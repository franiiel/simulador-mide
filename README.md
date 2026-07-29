# Simulador de consumo MIDE (Edenor)

Simulador del sistema prepago **MIDE** de Edenor: estima cuántos kWh rinde una
carga de dinero según el subsidio del segmento, los tramos tarifarios y el consumo
ya acumulado en el mes.

La pregunta que busca responder no es "cuánto sale el kWh", sino:

> ¿Cuántos kWh me da $60.000 **hoy**? ¿Me conviene cargar ahora o esperar?

> [!IMPORTANT]
> Proyecto personal, **sin relación ni afiliación con Edenor ni con el ENRE**. No es
> la aplicación oficial de MIDE.
>
> Las tarifas son las oficiales publicadas por el ENRE (Edenor, período 2026-07,
> Res. ENRE 206/2026), pero **la interpretación del cuadro todavía no se validó
> contra una factura emitida**. Verificá contra tu factura antes de tomar decisiones
> a partir de estos números.

## Estado

Prototipo temprano. Lo que hay hoy:

- **Motor de cálculo** (`app/domain/`): lógica pura en TypeScript, sin dependencias
  de React Native, con 7 casos de prueba manuales que pasan. Calcula el costo del mes,
  la función inversa (cuántos kWh compra un monto desde el consumo ya acumulado) y la
  proximidad al salto de categoría.
- **Cuadro tarifario real** de Edenor, período 2026-07 (Res. ENRE 206/2026).
- **Calculadora de carga**: una pantalla donde se elige monto, consumo acumulado del
  mes, mes y si se tiene subsidio, y se ven los kWh resultantes con su desglose por
  categoría, el aviso de salto y la factura estimada del mes. La recarga está acotada
  a los límites de MIDE, entre $1.500 y $60.000.
- **Backend** Go + Gin: solo `GET /health`.
- **Scraper** Python: sin implementar.

Lo que falta: validar el motor contra una factura real, la simulación mensual y el
comparador temporal.

## El problema

La facturación residencial de Edenor combina dos mecanismos que tiran en direcciones
distintas:

- **La energía se cobra marginalmente.** Cada kWh se paga al precio de la categoría
  T1-R en la que cae. Cruzar una frontera encarece los kWh siguientes, no los ya
  consumidos.
- **El cargo fijo lo decide la categoría en la que termina el mes.** Ese sí es
  retroactivo, y es enorme: va de $1.710 en R1 a $63.014 en R6.

De ahí salen los acantilados. Un usuario sin subsidio que termina el mes en 400 kWh
paga $65.756; si termina en 401 kWh paga $74.256. **Un kWh de más cuesta $8.499**, y
casi todo es el cargo fijo saltando de $3.648 a $11.981. Avisar antes de que eso pase
es la razón de ser de la app.

Encima de esto, el subsidio cubre solo un **bloque base** que cambia con la estación:
300 kWh/mes en diciembre–febrero y mayo–agosto, 150 kWh/mes en el resto. Lo que
excede el bloque se paga a precio pleno.

Y como la energía es marginal, **el consumo que ya llevás en el mes cambia cuánto
rinde la plata**: los mismos $60.000 compran mucho menos si arrancás desde 350 kWh
que desde cero, porque ya agotaste el bloque bonificado y empezás a comprar en
categorías más caras.

## Cómo funciona el cálculo

El consumo se recorre por tramos de precio homogéneo, cortando en cada frontera de
categoría y en el fin del bloque base:

```
precio(kwh) = kwh < bloqueBase ? precioBase(categoria(kwh))
                               : precioSinSubsidio(categoria(kwh))

costoEnergia = suma de cada tramo * su precio
total        = costoEnergia + cargoFijo(categoria del consumo final)
```

La función inversa recorre esos mismos tramos gastando el monto hasta agotarlo,
partiendo del consumo acumulado del mes.

> [!NOTE]
> Que la energía sea marginal y no retroactiva es una **interpretación**, todavía sin
> validar contra una factura ni un ticket de recarga. El cuadro tarifario, leído
> literalmente, sugiere que la categoría fija el precio de todo el mes; si eso fuera
> así, los acantilados serían aún más grandes.

El producto está descrito en [`docs/idea.md`](docs/idea.md). Los documentos
[`docs/calculoKWH.md`](docs/calculoKWH.md) y
[`docs/implementaciones.md`](docs/implementaciones.md) describen un modelo anterior
de tramos progresivos que resultó no ser el que usa Edenor; se conservan como
registro del razonamiento, pero el modelo vigente es el de arriba.

## Estructura

```
├── app/                  frontend React Native + Expo (TypeScript strict)
│   ├── domain/           motor de cálculo — TypeScript puro, testeable aislado
│   │   ├── types.ts        Categoria, CuadroTarifario, resultados
│   │   ├── tarifas.ts      cuadro real del ENRE + bloque base estacional
│   │   ├── calculadora.ts  calcularMes(), proximidadAlSalto(), calcularKwh()
│   │   └── casos.ts        7 casos de prueba manuales
│   ├── screens/          pantallas (calculadora de carga)
│   └── store/            estado (zustand) y validación (zod)
├── backend/              API Go + Gin — opcional, servirá las tarifas
├── scraper/              extracción de tarifas del ENRE (Python) — sin implementar
└── docs/                 documentación de producto y del modelo de cálculo
```

El MVP calcula **100% en el cliente**, con las tarifas embebidas: la app funciona
sin conexión y no depende del backend. Cuando el backend exista de verdad, servirá
tarifas actualizadas alimentadas por el scraper:

```
Scraper (Python) → JSON de tarifas → backend (Go + Gin) → app (React Native)
                                   ↘   (o embebido)    ↗
```

## Correrlo

Frontend:

```bash
cd app
pnpm install
pnpm start        # o: pnpm android / pnpm web
```

El motor de cálculo se puede ejercitar sin levantar la app:

```bash
cd app
npx tsc --noEmit          # typecheck
npx tsx domain/casos.ts   # corre los 3 casos de prueba
```

Backend (opcional, no hace falta para la app):

```bash
cd backend
go run ./cmd/api          # :8080, GET /health
```

## Roadmap

- Validar el motor contra una factura real de Edenor o un ticket de recarga: es lo
  único que confirma si la energía se cobra marginalmente, como asume el modelo, o si
  la categoría reprecia el mes entero.
- Confirmar si los niveles N2 y N3 tienen bonificaciones distintas — el cuadro del
  ENRE publica una sola columna "con subsidio".
- Simulación mensual y comparador temporal: cuánto rinde la misma carga según el
  momento del mes.
- Scraper del ENRE con validación, y `GET /tarifas` en el backend, para que el cuadro
  no haya que transcribirlo a mano cada vez que cambia.

## Licencia

[Apache 2.0](LICENSE).
