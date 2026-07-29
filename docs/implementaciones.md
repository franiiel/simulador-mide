La base está bien planteada: separación clara entre motor de cálculo (determinista, offline) y fuentes de datos (JSON versionado). Hay algunos ajustes que te conviene definir ahora para evitar deuda técnica cuando metas backend/scraper.

1. Motor de cálculo (núcleo crítico)

Esto no puede quedar ambiguo. Tenés que fijar un modelo formal.

Entidades mínimas
type Segmento = 'N1' | 'N2' | 'N3'; // sin subsidio, bajos ingresos, medios

type Tramo = {
desdeKwh: number;
hastaKwh: number | null; // null = infinito
precioKwh: number;
};

type Tarifa = {
segmento: Segmento;
cargoFijo: number;
tramos: Tramo[];
fechaVigencia: string;
};

type ResultadoCalculo = {
consumoKwh: number;
costoEnergia: number;
cargoFijo: number;
total: number;
detalle: {
tramo: Tramo;
kwhEnTramo: number;
subtotal: number;
}[];
};
Reglas que tenés que congelar
Subsidio por bloque (N2/N3)
Hasta cierto kWh → subsidiado
Excedente → precio pleno (N1)
Acumulación mensual
El cálculo MIDE no es por carga aislada → depende del acumulado del mes
Factor MIDE (prepago)
Puede haber diferencias vs factura tradicional (recargos, redondeos)
Redondeos
Definí si redondeás por tramo, total o kWh (esto cambia resultados reales)

Si no fijás esto ahora, después no vas a poder validar contra valores reales de Edenor.

2. Diseño del JSON de tarifas

No lo dejes como algo “libre”. Versionalo.

{
"version": "2026-07",
"distribuidora": "edenor",
"tarifas": [
{
"segmento": "N2",
"cargoFijo": 1200,
"tramos": [
{ "desdeKwh": 0, "hastaKwh": 350, "precioKwh": 80 },
{ "desdeKwh": 350, "hastaKwh": null, "precioKwh": 200 }
]
}
]
}
Claves importantes
version → para invalidar caché en app
fechaVigencia → para histórico (importante si simulás meses pasados)
No mezclar Edenor/Edesur en el mismo archivo 3. Motor desacoplado (bien hecho)

Ubicación:

app/
└── domain/
├── tarifas.ts
├── calculadora.ts
└── types.ts

Regla clave:
sin React, sin Expo, sin fetch, sin estado global

Esto te permite:

testear con Jest o Vitest más adelante
reutilizar en backend si querés (port a Go) 4. Backend (Go + Gin) — diseño mínimo correcto

Cuando lo actives, evitá hacerlo “genérico”.

Endpoint realista
GET /tarifas?distribuidora=edenor

Respuesta:

{
"version": "2026-07",
"urlDescarga": "...",
"checksum": "sha256..."
}

Después:

GET /tarifas/2026-07.json
Por qué así
Evitás bajar datos innecesarios
Podés cachear agresivamente en cliente
Podés validar integridad 5. Scraper (Python)

No lo pienses como “scrapear HTML y listo”. Eso se rompe.

Tenés 3 opciones reales:

PDFs del ENRE → parseo (más estable)
Resoluciones oficiales → scraping estructurado
HTML Edenor → menos confiable
Pipeline correcto
Fuente (ENRE/PDF)
↓
Parser estructurado
↓
Normalización (tu schema JSON)
↓
Validación (tests)
↓
Output versionado

Si no metés validación, vas a romper el cálculo sin darte cuenta.

6. Problema clave de tu app (y ventaja competitiva)

Esto es lo más importante que mencionaste en conversaciones anteriores:

“dependiendo cuándo cargo en el mes, cambia cuánto rinde”

Eso implica que tu app necesita:

Estado del usuario
type EstadoUsuario = {
consumoAcumuladoMes: number;
fechaInicioPeriodo: Date;
segmento: Segmento;
};
Y simulación temporal

No es solo:

“cuánto cuesta X kWh”

Es:

“si cargo hoy, ¿cuántos kWh reales obtengo?”

Eso te obliga a:

simular consumo futuro
proyectar cruce de tramos

Ahí está el valor real del producto.

7. Expo + SDK

Para tu caso:

Elegí último SDK estable de Expo SDK
Usá TypeScript strict (correcto ya)
No agregues navegación hasta necesitarla (bien planteado) 8. Riesgos técnicos que deberías evitar
❌ Hardcodear tarifas sin versionado
❌ No modelar subsidios explícitamente
❌ Mezclar UI con lógica de cálculo
❌ No validar contra casos reales (facturas o MIDE real)
❌ Suponer que el scraper siempre va a funcionar 9. Siguiente paso concreto

No sigas con backend ni scraper todavía.

Implementá esto primero:

types.ts
calculadora.ts
3 casos test manuales:
bajo consumo (todo subsidiado)
cruce de subsidio
consumo alto (todo sin subsidio)

Si eso no está sólido, el resto del sistema no sirve.
