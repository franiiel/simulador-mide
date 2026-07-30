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

## Lo que hay que decidir antes de escribir el workflow

### 1. Sobre qué branch commitea el Action, y de dónde lee la app

Es la decisión que bloquea todo lo demás. Estado actual:

| Branch              | Commit    | ¿Tiene el scraper y el JSON?   |
| ------------------- | --------- | ------------------------------ |
| `main` (default)    | `c5aee62` | **No** — está 14 commits atrás |
| `feat/scraper-enre` | `e712959` | Sí, ya pusheada                |

La app leería de una URL fija tipo
`https://raw.githubusercontent.com/franiiel/simulador-mide/<branch>/app/domain/cuadrosEnre.json`,
así que el branch queda **cableado en el cliente** y cambiarlo después obliga a republicar.
Conviene apuntar a `main` y mergear `feat/scraper-enre` antes de empezar, en vez de dejar la
URL apuntando a una rama de feature.

### 2. `raw.githubusercontent` o GitHub Pages

`raw` es el camino corto y alcanza para uso personal o familiar: el repo ya es público y no hay
nada que configurar. No está pensado como CDN de producción y cachea unos minutos, lo cual para
un archivo mensual es irrelevante. GitHub Pages es la opción más correcta si algún día la app se
distribuye en serio, a costa de configurar el repo. Se puede empezar con `raw` y migrar, siempre
que se acepte que migrar implica republicar.

### 3. Cadencia del cron

Los cuadros aparecen a principio de mes, pero no en un día fijo. Un cron mensual el día 1 puede
correr antes de que el ENRE publique. Lo razonable es **diario**, o diario solo durante los
primeros días del mes: el scraper en modo default hace 2 requests (índice + último cuadro) y no
escribe nada si el período ya está, así que correrlo seguido es barato y silencioso.

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

1. **El Action, en seco**: correrlo con `workflow_dispatch` y confirmar que el TLS del ENRE
   funciona en Ubuntu y que no genera diff cuando el período ya está.
2. **Un caso real de actualización**: forzar el estado eliminando el último período del JSON,
   correr el Action y ver que lo vuelve a agregar en un commit limpio.
3. **`uv run scraper/main.py --check`** sigue siendo el test del scraper, y
   **`npx tsx domain/casos.ts`** el del motor: los 12 comprobantes tienen que pasar después de
   cualquier cambio en cómo se cargan los cuadros.
4. **Los tres caminos de la app, a mano**: con red y remoto más nuevo (actualiza), sin red y con
   cache (usa cache), y sin red ni cache (usa el embebido). El tercero se prueba en una
   instalación limpia con el avión activado.
5. **JSON remoto corrupto**: servir a propósito algo inválido y confirmar que la app lo descarta
   y sigue calculando, en vez de romperse o dar números raros.

## Estado al cerrar la sesión anterior

- Rama `feat/scraper-enre`, pusheada y al día con `origin` (4 commits: scraper, conexión al
  JSON, docs, eliminación del backend). `main` está 14 commits atrás.
- No existe `.github/`. No hay ningún workflow todavía.
- `tsc` limpio, 7 casos de prueba pasando, 12 comprobantes reproducidos.
- `uv run scraper/main.py --check` verde en los dos formatos de cuadro.
- El JSON tiene 78 cuadros: 28 períodos (04/2024 a 07/2026) × niveles.
- `Bash(uv run *)` **no** está en los permisos de `.claude/settings.json`, así que correr el
  scraper pide confirmación cada vez.
