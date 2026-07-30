import { cuadroDe, PERIODO_VIGENTE } from './cuadrosEnre';
import type { CuadroEnre, Impuestos, TarifaMide, TramoPrecio } from './types';

// Impuestos, como fracción del subtotal de energía.
//
// Derivados del comprobante 58349 (28/11/25), el único donde `Subtotal A + Subtotal B`
// cierra exacto contra el monto recargado porque la recarga no compró kWh gravados por la
// tasa municipal: A = 31.400,00, IVA = 6.588,88, municipal = 2.011,07, provincial = 0,05.
//
// OJO: dan 20,984 % y 6,4047 %, no los 21 % y 6,4155 % nominales. El emisor factura sobre
// una base levemente menor a A y no se sabe por qué. Se usan los valores empíricos porque
// son los que hacen cerrar los tickets; el desvío contra los nominales es 0,02 % del
// multiplicador, unos 0,04 kWh en una recarga de $60.000.
const IMPUESTOS: Impuestos = {
  iva: 6588.88 / 31400,
  contribucionMunicipal: 2011.07 / 31400,
  contribucionProvincial: 0.05 / 31400,
};

// "Tasa Municipal", en $/kWh sobre los kWh comprados por debajo de 600 kWh acumulados.
//
// No sale del cuadro del ENRE —es un cargo del municipio— así que solo se conoce por los
// tickets. Cada valor está confirmado por comprobantes de ese período; los períodos sin
// entrada heredan el último valor conocido (ver tasaMunicipalDe).
const TASAS_MUNICIPALES: Record<string, number> = {
  '2025-10': 3.4933,
  '2025-11': 3.4933,
  '2025-12': 3.4933,
  '2026-02': 5.24,
  '2026-03': 5.24,
  '2026-04': 5.24,
};

/** Cuánto suma de impuestos cada peso de energía. */
export function multiplicadorImpuestos(impuestos: Impuestos = IMPUESTOS): number {
  const { iva, contribucionMunicipal, contribucionProvincial } = impuestos;
  return 1 + iva + contribucionMunicipal + contribucionProvincial;
}

/**
 * Lo que costaría un mes de `kwh` consumidos, según el cuadro T1-R: el cargo fijo del
 * bloque en el que cae el consumo, más el cargo variable subsidiado hasta el consumo base
 * y el pleno por el excedente.
 *
 * Es el costo de la factura que MIDE no emite. Sirve solo para derivar los precios de la
 * escalera; el usuario nunca ve este número.
 */
export function costoFactura(kwh: number, cuadro: CuadroEnre): number {
  if (kwh <= 0) return 0;

  const bloque = cuadro.bloques.find((b) => kwh <= b.hastaKwh);
  if (!bloque) {
    const tope = cuadro.bloques[cuadro.bloques.length - 1].hastaKwh;
    throw new Error(
      `Consumo de ${kwh} kWh fuera del cuadro ${cuadro.periodo}: el último bloque llega a ` +
        `${tope} kWh. El cuadro publica "+700" sin techo y MIDE lo trata como si el tope ` +
        `fuera ${tope}; arriba de eso no se sabe qué precio aplica.`,
    );
  }

  const base = Math.min(kwh, cuadro.consumoBaseKwh);
  const excedente = Math.max(0, kwh - cuadro.consumoBaseKwh);
  // En R1 el excedente es siempre 0 (el consumo base nunca bajó de 150), así que el cuadro
  // no publica cargo variable excedente para ese bloque.
  const precioExcedente = bloque.cargoVariableExcedente ?? 0;

  return bloque.cargoFijo + bloque.cargoVariableBase * base + precioExcedente * excedente;
}

/**
 * Precio del kWh en un tramo de la escalera de MIDE: el costo marginal de la factura entre
 * el tope del bloque anterior y el propio, dividido por el ancho.
 *
 * Esta es la regla que reproduce los tickets. Verificada contra 17 tramos en 7 períodos y
 * tres regímenes de consumo base distintos, con error 0,000 % — incluidos los importes en
 * pesos de cada renglón, no solo el $/kWh.
 *
 * El salto de cargo fijo entre bloques (en 2026-07 va de $3.648 a $11.981 a $40.400) es lo
 * que hace que la escalera NO sea monótona: al repartirse sobre 100 kWh de ancho infla el
 * precio de los tramos del medio, y vuelve a bajar en el ≤1400 porque ahí se reparte sobre
 * 700 kWh. De ahí que cruzar los 700 kWh acumulados abarate el kWh en vez de encarecerlo.
 */
export function precioTramo(indiceBloque: number, cuadro: CuadroEnre): number {
  const bloque = cuadro.bloques[indiceBloque];
  const desde = indiceBloque === 0 ? 0 : cuadro.bloques[indiceBloque - 1].hastaKwh;
  const ancho = bloque.hastaKwh - desde;

  return (costoFactura(bloque.hastaKwh, cuadro) - costoFactura(desde, cuadro)) / ancho;
}

/** La escalera completa de un cuadro. */
export function tramosDe(cuadro: CuadroEnre): TramoPrecio[] {
  return cuadro.bloques.map((bloque, i) => ({
    hastaKwhAcumulados: bloque.hastaKwh,
    precioKwh: precioTramo(i, cuadro),
  }));
}

function tasaMunicipalDe(periodo: string): { valor: number; heredada: boolean } {
  const propia = TASAS_MUNICIPALES[periodo];
  if (propia !== undefined) return { valor: propia, heredada: false };

  // Sin ticket del período que la confirme, se usa el último valor conocido anterior. Es
  // un cargo chico (unos $5/kWh contra ~$300/kWh de energía) y solo afecta a las recargas
  // que compran por debajo de 600 kWh acumulados.
  const anteriores = Object.keys(TASAS_MUNICIPALES)
    .filter((p) => p < periodo)
    .sort();
  const ultimo = anteriores[anteriores.length - 1];

  return ultimo
    ? { valor: TASAS_MUNICIPALES[ultimo], heredada: true }
    : { valor: 0, heredada: true };
}

/** Todo lo necesario para liquidar una recarga en un período. */
export function tarifaDe(periodo: string = PERIODO_VIGENTE): TarifaMide {
  const cuadro = cuadroDe(periodo);
  if (!cuadro) {
    throw new Error(`No se conoce el cuadro tarifario del período ${periodo}.`);
  }

  const tasa = tasaMunicipalDe(periodo);

  return {
    periodo: cuadro.periodo,
    distribuidora: cuadro.distribuidora,
    nivel: cuadro.nivel,
    tramos: tramosDe(cuadro),
    tasaMunicipalPorKwh: tasa.valor,
    tasaMunicipalHeredada: tasa.heredada,
    impuestos: IMPUESTOS,
  };
}

/** La tarifa vigente, que es la que usa la app. */
export const TARIFA_VIGENTE = tarifaDe();

/** Tramo que corresponde a un consumo acumulado del mes. null si está fuera de la escalera. */
export function tramoPara(acumuladoKwh: number, tarifa: TarifaMide = TARIFA_VIGENTE) {
  return tarifa.tramos.find((t) => acumuladoKwh <= t.hastaKwhAcumulados) ?? null;
}

/** Tope de la escalera; a partir de acá no se sabe qué precio se aplica. */
export function topeEscalera(tarifa: TarifaMide = TARIFA_VIGENTE): number {
  return tarifa.tramos[tarifa.tramos.length - 1].hastaKwhAcumulados;
}
