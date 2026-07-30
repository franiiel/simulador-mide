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

Más delicado que el workflow, porque acá se pueden introducir errores silenciosos.

**Validar el JSON remoto antes de usarlo.** Un JSON corrupto, truncado o con otro shape no debe
llegar al motor. `zod` ya está en el proyecto (`^4.4.3`) y se usa para validar formularios;
conviene un esquema para `CuadroEnre[]` y descartar el remoto si no valida, cayendo al cacheado
o al embebido. Sin esto, el peor caso no es que la app falle sino que calcule mal.

**No bloquear el arranque.** La app tiene que calcular de inmediato con lo embebido o cacheado y
refrescar en background. El JSON son 84 KB.

**Decidir cuándo el remoto gana.** Lo simple y suficiente: usarlo si su período máximo es mayor
o igual al del embebido. Nunca reemplazar por algo más viejo.

**Hace falta una dependencia nueva.** No hay nada para persistir: `@react-native-async-storage/async-storage`
no está instalado (tampoco `expo-file-system`). `AGENTS.md` pide no agregar dependencias hasta
que una feature concreta las necesite — esta la necesita, y conviene dejarlo dicho en el commit.
`axios` ya está (`^1.18.1`), aunque `fetch` alcanza.

**Consecuencia esperada, no bug:** cuando el Action agregue un período nuevo, `PERIODO_VIGENTE`
pasa a ser ese automáticamente y **la tasa municipal se hereda** del último período con
comprobante, porque el ENRE no la publica. La app ya avisa en pantalla cuando la está heredando.
No hay nada que arreglar, pero conviene saber que un cuadro nuevo activa ese aviso.

## Verificación

Del lado del Action, ya hecha (ver "Estado"):

1. **En seco, con `workflow_dispatch`**: que el TLS del ENRE funcione en Ubuntu y que no genere
   diff cuando el período ya está.
2. **Un caso real de actualización**: forzar el estado eliminando el último período del JSON,
   correr el Action y ver que lo vuelve a agregar en un commit limpio.

Del lado de la app, pendiente:

3. **`uv run scraper/main.py --check`** sigue siendo el test del scraper, y
   **`npx tsx domain/casos.ts`** el del motor: los 12 comprobantes tienen que pasar después de
   cualquier cambio en cómo se cargan los cuadros.
4. **Los tres caminos, a mano**: con red y remoto más nuevo (actualiza), sin red y con cache
   (usa cache), y sin red ni cache (usa el embebido). El tercero se prueba en una instalación
   limpia con el avión activado.
5. **JSON remoto corrupto**: servir a propósito algo inválido y confirmar que la app lo descarta
   y sigue calculando, en vez de romperse o dar números raros.

## Estado

**El Action está hecho y verificado**: `.github/workflows/tarifas.yml`, cron diario a las 09:00
UTC más `workflow_dispatch`.

- Corrida en seco: el TLS del ENRE **funciona en el runner de Ubuntu sin tocar nada** —era el
  riesgo principal y no se materializó. Resultado `(0 nuevos, 0 actualizados)` y ningún commit,
  así que los line endings tampoco se rompen.
- Corrida de escritura, en una rama descartable a la que se le borró `2026-07`: el bot lo volvió
  a agregar en un commit de 90 inserciones, inverso exacto de los 90 borrados, y el archivo
  resultante quedó **byte a byte idéntico** al de `main`.
- `setup-uv` no publica tag flotante de major: `@v9` no resuelve, hay que pinnear `@v9.0.0`.
- El bloque `permissions: contents: write` del workflow **sí eleva** por encima del default
  `read` del repo; no hace falta cambiar la configuración de Actions.

Lo que falta es todo el lado de la app. Ahí el peor caso no es fallar sino calcular mal en
silencio, que es por qué se hizo en un cambio aparte.

- `tsc` limpio, 7 casos de prueba pasando, 12 comprobantes reproducidos.
- El JSON tiene 78 cuadros: 28 períodos (04/2024 a 07/2026) × niveles. Ojo que **no todos los
  períodos traen los tres**: N3 está en 22 de 28 y los recientes, `2026-07` incluido, solo traen
  N1 y N2.
- `Bash(uv run *)` **no** está en los permisos de `.claude/settings.json`, así que correr el
  scraper pide confirmación cada vez.
