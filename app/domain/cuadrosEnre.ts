// Cuadros tarifarios T1-R de Edenor publicados por el ENRE, nivel N2 (con subsidio).
//
// Fuente: https://www.enre.gov.ar/web/tarifasd.nsf/todoscuadros?openview
// Cada período es un documento distinto; el ID va en `fuente`.
//
// Estos son los datos que alimentan el motor. Los precios por tramo que cobra MIDE se
// DERIVAN de acá con precioTramo() (ver tarifas.ts), no se copian de los tickets.
//
// Los bloques R1-R6 y el consumo base salen del cuadro tal cual. Ojo con el consumo base:
// es estacional (300 kWh en dic-feb y may-ago, 150 en mar-abr y sep-nov) y el régimen
// anterior a 2026 usaba 350 fijo. Ese parámetro cambia qué cargo variable aplica a cada
// bloque, y es lo que explica que el tramo ≤400 casi se duplicara entre dic/25 y mar/26.

import type { CuadroEnre } from './types';

const EDENOR_N2 = { distribuidora: 'edenor', nivel: 'N2' } as const;

export const CUADROS_ENRE: CuadroEnre[] = [
  {
    ...EDENOR_N2,
    periodo: '2025-11',
    consumoBaseKwh: 350,
    fuente: 'ENRE 26C7808800AC33C803258D4D006C2D99',
    bloques: [
      { hastaKwh: 150, cargoFijo: 1356.9, cargoVariableBase: 50.594, cargoVariableExcedente: null },
      {
        hastaKwh: 400,
        cargoFijo: 2894.06,
        cargoVariableBase: 51.089,
        cargoVariableExcedente: 110.133,
      },
      {
        hastaKwh: 500,
        cargoFijo: 9503.45,
        cargoVariableBase: 60.236,
        cargoVariableExcedente: 119.281,
      },
      {
        hastaKwh: 600,
        cargoFijo: 15203.38,
        cargoVariableBase: 63.213,
        cargoVariableExcedente: 122.258,
      },
      {
        hastaKwh: 700,
        cargoFijo: 32044.4,
        cargoVariableBase: 63.436,
        cargoVariableExcedente: 122.481,
      },
      {
        hastaKwh: 1400,
        cargoFijo: 49981.63,
        cargoVariableBase: 75.373,
        cargoVariableExcedente: 134.418,
      },
    ],
  },
  {
    ...EDENOR_N2,
    periodo: '2025-12',
    consumoBaseKwh: 350,
    fuente: 'ENRE 5CE52EEEC778664D03258D6F0043247F',
    bloques: [
      { hastaKwh: 150, cargoFijo: 1383.0, cargoVariableBase: 52.455, cargoVariableExcedente: null },
      {
        hastaKwh: 400,
        cargoFijo: 2949.73,
        cargoVariableBase: 52.959,
        cargoVariableExcedente: 112.806,
      },
      {
        hastaKwh: 500,
        cargoFijo: 9686.25,
        cargoVariableBase: 62.282,
        cargoVariableExcedente: 122.129,
      },
      {
        hastaKwh: 600,
        cargoFijo: 15495.83,
        cargoVariableBase: 65.316,
        cargoVariableExcedente: 125.163,
      },
      {
        hastaKwh: 700,
        cargoFijo: 32660.81,
        cargoVariableBase: 65.544,
        cargoVariableExcedente: 125.391,
      },
      {
        hastaKwh: 1400,
        cargoFijo: 50943.07,
        cargoVariableBase: 77.71,
        cargoVariableExcedente: 137.557,
      },
    ],
  },
  {
    ...EDENOR_N2,
    periodo: '2026-02',
    consumoBaseKwh: 300,
    fuente: 'ENRE 8D4B34105791105403258D8F006D881C',
    bloques: [
      {
        hastaKwh: 150,
        cargoFijo: 1457.11,
        cargoVariableBase: 51.621,
        cargoVariableExcedente: null,
      },
      {
        hastaKwh: 400,
        cargoFijo: 3107.78,
        cargoVariableBase: 52.152,
        cargoVariableExcedente: 132.15,
      },
      {
        hastaKwh: 500,
        cargoFijo: 10205.28,
        cargoVariableBase: 61.975,
        cargoVariableExcedente: 141.973,
      },
      {
        hastaKwh: 600,
        cargoFijo: 16326.14,
        cargoVariableBase: 65.172,
        cargoVariableExcedente: 145.17,
      },
      {
        hastaKwh: 700,
        cargoFijo: 34410.88,
        cargoVariableBase: 65.411,
        cargoVariableExcedente: 145.409,
      },
      {
        hastaKwh: 1400,
        cargoFijo: 53672.76,
        cargoVariableBase: 78.23,
        cargoVariableExcedente: 158.228,
      },
    ],
  },
  {
    ...EDENOR_N2,
    periodo: '2026-03',
    consumoBaseKwh: 150,
    fuente: 'ENRE 7BED190C55A9DBCA03258DAF0043A06A',
    bloques: [
      {
        hastaKwh: 150,
        cargoFijo: 1493.56,
        cargoVariableBase: 54.497,
        cargoVariableExcedente: null,
      },
      {
        hastaKwh: 400,
        cargoFijo: 3185.53,
        cargoVariableBase: 55.041,
        cargoVariableExcedente: 132.532,
      },
      {
        hastaKwh: 500,
        cargoFijo: 10460.58,
        cargoVariableBase: 65.11,
        cargoVariableExcedente: 142.6,
      },
      {
        hastaKwh: 600,
        cargoFijo: 16734.58,
        cargoVariableBase: 68.387,
        cargoVariableExcedente: 145.877,
      },
      {
        hastaKwh: 700,
        cargoFijo: 35271.74,
        cargoVariableBase: 68.632,
        cargoVariableExcedente: 146.122,
      },
      {
        hastaKwh: 1400,
        cargoFijo: 55015.5,
        cargoVariableBase: 81.772,
        cargoVariableExcedente: 159.262,
      },
    ],
  },
  {
    ...EDENOR_N2,
    periodo: '2026-04',
    consumoBaseKwh: 150,
    fuente: 'ENRE 8ED7D2B42899AACD03258DCA0072013C',
    bloques: [
      {
        hastaKwh: 150,
        cargoFijo: 1524.17,
        cargoVariableBase: 57.797,
        cargoVariableExcedente: null,
      },
      {
        hastaKwh: 400,
        cargoFijo: 3250.82,
        cargoVariableBase: 58.352,
        cargoVariableExcedente: 133.345,
      },
      {
        hastaKwh: 500,
        cargoFijo: 10674.98,
        cargoVariableBase: 68.627,
        cargoVariableExcedente: 143.621,
      },
      {
        hastaKwh: 600,
        cargoFijo: 17077.56,
        cargoVariableBase: 71.971,
        cargoVariableExcedente: 146.964,
      },
      {
        hastaKwh: 700,
        cargoFijo: 35994.65,
        cargoVariableBase: 72.222,
        cargoVariableExcedente: 147.215,
      },
      {
        hastaKwh: 1400,
        cargoFijo: 56143.07,
        cargoVariableBase: 85.63,
        cargoVariableExcedente: 160.623,
      },
    ],
  },
  {
    ...EDENOR_N2,
    periodo: '2026-06',
    consumoBaseKwh: 300,
    fuente: 'ENRE 6F3030F71B1D0F9103258E060045C260',
    bloques: [
      {
        hastaKwh: 150,
        cargoFijo: 1661.69,
        cargoVariableBase: 71.518,
        cargoVariableExcedente: null,
      },
      {
        hastaKwh: 400,
        cargoFijo: 3544.12,
        cargoVariableBase: 72.124,
        cargoVariableExcedente: 147.156,
      },
      {
        hastaKwh: 500,
        cargoFijo: 11638.12,
        cargoVariableBase: 83.326,
        cargoVariableExcedente: 158.359,
      },
      {
        hastaKwh: 600,
        cargoFijo: 18618.38,
        cargoVariableBase: 86.971,
        cargoVariableExcedente: 162.004,
      },
      {
        hastaKwh: 700,
        cargoFijo: 39242.25,
        cargoVariableBase: 87.244,
        cargoVariableExcedente: 162.277,
      },
      {
        hastaKwh: 1400,
        cargoFijo: 61208.56,
        cargoVariableBase: 101.863,
        cargoVariableExcedente: 176.895,
      },
    ],
  },
  {
    ...EDENOR_N2,
    periodo: '2026-07',
    consumoBaseKwh: 300,
    fuente: 'ENRE 3FF0093CEC594ECF03258E2800502AFD',
    bloques: [
      {
        hastaKwh: 150,
        cargoFijo: 1710.71,
        cargoVariableBase: 69.303,
        cargoVariableExcedente: null,
      },
      {
        hastaKwh: 400,
        cargoFijo: 3648.68,
        cargoVariableBase: 69.926,
        cargoVariableExcedente: 155.504,
      },
      {
        hastaKwh: 500,
        cargoFijo: 11981.48,
        cargoVariableBase: 81.459,
        cargoVariableExcedente: 167.037,
      },
      {
        hastaKwh: 600,
        cargoFijo: 19167.67,
        cargoVariableBase: 85.212,
        cargoVariableExcedente: 170.79,
      },
      {
        hastaKwh: 700,
        cargoFijo: 40400.01,
        cargoVariableBase: 85.493,
        cargoVariableExcedente: 171.071,
      },
      {
        hastaKwh: 1400,
        cargoFijo: 63014.37,
        cargoVariableBase: 100.542,
        cargoVariableExcedente: 186.121,
      },
    ],
  },
];

/** El período más reciente que se conoce. Es el que usa la app por defecto. */
export const PERIODO_VIGENTE = CUADROS_ENRE[CUADROS_ENRE.length - 1].periodo;

export function cuadroDe(periodo: string): CuadroEnre | null {
  return CUADROS_ENRE.find((c) => c.periodo === periodo) ?? null;
}
