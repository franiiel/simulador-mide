import { z } from 'zod';
import { create } from 'zustand';
import type { Segmento } from '../domain/types';

// La entrada se guarda como texto porque es lo que devuelve TextInput. Convertirla a
// número es responsabilidad de la validación, no del store.
type EstadoSimulacion = {
  segmento: Segmento;
  montoTexto: string;
  acumuladoTexto: string;
  setSegmento: (segmento: Segmento) => void;
  setMontoTexto: (texto: string) => void;
  setAcumuladoTexto: (texto: string) => void;
};

export const useSimulacion = create<EstadoSimulacion>((set) => ({
  segmento: 'N2',
  montoTexto: '',
  acumuladoTexto: '0',
  setSegmento: (segmento) => set({ segmento }),
  setMontoTexto: (montoTexto) => set({ montoTexto }),
  setAcumuladoTexto: (acumuladoTexto) => set({ acumuladoTexto }),
}));

// Acepta coma como separador decimal: es lo natural al escribir pesos en es-AR.
const numeroNoNegativo = (etiqueta: string) =>
  z
    .string()
    .trim()
    .min(1, `Ingresá ${etiqueta}`)
    .transform((texto) => Number(texto.replace(',', '.')))
    .refine((valor) => Number.isFinite(valor), `${etiqueta} tiene que ser un número`)
    .refine((valor) => valor >= 0, `${etiqueta} no puede ser negativo`);

export const entradaSchema = z.object({
  segmento: z.enum(['N1', 'N2', 'N3']),
  montoTexto: numeroNoNegativo('el monto'),
  acumuladoTexto: numeroNoNegativo('el consumo acumulado'),
});

export type EntradaValidada = z.infer<typeof entradaSchema>;

export type ResultadoValidacion =
  | { ok: true; datos: EntradaValidada }
  | { ok: false; errores: Partial<Record<keyof EntradaValidada, string>> };

/** Valida la entrada cruda del formulario y devuelve los datos ya convertidos o los errores por campo. */
export function validarEntrada(entrada: {
  segmento: Segmento;
  montoTexto: string;
  acumuladoTexto: string;
}): ResultadoValidacion {
  const parsed = entradaSchema.safeParse(entrada);
  if (parsed.success) {
    return { ok: true, datos: parsed.data };
  }

  const errores: Partial<Record<keyof EntradaValidada, string>> = {};
  for (const issue of parsed.error.issues) {
    const campo = issue.path[0] as keyof EntradaValidada | undefined;
    if (campo && !errores[campo]) {
      errores[campo] = issue.message;
    }
  }
  return { ok: false, errores };
}
