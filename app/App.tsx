// Un import por peso y no el del paquete entero: el índice de @expo-google-fonts/archivo
// reexporta los 18 pesos con sus itálicas, y desde el barrel Metro se los lleva todos al
// bundle. Por subpath entran solo los cinco .ttf que usa la escala de ui/theme.ts.
import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_500Medium } from '@expo-google-fonts/archivo/500Medium';
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_900Black } from '@expo-google-fonts/archivo/900Black';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Calculadora } from './screens/Calculadora';
import { useCuadros } from './store/useCuadros';
import { useTema } from './ui/theme';

export type RootStackParamList = {
  Calculadora: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { paleta, oscuro } = useTema();

  // Los pesos tienen que coincidir con los que declara `tipo` en ui/theme.ts.
  const [fuentesListas] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_900Black,
  });

  // Sin await: la app ya renderiza con los cuadros embebidos y la pantalla se actualiza sola
  // cuando el store cambia. Esperar acá agregaría una pantalla de carga para nada.
  useEffect(() => {
    void useCuadros.getState().refrescar();
  }, []);

  // Las fuentes sí bloquean: montar con la del sistema y cambiarla después hace saltar todo
  // el layout, porque la escala tipográfica está calibrada sobre Archivo.
  if (!fuentesListas) return null;

  const base = oscuro ? DarkTheme : DefaultTheme;

  return (
    <SafeAreaProvider>
      <NavigationContainer
        theme={{
          ...base,
          colors: { ...base.colors, background: paleta.fondo, text: paleta.ink },
        }}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {/* En web React Navigation pisa el <title> del HTML con el nombre de la ruta. */}
          <Stack.Screen
            name="Calculadora"
            component={Calculadora}
            options={{ title: 'Consumo MIDE' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style={oscuro ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}
