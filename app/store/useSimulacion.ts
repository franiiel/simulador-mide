import { z } from 'zod';
import { create } from 'zustand';
import { RECARGA_MAXIMA, RECARGA_MINIMA } from '../domain/types';
import type { Mes } from '../domain/types';

// La entrada se guarda como texto porque es lo que devuelve TextInput. Convertirla a
// número es responsabilidad de la validación, no del store.
type EstadoSimulacion = {
  montoTexto: string;
  acumuladoTexto: string;
  mes: Mes;
  conSubsidio: boolean;
  setMontoTexto: (texto: string) => void;
  setAcumuladoTexto: (texto: string) => void;
  setMes: (mes: Mes) => void;
  setConSubsidio: (conSubsidio: boolean) => void;
};

const mesActual = (new Date().getMonth() + 1) as Mes;

export const useSimulacion = create<EstadoSimulacion>((set) => ({
  montoTexto: '',
  acumuladoTexto: '0',
  mes: mesActual,
  conSubsidio: true,
  setMontoTexto: (montoTexto) => set({ montoTexto }),
  setAcumuladoTexto: (acumuladoTexto) => set({ acumuladoTexto }),
  setMes: (mes) => set({ mes }),
  setConSubsidio: (conSubsidio) => set({ conSubsidio }),
}));

// Acepta coma como separador decimal: es lo natural al escribir números en es-AR.
const aNumero = (texto: string) => Number(texto.trim().replace(',', '.'));

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

// El mínimo y el máximo son límites duros de una recarga de MIDE, no sugerencias.
export const montoSchema = z
  .string()
  .trim()
  .min(1, 'Ingresá el monto')
  .transform(aNumero)
  .refine(Number.isFinite, 'El monto tiene que ser un número')
  .refine((v) => v >= RECARGA_MINIMA, `La recarga mínima es ${pesos.format(RECARGA_MINIMA)}`)
  .refine((v) => v <= RECARGA_MAXIMA, `La recarga máxima es ${pesos.format(RECARGA_MAXIMA)}`);

export const acumuladoSchema = z
  .string()
  .trim()
  .min(1, 'Ingresá el consumo acumulado')
  .transform(aNumero)
  .refine(Number.isFinite, 'El consumo tiene que ser un número')
  .refine((v) => v >= 0, 'El consumo no puede ser negativo');

export type Validacion<T> = { ok: true; valor: T } | { ok: false; error: string };

function validar<T>(schema: z.ZodType<T, string>, texto: string): Validacion<T> {
  const parsed = schema.safeParse(texto);
  return parsed.success
    ? { ok: true, valor: parsed.data }
    : { ok: false, error: parsed.error.issues[0].message };
}

export const validarMonto = (texto: string) => validar(montoSchema, texto);
export const validarAcumulado = (texto: string) => validar(acumuladoSchema, texto);
