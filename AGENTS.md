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
│   ├── App.tsx
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

El MVP calcula **100% en el cliente**: el motor de cálculo (subsidio, tramos
tarifarios, factor de ajuste MIDE) es lógica pura en TypeScript dentro de `app/`,
alimentada por un JSON de tarifas embebido localmente. La app no depende del backend
para funcionar (modo offline, ver `docs/idea.md`).

El backend Go+Gin es opcional: cuando exista, expondrá `GET /tarifas` para que la app
actualice el JSON local cuando haya conexión. El scraper Python alimenta ese JSON de
forma batch:

```
Scraper (Python) → JSON de tarifas → backend (Go+Gin) → app (React Native)
                                    ↘ (o directo, embebido) ↗
```

Ninguno de los dos (`backend/`, `scraper/`) es necesario para el MVP; están
scaffoldeados para no bloquear cuando se necesiten.

## Convenciones

- **Motor de cálculo** (`app/`): debe vivir en un módulo TypeScript puro, sin
  dependencias de React Native, para poder testearlo aislado del renderizado.
- **Go** (`backend/`): layout estándar `cmd/` (entrypoints) + `internal/` (handlers,
  lógica, no importable desde fuera del módulo). Se crea `internal/` recién cuando
  haya handlers reales, no antes.
- **No agregar dependencias nuevas** (navegación, gráficos, testing, etc.) hasta que
  una feature concreta las necesite. Evitar abstracciones o configuración anticipada.

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

## Pendiente de definir

- Implementación del motor de cálculo (modelo de `Tarifa`, fórmula de kWh — ver
  `docs/idea.md`).
- Endpoints reales del backend más allá de `/health`.
- Lógica del scraper.
