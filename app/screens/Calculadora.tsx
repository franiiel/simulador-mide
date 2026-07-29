import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { calcularKwh, calcularMes, proximidadAlSalto } from '../domain/calculadora';
import { bloqueBaseKwh, CUADRO_EDENOR } from '../domain/tarifas';
import { RECARGA_MAXIMA, RECARGA_MINIMA } from '../domain/types';
import type { Mes } from '../domain/types';
import { useSimulacion, validarAcumulado, validarMonto } from '../store/useSimulacion';

const MESES: { valor: Mes; etiqueta: string }[] = [
  { valor: 1, etiqueta: 'Ene' },
  { valor: 2, etiqueta: 'Feb' },
  { valor: 3, etiqueta: 'Mar' },
  { valor: 4, etiqueta: 'Abr' },
  { valor: 5, etiqueta: 'May' },
  { valor: 6, etiqueta: 'Jun' },
  { valor: 7, etiqueta: 'Jul' },
  { valor: 8, etiqueta: 'Ago' },
  { valor: 9, etiqueta: 'Sep' },
  { valor: 10, etiqueta: 'Oct' },
  { valor: 11, etiqueta: 'Nov' },
  { valor: 12, etiqueta: 'Dic' },
];

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const kwhFmt = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function Calculadora() {
  const {
    montoTexto,
    acumuladoTexto,
    mes,
    conSubsidio,
    setMontoTexto,
    setAcumuladoTexto,
    setMes,
    setConSubsidio,
  } = useSimulacion();

  const vMonto = validarMonto(montoTexto);
  const vAcumulado = validarAcumulado(acumuladoTexto);
  const opciones = { mes, conSubsidio };

  const compra =
    vMonto.ok && vAcumulado.ok ? calcularKwh(vMonto.valor, opciones, vAcumulado.valor) : null;
  const facturaFinal = compra ? calcularMes(compra.consumoFinalKwh, opciones) : null;
  const salto = compra ? proximidadAlSalto(compra.consumoFinalKwh, opciones) : null;

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      <View style={styles.fuente}>
        <Text style={styles.fuenteTexto}>
          Cuadro tarifario {CUADRO_EDENOR.distribuidora} · período {CUADRO_EDENOR.periodo} ·{' '}
          {CUADRO_EDENOR.resolucion}
        </Text>
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
      <Text style={styles.ayuda}>
        Entre {pesos.format(RECARGA_MINIMA)} y {pesos.format(RECARGA_MAXIMA)} por recarga
      </Text>
      {!vMonto.ok && montoTexto.length > 0 ? (
        <Text style={styles.error}>{vMonto.error}</Text>
      ) : null}

      <Text style={styles.etiqueta}>Consumo acumulado del mes (kWh)</Text>
      <TextInput
        style={styles.input}
        value={acumuladoTexto}
        onChangeText={setAcumuladoTexto}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor="#9ca3af"
      />
      <Text style={styles.ayuda}>Define desde qué categoría empezás a comprar</Text>
      {!vAcumulado.ok ? <Text style={styles.error}>{vAcumulado.error}</Text> : null}

      <Text style={styles.etiqueta}>Mes</Text>
      <View style={styles.meses}>
        {MESES.map(({ valor, etiqueta }) => {
          const activo = valor === mes;
          return (
            <TouchableOpacity
              key={valor}
              onPress={() => setMes(valor)}
              style={[styles.mes, activo && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{etiqueta}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.ayuda}>Bloque base bonificado en este mes: {bloqueBaseKwh(mes)} kWh</Text>

      <Text style={styles.etiqueta}>Subsidio</Text>
      <View style={styles.segmentos}>
        <TouchableOpacity
          onPress={() => setConSubsidio(true)}
          style={[styles.segmento, conSubsidio && styles.chipActivo]}
        >
          <Text style={[styles.chipTexto, conSubsidio && styles.chipTextoActivo]}>
            Con subsidio
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setConSubsidio(false)}
          style={[styles.segmento, !conSubsidio && styles.chipActivo]}
        >
          <Text style={[styles.chipTexto, !conSubsidio && styles.chipTextoActivo]}>
            Sin subsidio
          </Text>
        </TouchableOpacity>
      </View>

      {compra && facturaFinal && salto ? (
        <>
          <View style={styles.resultado}>
            <Text style={styles.resultadoEtiqueta}>Te alcanza para</Text>
            <Text style={styles.resultadoKwh}>{kwhFmt.format(compra.kwhComprados)} kWh</Text>
            <Text style={styles.resultadoCategoria}>
              terminás el mes en {kwhFmt.format(compra.consumoFinalKwh)} kWh · categoría{' '}
              {compra.categoriaFinal}
            </Text>

            <View style={styles.desglose}>
              {compra.tramos.map((t, i) => (
                <View key={i} style={styles.fila}>
                  <Text style={styles.filaEtiqueta}>
                    {kwhFmt.format(t.kwh)} kWh en {t.categoria}
                    {t.bonificado ? ' (bonificado)' : ''}
                  </Text>
                  <Text style={styles.filaValor}>{pesos.format(t.precioKwh)}/kWh</Text>
                </View>
              ))}
            </View>
          </View>

          {salto.categoriaSiguiente && salto.saltoTotal !== null ? (
            <View style={styles.salto}>
              <Text style={styles.saltoTitulo}>
                Terminás a {kwhFmt.format(salto.kwhHastaElSalto ?? 0)} kWh de pasar a{' '}
                {salto.categoriaSiguiente}
              </Text>
              <Text style={styles.saltoTexto}>
                Si el mes termina ahí, el cargo fijo sube {pesos.format(salto.saltoCargoFijo ?? 0)}{' '}
                y la factura pasa de {pesos.format(salto.totalActual)} a{' '}
                {pesos.format(salto.totalTrasElSalto ?? 0)}.
              </Text>
            </View>
          ) : null}

          <View style={styles.factura}>
            <Text style={styles.facturaTitulo}>Factura estimada del mes</Text>
            <Fila etiqueta="Energía" valor={pesos.format(facturaFinal.costoEnergia)} />
            <Fila
              etiqueta={`Cargo fijo (${facturaFinal.categoriaFinal})`}
              valor={pesos.format(facturaFinal.cargoFijo)}
            />
            <Fila etiqueta="Total" valor={pesos.format(facturaFinal.total)} />
            <Text style={styles.facturaNota}>
              El cargo fijo es mensual y no sale de la recarga.
            </Text>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
      <Text style={styles.filaValor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#fff' },
  contenido: { padding: 20 },
  fuente: { backgroundColor: '#f3f4f6', borderRadius: 8, padding: 10, marginBottom: 8 },
  fuenteTexto: { color: '#4b5563', fontSize: 12 },
  etiqueta: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 6 },
  ayuda: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 4 },
  meses: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mes: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  segmentos: { flexDirection: 'row', gap: 8 },
  segmento: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  chipActivo: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipTexto: { fontSize: 14, fontWeight: '600', color: '#374151' },
  chipTextoActivo: { color: '#fff' },
  resultado: { marginTop: 24, padding: 16, borderRadius: 12, backgroundColor: '#eff6ff' },
  resultadoEtiqueta: { fontSize: 13, color: '#1e40af', fontWeight: '600' },
  resultadoKwh: { fontSize: 34, fontWeight: '700', color: '#1e3a8a' },
  resultadoCategoria: { fontSize: 13, color: '#1e40af' },
  desglose: { marginTop: 12, gap: 4 },
  fila: { flexDirection: 'row', justifyContent: 'space-between' },
  filaEtiqueta: { fontSize: 13, color: '#4b5563' },
  filaValor: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  salto: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  saltoTitulo: { fontSize: 15, fontWeight: '700', color: '#78350f', marginBottom: 6 },
  saltoTexto: { fontSize: 13, color: '#78350f', lineHeight: 19 },
  factura: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 4,
  },
  facturaTitulo: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 4 },
  facturaNota: { fontSize: 12, color: '#6b7280', marginTop: 6 },
});
