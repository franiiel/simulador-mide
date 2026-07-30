import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Calculadora } from './screens/Calculadora';
import { useCuadros } from './store/useCuadros';

export type RootStackParamList = {
  Calculadora: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  // Sin await: la app ya renderiza con los cuadros embebidos y la pantalla se actualiza sola
  // cuando el store cambia. Esperar acá agregaría una pantalla de carga para nada.
  useEffect(() => {
    void useCuadros.getState().refrescar();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Calculadora"
            component={Calculadora}
            options={{ title: 'Simulador MIDE' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
