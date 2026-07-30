// Modelo de una recarga de MIDE.
//
// En MIDE no hay factura: se recarga un monto, el medidor acredita kWh y cuando llegan a
// cero se corta el servicio. El monto de la recarga es BRUTO y se reparte en tres cosas:
//
//   Subtotal A (energía) + Subtotal B (impuestos) + Tasa Municipal = monto recargado
//
// La energía se cobra en ESCALERA sobre el consumo acumulado del mes, que se resetea cada
// mes. Una recarga que cruza un umbral se parte: el ticket imprime un renglón por tramo
// atravesado.
//
// El precio de cada tramo NO es un dato del ticket: se DERIVA del cuadro tarifario T1-R
// que publica el ENRE (ver cuadrosEnre.ts y precioTramo() en tarifas.ts). Los 12
// comprobantes de .transcripciones/ son el set de validación de esa derivación, no la
// fuente. Verificado: 17 tramos en 7 períodos, error 0,000 %.

export type Nivel = 'N1' | 'N2' | 'N3';

/**
 * Topes de los bloques R1-R6 del cuadro T1-R, en kWh acumulados del mes. Son la escalera
 * de MIDE: coinciden con los bloques del ENRE en todos los períodos vistos.
 *
 * El 1400 es el tope que MIDE le asigna a R6, que en el cuadro figura como "+700" sin
 * techo. Sale del ticket, que imprime ese tramo como "Hasta 1400kWh". Arriba de 1400 no
 * hay tramo definido y el motor lanza error: ningún comprobante lo cruza (el acumulado
 * más alto visto es 1336,8).
 */
export const TOPES_KWH = [150, 400, 500, 600, 700, 1400] as const;

/**
 * La tasa municipal solo grava los kWh comprados por debajo de este acumulado. Coincide
 * con un tope de la escalera, lo que hace que el costo marginal del kWh sea constante
 * dentro de cada tramo — de ahí que la inversa monto → kWh sea exacta y no iterativa.
 */
export const TOPE_TASA_MUNICIPAL_KWH = 600;

/** Un bloque (R1..R6) del cuadro tarifario T1-R del ENRE. */
export type BloqueEnre = {
  /** Tope de consumo mensual del bloque, en kWh. */
  hastaKwh: number;
  cargoFijo: number; // $/mes
  cargoVariableBase: number; // $/kWh hasta el consumo base
  /** $/kWh pasado el consumo base. null en R1, donde nunca aplica. */
  cargoVariableExcedente: number | null;
};

/** Cuadro tarifario de un período, tal como lo publica el ENRE. */
export type CuadroEnre = {
  periodo: string; // 'YYYY-MM'
  distribuidora: string;
  nivel: Nivel;
  /**
   * Consumo base mensual subsidiado, en kWh. Es estacional: 300 en dic-feb y may-ago,
   * 150 en mar-abr y sep-nov. El régimen anterior a 2026 usaba 350 fijo.
   */
  consumoBaseKwh: number;
  bloques: BloqueEnre[];
  fuente: string;
};

/** Tasas de impuestos, como fracción del subtotal de energía. */
export type Impuestos = {
  iva: number;
  contribucionMunicipal: number;
  contribucionProvincial: number;
};

/** Un tramo de la escalera de MIDE, con el precio ya derivado del cuadro. */
export type TramoPrecio = {
  hastaKwhAcumulados: number;
  precioKwh: number;
};

/**
 * Todo lo que hace falta para liquidar una recarga en un período.
 *
 * Los tramos salen del cuadro del ENRE; la tasa municipal no, porque es un cargo del
 * municipio que el cuadro no publica y solo se conoce por los tickets.
 */
export type TarifaMide = {
  periodo: string;
  distribuidora: string;
  nivel: Nivel;
  tramos: TramoPrecio[];
  tasaMunicipalPorKwh: number;
  /** true si la tasa municipal se heredó de un período anterior por no tener el dato. */
  tasaMunicipalHeredada: boolean;
  impuestos: Impuestos;
};

/** Un renglón de energía del ticket: tantos kWh a tal precio. */
export type RenglonTramo = {
  hastaKwhAcumulados: number;
  precioKwh: number;
  kwh: number;
  importe: number;
};

/** Mismos campos que imprime el comprobante, para poder contrastarlo de un vistazo. */
export type ResultadoRecarga = {
  montoBruto: number;
  /** Un renglón por tramo atravesado, en el orden en que los imprime el ticket. */
  renglones: RenglonTramo[];
  subtotalEnergia: number; // Subtotal A
  iva: number;
  contribucionMunicipal: number;
  contribucionProvincial: number;
  subtotalImpuestos: number; // Subtotal B
  tasaMunicipal: number;
  kwh: number;
  /** Promedio ponderado con impuestos y tasa incluidos: lo que de verdad se paga por kWh. */
  precioEfectivoPorKwh: number;
  acumuladoPrevioKwh: number;
  acumuladoFinalKwh: number;
};

/** Distancia al cambio de tramo de precio. */
export type ProximidadSalto = {
  precioActual: number;
  precioSiguiente: number | null; // null = ya está en el último tramo (≤1400)
  kwhHastaElSalto: number | null;
  /** Positivo = más caro del otro lado; negativo = más barato (lo que pasa cruzando 700). */
  variacionPorKwh: number | null;
};

/** Límites de una recarga individual en MIDE. */
export const RECARGA_MINIMA = 1500;
export const RECARGA_MAXIMA = 60000;
