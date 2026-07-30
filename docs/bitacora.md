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
tarifa. En realidad $186,121 es el _cargo variable excedente_ del bloque R6, y le faltaba
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
es 1336,8 (junio/26). Es la única pieza de conocimiento de MIDE que el scraper inyecta al
traducir el cuadro, y está marcada como tal en `TOPE_ULTIMO_BLOQUE`.

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

## El scraper, y lo que confirmó

`scraper/main.py` baja los cuadros del índice del ENRE y los emite en `scraper/cuadros.json`
(78 cuadros, 28 períodos, abr/2024 a jul/2026, Edenor N1/N2/N3 según el formato).

Dos resultados que valen más que el scraper en sí:

- **Reproduce exactos los 7 períodos que estaban cargados a mano**: 161 campos idénticos,
  cero diferencias. Confirma que la transcripción manual no tenía errores.
- **Trajo el cuadro de oct/25**, que no se había conseguido, y la fórmula predice sus dos
  precios al milésimo (`187,6299` y `282,3096` contra los `187,630` y `282,310` del
  comprobante 58350). Es la validación más limpia que tiene el modelo: ese período **no
  participó de derivar la fórmula**, así que no puede haber ajuste circular. Con eso el
  comprobante 58350 entró a `casos.ts` y ya son **12 de 12** los tickets reproducidos.

Dos cosas que costaron y conviene no volver a descubrir:

- **El ENRE rechaza el handshake TLS de OpenSSL 3** (`SSLV3_ALERT_HANDSHAKE_FAILURE`). Se
  resuelve bajando a `SECLEVEL=1`. Se probó que no hace falta forzar TLS 1.2 ni renegociación
  legacy, y el certificado se sigue verificando.
- **El formato de los cuadros cambió en febrero de 2026**, no en enero como se había supuesto:
  enero todavía traía tres niveles. Por eso el scraper elige el parser mirando los `<h4>`
  presentes y no la fecha. Desde feb/26 **N3 dejó de publicarse**.

## El backend, eliminado

Había un scaffold de Go + Gin (`backend/`, 47 líneas: `/health` y nada más). Se eliminó en la
rama `feat/scraper-enre`.

El razonamiento, por si alguna vez se plantea de nuevo: su propósito declarado en `idea.md`
era servir una API de tarifas, y eso quedó cubierto por el scraper emitiendo un JSON que la
app embebe. Nada de lo que está en "futuras mejoras" necesita servidor — el historial de
cargas es AsyncStorage y los avisos de consumo se hacen con notificaciones locales, porque el
cálculo corre en el dispositivo. Tampoco lo necesita la actualización remota de tarifas, que
va a resolverse con un GitHub Action publicando el JSON.

Dos señales de que era scaffolding sin dueño: el diagrama de flujo de datos de `idea.md` ya no
lo incluía, y el scaffold era Go+Gin mientras `idea.md` decía Node.js + Express.

**Volvería a tener sentido** con features que necesiten estado compartido: cuentas,
sincronización entre dispositivos o notificaciones push reales. Si aparece alguna, recuperarlo
es `git checkout f198660 -- backend/`, o rehacerlo desde cero en minutos.

## Próximo paso

El motor está completo para el rango que importa. Lo que más valor agrega ahora:

- **Actualización remota**, que es el requisito previo a Play Store. Como las tarifas cambian
  todos los meses, un JSON embebido obligaría a un release mensual y los usuarios que no
  actualizan calcularían mal. Plan: un GitHub Action con cron que corra el scraper y commitee
  el JSON, y la app leyéndolo con cache y fallback al embebido. Sin hosting.
- **N1 y N3**: el scraper ya los baja y la derivación los cubre. Falta poder elegir el nivel
  en la pantalla; con eso la app sirve para cualquiera, no solo para este medidor.
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
  se escribe o edita. Para una pasada completa está la skill `/formatear`. Python queda
  afuera: no hay formateador configurado para el scraper.
- **Los casos de prueba** (`app/domain/casos.ts`) no son un framework: es un script que se
  corre con `npx tsx domain/casos.ts`. Acumula fallos y sale con código 1, en vez de tirar en
  el primero.
- **Las tolerancias de los tests están justificadas en comentarios**, no son arbitrarias: el
  ticket imprime los kWh con 1 decimal y el $/kWh con 3, y el emisor no redondea de forma
  consistente (en un ticket redondea el milésimo hacia arriba y en otro lo trunca).
- **El scraper tiene su propio test** (`uv run scraper/main.py --check`): baja un período de
  cada formato y compara contra valores validados con comprobantes. No depende de la app, así
  que sigue sirviendo si alguna vez se separan.
- **`cuadrosEnre.json` lo genera el scraper y trae los tres niveles**, pero `cuadrosEnre.ts` lo
  filtra a Edenor N2. Ese filtro no es cosmético: `cuadroDe()` busca solo por período, así que
  sin él el motor tomaría el primer nivel que matchee y calcularía con la tarifa sin subsidio
  sin que nada falle. El caso 3 de `casos.ts` lo cubre, y usa el tramo ≤150 como discriminante
  porque del ≤500 en adelante N1 y N2 dan **el mismo precio** (el consumo base ya está agotado
  y el excedente se cobra pleno). Esa igualdad es, leída desde el cuadro, la razón de que los
  tickets con acumulado alto impriman "Subsidio Estado Nacional: $0,00".
- **El JSON tiene períodos anteriores al primer comprobante** (llega hasta abr/2024). Para
  esos, `tasaMunicipalDe()` no encuentra ningún valor previo y devuelve 0, así que una recarga
  simulada en 2024 no cobraría tasa municipal. No afecta el uso real —la app usa el período
  vigente— ni los tests, donde cada ticket trae su tasa conocida.
- **Verificación visual**: `pnpm web` levanta la app en el navegador sin necesidad de
  emulador. Al matar el proceso, Metro suele quedar vivo ocupando el puerto.
