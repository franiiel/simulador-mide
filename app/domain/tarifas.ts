import type { CuadroTarifario, Mes } from './types';

// Cuadro tarifario real, transcrito del sitio del ENRE.
// Verificar contra una factura antes de confiar en los resultados: los valores son
// oficiales, pero la interpretación del cuadro todavía no se validó contra una
// factura emitida.
export const CUADRO_EDENOR: CuadroTarifario = {
  distribuidora: 'edenor',
  periodo: '2026-07',
  resolucion: 'ENRE 206/2026',
  vigenciaDesde: '2026-07-01',
  fuente: 'https://www.enre.gov.ar/web/tarifasd.nsf/todoscuadros',
  categorias: [
    {
      categoria: 'R1',
      desdeKwh: 0,
      hastaKwh: 150,
      cargoFijo: 1710.71,
      precioSinSubsidio: 154.881,
      precioBase: 69.303,
    },
    {
      categoria: 'R2',
      desdeKwh: 150,
      hastaKwh: 400,
      cargoFijo: 3648.68,
      precioSinSubsidio: 155.504,
      precioBase: 69.926,
    },
    {
      categoria: 'R3',
      desdeKwh: 400,
      hastaKwh: 500,
      cargoFijo: 11981.48,
      precioSinSubsidio: 167.037,
      precioBase: 81.459,
    },
    {
      categoria: 'R4',
      desdeKwh: 500,
      hastaKwh: 600,
      cargoFijo: 19167.67,
      precioSinSubsidio: 170.79,
      precioBase: 85.212,
    },
    {
      categoria: 'R5',
      desdeKwh: 600,
      hastaKwh: 700,
      cargoFijo: 40400.01,
      precioSinSubsidio: 171.071,
      precioBase: 85.493,
    },
    {
      categoria: 'R6',
      desdeKwh: 700,
      hastaKwh: null,
      cargoFijo: 63014.37,
      precioSinSubsidio: 186.121,
      precioBase: 100.542,
    },
  ],
};

// El subsidio solo cubre el "bloque base", que cambia con la estación:
// 300 kWh/mes en diciembre-febrero y mayo-agosto, 150 kWh/mes en el resto.
const MESES_BLOQUE_300: Mes[] = [12, 1, 2, 5, 6, 7, 8];

export function bloqueBaseKwh(mes: Mes): number {
  return MESES_BLOQUE_300.includes(mes) ? 300 : 150;
}

/** La categoría en la que cae un consumo mensual total. */
export function categoriaPara(consumoMensualKwh: number, cuadro: CuadroTarifario = CUADRO_EDENOR) {
  const fila = cuadro.categorias.find(
    (c) =>
      consumoMensualKwh > c.desdeKwh && (c.hastaKwh === null || consumoMensualKwh <= c.hastaKwh),
  );
  // Un consumo de 0 no supera el `desdeKwh` de R1, pero sigue siendo R1.
  return fila ?? cuadro.categorias[0];
}
