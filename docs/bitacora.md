# Bitácora — dónde estamos y qué sigue

Contexto de trabajo para retomar el proyecto. El modelo vigente está documentado en el
[README](../README.md); acá va lo que no se deduce del código: qué se probó, qué se
descartó y por qué, y qué falta averiguar.

## La lección principal, y su matiz

Se construyeron **cuatro modelos de cálculo** y los tres primeros resultaron falsos:

1. **Tramos progresivos con subsidio** (el de `calculoKWH.md`): los primeros N kWh a precio
   subsidiado, el excedente a precio pleno. Derivado de razonar sobre el producto, sin
   datos.
2. **Categorías T1-R con cargo fijo**, derivado del cuadro tarifario del ENRE. Producía
   "acantilados" de $8.000–13.000 al cruzar de categoría, que resultaron no existir.
3. **Precio único por recarga**, según el tramo del acumulado. Derivado de un comprobante
   real, que reproducía exacto — pero era el único que se tenía, y caía entero en un tramo.
4. **El actual**: escalera progresiva, precios derivados del cuadro del ENRE, impuestos y
   tasa municipal que salen del monto recargado.

Durante mucho tiempo la conclusión operativa fue **"no modelar la facturación a partir de
documentación; conseguir un comprobante primero"**. Sigue siendo cierta como orden de
trabajo, pero hay que leerla con cuidado, porque llevó a un error caro:

**el cuadro del ENRE fue descartado por una comparación mal hecha.** Se contrastó su precio
más alto ($186,121/kWh) contra el del ticket ($233,477) y se concluyó que MIDE cobraba otra
tarifa. En realidad $186,121 es el *cargo variable excedente* del bloque R6, y le faltaba
sumarle el cargo fijo prorrateado. El cuadro **sí** es la fuente, y ese descarte costó
meses de creer que hacía falta un comprobante por mes para siempre.

La regla corregida: **los comprobantes son el set de validación, no la fuente.** Un modelo
derivado de documentación no se descarta por no cerrar al primer intento; se descarta
cuando falla contra tickets después de haber entendido bien la documentación.

## El modelo, y cómo se resolvió

La escalera de MIDE resultó ser el **costo marginal de la factura T1-R que MIDE no emite**,
entre topes de bloque. La fórmula está en el README y en `precioTramo()`.

El camino fue: los 12 comprobantes dieron 17 pares (tramo, precio) repartidos en 8 períodos;
se bajaron los cuadros del ENRE de 7 de esos períodos; y se buscó la regla que los conectara.
Hubo dos intentos fallidos que "casi" cerraban —error sistemático de −0,44 % en tres tramos
y de −16 % en otros— y la tentación de quedarse con el que mejor ajustaba era exactamente
el error de los modelos 1 y 2. La regla correcta cierra los 17 tramos dentro del último
dígito impreso, y de paso reproduce los importes en pesos de cada renglón.

**Criterio que conviene mantener: no aceptar una fórmula con error sistemático.** Un −0,44 %
repetido no es ruido de redondeo, es un término faltante. Ese fue el indicio de que la
fórmula candidata estaba mal, no aceptablemente aproximada.

## Preguntas que quedaron resueltas

- **El resto de la tabla de tramos.** Los topes son 150/400/500/600/700/1400 y coinciden con
  los bloques R1-R6 del cuadro. Ya no hace falta un comprobante por tramo.
- **Si el precio cambia dentro de una misma recarga.** Sí. El comprobante 58214 (13/07/26)
  viene de 611,2 kWh acumulados y cobra 88,8 kWh a $385,080 —los que faltaban para 700— más
  55,3 kWh a $233,477. `700 − 611,2 = 88,8` exacto.
- **Por qué "Subsidio Estado Nacional: $0,00".** Porque el subsidio se concentra en los
  tramos bajos y esas recargas no compraron kWh subsidiados. Dos comprobantes del mismo
  noviembre/25 lo prueban: el que arranca de 0 kWh tiene subsidio $24.202,86 y el que
  arranca en 696 kWh tiene $1.524,37. No es informativo para el cálculo — `Subtotal A`
  cierra sin usarlo.
- **La discrepancia con el ENRE.** No existía. Ver arriba.
- **Un tercer componente en el monto.** `A + B = COMPRA ACTUAL` era falso: falta la "Tasa
  Municipal", que es $/kWh sobre los kWh comprados por debajo de 600 kWh acumulados. El
  corte en 600 se verifica exacto en el comprobante 58350 (`600 − 577,4 = 22,6 kWh`).

## Preguntas abiertas

**1. El tramo de arriba de 1400 kWh.** El cuadro publica el último bloque como "+700" sin
techo, y MIDE lo trata como si el tope fuera 1400 (así lo imprime el ticket), pero de dónde
sale ese 1400 no se sabe. Puede ser que MIDE no venda más de 1400 kWh en un mes, o que haya
otro bloque. _Lo resuelve:_ un comprobante con más de 1400 kWh acumulados. El máximo visto
es 1336,8 (junio/26).

**2. La tasa municipal del período vigente.** No la publica el ENRE —es del municipio— así
que solo se conoce por tickets: $3,4933/kWh en oct-dic/25 y $5,2400/kWh en feb-abr/26. Para
jun-jul/26 se hereda el último valor y la app lo avisa. _Lo resuelve:_ un comprobante que
compre por debajo de 600 kWh acumulados en el período vigente.

**3. Por qué el IVA da 20,984 % y no 21 %.** Sobre el comprobante 58349, donde `A + B` cierra
exacto, el IVA es 6.588,88/31.400 = 20,984 % y la contribución municipal 6,4047 % en vez de
6,4155 %. El emisor factura sobre una base levemente menor a `Subtotal A` y no se sabe por
qué. Se usan los valores empíricos porque son los que cierran. Impacto: 0,02 % del
multiplicador, unos 0,04 kWh en una recarga de $60.000 — es cosmético, no urgente.

**4. Cómo se calcula el "Subsidio Estado Nacional" que imprime el ticket.** No hace falta
para el cálculo, pero no se logró derivar de los cuadros. Curiosidad pendiente.

## Próximo paso

El motor está completo para el rango que importa. Lo que más valor agrega ahora:

- **El scraper** (`scraper/`, hoy vacío). Los cuadros se cargan a mano en `cuadrosEnre.ts`;
  automatizarlo mantiene la app al día sin tocar código. El índice del ENRE está en
  `enre.gov.ar/web/tarifasd.nsf/todoscuadros?openview`, un documento por período, y los IDs
  de los 7 cargados están en el campo `fuente` de cada cuadro.
- **N1 y N3**: el cuadro los trae, así que la derivación ya los cubre. Falta cargarlos y
  poder elegir el nivel; con eso la app sirve para cualquiera, no solo para este medidor.
- **Simulación temporal**, que era la idea original del producto y hasta ahora estaba
  bloqueada por no tener la tabla.

## Estado del repo

Rama de trabajo: **`feat/motor-calculo`**, con upstream en `origin`. `main` quedó bastante
atrás. Existe también una rama `dev` local, sin pushear.

Los commits `751698d` y `baf3691` implementan y documentan el **modelo 2**, el de categorías,
que está desmentido. Conviene tenerlo presente al leer la historia: describen algo que no es
cómo funciona MIDE.

## Cosas no obvias del repo

- **Los comprobantes están en `.transcripciones/`, fuera de git**, porque llevan nombre,
  dirección, CUIT y número de medidor. Por eso los casos de prueba tienen los números
  hardcodeados: tienen que poder correr sin los tickets. Los cuadros del ENRE, en cambio,
  son públicos y están en git — son la fuente del cálculo.
- **El "kWh Acumulados" del ticket es el de DESPUÉS de acreditar la recarga.** Para usarlo
  como acumulado previo hay que restarle los kWh comprados. Las cadenas cierran entre
  tickets consecutivos (julio/26: 611,2 → 755,3 → 957,0 → 1125,1), que es lo que confirma
  tanto la lectura del campo como el reseteo mensual. El caso de prueba original tenía este
  error y pasaba por casualidad, porque el acumulado correcto y el equivocado caían en el
  mismo tramo.
- **Un hook `PostToolUse`** en `.claude/settings.json` corre Prettier sobre cada archivo que
  se escribe o edita. Para una pasada completa está la skill `/formatear`, que además corre
  `gofmt` sobre `backend/`.
- **Los casos de prueba** (`app/domain/casos.ts`) no son un framework: es un script que se
  corre con `npx tsx domain/casos.ts`. Acumula fallos y sale con código 1, en vez de tirar en
  el primero.
- **Las tolerancias de los tests están justificadas en comentarios**, no son arbitrarias: el
  ticket imprime los kWh con 1 decimal y el $/kWh con 3, y el emisor no redondea de forma
  consistente (en un ticket redondea el milésimo hacia arriba y en otro lo trunca).
- **Falta el cuadro de octubre 2025**, así que el comprobante 58350 (30/10/25) no se puede
  contrastar y quedó fuera de los casos. Es el único de los 12 sin testear.
- **Verificación visual**: `pnpm web` levanta la app en el navegador sin necesidad de
  emulador. Al matar el proceso, Metro suele quedar vivo ocupando el puerto.
