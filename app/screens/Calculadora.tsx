import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { calcularRecarga, proximidadAlSalto } from '../domain/calculadora';
import { topeEscalera } from '../domain/tarifas';
import type { TarifaMide } from '../domain/types';
import { RECARGA_MAXIMA, RECARGA_MINIMA, TOPE_TASA_MUNICIPAL_KWH } from '../domain/types';
import type { Origen } from '../store/useCuadros';
import { useCuadros } from '../store/useCuadros';
import { useSimulacion, validarAcumulado, validarMonto } from '../store/useSimulacion';

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const pesosRedondos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const kwhFmt = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
// El ticket imprime el precio del kWh con 3 decimales; conviene mostrarlo igual para poder
// contrastar de un vistazo.
const precioFmt = new Intl.NumberFormat('es-AR', {
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

/**
 * De cuándo son las tarifas que se están usando.
 *
 * Importa decirlo: los cuadros se actualizan solos por red, así que sin esto no hay forma de
 * distinguir una app al día de una que hace un mes que no se conecta y calcula con precios
 * viejos. El período ya está arriba, pero solo dice qué mes es, no si es el último publicado.
 */
function textoActualizacion(origen: Origen, actualizadoEn: string | null): string {
  if (origen === 'embebido' || !actualizadoEn) {
    return 'Tarifas de la versión instalada';
  }

  const cuando = new Date(actualizadoEn);
  return `Tarifas actualizadas el ${fechaFmt.format(cuando)} · ${horaFmt.format(cuando)}`;
}

/** Calcula la recarga y devuelve el error si el acumulado cae fuera de la escalera. */
function simular(monto: number, acumulado: number, tarifa: TarifaMide) {
  try {
    return {
      recarga: calcularRecarga(monto, acumulado, tarifa),
      salto: proximidadAlSalto(acumulado, tarifa),
      error: null,
    };
  } catch (e) {
    return { recarga: null, salto: null, error: (e as Error).message };
  }
}

export function Calculadora() {
  const { montoTexto, acumuladoTexto, setMontoTexto, setAcumuladoTexto } = useSimulacion();

  // La tarifa sale del store y se pasa explícita a todo el motor, en vez de dejar que caiga
  // en su default: los cuadros se reemplazan en runtime cuando llegan los publicados, y así
  // el render y el cálculo usan siempre el mismo.
  const { tarifa, origen, actualizadoEn } = useCuadros();

  const vMonto = validarMonto(montoTexto);
  const vAcumulado = validarAcumulado(acumuladoTexto);
  const simulacion =
    vMonto.ok && vAcumulado.ok ? simular(vMonto.valor, vAcumulado.valor, tarifa) : null;
  const recarga = simulacion?.recarga;

  // La tasa municipal no sale del cuadro del ENRE, solo de los tickets. Si el período
  // vigente no tiene ninguno que la confirme y la recarga igual la paga, hay que decirlo.
  const tasaSinConfirmar = tarifa.tasaMunicipalHeredada && (recarga?.tasaMunicipal ?? 0) > 0;

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      <View style={styles.fuente}>
        <Text style={styles.fuenteTexto}>
          {tarifa.distribuidora} · nivel {tarifa.nivel} · período {tarifa.periodo}
        </Text>
        <Text style={styles.fuenteTexto}>Precios derivados del cuadro tarifario T1-R del ENRE</Text>
        <Text style={styles.fuenteTexto}>{textoActualizacion(origen, actualizadoEn)}</Text>
      </View>

      <Text style={styles.etiqueta}>Monto a cargar</Text>
      <TextInput
        style={styles.input}
        value={montoTexto}
        onChangeText={setMontoTexto}
        keyboardType="numeric"
        placeholder="50000"
        placeholderTextColor="#9ca3af"
      />
      <Text style={styles.ayuda}>
        Entre {pesosRedondos.format(RECARGA_MINIMA)} y {pesosRedondos.format(RECARGA_MAXIMA)} por
        recarga
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
      <Text style={styles.ayuda}>
        El que dice "kWh Acumulados" en tu último comprobante. Se resetea cada mes.
      </Text>
      {!vAcumulado.ok ? <Text style={styles.error}>{vAcumulado.error}</Text> : null}

      {simulacion?.error ? (
        <View style={styles.desconocido}>
          <Text style={styles.desconocidoTexto}>{simulacion.error}</Text>
        </View>
      ) : null}

      {recarga ? (
        <>
          <View style={styles.resultado}>
            <Text style={styles.resultadoEtiqueta}>Se acreditan</Text>
            <Text style={styles.resultadoKwh}>{kwhFmt.format(recarga.kwh)} kWh</Text>
            <Text style={styles.resultadoNota}>
              {pesos.format(recarga.precioEfectivoPorKwh)}/kWh todo incluido · quedás en{' '}
              {kwhFmt.format(recarga.acumuladoFinalKwh)} kWh acumulados
            </Text>
          </View>

          <View style={styles.ticket}>
            <Text style={styles.ticketTitulo}>Desglose de la recarga</Text>

            {recarga.renglones.map((r) => (
              <View key={r.hastaKwhAcumulados} style={styles.renglon}>
                <Text style={styles.renglonTramo}>
                  Hasta {r.hastaKwhAcumulados} kWh · {precioFmt.format(r.precioKwh)}/kWh
                </Text>
                <View style={styles.fila}>
                  <Text style={styles.filaEtiqueta}>{kwhFmt.format(r.kwh)} kWh</Text>
                  <Text style={styles.filaValor}>{pesos.format(r.importe)}</Text>
                </View>
              </View>
            ))}

            <View style={styles.separador} />
            <Fila etiqueta="Energía (subtotal A)" valor={pesos.format(recarga.subtotalEnergia)} />
            <Fila etiqueta="IVA" valor={pesos.format(recarga.iva)} />
            <Fila
              etiqueta="Contribución municipal"
              valor={pesos.format(recarga.contribucionMunicipal)}
            />
            <Fila
              etiqueta="Contribución provincial"
              valor={pesos.format(recarga.contribucionProvincial)}
            />
            {recarga.tasaMunicipal > 0 ? (
              <Fila etiqueta="Tasa municipal" valor={pesos.format(recarga.tasaMunicipal)} />
            ) : null}
            <View style={styles.separador} />
            <Fila etiqueta="Total recargado" valor={pesos.format(recarga.montoBruto)} />

            <Text style={styles.ticketNota}>
              Los impuestos salen del monto: solo{' '}
              {Math.round((recarga.subtotalEnergia / recarga.montoBruto) * 100)}% compra energía.
            </Text>
          </View>

          {recarga.renglones.length > 1 ? (
            <Text style={styles.nota}>
              La recarga cruza un cambio de precio, así que se cobra en {recarga.renglones.length}{' '}
              tramos — igual que en el comprobante.
            </Text>
          ) : null}

          {tasaSinConfirmar ? (
            <View style={styles.aviso}>
              <Text style={styles.avisoTexto}>
                La tasa municipal ({pesos.format(tarifa.tasaMunicipalPorKwh)}/kWh bajo los{' '}
                {TOPE_TASA_MUNICIPAL_KWH} kWh) no la publica el ENRE y no hay comprobante de{' '}
                {tarifa.periodo} que la confirme: se usa la del último período conocido. Es el único
                número acá que no está verificado.
              </Text>
            </View>
          ) : null}

          {simulacion.salto && simulacion.salto.kwhHastaElSalto !== null ? (
            <Salto
              kwhHastaElSalto={simulacion.salto.kwhHastaElSalto}
              precioSiguiente={simulacion.salto.precioSiguiente}
              variacionPorKwh={simulacion.salto.variacionPorKwh}
              tope={topeEscalera(tarifa)}
            />
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

/**
 * El cambio de tramo puede abaratar o encarecer el kWh: la escalera no es monótona, y
 * cruzar los 700 kWh acumulados lo abarata bastante. Por eso el cartel cambia de color y de
 * texto según el signo, en vez de avisar siempre de un encarecimiento.
 */
function Salto({
  kwhHastaElSalto,
  precioSiguiente,
  variacionPorKwh,
  tope,
}: {
  kwhHastaElSalto: number;
  precioSiguiente: number | null;
  variacionPorKwh: number | null;
  tope: number;
}) {
  if (precioSiguiente === null || variacionPorKwh === null) {
    return (
      <View style={styles.saltoNeutro}>
        <Text style={styles.saltoTituloNeutro}>
          Estás a {kwhFmt.format(kwhHastaElSalto)} kWh del tope de {tope} kWh
        </Text>
        <Text style={styles.saltoTextoNeutro}>
          Pasando ese acumulado no se sabe qué precio aplica: el cuadro del ENRE publica el último
          bloque sin techo y ningún comprobante llegó tan alto.
        </Text>
      </View>
    );
  }

  const abarata = variacionPorKwh < 0;

  return (
    <View style={abarata ? styles.saltoBueno : styles.salto}>
      <Text style={abarata ? styles.saltoTituloBueno : styles.saltoTitulo}>
        {abarata ? 'Conviene pasar' : 'Ojo'}: a {kwhFmt.format(kwhHastaElSalto)} kWh cambia el
        precio
      </Text>
      <Text style={abarata ? styles.saltoTextoBueno : styles.saltoTexto}>
        Ahí el kWh {abarata ? 'baja' : 'sube'} a {precioFmt.format(precioSiguiente)} (
        {abarata ? '' : '+'}
        {pesos.format(variacionPorKwh)} por kWh).
      </Text>
    </View>
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
  fuente: { backgroundColor: '#f3f4f6', borderRadius: 8, padding: 10, marginBottom: 8, gap: 2 },
  fuenteTexto: { color: '#4b5563', fontSize: 12 },
  etiqueta: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 6 },
  ayuda: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  nota: { fontSize: 12, color: '#6b7280', marginTop: 10, lineHeight: 17 },
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
  desconocido: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  desconocidoTexto: { color: '#991b1b', fontSize: 14, lineHeight: 20 },
  resultado: { marginTop: 24, padding: 16, borderRadius: 12, backgroundColor: '#eff6ff' },
  resultadoEtiqueta: { fontSize: 13, color: '#1e40af', fontWeight: '600' },
  resultadoKwh: { fontSize: 34, fontWeight: '700', color: '#1e3a8a' },
  resultadoNota: { fontSize: 13, color: '#1e40af' },
  ticket: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 4,
  },
  ticketTitulo: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 4 },
  ticketNota: { fontSize: 12, color: '#6b7280', marginTop: 6 },
  separador: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 },
  renglon: { marginBottom: 4 },
  renglonTramo: { fontSize: 12, color: '#6b7280' },
  fila: { flexDirection: 'row', justifyContent: 'space-between' },
  filaEtiqueta: { fontSize: 13, color: '#4b5563' },
  filaValor: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  aviso: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  avisoTexto: { fontSize: 12, color: '#4b5563', lineHeight: 18 },
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
  saltoBueno: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#34d399',
  },
  saltoTituloBueno: { fontSize: 15, fontWeight: '700', color: '#065f46', marginBottom: 6 },
  saltoTextoBueno: { fontSize: 13, color: '#065f46', lineHeight: 19 },
  saltoNeutro: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  saltoTituloNeutro: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 6 },
  saltoTextoNeutro: { fontSize: 13, color: '#4b5563', lineHeight: 19 },
});
