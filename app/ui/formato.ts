// Formateo de números y fechas para la UI. Centralizado acá porque el desglose, la escalera
// y el héroe tienen que mostrar el mismo número con la misma forma.

import type { Origen } from '../store/useCuadros';

export const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

export const pesosRedondos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export const kwhFmt = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// El ticket imprime el precio del kWh con 3 decimales; conviene mostrarlo igual para poder
// contrastar de un vistazo.
export const precioFmt = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

// Dos formatters en vez de uno: con ambos juntos, es-AR devuelve "30/7, 09:14 a. m." y habría
// que partir esa cadena para armar el texto. hour12 explícito porque el default del locale es
// de 12 horas.
const fechaFmt = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' });
const horaFmt = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '2026-07' → 'jul 2026'. Se parsea a mano: `new Date('2026-07')` cae en UTC y corre el mes. */
export function periodoCorto(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  return `${MESES[Number(mes) - 1] ?? mes} ${anio}`;
}

/**
 * De cuándo son las tarifas que se están usando.
 *
 * Importa decirlo: los cuadros se actualizan solos por red, así que sin esto no hay forma de
 * distinguir una app al día de una que hace un mes que no se conecta y calcula con precios
 * viejos. El período ya está arriba, pero solo dice qué mes es, no si es el último publicado.
 */
export function textoActualizacion(origen: Origen, actualizadoEn: string | null): string {
  if (origen === 'embebido' || !actualizadoEn) {
    return 'Tarifas de la versión instalada';
  }

  const cuando = new Date(actualizadoEn);
  return `Tarifas actualizadas el ${fechaFmt.format(cuando)} · ${horaFmt.format(cuando)}`;
}
