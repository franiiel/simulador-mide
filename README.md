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
> Las tarifas incluidas en `app/domain/tarifas.ts` son **valores de ejemplo
> inventados**, no las tarifas reales vigentes. Los resultados que produce hoy no
> sirven para tomar decisiones de consumo.

## Estado

Prototipo temprano. Lo que hay hoy:

- **Motor de cálculo** (`app/domain/`): lógica pura en TypeScript, sin dependencias
  de React Native, con 3 casos de prueba manuales que pasan.
- **Scaffold de la app** Expo: `App.tsx` sigue siendo la pantalla por defecto, sin
  interfaz propia todavía.
- **Backend** Go + Gin: solo `GET /health`.
- **Scraper** Python: sin implementar.

Lo que falta para que sea útil: tarifas reales, la función inversa (monto → kWh),
y la interfaz.

## El problema

El sistema MIDE no es intuitivo porque el precio del kWh no es fijo:

- Existe un límite mensual de energía subsidiada; pasado ese límite, el excedente
  se paga a precio pleno.
- Como el límite corre contra el **acumulado del mes**, el precio marginal depende
  de cuánto consumiste antes.
- En consecuencia, el mismo monto rinde distinto según el momento del mes en que
  cargues, y dos usuarios con igual consumo mensual pueden pagar distinto.

Esa no linealidad es exactamente lo que el simulador intenta hacer visible.

## Cómo funciona el cálculo

El consumo no se evalúa aislado sino sobre el intervalo que va del acumulado del
mes al acumulado más la carga nueva. Ese intervalo se parte entre el tramo
subsidiado y el excedente:

```
energiaSubsidiada = max(0, min(limiteSegmento - acumulado, consumo))
energiaPlena      = consumo - energiaSubsidiada

costo = energiaSubsidiada * precioSubsidiado + energiaPlena * precioPleno
```

El detalle completo está en [`docs/calculoKWH.md`](docs/calculoKWH.md) (fórmula y
función inversa) y [`docs/implementaciones.md`](docs/implementaciones.md) (modelo de
datos y reglas congeladas). El producto está descrito en
[`docs/idea.md`](docs/idea.md).

## Estructura

```
├── app/                  frontend React Native + Expo (TypeScript strict)
│   └── domain/           motor de cálculo — TypeScript puro, testeable aislado
│       ├── types.ts        Segmento, Tramo, Tarifa, ResultadoCalculo
│       ├── tarifas.ts      JSON de tarifas versionado (hoy, valores de ejemplo)
│       ├── calculadora.ts  calcularCosto()
│       └── casos.ts        3 casos de prueba manuales
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

- Función inversa: dado un monto, cuántos kWh se obtienen.
- Tarifas reales del ENRE, validadas contra facturas o cargas MIDE reales.
- Interfaz: calculadora de carga, simulación mensual y comparador temporal.
- Factor de ajuste MIDE, calibrado empíricamente.
- Scraper del ENRE con validación, y `GET /tarifas` en el backend.

## Licencia

[Apache 2.0](LICENSE).
