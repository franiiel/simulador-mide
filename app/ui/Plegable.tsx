import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { espacio, radio, tipo, useTema } from './theme';

type Props = {
  titulo: string;
  children: ReactNode;
};

/** Sección que se despliega al tocarla. Arranca plegada: el detalle se pide, no se impone. */
export function Plegable({ titulo, children }: Props) {
  const { paleta } = useTema();
  const [abierto, setAbierto] = useState(false);

  const alternar = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAbierto((a) => !a);
  };

  return (
    <View style={[styles.caja, { backgroundColor: paleta.superficie, borderColor: paleta.borde }]}>
      <Pressable
        onPress={alternar}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        style={styles.cabecera}
      >
        <Text style={[tipo.seccion, { color: paleta.ink }]}>{titulo}</Text>
        <Feather name={abierto ? 'chevron-up' : 'chevron-down'} size={18} color={paleta.muted} />
      </Pressable>

      {abierto ? <View style={styles.contenido}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { borderRadius: radio.md, borderWidth: 1, overflow: 'hidden' },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacio.lg,
    paddingVertical: espacio.md + 2,
    gap: espacio.md,
  },
  contenido: { paddingHorizontal: espacio.lg, paddingBottom: espacio.lg },
});
