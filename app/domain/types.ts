// Modelo formal del motor de cálculo, congelado en docs/implementaciones.md (secciones 1 y 2)
// y docs/calculoKWH.md (fórmula operativa).

export type Segmento = 'N1' | 'N2' | 'N3'; // sin subsidio, bajos ingresos, medios

export type Tramo = {
  desdeKwh: number;
  hastaKwh: number | null; // null = infinito
  precioKwh: number;
};

export type Tarifa = {
  segmento: Segmento;
  cargoFijo: number; // mensual: no se cobra por carga (ver calculoKWH.md §7)
  factorAjusteMide: number; // el α de calculoKWH.md §9; 0 = sin ajuste
  tramos: Tramo[];
  fechaVigencia: string;
};

export type DetalleTramo = {
  tramo: Tramo;
  kwhEnTramo: number;
  subtotal: number;
};

/** Costo de una carga puntual: energía incremental, sin cargo fijo (calculoKWH.md §4 y §9). */
export type ResultadoCalculo = {
  consumoKwh: number;
  costoEnergia: number; // costo base, antes del factor MIDE
  costoReal: number; // costoEnergia * (1 + factorAjusteMide)
  detalle: DetalleTramo[];
};

/** Costo del mes completo: energía del acumulado total más el cargo fijo (calculoKWH.md §7). */
export type ResultadoMensual = {
  consumoKwh: number;
  costoEnergia: number;
  costoReal: number;
  cargoFijo: number;
  total: number; // costoReal + cargoFijo
  detalle: DetalleTramo[];
};

/** Función inversa: cuántos kWh compra un monto dado (calculoKWH.md §8). */
export type ResultadoInverso = {
  monto: number;
  kwh: number;
  detalle: DetalleTramo[];
};

export type TarifasJson = {
  version: string;
  distribuidora: string;
  tarifas: Tarifa[];
};
