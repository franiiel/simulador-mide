// Validación del JSON de cuadros que llega de afuera del bundle.
//
// El embebido se genera con el scraper y es confiable. El que baja de la red no: puede venir
// truncado, con otro shape, o ser directamente otra cosa (una URL mal apuntada devuelve 200 y
// un HTML). Acá el modo de error que importa no es que la app explote —eso se nota— sino que
// calcule con datos a medias y muestre números plausibles y equivocados.

import { z } from 'zod';
import type { CuadroEnre } from './types';
import { TOPES_KWH } from './types';

const bloqueSchema = z.object({
  hastaKwh: z.number().positive(),
  cargoFijo: z.number().nonnegative(),
  cargoVariableBase: z.number().nonnegative(),
  // null es válido: el cuadro no publica cargo excedente en R1. costoFactura() ya corta si
  // aparecen kWh excedentes sin precio.
  cargoVariableExcedente: z.number().nonnegative().nullable(),
});

const cuadroSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/, 'el período va como YYYY-MM'),
  distribuidora: z.string().min(1),
  // Laxo a propósito, igual que en cuadrosEnre.ts: el JSON trae los tres niveles y el filtro
  // es el que estrecha a N2. Un enum acá rechazaría el archivo entero por traer N1.
  nivel: z.string().min(1),
  // 0 es un valor real, no un dato faltante: los cuadros de 2024 lo traen en cero (N1 no
  // tiene subsidio, y N2 tampoco lo tuvo hasta mediados de ese año). Pedir > 0 acá rechazaría
  // el JSON embebido entero.
  consumoBaseKwh: z.number().nonnegative(),
  bloques: z
    .array(bloqueSchema)
    // El chequeo menos obvio y el más importante. TOPE_TASA_MUNICIPAL_KWH = 600 asume que 600
    // es un tope de la escalera: de ahí sale que el costo marginal sea constante dentro del
    // tramo, y de ahí que la inversa monto → kWh se resuelva con una división en vez de
    // iterando. Con otra escalera esa propiedad se cae SIN QUE NADA FALLE.
    //
    // La contra asumida: si el ENRE algún día cambia los bloques de verdad, la app rechaza el
    // cuadro nuevo y se queda con el que tenía hasta que se publique una versión. Es la
    // dirección segura —viejo es mejor que mal— y el cuadro igual queda visible en el repo,
    // porque el Action lo commitea igual.
    .refine(
      (bloques) => bloques.map((b) => b.hastaKwh).join(',') === TOPES_KWH.join(','),
      `los bloques tienen que ser exactamente ${TOPES_KWH.join(', ')} kWh`,
    ),
  fuente: z.string().min(1),
});

const cuadrosSchema = z.array(cuadroSchema).min(1);

/**
 * Valida un JSON de cuadros. Devuelve null si no sirve.
 *
 * No lanza: un remoto inválido se descarta y la app sigue con lo que ya tenía. Lanzar
 * obligaría a cada llamador a acordarse de atajarlo, y el que se olvide rompe el arranque.
 *
 * El resultado todavía NO está filtrado a Edenor N2 — eso lo hace normalizarCuadros().
 */
export function parsearCuadros(json: unknown): CuadroEnre[] | null {
  const resultado = cuadrosSchema.safeParse(json);
  if (!resultado.success) {
    console.warn('Cuadros descartados por no validar:', resultado.error.issues[0]?.message);
    return null;
  }

  // El esquema deja `nivel: string`; el filtro de normalizarCuadros() lo estrecha a Nivel.
  return resultado.data as CuadroEnre[];
}
