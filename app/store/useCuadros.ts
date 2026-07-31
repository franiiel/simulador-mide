// Los cuadros tarifarios que usa la app, y de dónde salieron.
//
// El JSON embebido en el bundle es el piso; encima va el que publica el repo, que el GitHub
// Action actualiza por cron (ver .github/workflows/tarifas.yml). Sin esto habría que publicar
// una versión en Play Store cada vez que el ENRE cambia una tarifa, o sea todos los meses.
//
// Vive en store/ y no en domain/ a propósito: toca red y AsyncStorage. El motor tiene que
// seguir siendo TypeScript puro para poder correr con `npx tsx domain/casos.ts` en Node.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { normalizarCuadros, usarCuadros } from '../domain/cuadrosEnre';
import { parsearCuadros } from '../domain/esquemaCuadros';
import { tarifaVigente } from '../domain/tarifas';
import type { TarifaMide } from '../domain/types';

// La rama queda cableada acá: cambiarla obliga a publicar una versión. Por eso apunta a main
// y no a una rama de feature. Ver docs/actualizacion-remota.md.
const URL =
  'https://raw.githubusercontent.com/franiiel/simulador-mide/main/app/domain/cuadrosEnre.json';

const CLAVE_CUADROS = 'cuadrosEnre';
const CLAVE_FECHA = 'cuadrosEnreActualizadoEn';

// fetch no tiene timeout propio: sin esto una red que acepta la conexión y no responde deja
// la promesa colgada para siempre. No bloquea nada —el refresco es en background— pero deja
// el estado mintiendo sobre el origen.
const TIMEOUT_MS = 10_000;

/** De dónde salieron los cuadros con los que se está calculando. */
export type Origen = 'embebido' | 'cache' | 'remoto';

type EstadoCuadros = {
  tarifa: TarifaMide;
  origen: Origen;
  /** ISO del último fetch remoto que se aceptó. null si nunca hubo uno. */
  actualizadoEn: string | null;
  refrescar: () => Promise<void>;
};

/** Valida, filtra a Edenor N2 e instala. Devuelve si los cuadros entraron. */
function instalar(json: unknown): boolean {
  const validados = parsearCuadros(json);
  if (!validados) return false;

  // normalizarCuadros() y no un filtro propio: es el mismo camino que usa el embebido, y es
  // lo único que garantiza que un cuadro bajado por red no entre sin filtrar por nivel.
  return usarCuadros(normalizarCuadros(validados));
}

export const useCuadros = create<EstadoCuadros>((set) => ({
  // El estado arranca con el embebido ya resuelto, así que la app calcula desde el primer
  // render y refrescar() no bloquea nada.
  tarifa: tarifaVigente(),
  origen: 'embebido',
  actualizadoEn: null,

  refrescar: async () => {
    // Primero el cache, que es local: deja a la app con lo mejor que tiene antes de que la
    // red conteste, o para siempre si no hay red.
    try {
      const [guardado, fecha] = await Promise.all([
        AsyncStorage.getItem(CLAVE_CUADROS),
        AsyncStorage.getItem(CLAVE_FECHA),
      ]);

      if (guardado && instalar(JSON.parse(guardado))) {
        set({ tarifa: tarifaVigente(), origen: 'cache', actualizadoEn: fecha });
      }
    } catch (e) {
      console.warn('No se pudo leer el cache de cuadros:', e);
    }

    // Después la red. Todo lo que falle acá deja la app como estaba: con el cache o con el
    // embebido, nunca sin cuadros.
    try {
      const corte = AbortSignal.timeout(TIMEOUT_MS);
      const respuesta = await fetch(URL, { signal: corte });
      if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status}`);
      }

      // .text() y JSON.parse() a mano en vez de .json(): la URL puede devolver 200 con algo
      // que no es JSON (un README, una página de error) y así el fallo cae en este catch.
      const crudo = await respuesta.text();
      if (!instalar(JSON.parse(crudo))) return;

      const ahora = new Date().toISOString();
      set({ tarifa: tarifaVigente(), origen: 'remoto', actualizadoEn: ahora });

      // Se persiste lo que ya se aceptó, no lo que llegó: si el remoto viniera más viejo que
      // lo que hay, instalar() lo rechaza y el cache no se ensucia.
      await AsyncStorage.multiSet([
        [CLAVE_CUADROS, crudo],
        [CLAVE_FECHA, ahora],
      ]);
    } catch (e) {
      console.warn('No se pudieron bajar los cuadros publicados:', e);
    }
  },
}));
