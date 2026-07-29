// Modelo formal del motor de cálculo, congelado en docs/implementaciones.md (secciones 1 y 2).

export type Segmento = 'N1' | 'N2' | 'N3'; // sin subsidio, bajos ingresos, medios

export type Tramo = {
  desdeKwh: number;
  hastaKwh: number | null; // null = infinito
  precioKwh: number;
};

export type Tarifa = {
  segmento: Segmento;
  cargoFijo: number;
  tramos: Tramo[];
  fechaVigencia: string;
};

export type DetalleTramo = {
  tramo: Tramo;
  kwhEnTramo: number;
  subtotal: number;
};

export type ResultadoCalculo = {
  consumoKwh: number;
  costoEnergia: number;
  cargoFijo: number;
  total: number;
  detalle: DetalleTramo[];
};

export type TarifasJson = {
  version: string;
  distribuidora: string;
  tarifas: Tarifa[];
};
