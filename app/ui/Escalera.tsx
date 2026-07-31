// La escalera de precios de MIDE, dibujada.
//
// Es el elemento que distingue a esta app de una calculadora cualquiera: muestra que el kWh no
// tiene un precio, tiene seis, y que dónde caiga tu acumulado del mes decide cuánto rinde la
// plata. Los segmentos van a escala del kWh que abarca cada tramo, así que los tramos angostos
// del medio (500, 600 y 700 kWh miden 100 kWh cada uno) se ven apretados: es la zona donde el
// precio cambia más seguido.
//
// La barra sola no alcanza: dice dónde estás pero no qué vale cada color. Por eso abajo va
// siempre la lista de tramos con su precio, que es la referencia de la barra.

import { StyleSheet, Text, View } from 'react-native';
import type { TramoPrecio } from '../domain/types';
import { kwhFmt, precioFmt } from './formato';
import { conAlfa, espacio, radio, tipo, useTema } from './theme';

const ALTO = 22;

type Props = {
  tramos: TramoPrecio[];
  /** Un color por tramo, en el mismo orden. Sale de `coloresDeTramos()`. */
  colores: string[];
  /** Acumulado del mes antes de la recarga. */
  desde: number;
  /** Acumulado después de la recarga. Sin esto la escalera solo marca dónde estás parado. */
  hasta?: number | null;
};

export function Escalera({ tramos, colores, desde, hasta }: Props) {
  const { paleta } = useTema();

  const tope = tramos[tramos.length - 1].hastaKwhAcumulados;
  const finRecorrido = hasta ?? desde;
  const posicion = Math.min(Math.max(desde / tope, 0), 1) * 100;

  // Mismo criterio que tramoPara() en domain/tarifas.ts: el acumulado pertenece al primer
  // tramo cuyo tope no supera.
  const actual = tramos.findIndex((t) => desde <= t.hastaKwhAcumulados);

  return (
    <View style={styles.todo}>
      <View>
        <View style={[styles.barra, { backgroundColor: paleta.tenue }]}>
          {tramos.map((tramo, i) => {
            const pisoTramo = i === 0 ? 0 : tramos[i - 1].hastaKwhAcumulados;
            const ancho = tramo.hastaKwhAcumulados - pisoTramo;

            // Cuánto de este tramo cubre la recarga, y desde dónde. Se calcula por tramo en vez
            // de recortar una barra continua: así el relleno respeta los cortes entre segmentos.
            const inicio = Math.max(desde, pisoTramo);
            const fin = Math.min(finRecorrido, tramo.hastaKwhAcumulados);
            const cubierto = Math.max(0, fin - inicio);

            return (
              <View
                key={tramo.hastaKwhAcumulados}
                style={[
                  styles.tramo,
                  { flexGrow: ancho, backgroundColor: conAlfa(colores[i], 0.2) },
                ]}
              >
                <View style={{ width: `${((inicio - pisoTramo) / ancho) * 100}%` }} />
                <View
                  style={{ width: `${(cubierto / ancho) * 100}%`, backgroundColor: colores[i] }}
                />
              </View>
            );
          })}

          <View style={[styles.marca, { left: `${posicion}%`, backgroundColor: paleta.ink }]} />
        </View>

        <View style={styles.extremos}>
          <Text style={[tipo.pie, { color: paleta.muted }]}>0</Text>
          <Text style={[tipo.pie, { color: paleta.muted }]}>{tope} kWh</Text>
        </View>
      </View>

      <View style={styles.leyenda}>
        {/* Sin "kWh" en el título: el eyebrow va en mayúsculas y lo dejaría como "KWH". */}
        <Text style={[tipo.eyebrow, { color: paleta.muted }]}>Precio por tramo</Text>

        {tramos.map((tramo, i) => {
          const pisoTramo = i === 0 ? 0 : tramos[i - 1].hastaKwhAcumulados;
          const recorrido = finRecorrido > pisoTramo && desde < tramo.hastaKwhAcumulados;

          return (
            <View key={tramo.hastaKwhAcumulados} style={styles.fila}>
              <View
                style={[
                  styles.punto,
                  { backgroundColor: recorrido ? colores[i] : conAlfa(colores[i], 0.35) },
                ]}
              />
              <Text
                style={[tipo.dato, styles.rango, { color: recorrido ? paleta.ink : paleta.muted }]}
                numberOfLines={1}
              >
                {pisoTramo} a {tramo.hastaKwhAcumulados} kWh
                {i === actual ? <Text style={{ color: paleta.muted }}> · estás acá</Text> : null}
              </Text>
              <Text style={[tipo.dato, { color: recorrido ? paleta.ink : paleta.muted }]}>
                {precioFmt.format(tramo.precioKwh)}
              </Text>
            </View>
          );
        })}

        <Text style={[tipo.pie, { color: paleta.muted }]}>
          {hasta != null
            ? `Con esta recarga vas de ${kwhFmt.format(desde)} a ${kwhFmt.format(hasta)} kWh acumulados.`
            : `Vas ${kwhFmt.format(desde)} kWh acumulados en el mes.`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  todo: { gap: espacio.lg },
  barra: {
    flexDirection: 'row',
    height: ALTO,
    borderRadius: radio.sm,
    overflow: 'hidden',
    gap: 2,
  },
  // flexBasis 0 para que el ancho salga solo de flexGrow: con el default (auto) los tramos
  // vacíos no se reparten a escala del kWh que abarcan.
  tramo: { flexDirection: 'row', flexBasis: 0, height: '100%' },
  marca: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: ALTO + 6,
    marginLeft: -1,
    borderRadius: 1,
  },
  extremos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: espacio.xs },
  leyenda: { gap: espacio.xs },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  punto: { width: 8, height: 8, borderRadius: 4 },
  // flex 1 en el rango empuja el precio contra el borde derecho y deja las seis filas con la
  // columna de precios alineada.
  rango: { flex: 1 },
});
