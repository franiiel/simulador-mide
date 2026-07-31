import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { espacio, radio, tipo, useTema } from './theme';

type Props = {
  etiqueta: string;
  valor: string;
  onChange: (texto: string) => void;
  placeholder?: string;
  /** Se pinta dentro del campo, antes del número. */
  prefijo?: string;
  /** Se pinta dentro del campo, después del número. */
  sufijo?: string;
  ayuda?: string;
  error?: string | null;
};

export function CampoNumero({
  etiqueta,
  valor,
  onChange,
  placeholder,
  prefijo,
  sufijo,
  ayuda,
  error,
}: Props) {
  const { paleta } = useTema();
  const [enfocado, setEnfocado] = useState(false);

  const borde = error ? paleta.error : enfocado ? paleta.ink : paleta.borde;

  return (
    <View style={styles.campo}>
      <Text style={[tipo.eyebrow, { color: paleta.muted }]}>{etiqueta}</Text>

      <View style={[styles.caja, { backgroundColor: paleta.superficie, borderColor: borde }]}>
        {prefijo ? <Text style={[tipo.entrada, { color: paleta.muted }]}>{prefijo}</Text> : null}
        <TextInput
          style={[tipo.entrada, styles.input, { color: paleta.ink }]}
          value={valor}
          onChangeText={onChange}
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor={paleta.muted}
          accessibilityLabel={etiqueta}
        />
        {sufijo ? <Text style={[tipo.dato, { color: paleta.muted }]}>{sufijo}</Text> : null}
      </View>

      {error ? (
        <Text style={[tipo.pie, { color: paleta.error }]}>{error}</Text>
      ) : ayuda ? (
        <Text style={[tipo.pie, { color: paleta.muted }]}>{ayuda}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: { flex: 1, gap: espacio.sm },
  caja: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radio.sm,
    paddingHorizontal: espacio.md,
    height: 54,
    gap: espacio.xs,
  },
  // minWidth 0 para que el input pueda encogerse dentro de la fila en pantallas angostas en
  // vez de empujar al sufijo fuera de la caja.
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    // Solo aplica en web: sin esto el navegador dibuja su propio anillo de foco adentro de la
    // caja, encima del borde que ya marca el foco. El tipo de RN restringe outlineStyle a
    // solid/dotted/dashed, así que 'none' entra por spread.
    ...({ outlineStyle: 'none' } as object),
  },
});
