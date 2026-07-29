// Modelo del cuadro tarifario residencial de Edenor (Tarifa 1 - R).
//
// Dos mecanismos se combinan:
//
// 1. La ENERGÍA se cobra de forma marginal: cada kWh se paga al precio de la
//    categoría en la que cae ese kWh. Cruzar una frontera encarece los kWh
//    siguientes, no los ya consumidos.
// 2. El CARGO FIJO lo determina la categoría en la que termina el mes, así que sí
//    se aplica retroactivamente: terminar el mes un kWh más arriba puede subirlo
//    varios miles de pesos.
//
// SUPUESTO A VALIDAR: el punto 1 es la interpretación de cómo cobra MIDE, todavía
// sin contrastar contra una factura ni un ticket de recarga.

export type Categoria = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';

export type FilaCategoria = {
  categoria: Categoria;
  desdeKwh: number;
  hastaKwh: number | null; // null = sin tope (R6)
  cargoFijo: number; // mensual, lo fija la categoría en la que termina el mes
  precioSinSubsidio: number; // $/kWh
  precioBase: number; // $/kWh bonificado, solo dentro del bloque base
};

export type CuadroTarifario = {
  distribuidora: string;
  periodo: string; // 'YYYY-MM'
  resolucion: string; // norma que lo respalda
  vigenciaDesde: string; // 'YYYY-MM-DD'
  fuente: string;
  categorias: FilaCategoria[];
};

/** Mes del año, 1 = enero. El bloque base bonificado depende de la estación. */
export type Mes = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** Un tramo homogéneo de consumo: mismo precio de punta a punta. */
export type TramoConsumido = {
  desdeKwh: number;
  hastaKwh: number;
  kwh: number;
  categoria: Categoria;
  bonificado: boolean;
  precioKwh: number;
  subtotal: number;
};

export type ResultadoMensual = {
  consumoKwh: number;
  categoriaFinal: Categoria;
  cargoFijo: number;
  bloqueBaseKwh: number;
  costoEnergia: number;
  total: number; // costoEnergia + cargoFijo
  tramos: TramoConsumido[];
};

/**
 * Cuánto falta para que el mes termine en la categoría siguiente, y cuánto encarece
 * la factura ese salto. El grueso del salto es el cargo fijo, que se recalcula por
 * la categoría final.
 */
export type ProximidadSalto = {
  categoriaActual: Categoria;
  categoriaSiguiente: Categoria | null; // null = ya está en R6
  kwhHastaElSalto: number | null;
  totalActual: number;
  totalTrasElSalto: number | null;
  saltoTotal: number | null;
  saltoCargoFijo: number | null; // parte del salto que viene del cargo fijo
};

export type ResultadoInverso = {
  monto: number;
  acumuladoPrevioKwh: number;
  kwhComprados: number;
  consumoFinalKwh: number; // acumulado + comprados
  categoriaFinal: Categoria;
  tramos: TramoConsumido[];
};

/** Límites de una recarga individual en MIDE. */
export const RECARGA_MINIMA = 1500;
export const RECARGA_MAXIMA = 60000;
