# Fórmula Operativa del Cálculo MIDE (Edenor)

Voy a definirte la fórmula exacta operativa (implementable) del cálculo MIDE para Edenor con:

- Segmentación N1 / N2 / N3
- Subsidio por bloque
- Acumulación mensual
- Cálculo incremental (clave para prepago)

Esto está modelado para que lo puedas llevar directo a TypeScript sin ambigüedades.

## 1. Variables del sistema

### Inputs

- $C_m$ = consumo acumulado del mes antes de la carga (kWh)
- $\Delta C$ = consumo a calcular (kWh)
- $S \in \{N1, N2, N3\}$ = segmento
- $L_S$ = límite subsidiado del segmento (kWh/mes)

**Valores típicos (pueden cambiar por resolución):**

- **N1:** $L_{N1} = 0$
- **N2:** $L_{N2} \approx 350$
- **N3:** $L_{N3} \approx 250$

### Tarifas

- $P_{sub}$ = precio subsidiado (\$/kWh)
- $P_{pleno}$ = precio sin subsidio (\$/kWh)
- $CF$ = cargo fijo mensual (\$)

## 2. Consumo incremental (clave MIDE)

El cálculo NO es sobre $\Delta C$ directamente. Se evalúa sobre el intervalo:
$$ [C_m, \; C_m + \Delta C] $$

## 3. Separación en bloques

Definimos:

**Energía subsidiada dentro del delta**
$$ E\_{sub} = \max\Big(0, \; \min(L_S - C_m, \; \Delta C)\Big) $$

**Energía sin subsidio dentro del delta**
$$ E*{pleno} = \Delta C - E*{sub} $$

## 4. Función de costo total

El costo de energía queda:
$$ Costo(\Delta C) = E*{sub} \cdot P*{sub} + E*{pleno} \cdot P*{pleno} $$

## 5. Forma equivalente (más robusta para código)

$$ Costo(\Delta C) = \underbrace{\min(\Delta C, \max(0, L*S - C_m))}*{\text{subsidiado}} \cdot P*{sub} + \underbrace{\max(0, \Delta C - \max(0, L_S - C_m))}*{\text{excedente}} \cdot P\_{pleno} $$

## 6. Caso especial por segmento

**N1 (sin subsidio)**
$$ L*{N1} = 0 \Rightarrow E*{sub} = 0 $$
$$ Costo(\Delta C) = \Delta C \cdot P\_{pleno} $$

**N2 / N3**
Se aplica exactamente la fórmula general.

## 7. Costo total del mes (si lo necesitás)

$$ Costo*{mes} = CF + Costo(C*{total}) $$
donde:
$$ C\_{total} = C_m + \Delta C $$

## 8. Función inversa (la importante para tu app)

Tu app necesita esto: _"con $X, ¿cuántos kWh obtengo?"_
Esto implica invertir la función.

**Caso 1: todavía dentro del subsidio**
Si $C_m < L_S$ y el dinero $M$ alcanza solo para zona subsidiada:
$$ \Delta C = \frac{M}{P\_{sub}} $$
condición: $C_m + \Delta C \le L_S$

**Caso 2: cruza el límite**
Primero consumís lo subsidiado restante:
$$ E*{sub} = L_S - C_m $$
Costo de esa parte:
$$ M*{sub} = E*{sub} \cdot P*{sub} $$
Luego el resto del dinero:
$$ M*{resto} = M - M*{sub} $$
Y eso compra energía plena:
$$ E*{pleno} = \frac{M*{resto}}{P*{pleno}} $$
Resultado total:
$$ \Delta C = (L_S - C_m) + \frac{M - (L_S - C_m) \cdot P*{sub}}{P\_{pleno}} $$

**Caso 3: ya sin subsidio**
$$ C*m \ge L_S \Rightarrow \Delta C = \frac{M}{P*{pleno}} $$

## 9. Factor MIDE (ajuste práctico)

En la realidad de MIDE:
$$ Costo\_{real} = Costo(\Delta C) \cdot (1 + \alpha) $$
donde $\alpha$ = pérdidas, impuestos, redondeos (~1–5%).
Esto lo vas a calibrar empíricamente contra datos reales.

## 10. Forma final para implementación

```typescript
function calcularCosto({
  Cm,
  deltaC,
  Ls,
  Psub,
  Ppleno,
}: {
  Cm: number;
  deltaC: number;
  Ls: number;
  Psub: number;
  Ppleno: number;
}): number {
  const energiaSub = Math.max(0, Math.min(Ls - Cm, deltaC));
  const energiaPlena = deltaC - energiaSub;

  return energiaSub * Psub + energiaPlena * Ppleno;
}
```

## 11. Insight clave (producto)

El sistema es no lineal en el tiempo porque:

- El precio marginal depende de $C_m$.
- Dos usuarios con el mismo consumo mensual pueden pagar distinto.
- El momento de la carga cambia el rendimiento.

Esto es exactamente lo que tu app tiene que explotar.
