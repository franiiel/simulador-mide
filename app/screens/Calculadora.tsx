import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { calcularKwh } from '../domain/calculadora';
import { getTarifa } from '../domain/tarifas';
import type { DetalleTramo, Segmento } from '../domain/types';
import { useSimulacion, validarEntrada } from '../store/useSimulacion';

const SEGMENTOS: { valor: Segmento; etiqueta: string }[] = [
  { valor: 'N1', etiqueta: 'N1' },
  { valor: 'N2', etiqueta: 'N2' },
  { valor: 'N3', etiqueta: 'N3' },
];

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const kwh = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// El tramo sin tope es el de precio pleno; cualquier anterior está subsidiado.
// Sale de la estructura del modelo, no de un campo inventado.
function etiquetaTramo(detalle: DetalleTramo): string {
  return detalle.tramo.hastaKwh === null ? 'sin subsidio' : 'subsidiado';
}

export function Calculadora() {
  const { segmento, montoTexto, acumuladoTexto, setSegmento, setMontoTexto, setAcumuladoTexto } =
    useSimulacion();

  const validacion = validarEntrada({ segmento, montoTexto, acumuladoTexto });
  const resultado = validacion.ok
    ? calcularKwh(
        validacion.datos.montoTexto,
        getTarifa(validacion.datos.segmento),
        validacion.datos.acumuladoTexto,
      )
    : null;
  const errores = validacion.ok ? {} : validacion.errores;

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      <View style={styles.aviso}>
        <Text style={styles.avisoTexto}>
          Las tarifas cargadas son valores de ejemplo, no las reales de Edenor. Los resultados no
          sirven para tomar decisiones de consumo.
        </Text>
      </View>

      <Text style={styles.etiqueta}>Segmento</Text>
      <View style={styles.segmentos}>
        {SEGMENTOS.map(({ valor, etiqueta }) => {
          const activo = valor === segmento;
          return (
            <TouchableOpacity
              key={valor}
              onPress={() => setSegmento(valor)}
              style={[styles.segmento, activo && styles.segmentoActivo]}
            >
              <Text style={[styles.segmentoTexto, activo && styles.segmentoTextoActivo]}>
                {etiqueta}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.etiqueta}>Monto a cargar</Text>
      <TextInput
        style={styles.input}
        value={montoTexto}
        onChangeText={setMontoTexto}
        keyboardType="numeric"
        placeholder="60000"
        placeholderTextColor="#9ca3af"
      />
      {errores.montoTexto ? <Text style={styles.error}>{errores.montoTexto}</Text> : null}

      <Text style={styles.etiqueta}>Consumo acumulado del mes (kWh)</Text>
      <TextInput
        style={styles.input}
        value={acumuladoTexto}
        onChangeText={setAcumuladoTexto}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor="#9ca3af"
      />
      {errores.acumuladoTexto ? <Text style={styles.error}>{errores.acumuladoTexto}</Text> : null}

      {resultado ? (
        <View style={styles.resultado}>
          <Text style={styles.resultadoEtiqueta}>Obtenés</Text>
          <Text style={styles.resultadoKwh}>{kwh.format(resultado.kwh)} kWh</Text>

          {resultado.detalle.length > 0 ? (
            <View style={styles.desglose}>
              {resultado.detalle.map((detalle, i) => (
                <View key={i} style={styles.filaDesglose}>
                  <Text style={styles.desgloseKwh}>{kwh.format(detalle.kwhEnTramo)} kWh</Text>
                  <Text style={styles.desgloseDetalle}>
                    {etiquetaTramo(detalle)} · {pesos.format(detalle.tramo.precioKwh)}/kWh
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contenido: {
    padding: 20,
    gap: 8,
  },
  aviso: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  avisoTexto: {
    color: '#78350f',
    fontSize: 13,
    lineHeight: 18,
  },
  etiqueta: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  segmentos: {
    flexDirection: 'row',
    gap: 8,
  },
  segmento: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  segmentoActivo: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  segmentoTexto: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  segmentoTextoActivo: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  error: {
    color: '#b91c1c',
    fontSize: 13,
  },
  resultado: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
  },
  resultadoEtiqueta: {
    fontSize: 13,
    color: '#1e40af',
    fontWeight: '600',
  },
  resultadoKwh: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  desglose: {
    marginTop: 12,
    gap: 6,
  },
  filaDesglose: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  desgloseKwh: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  desgloseDetalle: {
    fontSize: 13,
    color: '#4b5563',
  },
});
