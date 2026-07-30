# Scraper de cuadros tarifarios (ENRE)

Extrae los cuadros **T1-R de Edenor** que publica el ENRE y los emite en
`app/domain/cuadrosEnre.json`, que es de donde el motor los lee. Tienen el shape del tipo
`CuadroEnre` de `app/domain/types.ts`.

Se escribe dentro de `app/` porque es el consumidor y porque Metro, el bundler de Expo, no
resuelve imports que salgan de la raíz del proyecto sin configurarle `watchFolders`.

Estos cuadros son la fuente del cálculo: el motor **deriva** de ellos los precios por tramo
que cobra MIDE (ver `precioTramo()` en `app/domain/tarifas.ts`). Los comprobantes de recarga
son el set de validación, no la fuente.

## Correrlo

Con [uv](https://docs.astral.sh/uv/), que resuelve las dependencias solo — no hace falta
instalar Python ni crear un venv:

```bash
uv run scraper/main.py                    # el último cuadro publicado (default)
uv run scraper/main.py --todos            # todos los períodos del índice
uv run scraper/main.py --periodo 2025-10  # uno puntual
uv run scraper/main.py --check            # valida los parsers y no escribe nada
```

El default es lo que se quiere para mantenerse al día: toma el primero del índice del ENRE,
que es el más reciente. Si ese período ya está en el JSON no lo duplica, y si cambió lo
reemplaza avisando.

`--check` es el test del scraper: baja un período de cada formato y compara contra valores
que están validados contra comprobantes reales de MIDE. Si eso falla, el scraper está roto.

## Los dos formatos de cuadro

El ENRE cambió la estructura de los cuadros en **febrero de 2026**, y los dos siguen
importando porque el motor valida contra comprobantes de 2025 y de 2026.

|                     | Hasta 2026-01                                                                 | Desde 2026-02                                              |
| ------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Secciones (`<h4>`)  | `Nivel 1 altos ingresos`, `Nivel 2 bajos ingresos`, `Nivel 3 ingresos medios` | `sin subsidio`, `con subsidio`                             |
| Niveles disponibles | N1, N2, N3                                                                    | N1, N2 (**N3 ya no está**)                                 |
| Cargos variables    | `Cargo Variable hasta 350` + `excedente a 350`                                | `Cargo Variable consumo base` + `excedente a consumo base` |
| Consumo base        | En el propio label; **cambia por nivel** (N2 usa 350, N3 usa 250)             | En una nota al pie, y es **estacional**                    |

La nota del formato nuevo:

> Períodos dic/feb y mayo/agosto: consumo base de 300 kWh/mes. Períodos marzo/abril y
> septiembre/noviembre: consumo base de 150 kWh/mes.

El scraper decide qué parser usar **mirando los `<h4>` presentes, no la fecha**. Fue lo
correcto: enero de 2026 todavía usaba el formato viejo, contra lo que se había supuesto.

### Mapeo de sección a nivel

| Sección                                   | Nivel                   |
| ----------------------------------------- | ----------------------- |
| `Nivel 1 altos ingresos` / `sin subsidio` | N1                      |
| `Nivel 2 bajos ingresos` / `con subsidio` | N2                      |
| `Nivel 3 ingresos medios`                 | N3 (solo formato viejo) |

`con subsidio → N2` está validado contra comprobantes: los tickets dicen "TARIFA RESIDENCIAL
NIVEL 2" y los precios derivados de esa sección los reproducen exactos. Sobre qué pasó con N3
en el régimen nuevo no se afirma nada — simplemente dejó de publicarse.

## Cosas no obvias

- **TLS.** El servidor del ENRE negocia ciphers que OpenSSL 3 rechaza por defecto
  (`SSLV3_ALERT_HANDSHAKE_FAILURE`). Hace falta bajar a `SECLEVEL=1`; ver `_TLSViejo` en
  `main.py`. El certificado se sigue verificando: solo se aceptan algoritmos más viejos.
- **Encoding.** Las páginas son ISO-8859-1 y no lo declaran de forma utilizable.
- **Números en formato inglés**: `1,356.90` es mil trescientos cincuenta y seis con noventa.
- **El tope de 1400 kWh del último bloque no sale del ENRE.** El cuadro publica `+700` sin
  techo; el 1400 es cómo lo trata MIDE, y sale del ticket ("Hasta 1400kWh"). Es la única
  pieza de conocimiento de MIDE que el scraper inyecta en la traducción.
- **Los niveles sin subsidio publican un solo cargo variable.** El scraper lo repite en el
  campo de excedente en vez de dejarlo en `null`, porque el motor multiplica los kWh
  excedentes por ese valor y un `null` se volvería un cobro de $0 en silencio. Su
  `consumoBaseKwh` queda en 0: no hay nada subsidiado.
- **Si el HTML no tiene la forma esperada, el scraper falla** en vez de adivinar
  (`ErrorDeFormato`). Con `--todos`, un período que falla no tumba la corrida: se saltea con
  un aviso.

## Estado

El JSON tiene 78 cuadros: 28 períodos (abr/2024 a jul/2026) × los niveles de cada formato.
`app/domain/cuadrosEnre.ts` lo importa y **filtra a Edenor N2**, que es el nivel del medidor de
los comprobantes. Ese filtro es necesario: `cuadroDe()` busca solo por período y sin él
tomaría el primer nivel que matchee, calculando con la tarifa sin subsidio sin que nada falle.
Hay un caso de prueba que lo cubre (`casos.ts`, caso 3).

Los otros niveles quedan en el JSON esperando el selector de nivel en la pantalla. Ojo: N3
dejó de publicarse desde feb/2026.

Falta el pipeline remoto —un GitHub Action que corra esto por cron y una URL que la app lea y
cachee—, que es el requisito previo a publicar en Play Store. Ver el README de la raíz.
