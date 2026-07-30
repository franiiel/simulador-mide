# Actualización remota de los cuadros tarifarios

Preparación para implementar el pipeline de GitHub que mantiene las tarifas al día sin
republicar la app. Acá va lo que no se deduce del código: por qué hace falta, qué decisiones
están tomadas, qué queda por decidir y las trampas concretas que ya se detectaron.

El scraper ya funciona (`scraper/main.py`, ver su README). Lo que falta es automatizarlo y que
la app consuma el resultado sin pasar por Play Store.

## Por qué hace falta

Las tarifas del ENRE cambian **todos los meses**. Hoy el JSON viaja embebido en el bundle, así
que actualizar precios significa publicar una versión nueva en Play Store, esperar la revisión
y esperar que la gente actualice.

El costo de no hacerlo es medible, no teórico: el tramo ≤1400 pasó de $222,893 (jun/26) a
$233,477 (jul/26), **+4,75 %**. Calcular julio con el cuadro de junio da 211,3 kWh en vez de
201,7 en una recarga de $60.000 — **9,6 kWh de error con un solo mes de atraso**, y en el
tramo que menos se movió. La tolerancia pedida para el producto es ±5 kWh.

Hay un segundo motivo, más importante a largo plazo: **si el ENRE cambia su HTML, se arregla
el scraper y todos los usuarios se benefician sin republicar.** Esa es la razón por la que la
app no debe scrapear el ENRE directamente — ahí cada cambio del ENRE obligaría a un release.

## Arquitectura decidida

```
GitHub Action (cron)
  └─ uv run scraper/main.py
      └─ commitea app/domain/cuadrosEnre.json
          └─ la app lo lee por HTTP, lo valida, lo cachea
              └─ sin red o JSON inválido → cae al embebido en el bundle
```

**Sin backend y sin hosting.** Se evaluó desplegar el scaffold de Go que había y se descartó:
para servir un archivo que cambia una vez al mes no hace falta un servicio 24/7. El scaffold se
eliminó (ver "El backend, eliminado" en `bitacora.md`); si alguna vez hace falta, está en la
historia de git.

El JSON embebido **no desaparece**: es el fallback offline y lo que usa una instalación nueva
sin red. Se actualiza solo cuando se publica una versión de la app.

## Decisiones tomadas

### 1. El Action commitea a `main`, y la app va a leer de ahí

La app lee de una URL fija y el branch queda **cableado en el cliente**, así que cambiarlo
después obliga a republicar. Por eso apunta a `main` y no a una rama de feature:

```
https://raw.githubusercontent.com/franiiel/simulador-mide/main/app/domain/cuadrosEnre.json
```

`main` quedó al día (venía 14 commits atrás) y se le sacó la protección, que exigía una
aprobación de PR imposible de conseguir en un repo de una sola persona y además le habría
rechazado el push al bot.

### 2. `raw.githubusercontent`, no GitHub Pages

El repo es público y no hay nada que configurar. `raw` no está pensado como CDN de producción
y cachea unos minutos, irrelevante para un archivo mensual. Pages es más correcto si la app
alguna vez se distribuye en serio; migrar implica republicar, y se acepta ese costo.

### 3. Cron diario

Los cuadros aparecen a principio de mes, pero no en un día fijo, así que un cron mensual el
día 1 puede correr antes de que el ENRE publique. El scraper en modo default hace 2 requests
(índice + último cuadro) y no escribe nada si el período ya está: correrlo seguido es barato y
silencioso.

## Trampas ya detectadas

Estas costaron trabajo de encontrar. No repetirlas.

**TLS.** El servidor del ENRE negocia ciphers que OpenSSL 3 rechaza por defecto; sin el
`SECLEVEL=1` de `_TLSViejo` en `main.py`, todo request muere con
`SSLV3_ALERT_HANDSHAKE_FAILURE`. Está resuelto en código, pero **verificar que funciona en el
runner de Ubuntu**: su OpenSSL puede tener una política distinta a la de Windows. Es lo primero
que hay que probar en CI, porque si falla ahí no falla en local.

**Line endings.** `escribir_salida()` fuerza LF a propósito. Si eso se rompe, el Action
regenerando el JSON en Linux produciría un diff de ~3.500 líneas por corrida. Verificar que el
primer commit del Action **no cambie nada** si el período ya estaba.

**El Action tiene que poder commitear.** Hace falta `permissions: contents: write` en el
workflow. Y usar `astral-sh/setup-uv`, no instalar Python a mano: las dependencias van inline en
`main.py` (PEP 723) y `uv run` las resuelve solo.

**Un formato nuevo debe fallar ruidosamente.** El scraper lanza `ErrorDeFormato` en vez de
adivinar, así que el Action va a fallar y GitHub va a avisar por mail. Eso es lo deseado: es
preferible no actualizar que publicar números mal parseados. Ojo con `--todos`, que saltea los
períodos que fallan con un aviso: **para el Action usar el modo default**, que trae solo el
último y falla fuerte si no lo entiende.

**El filtro de nivel.** `cuadrosEnre.json` trae N1, N2 y N3, y `cuadroDe()` busca solo por
período. `cuadrosEnre.ts` filtra a Edenor N2 y hay un caso de prueba que lo cubre (caso 3 de
`casos.ts`). Cualquier cambio en cómo la app carga el JSON tiene que preservar ese filtro: sin
él calcularía con la tarifa sin subsidio **sin que nada falle**.

## El lado de la app

Era la parte delicada, porque acá los errores no se ven: el peor caso no es que la app falle
sino que calcule bien con datos equivocados. Así quedó resuelto.

**Un solo filtro.** `normalizarCuadros()` (en `domain/cuadrosEnre.ts`) se exporta y lo usan
tanto el embebido como el remoto. Dos filtros parecidos hacia los mismos datos es exactamente
cómo se cuela un cuadro N1 —sin subsidio— sin que nada avise.

**Lo vigente son funciones, no constantes.** `periodoVigente()` y `tarifaVigente()` reemplazaron
a `PERIODO_VIGENTE` y `TARIFA_VIGENTE`. Como defaults de parámetro se evalúan en cada llamada,
así que el motor no cambió: ya recibía `tarifa` explícita en todas sus funciones.

**`usarCuadros()` concentra qué origen gana**: rechaza lista vacía (un JSON válido puede quedar
en nada después del filtro), rechaza un período máximo menor al vigente, y acepta mayor o igual.
Una vez que entró un cuadro nuevo, ni el embebido puede hacerlo retroceder.

**Validación con zod** en `domain/esquemaCuadros.ts`. `parsearCuadros()` devuelve `null` en vez
de lanzar: un remoto inválido se descarta y la app sigue con lo que tenía. El chequeo menos
obvio es que los topes de `bloques` sean exactamente `TOPES_KWH` — ver el trade-off abajo.

**El esquema no puede ser más estricto que los datos reales.** Ya falló una vez: pedir
`consumoBaseKwh > 0` tiraba los 2024 enteros, que legítimamente lo traen en cero (N1 no tiene
subsidio, y N2 tampoco lo tuvo hasta mediados de ese año). El caso 9 de `casos.ts` valida el
JSON embebido contra el esquema justamente para atrapar eso: un esquema de más rechazaría el
archivo bueno y la app dejaría de actualizarse **en silencio y para siempre**.

**No bloquea el arranque.** El store arranca con el embebido ya resuelto y `App.tsx` dispara
`refrescar()` en un `useEffect` sin `await`. La pantalla se actualiza sola cuando el store
cambia.

**`.text()` + `JSON.parse()` a mano**, no `res.json()`: la URL puede devolver 200 con algo que
no es JSON (un README, una página de error), y así el fallo cae en el `catch` en vez de
propagarse.

**Dependencias.** Entró `@react-native-async-storage/async-storage` (2.2.0) para el cache, que
es la única forma de cubrir el arranque sin red. Se sacó `axios`, que estaba declarado y no se
importaba en ningún lado; el `fetch` nativo alcanza. `date-fns` sigue instalado sin usarse.

**Consecuencia esperada, no bug:** cuando el Action agregue un período nuevo, el vigente pasa a
ser ese automáticamente y **la tasa municipal se hereda** del último período con comprobante,
porque el ENRE no la publica. La app ya avisa en pantalla cuando la está heredando. No hay nada
que arreglar, pero conviene saber que un cuadro nuevo activa ese aviso.

**Trade-off asumido con la escalera.** El esquema rechaza un cuadro cuyos bloques no sean
`TOPES_KWH`, porque `TOPE_TASA_MUNICIPAL_KWH = 600` asume que 600 es un tope: de ahí sale que el
costo marginal sea constante dentro del tramo y que la inversa monto → kWh se resuelva con una
división. Con otra escalera esa propiedad se cae sin que nada falle. Si el ENRE algún día cambia
los bloques de verdad, la app se queda con el cuadro viejo hasta que se publique una versión —
viejo es mejor que mal, pero deja de actualizarse en silencio.

## Verificación

Toda hecha. Los caminos de la app se probaron con `pnpm web` apuntando `URL` a propósito a
cosas distintas, y borrando `localStorage` entre corridas.

1. **El Action en seco, con `workflow_dispatch`**: que el TLS del ENRE funcione en Ubuntu y que
   no genere diff cuando el período ya está.
2. **Un caso real de actualización**: eliminar el último período del JSON, correr el Action y
   ver que lo vuelve a agregar en un commit limpio.
3. **`npx tsx domain/casos.ts`** es el test del motor y **`uv run scraper/main.py --check`** el
   del scraper: los 12 comprobantes tienen que pasar después de cualquier cambio en cómo se
   cargan los cuadros.
4. **Con red**: baja el remoto, muestra la fecha del fetch y calcula. Contrastado con el
   comprobante 58213 ($60.000 sobre 755,3 kWh acumulados → 201,7 kWh a $233,477/kWh).
5. **Sin red y con cache**: apuntar `URL` a un host inalcanzable. Usa el cache y muestra la
   fecha del fetch anterior.
6. **Sin red ni cache**: "Tarifas de la versión instalada", y calcula igual.
7. **Un remoto más viejo no pisa al que hay**: apuntar `URL` al JSON de un commit anterior.
8. **JSON remoto corrupto**: apuntar `URL` al README, que responde 200 con algo que no es JSON.
   Se descarta, se avisa por consola y el cache no se ensucia.

## Estado

**Las dos mitades están hechas y verificadas.** Un cuadro nuevo del ENRE llega al celular sin
pasar por Play Store.

### El Action

`.github/workflows/tarifas.yml`, cron diario a las 09:00 UTC más `workflow_dispatch`.

- Corrida en seco: el TLS del ENRE **funciona en el runner de Ubuntu sin tocar nada** —era el
  riesgo principal y no se materializó. Resultado `(0 nuevos, 0 actualizados)` y ningún commit,
  así que los line endings tampoco se rompen.
- Corrida de escritura, en una rama descartable a la que se le borró `2026-07`: el bot lo volvió
  a agregar en un commit de 90 inserciones, inverso exacto de los 90 borrados, y el archivo
  resultante quedó **byte a byte idéntico** al de `main`.
- `setup-uv` no publica tag flotante de major: `@v9` no resuelve, hay que pinnear `@v9.0.0`.
- El bloque `permissions: contents: write` del workflow **sí eleva** por encima del default
  `read` del repo; no hace falta cambiar la configuración de Actions.

### La app

`store/useCuadros.ts` baja el JSON al arrancar, lo valida, lo cachea y actualiza la pantalla.
Se hizo en un cambio aparte del Action a propósito: los riesgos son distintos.

- Los 5 caminos probados en el navegador: remoto, cache, embebido, remoto más viejo y JSON
  corrupto. En los tres últimos la app sigue calculando y el cache no se ensucia.
- **Los 12 comprobantes siguen cerrando** después de convertir las constantes en funciones,
  que es lo que prueba que el refactor no movió ningún número.
- `casos.ts` pasó de 7 a 10 casos: se agregaron el filtro sobre el camino remoto, el rechazo de
  JSON inválido y las reglas de reemplazo.
- El caso 10 deja instalado un cuadro de prueba y **no se puede deshacer** —volver al embebido
  sería un retroceso y la regla lo prohíbe—, así que tiene que quedar último en el archivo.

### Datos sueltos que conviene tener a mano

- `tsc` limpio, 10 casos de prueba pasando, 12 comprobantes reproducidos.
- El JSON tiene 78 cuadros: 28 períodos (04/2024 a 07/2026) × niveles. Ojo que **no todos los
  períodos traen los tres**: N3 está en 22 de 28 y los recientes, `2026-07` incluido, solo traen
  N1 y N2.
- `Bash(uv run *)` **no** está en los permisos de `.claude/settings.json`, así que correr el
  scraper pide confirmación cada vez.
