// Cuadros tarifarios T1-R de Edenor publicados por el ENRE.
//
// Los datos están en cuadrosEnre.json, que lo genera el scraper del repo:
//
//     uv run scraper/main.py            # trae el último cuadro publicado
//     uv run scraper/main.py --check    # valida los parsers
//
// No editar el JSON a mano: se regenera. Ver scraper/README.md, que documenta los dos
// formatos de cuadro que publicó el ENRE (cambiaron en febrero de 2026) y de dónde sale cada
// campo.
//
// Estos cuadros son la FUENTE del cálculo: los precios por tramo que cobra MIDE se derivan de
// acá con precioTramo() (ver tarifas.ts), no se copian de los comprobantes. Los tickets son
// el set de validación — casos.ts reproduce 12 comprobantes reales.
//
// Ojo con el consumo base, que es el campo menos obvio: es la cantidad de kWh mensuales que
// se cobran al precio subsidiado, y es estacional en el régimen 2026 (300 kWh en dic-feb y
// may-ago, 150 en mar-abr y sep-nov; el régimen anterior usaba 350 fijo). Ese parámetro es lo
// que explica que el tramo ≤400 casi se duplicara entre dic/25 y mar/26: no fue solo la quita
// de subsidio, fue que el consumo base bajó de 350 a 150 y el bloque pasó a ser todo
// excedente.

import crudos from './cuadrosEnre.json';
import type { CuadroEnre, Nivel } from './types';

/**
 * El motor calcula para Edenor nivel N2, que es el del medidor de los comprobantes.
 *
 * El JSON trae los tres niveles de cada período, así que hay que filtrar: `cuadroDe()` busca
 * solo por período y sin este filtro devolvería el primer nivel que matchee. Eso calcularía
 * con la tarifa sin subsidio sin que nada falle — números plausibles y equivocados, que es el
 * modo de error que ya produjo tres modelos falsos en este proyecto.
 *
 * Cuando se agregue selector de nivel, los otros ya están en el JSON.
 */
const DISTRIBUIDORA: string = 'edenor';
const NIVEL: Nivel = 'N2';

// El JSON infiere `nivel: string`, que no es asignable a Nivel. Se tipa laxo y el filtro lo
// estrecha, en vez de forzar el tipo con un cast que podría tapar un cambio de shape.
type CuadroCrudo = Omit<CuadroEnre, 'nivel'> & { nivel: string };

export const CUADROS_ENRE: CuadroEnre[] = (crudos as CuadroCrudo[])
  .filter((cuadro) => cuadro.distribuidora === DISTRIBUIDORA && cuadro.nivel === NIVEL)
  .map((cuadro) => ({ ...cuadro, nivel: NIVEL }))
  .sort((a, b) => a.periodo.localeCompare(b.periodo));

/** El período más reciente que se conoce. Es el que usa la app por defecto. */
export const PERIODO_VIGENTE = CUADROS_ENRE[CUADROS_ENRE.length - 1].periodo;

export function cuadroDe(periodo: string): CuadroEnre | null {
  return CUADROS_ENRE.find((cuadro) => cuadro.periodo === periodo) ?? null;
}
