Voy a definirte la fórmula exacta operativa (implementable) del cálculo MIDE para Edenor con:

Segmentación N1 / N2 / N3
Subsidio por bloque
Acumulación mensual
Cálculo incremental (clave para prepago)

Esto está modelado para que lo puedas llevar directo a TypeScript sin ambigüedades.

1. Variables del sistema
Inputs
C
m
	​

 = consumo acumulado del mes antes de la carga (kWh)
ΔC = consumo a calcular (kWh)
S∈{N1,N2,N3} = segmento
L
S
	​

 = límite subsidiado del segmento (kWh/mes)

Valores típicos (pueden cambiar por resolución):

N1: L
N1
	​

=0
N2: L
N2
	​

≈350
N3: L
N3
	​

≈250
Tarifas
P
sub
	​

 = precio subsidiado ($/kWh)
P
pleno
	​

 = precio sin subsidio ($/kWh)
CF = cargo fijo mensual ($)
2. Consumo incremental (clave MIDE)

El cálculo NO es sobre ΔC directamente.

Se evalúa sobre el intervalo:

[C
m
	​

,C
m
	​

+ΔC]
3. Separación en bloques

Definimos:

Energía subsidiada dentro del delta
E
sub
	​

=max(0,min(L
S
	​

−C
m
	​

,ΔC))
Energía sin subsidio dentro del delta
E
pleno
	​

=ΔC−E
sub
	​

4. Función de costo total

El costo de energía queda:

Costo(ΔC)=E
sub
	​

⋅P
sub
	​

+E
pleno
	​

⋅P
pleno
	​

5. Forma equivalente (más robusta para código)
Costo(ΔC)=
subsidiado
min(ΔC,max(0,L
S
	​

−C
m
	​

))
	​

	​

⋅P
sub
	​

+
excedente
max(0,ΔC−max(0,L
S
	​

−C
m
	​

))
	​

	​

⋅P
pleno
	​

6. Caso especial por segmento
N1 (sin subsidio)
L
N1
	​

=0⇒E
sub
	​

=0
Costo(ΔC)=ΔC⋅P
pleno
	​

N2 / N3

Se aplica exactamente la fórmula general.

7. Costo total del mes (si lo necesitás)
Costo
mes
	​

=CF+Costo(C
total
	​

)

donde:

C
total
	​

=C
m
	​

+ΔC
8. Función inversa (la importante para tu app)

Tu app necesita esto:

“con $X, ¿cuántos kWh obtengo?”

Esto implica invertir la función.

Caso 1: todavía dentro del subsidio

Si:

C
m
	​

<L
S
	​


y el dinero M alcanza solo para zona subsidiada:

ΔC=
P
sub
	​

M
	​


condición:

C
m
	​

+ΔC≤L
S
	​

Caso 2: cruza el límite

Primero consumís lo subsidiado restante:

E
sub
	​

=L
S
	​

−C
m
	​


Costo de esa parte:

M
sub
	​

=E
sub
	​

⋅P
sub
	​


Luego el resto del dinero:

M
resto
	​

=M−M
sub
	​


Y eso compra energía plena:

E
pleno
	​

=
P
pleno
	​

M
resto
	​

	​

Resultado total
ΔC=(L
S
	​

−C
m
	​

)+
P
pleno
	​

M−(L
S
	​

−C
m
	​

)⋅P
sub
	​

	​

Caso 3: ya sin subsidio
C
m
	​

≥L
S
	​

⇒ΔC=
P
pleno
	​

M
	​

9. Factor MIDE (ajuste práctico)

En la realidad de MIDE:

Costo
real
	​

=Costo(ΔC)⋅(1+α)

donde:

α = pérdidas, impuestos, redondeos (~1–5%)

Esto lo vas a calibrar empíricamente contra datos reales.

10. Forma final para implementación
function calcularCosto({
  Cm,
  deltaC,
  Ls,
  Psub,
  Ppleno
}) {
  const energiaSub = Math.max(0, Math.min(Ls - Cm, deltaC));
  const energiaPlena = deltaC - energiaSub;

  return energiaSub * Psub + energiaPlena * Ppleno;
}
11. Insight clave (producto)

El sistema es no lineal en el tiempo porque:

El precio marginal depende de C
m
	​

Dos usuarios con el mismo consumo mensual pueden pagar distinto
El momento de la carga cambia el rendimiento

Esto es exactamente lo que tu app tiene que explotar.