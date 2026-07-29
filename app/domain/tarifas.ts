import type { Segmento, Tarifa, TarifasJson } from './types';

// PLACEHOLDER: valores inventados hasta tener datos reales del ENRE (scraper pendiente).
// Lo que se congela acá es la estructura, no los números.
export const TARIFAS: TarifasJson = {
  version: '2026-07',
  distribuidora: 'edenor',
  tarifas: [
    {
      segmento: 'N1',
      cargoFijo: 1500,
      fechaVigencia: '2026-07-01',
      tramos: [{ desdeKwh: 0, hastaKwh: null, precioKwh: 200 }],
    },
    {
      segmento: 'N2',
      cargoFijo: 1200,
      fechaVigencia: '2026-07-01',
      tramos: [
        { desdeKwh: 0, hastaKwh: 350, precioKwh: 80 },
        { desdeKwh: 350, hastaKwh: null, precioKwh: 200 },
      ],
    },
    {
      segmento: 'N3',
      cargoFijo: 1200,
      fechaVigencia: '2026-07-01',
      tramos: [
        { desdeKwh: 0, hastaKwh: 300, precioKwh: 120 },
        { desdeKwh: 300, hastaKwh: null, precioKwh: 200 },
      ],
    },
  ],
};

export function getTarifa(segmento: Segmento): Tarifa {
  const tarifa = TARIFAS.tarifas.find((t) => t.segmento === segmento);
  if (!tarifa) {
    throw new Error(`No hay tarifa para el segmento ${segmento}`);
  }
  return tarifa;
}
