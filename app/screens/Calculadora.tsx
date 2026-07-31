import Feather from '@expo/vector-icons/Feather';
import { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { calcularRecarga, proximidadAlSalto } from '../domain/calculadora';
import { topeEscalera } from '../domain/tarifas';
import type { ProximidadSalto, TarifaMide } from '../domain/types';
import { RECARGA_MAXIMA, RECARGA_MINIMA, TOPE_TASA_MUNICIPAL_KWH } from '../domain/types';
import { useCuadros } from '../store/useCuadros';
import { useSimulacion, validarAcumulado, validarMonto } from '../store/useSimulacion';
import { CampoNumero } from '../ui/CampoNumero';
import { Escalera } from '../ui/Escalera';
import { Plegable } from '../ui/Plegable';
import {
  kwhFmt,
  periodoCorto,
  pesos,
  pesosRedondos,
  precioFmt,
  textoActualizacion,
} from '../ui/formato';
import type { Paleta } from '../ui/theme';
import { coloresDeTramos, espacio, radio, tipo, useTema } from '../ui/theme';

/** Dónde cae el acumulado en la escalera. Falla si queda fuera del último tramo conocido. */
function analizar(acumulado: number, tarifa: TarifaMide) {
  try {
    return { salto: proximidadAlSalto(acumulado, tarifa), error: null };
  } catch (e) {
    return { salto: null, error: (e as Error).message };
  }
}

/** Calcula la recarga. Falla si el monto llenaría la escalera entera. */
function simular(monto: number, acumulado: number, tarifa: TarifaMide) {
  try {
    return { recarga: calcularRecarga(monto, acumulado, tarifa), error: null };
  } catch (e) {
    return { recarga: null, error: (e as Error).message };
  }
}

export function Calculadora() {
  const { paleta } = useTema();
  const { montoTexto, acumuladoTexto, setMontoTexto, setAcumuladoTexto } = useSimulacion();

  // La tarifa sale del store y se pasa explícita a todo el motor, en vez de dejar que caiga
  // en su default: los cuadros se reemplazan en runtime cuando llegan los publicados, y así
  // el render y el cálculo usan siempre el mismo.
  const { tarifa, origen, actualizadoEn } = useCuadros();

  const vMonto = validarMonto(montoTexto);
  const vAcumulado = validarAcumulado(acumuladoTexto);

  // El análisis del acumulado no depende del monto: así la escalera y el error de "fuera de
  // la escalera" ya están bien antes de que se escriba cuánto se va a cargar.
  const analisis = vAcumulado.ok ? analizar(vAcumulado.valor, tarifa) : null;
  const simulacion =
    vMonto.ok && vAcumulado.ok && analisis && !analisis.error
      ? simular(vMonto.valor, vAcumulado.valor, tarifa)
      : null;

  const recarga = simulacion?.recarga ?? null;
  const errorDominio = analisis?.error ?? simulacion?.error ?? null;

  const colores = useMemo(
    () => coloresDeTramos(tarifa.tramos, paleta.rampa),
    [tarifa.tramos, paleta.rampa],
  );

  // La tasa municipal no sale del cuadro del ENRE, solo de los tickets. Si el período
  // vigente no tiene ninguno que la confirme y la recarga igual la paga, hay que decirlo.
  const tasaSinConfirmar = tarifa.tasaMunicipalHeredada && (recarga?.tasaMunicipal ?? 0) > 0;

  const styles = useMemo(() => hojaDeEstilos(paleta), [paleta]);

  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.pantalla}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.barra}>
          <Text style={styles.marca}>Simulador MIDE</Text>
          <View style={styles.chip}>
            <Text style={styles.chipTexto}>{periodoCorto(tarifa.periodo)}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.entradas}>
            <CampoNumero
              etiqueta="Monto a cargar"
              valor={montoTexto}
              onChange={setMontoTexto}
              placeholder="50000"
              prefijo="$"
              ayuda={`${pesosRedondos.format(RECARGA_MINIMA)} a ${pesosRedondos.format(RECARGA_MAXIMA)}`}
              error={!vMonto.ok && montoTexto.length > 0 ? vMonto.error : null}
            />
            <CampoNumero
              etiqueta="Acumulado del mes"
              valor={acumuladoTexto}
              onChange={setAcumuladoTexto}
              placeholder="0"
              sufijo="kWh"
              ayuda="De tu comprobante"
              error={!vAcumulado.ok ? vAcumulado.error : null}
            />
          </View>

          <Text style={styles.ayudaLarga}>
            El acumulado es el que dice "kWh Acumulados" en tu último comprobante. Se resetea cada
            mes.
          </Text>

          <View style={styles.tarjeta}>
            {errorDominio ? (
              <View style={styles.heroeError}>
                <Feather name="alert-circle" size={22} color={paleta.error} />
                <Text style={styles.heroeErrorTexto}>{errorDominio}</Text>
              </View>
            ) : recarga ? (
              <>
                <Text style={styles.eyebrow}>Se acreditan</Text>
                <View style={styles.heroeFila}>
                  <Text style={styles.heroe} numberOfLines={1} adjustsFontSizeToFit>
                    {kwhFmt.format(recarga.kwh)}
                  </Text>
                  <Text style={styles.heroeUnidad}>kWh</Text>
                </View>
                <Text style={styles.heroeNota}>
                  {pesos.format(recarga.precioEfectivoPorKwh)} por kWh, todo incluido
                </Text>
              </>
            ) : (
              <Text style={styles.heroeVacio}>Ingresá cuánto vas a cargar</Text>
            )}

            {!errorDominio && vAcumulado.ok ? (
              <View style={styles.escalera}>
                <Escalera
                  tramos={tarifa.tramos}
                  colores={colores}
                  desde={vAcumulado.valor}
                  hasta={recarga?.acumuladoFinalKwh ?? null}
                />
              </View>
            ) : null}
          </View>

          {recarga && analisis?.salto && vAcumulado.ok ? (
            <Salto
              salto={analisis.salto}
              acumulado={vAcumulado.valor}
              finalKwh={recarga.acumuladoFinalKwh}
              tope={topeEscalera(tarifa)}
              paleta={paleta}
            />
          ) : null}

          {recarga ? (
            <Plegable titulo="Ver desglose">
              {recarga.renglones.map((r) => {
                const i = tarifa.tramos.findIndex(
                  (t) => t.hastaKwhAcumulados === r.hastaKwhAcumulados,
                );
                return (
                  <View key={r.hastaKwhAcumulados} style={styles.renglon}>
                    <View style={styles.renglonTitulo}>
                      <View style={[styles.punto, { backgroundColor: colores[i] }]} />
                      <Text style={styles.renglonTramo}>
                        Hasta {r.hastaKwhAcumulados} kWh · {precioFmt.format(r.precioKwh)}/kWh
                      </Text>
                    </View>
                    <Fila
                      etiqueta={`${kwhFmt.format(r.kwh)} kWh`}
                      valor={pesos.format(r.importe)}
                      styles={styles}
                    />
                  </View>
                );
              })}

              {recarga.renglones.length > 1 ? (
                <Text style={styles.nota}>
                  La recarga cruza un cambio de precio, así que se cobra en{' '}
                  {recarga.renglones.length} tramos — igual que en el comprobante.
                </Text>
              ) : null}

              <View style={styles.separador} />
              <Fila
                etiqueta="Energía (subtotal A)"
                valor={pesos.format(recarga.subtotalEnergia)}
                styles={styles}
              />
              <Fila etiqueta="IVA" valor={pesos.format(recarga.iva)} styles={styles} />
              <Fila
                etiqueta="Contribución municipal"
                valor={pesos.format(recarga.contribucionMunicipal)}
                styles={styles}
              />
              <Fila
                etiqueta="Contribución provincial"
                valor={pesos.format(recarga.contribucionProvincial)}
                styles={styles}
              />
              {recarga.tasaMunicipal > 0 ? (
                <Fila
                  etiqueta="Tasa municipal"
                  valor={pesos.format(recarga.tasaMunicipal)}
                  styles={styles}
                />
              ) : null}
              <View style={styles.separador} />
              <Fila
                etiqueta="Total recargado"
                valor={pesos.format(recarga.montoBruto)}
                styles={styles}
                fuerte
              />

              <Text style={styles.nota}>
                Los impuestos salen del monto: solo{' '}
                {Math.round((recarga.subtotalEnergia / recarga.montoBruto) * 100)}% compra energía.
              </Text>
            </Plegable>
          ) : null}

          <Plegable titulo="De dónde salen los precios">
            <Text style={styles.nota}>
              {tarifa.distribuidora} · nivel {tarifa.nivel} · período {tarifa.periodo}
            </Text>
            <Text style={styles.nota}>
              Los precios de cada tramo se derivan del cuadro tarifario T1-R que publica el ENRE. No
              se copian de los comprobantes: los tickets sirven para verificarlos.
            </Text>
            <Text style={styles.nota}>{textoActualizacion(origen, actualizadoEn)}</Text>
          </Plegable>

          {tasaSinConfirmar ? (
            <Text style={styles.avisoTasa}>
              La tasa municipal ({pesos.format(tarifa.tasaMunicipalPorKwh)}/kWh bajo los{' '}
              {TOPE_TASA_MUNICIPAL_KWH} kWh) no la publica el ENRE y no hay comprobante de{' '}
              {tarifa.periodo} que la confirme: se usa la del último período conocido. Es el único
              número acá que no está verificado.
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * El cambio de tramo puede abaratar o encarecer el kWh: la escalera no es monótona, y
 * cruzar los 700 kWh acumulados lo abarata bastante. Por eso el cartel cambia de color, de
 * ícono y de texto según el signo, en vez de avisar siempre de un encarecimiento.
 *
 * El aviso mide desde el acumulado que trae el mes, no desde donde deja la recarga: es la
 * distancia al cambio de precio consumiendo. Por eso nombra el umbral y los dos precios en
 * vez de decir solo "faltan tantos kWh", que no dice a qué.
 */
function Salto({
  salto,
  acumulado,
  finalKwh,
  tope,
  paleta,
}: {
  salto: ProximidadSalto;
  acumulado: number;
  finalKwh: number;
  tope: number;
  paleta: Paleta;
}) {
  const { precioActual, kwhHastaElSalto, precioSiguiente, variacionPorKwh } = salto;
  if (kwhHastaElSalto === null) return null;

  const desconocido = precioSiguiente === null || variacionPorKwh === null;
  const abarata = !desconocido && variacionPorKwh < 0;
  const umbral = acumulado + kwhHastaElSalto;

  const tinta = desconocido ? paleta.muted : abarata ? paleta.positivo : paleta.alerta;
  const fondo = desconocido
    ? paleta.superficie
    : abarata
      ? paleta.positivoFondo
      : paleta.alertaFondo;
  const icono = desconocido ? 'alert-circle' : abarata ? 'trending-down' : 'trending-up';

  return (
    <View style={[estilosSalto.caja, { backgroundColor: fondo, borderColor: tinta }]}>
      <Feather name={icono} size={20} color={tinta} style={estilosSalto.icono} />
      <View style={estilosSalto.texto}>
        <Text style={[tipo.seccion, { color: tinta }]}>
          {desconocido
            ? `Te faltan ${kwhFmt.format(kwhHastaElSalto)} kWh para el tope de ${tope} kWh`
            : `Al llegar a ${umbral} kWh acumulados el kWh ${abarata ? 'se abarata' : 'se encarece'}`}
        </Text>
        <Text style={[tipo.cuerpo, { color: desconocido ? paleta.muted : tinta }]}>
          {desconocido
            ? 'Pasado ese acumulado no se sabe qué precio aplica: el cuadro del ENRE publica el último bloque sin techo y ningún comprobante llegó tan alto.'
            : `Venís con ${kwhFmt.format(acumulado)} kWh consumidos en el mes, así que te faltan ${kwhFmt.format(kwhHastaElSalto)} kWh. Ahí el kWh pasa de ${precioFmt.format(precioActual)} a ${precioFmt.format(precioSiguiente)}: ${pesos.format(Math.abs(variacionPorKwh))} ${abarata ? 'menos' : 'más'} por cada kWh.`}
        </Text>
        {!desconocido && finalKwh > umbral ? (
          <Text style={[tipo.pie, { color: tinta }]}>
            Esta recarga ya cruza ese umbral: los primeros {kwhFmt.format(kwhHastaElSalto)} kWh los
            pagás al precio de ahora y el resto al nuevo.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Fila({
  etiqueta,
  valor,
  styles,
  fuerte,
}: {
  etiqueta: string;
  valor: string;
  styles: ReturnType<typeof hojaDeEstilos>;
  fuerte?: boolean;
}) {
  return (
    <View style={styles.fila}>
      <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
      <Text style={[styles.filaValor, fuerte && styles.filaValorFuerte]}>{valor}</Text>
    </View>
  );
}

const estilosSalto = StyleSheet.create({
  caja: {
    flexDirection: 'row',
    gap: espacio.md,
    padding: espacio.lg,
    borderRadius: radio.md,
    borderWidth: 1,
  },
  icono: { marginTop: 2 },
  texto: { flex: 1, gap: espacio.xs },
});

function hojaDeEstilos(paleta: Paleta) {
  return StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: paleta.fondo },
    barra: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: espacio.xl,
      paddingTop: espacio.md,
      paddingBottom: espacio.lg,
      gap: espacio.md,
    },
    marca: { ...tipo.titulo, color: paleta.ink },
    chip: {
      borderWidth: 1,
      borderColor: paleta.borde,
      borderRadius: 999,
      paddingHorizontal: espacio.md,
      paddingVertical: espacio.xs + 1,
    },
    chipTexto: { ...tipo.pie, color: paleta.muted },

    contenido: { paddingHorizontal: espacio.xl, paddingBottom: espacio.xxl, gap: espacio.md },
    entradas: { flexDirection: 'row', gap: espacio.md },
    ayudaLarga: { ...tipo.pie, color: paleta.muted },

    tarjeta: {
      backgroundColor: paleta.superficie,
      borderColor: paleta.borde,
      borderWidth: 1,
      borderRadius: radio.lg,
      padding: espacio.xl,
      marginTop: espacio.sm,
    },
    eyebrow: { ...tipo.eyebrow, color: paleta.muted },
    heroeFila: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.sm, marginTop: 2 },
    heroe: { ...tipo.heroe, color: paleta.ink, flexShrink: 1 },
    heroeUnidad: { ...tipo.heroeUnidad, color: paleta.muted },
    heroeNota: { ...tipo.cuerpo, color: paleta.muted },
    heroeVacio: { ...tipo.titulo, color: paleta.muted, paddingVertical: espacio.md },
    heroeError: { flexDirection: 'row', gap: espacio.md, alignItems: 'flex-start' },
    heroeErrorTexto: { ...tipo.cuerpo, color: paleta.error, flex: 1 },
    escalera: { marginTop: espacio.xl },

    renglon: { marginBottom: espacio.md },
    renglonTitulo: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
    punto: { width: 8, height: 8, borderRadius: 4 },
    renglonTramo: { ...tipo.pie, color: paleta.muted },
    separador: { height: 1, backgroundColor: paleta.borde, marginVertical: espacio.sm },
    fila: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: espacio.md,
      paddingVertical: 3,
    },
    filaEtiqueta: { ...tipo.dato, color: paleta.muted, flexShrink: 1 },
    filaValor: { ...tipo.dato, color: paleta.ink },
    filaValorFuerte: { fontFamily: 'Archivo_700Bold' },
    nota: { ...tipo.pie, color: paleta.muted, marginTop: espacio.sm },
    avisoTasa: { ...tipo.pie, color: paleta.muted, paddingHorizontal: espacio.xs },
  });
}
