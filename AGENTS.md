# Calculadora / Simulador de Consumo MIDE (Edenor)

Ver `docs/idea.md` para el detalle completo del producto (problema, funcionalidades,
modelo de cálculo). Este archivo documenta la arquitectura técnica y las convenciones
del repo.

## Stack

- **Frontend**: React Native + Expo (TypeScript, strict).
- **Scraper**: Python con `uv` — baja los cuadros tarifarios del ENRE.

No hay backend. Ver "Por qué no hay backend" más abajo.

## Estructura del repo

```
mide-app/                 raíz del repo
├── .github/workflows/    tarifas.yml — cron diario que corre el scraper y commitea el JSON
├── docs/                 documentación de producto (idea.md, etc.)
├── app/                  frontend React Native + Expo
│   ├── App.tsx           navegación (stack) y providers
│   ├── domain/           motor de cálculo — TypeScript puro, sin React
│   ├── screens/          pantallas
│   ├── ui/               tokens visuales y componentes de presentación
│   ├── store/            estado (zustand), validación (zod) y la bajada de cuadros
│   ├── index.ts
│   ├── app.json
│   ├── package.json      (pnpm)
│   └── assets/           iconos — generados, no editados a mano
├── scripts/              iconos.py — regenera los iconos de app/assets/
└── scraper/              baja los cuadros del ENRE (Python)
    ├── main.py
    └── requirements.txt
```

## Arquitectura

El MVP calcula **100% en el cliente**: el motor de cálculo es lógica pura en TypeScript
dentro de `app/domain/`, alimentado por los cuadros tarifarios del ENRE embebidos en
`app/domain/cuadrosEnre.json`. La app funciona sin conexión y no depende de ningún servicio.

El flujo de datos importa para entender el diseño: los precios por tramo que cobra MIDE
**se derivan** del cuadro T1-R del ENRE, no se copian de los comprobantes. Los tickets son
el set de validación. Ver el README para la fórmula.

```
Action (cron) → commitea cuadrosEnre.json → raw.githubusercontent
                                                    │
                        JSON embebido en el bundle  │  (fallback)
                                       └────────────┴──→ motor → pantalla
```

**La actualización remota está completa.** El Action mantiene el JSON del repo al día y la app
lo baja al arrancar, lo valida con zod, lo cachea en AsyncStorage y cae al embebido si algo
falla. Un cuadro nuevo llega al celular sin publicar en Play Store. Ver
`docs/actualizacion-remota.md`.

Los cuadros activos se reemplazan en runtime, y por eso lo vigente son **funciones**
(`periodoVigente()`, `tarifaVigente()`) y no constantes: una constante congela el valor en el
import y la pantalla seguiría calculando con el cuadro viejo. `usarCuadros()` concentra la
regla de qué origen gana; `normalizarCuadros()` es el único filtro a Edenor N2 y lo usan tanto
el embebido como el remoto.

## Por qué no hay backend

Hubo un scaffold de Go + Gin con solo `/health`, eliminado en `feat/scraper-enre`. Su
propósito declarado era servir las tarifas, y eso lo cubre el scraper emitiendo un JSON
embebido. Nada de lo que está planeado necesita servidor: el historial de cargas es
AsyncStorage y los avisos de consumo se hacen con notificaciones locales de Expo, porque el
cálculo es local.

La actualización remota de tarifas —necesaria para no republicar en Play Store cada vez que
cambia una tarifa— tampoco lo necesitó: es un GitHub Action con cron que corre el scraper y
commitea el JSON, más la app leyéndolo de `raw.githubusercontent` y cacheándolo con el embebido
como fallback. Está funcionando y no hay nada servido por nosotros.

Un backend recién tendría sentido con features que necesiten estado compartido: cuentas,
sincronización entre dispositivos o notificaciones push reales. Si aparece alguna, rehacer el
scaffold son minutos, y el que había está en la historia de git.

## Convenciones

- **Motor de cálculo** (`app/domain/`): TypeScript puro, sin dependencias de React
  Native, para poder testearlo aislado del renderizado. Las pantallas lo consumen;
  nunca al revés. Esto es lo que permite correr `casos.ts` con `tsx` en Node, así que la red y
  la persistencia van en `store/`: un import de AsyncStorage dentro de `domain/` rompe los
  casos de prueba.
- **UI**: navegación con `@react-navigation/native-stack`, estado con `zustand`,
  validación de formularios con `zod`. El store guarda la entrada cruda (texto) y la
  validación la convierte; el cálculo se deriva en la pantalla, no en el store.
- **Presentación** (`app/ui/`): `theme.ts` es la única fuente de colores y tipografías —las
  pantallas no declaran hex propios— y expone las dos variantes de tema. Los colores de los
  tramos se interpolan a partir del **precio real** de cada uno (`coloresDeTramos()`) y no del
  orden: la escalera no es monótona, así que un color por índice pintaría el tramo más barato
  como el más caro.
- **Iconos** (`app/assets/`): son **generados**, no se editan a mano. La marca es el monograma
  M en Archivo Black —la misma tipografía de la app— sobre el fondo oscuro del tema, con la
  rampa de precios como base. `scripts/iconos.py` los rehace a partir de los tokens de
  `theme.ts` y de la TTF que ya está en `node_modules`; retocar un PNG suelto los desincroniza.
- **Scraper** (`scraper/`): Python con `uv`. Las dependencias van inline en `main.py`
  (PEP 723) para que corra con un comando y sin venv. Si el HTML del ENRE no tiene la forma
  esperada, falla en vez de adivinar.
- **No agregar dependencias nuevas** (gráficos, testing, etc.) hasta que una feature concreta
  las necesite. Evitar abstracciones anticipadas. `@react-native-async-storage/async-storage`
  entró bajo esta regla, para el cache de cuadros; `axios` se sacó por no usarse en ningún
  lado, y `date-fns` sigue instalado sin usarse. `expo-font`, `@expo-google-fonts/archivo` y
  `@expo/vector-icons` entraron con el rediseño de la pantalla: la identidad tipográfica no se
  puede resolver con la fuente del sistema, y los tres íconos del salto y de los plegables
  serían glifos de texto que no escalan igual entre plataformas. La escalera, en cambio, se
  dibuja con `View`: no hace falta una librería de gráficos.
- **Formateo**: Prettier para TS/JSON/Markdown. Un hook `PostToolUse` formatea cada archivo
  al escribirlo; para una pasada completa está la skill `/formatear`.

## Convenciones de commit

- **Formato**: [Conventional Commits](https://www.conventionalcommits.org/) —
  `tipo(área): descripción`.
- **Tipos**: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.
- **Áreas**: `app`, `scraper`. Omitir el área si el cambio no pertenece a una (ej. docs de
  la raíz).
- **Idioma**: inglés, en imperativo.

```
feat(app): add tariff bracket calculation engine
fix(app): correct rounding at subsidy crossover
feat(scraper): scrape the ENRE T1-R rate schedules
docs: document commit conventions
```

## Comandos de desarrollo

```bash
# Frontend
cd app
pnpm install
pnpm start         # expo start
pnpm android       # expo start --android
pnpm web           # expo start --web

npx tsc --noEmit          # typecheck
npx tsx domain/casos.ts   # casos de prueba del motor

# Scraper (desde la raíz)
uv run scraper/main.py            # trae el último cuadro publicado
uv run scraper/main.py --check    # valida los parsers

# Iconos (desde la raíz, después de `pnpm install`)
uv run scripts/iconos.py          # regenera app/assets/
```

## Reglas del motor de cálculo

Estas no son preferencias de estilo: salen de haber construido tres modelos falsos antes
del actual. La historia está en `docs/bitacora.md`.

- **Los precios se derivan del cuadro del ENRE, no se copian de los tickets.** Los
  comprobantes son el set de validación. Para cargar un período nuevo se corre el scraper y
  los precios salen solos; `cuadrosEnre.json` no se edita a mano.
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
- **Qué hacer si el ENRE cambia la escalera de bloques.** El esquema exige que los topes sean
  exactamente `TOPES_KWH`, porque `TOPE_TASA_MUNICIPAL_KWH = 600` asume que 600 es un tope y de
  ahí sale que la inversa monto → kWh sea exacta. Con otra escalera la app rechaza el cuadro
  nuevo y se queda con el viejo. Es la dirección segura, pero deja de actualizarse en silencio:
  si alguna vez pasa, hay que revisar el modelo y publicar una versión.
