# Calculadora / Simulador de Consumo MIDE (Edenor)

Ver `docs/idea.md` para el detalle completo del producto (problema, funcionalidades,
modelo de cálculo). Este archivo documenta la arquitectura técnica y las convenciones
del repo.

## Stack

- **Frontend**: React Native + Expo (TypeScript, strict).
- **Backend**: Go + Gin — opcional/futuro, no es una dependencia crítica del MVP.
- **Scraper**: Python — futuro, extrae tarifas del ENRE. Todavía sin lógica.

## Estructura del repo (monorepo)

```
mide-app/                 raíz del repo
├── docs/                 documentación de producto (idea.md, etc.)
├── app/                  frontend React Native + Expo
│   ├── App.tsx           navegación (stack) y providers
│   ├── domain/           motor de cálculo — TypeScript puro, sin React
│   ├── screens/          pantallas
│   ├── store/            estado (zustand) y validación de formularios (zod)
│   ├── index.ts
│   ├── app.json
│   ├── package.json      (pnpm)
│   └── assets/
├── backend/               API Go + Gin
│   ├── go.mod
│   └── cmd/api/main.go
└── scraper/               scraping de tarifas (Python, futuro)
    ├── main.py
    └── requirements.txt
```

## Arquitectura

El MVP calcula **100% en el cliente**: el motor de cálculo es lógica pura en TypeScript
dentro de `app/domain/`, alimentada por los cuadros tarifarios del ENRE embebidos en
`cuadrosEnre.ts`. La app no depende del backend para funcionar (modo offline, ver
`docs/idea.md`).

El flujo de datos importa para entender el diseño: los precios por tramo que cobra MIDE
**se derivan** del cuadro T1-R del ENRE, no se copian de los comprobantes. Los tickets son
el set de validación. Ver el README para la fórmula.

El backend Go+Gin es opcional: cuando exista, expondrá `GET /tarifas` para que la app
actualice los cuadros cuando haya conexión. El scraper Python los alimenta de forma batch
desde el índice público del ENRE:

```
Scraper (Python) → cuadros del ENRE → backend (Go+Gin) → app (React Native)
                                     ↘ (o directo, embebido) ↗
```

Ninguno de los dos (`backend/`, `scraper/`) es necesario para el MVP; están
scaffoldeados para no bloquear cuando se necesiten.

## Convenciones

- **Motor de cálculo** (`app/domain/`): TypeScript puro, sin dependencias de React
  Native, para poder testearlo aislado del renderizado. Las pantallas lo consumen;
  nunca al revés.
- **UI**: navegación con `@react-navigation/native-stack`, estado con `zustand`,
  validación de formularios con `zod`. El store guarda la entrada cruda (texto) y la
  validación la convierte; el cálculo se deriva en la pantalla, no en el store.
- **Go** (`backend/`): layout estándar `cmd/` (entrypoints) + `internal/` (handlers,
  lógica, no importable desde fuera del módulo). Se crea `internal/` recién cuando
  haya handlers reales, no antes.
- **No agregar dependencias nuevas** (gráficos, testing, persistencia, etc.) hasta que
  una feature concreta las necesite. Evitar abstracciones anticipadas.
- **Formateo**: Prettier para TS/JSON/Markdown y `gofmt` para Go. Un hook
  `PostToolUse` formatea cada archivo al escribirlo; para una pasada completa está la
  skill `/formatear`.

## Convenciones de commit

- **Formato**: [Conventional Commits](https://www.conventionalcommits.org/) —
  `tipo(área): descripción`.
- **Tipos**: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.
- **Áreas** (según el monorepo): `app`, `backend`, `scraper`. Omitir el área si el
  cambio no pertenece a una (ej. docs de la raíz).
- **Idioma**: inglés, en imperativo.

```
feat(app): add tariff bracket calculation engine
fix(app): correct rounding at subsidy crossover
docs: document commit conventions
chore(backend): initial scaffold
```

## Comandos de desarrollo

```bash
# Frontend
cd app
pnpm install
pnpm start        # expo start
pnpm android       # expo start --android
pnpm web           # expo start --web

# Backend
cd backend
go run ./cmd/api   # sirve en :8080, GET /health
```

## Comunicación frontend/backend

No hay dependencia en el MVP. Cuando el backend exista de verdad, la URL base de la
API y el manejo de errores/timeout se documentan acá.

## Reglas del motor de cálculo

Estas no son preferencias de estilo: salen de haber construido tres modelos falsos antes
del actual. La historia está en `docs/bitacora.md`.

- **Los precios se derivan del cuadro del ENRE, no se copian de los tickets.** Los
  comprobantes son el set de validación. Si hace falta cargar un período nuevo, se agrega
  el cuadro a `cuadrosEnre.ts` y los precios salen solos.
- **Fuera de la escalera conocida el motor lanza error, no extrapola.** Hoy eso significa
  acumulados de más de 1400 kWh. Un número inventado que parece razonable es peor que no
  dar ninguno.
- **No aceptar una fórmula con error sistemático.** Un desvío constante (por ejemplo −0,44 %
  repetido en varios tramos) es un término faltante, no ruido de redondeo. Las dos fórmulas
  candidatas que se descartaron fallaban así.
- **Todo cambio al modelo empieza por un comprobante que lo justifique**, y se agrega como
  caso en `casos.ts`.

## Pendiente de definir

- **El tramo de arriba de 1400 kWh.** El cuadro publica el último bloque como "+700" sin
  techo; MIDE lo trata como si el tope fuera 1400 y de ahí no se pasa. Hace falta un
  comprobante con ese acumulado.
- **La tasa municipal del período vigente**, que el ENRE no publica y hoy se hereda del
  último período con comprobante.
- Por qué el IVA de los comprobantes da 20,984 % y no 21 %.
- Cómo se calcula el "Subsidio Estado Nacional" que imprime el ticket (no hace falta para
  el cálculo).
- Endpoints reales del backend más allá de `/health`.
- Lógica del scraper.
