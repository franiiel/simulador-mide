// Tokens visuales de la app. Es la única fuente de colores y tipografías: las pantallas no
// declaran hex propios.
//
// Vive en ui/ y no en domain/ porque importa de react-native. El motor tiene que seguir
// siendo TypeScript puro para correr con `npx tsx domain/casos.ts` en Node.

import type { TextStyle } from 'react-native';
import { useColorScheme } from 'react-native';
import type { TramoPrecio } from '../domain/types';

export type Paleta = {
  fondo: string;
  superficie: string;
  borde: string;
  ink: string;
  muted: string;
  /** Relleno de la escalera todavía no recorrida. */
  tenue: string;
  positivo: string;
  positivoFondo: string;
  alerta: string;
  alertaFondo: string;
  error: string;
  errorFondo: string;
  /**
   * Anclas de la rampa de precios, de barato a caro. La escalera de MIDE no es monótona
   * —cruzar los 700 kWh abarata el kWh— así que el color sale del precio y no del orden del
   * tramo: si saliera del orden, el tramo más barato se pintaría como el más caro.
   */
  rampa: string[];
};

const claro: Paleta = {
  fondo: '#FBFBFA',
  superficie: '#FFFFFF',
  borde: '#E7E5E1',
  ink: '#14161A',
  muted: '#6B7280',
  tenue: '#EFEDE9',
  positivo: '#16A34A',
  positivoFondo: '#ECFDF5',
  alerta: '#B45309',
  alertaFondo: '#FEF6E7',
  error: '#B91C1C',
  errorFondo: '#FEF2F2',
  rampa: ['#3B82F6', '#8B5CF6', '#D946A6', '#E0553C'],
};

const oscuro: Paleta = {
  fondo: '#0E1013',
  superficie: '#171A1F',
  borde: '#262A31',
  ink: '#F3F4F6',
  muted: '#9BA3AF',
  tenue: '#22262D',
  positivo: '#4ADE80',
  positivoFondo: '#0F2419',
  alerta: '#FBBF24',
  alertaFondo: '#241C0B',
  error: '#F87171',
  errorFondo: '#261415',
  rampa: ['#60A5FA', '#A78BFA', '#F472B6', '#FB7A5F'],
};

export function useTema(): { paleta: Paleta; oscuro: boolean } {
  const esOscuro = useColorScheme() === 'dark';
  return { paleta: esOscuro ? oscuro : claro, oscuro: esOscuro };
}

/**
 * Escala tipográfica. Una sola superfamilia (Archivo), jerarquía por peso: el paquete de
 * Google Fonts no publica la variante Expanded, así que el peso Black con el tracking cerrado
 * es lo que le da presencia al número grande.
 */
export const tipo = {
  heroe: { fontFamily: 'Archivo_900Black', fontSize: 54, letterSpacing: -2.2 },
  heroeUnidad: { fontFamily: 'Archivo_700Bold', fontSize: 21, letterSpacing: -0.4 },
  titulo: { fontFamily: 'Archivo_700Bold', fontSize: 19, letterSpacing: -0.3 },
  seccion: { fontFamily: 'Archivo_600SemiBold', fontSize: 15, letterSpacing: -0.1 },
  eyebrow: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cuerpo: { fontFamily: 'Archivo_400Regular', fontSize: 15, lineHeight: 21 },
  dato: { fontFamily: 'Archivo_500Medium', fontSize: 14, fontVariant: ['tabular-nums'] },
  entrada: { fontFamily: 'Archivo_600SemiBold', fontSize: 19, fontVariant: ['tabular-nums'] },
  pie: { fontFamily: 'Archivo_400Regular', fontSize: 12, lineHeight: 17 },
} satisfies Record<string, TextStyle>;

export const espacio = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radio = { sm: 8, md: 12, lg: 16 };

/** Los pesos que carga App.tsx. Cambiar acá obliga a cambiar `tipo` y viceversa. */
export const PESOS_ARCHIVO = [
  'Archivo_400Regular',
  'Archivo_500Medium',
  'Archivo_600SemiBold',
  'Archivo_700Bold',
  'Archivo_900Black',
] as const;

function componentes(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mezclar(a: string, b: string, t: number): string {
  const [ra, ga, ba] = componentes(a);
  const [rb, gb, bb] = componentes(b);
  const canal = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${canal(ra, rb)}, ${canal(ga, gb)}, ${canal(ba, bb)})`;
}

function enRampa(rampa: string[], t: number): string {
  const escalado = Math.min(Math.max(t, 0), 1) * (rampa.length - 1);
  const i = Math.min(Math.floor(escalado), rampa.length - 2);
  return mezclar(rampa[i], rampa[i + 1], escalado - i);
}

/** Vuelve translúcido un color de la rampa, que siempre viene como `rgb(r, g, b)`. */
export function conAlfa(color: string, alfa: number): string {
  return color.replace('rgb(', 'rgba(').replace(')', `, ${alfa})`);
}

/**
 * Un color por tramo, interpolado sobre la rampa según el precio real del cuadro vigente.
 *
 * Se normaliza contra el mínimo y el máximo del propio cuadro, no contra valores fijos: los
 * precios cambian todos los meses y el color tiene que seguir significando "caro respecto de
 * los demás tramos de este período".
 */
export function coloresDeTramos(tramos: TramoPrecio[], rampa: string[]): string[] {
  const precios = tramos.map((t) => t.precioKwh);
  const min = Math.min(...precios);
  const max = Math.max(...precios);
  return precios.map((p) => enRampa(rampa, max === min ? 0 : (p - min) / (max - min)));
}
