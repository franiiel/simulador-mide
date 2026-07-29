# ⚡ Simulador de Consumo MIDE (Edenor)

## 📌 Descripción

Aplicación móvil/web que permite simular cuánto rinde una carga de dinero en el sistema prepago MIDE de Edenor, considerando:

- Subsidios energéticos
- Consumo acumulado mensual
- Tramos tarifarios (R1–R6)
- Variación del costo por momento del mes

El objetivo es brindar al usuario una herramienta clara para tomar decisiones como:

> “¿Me conviene cargar ahora o esperar?”
> “¿Cuántos kWh me da $60.000 hoy?”

---

## 🎯 Problema

El sistema MIDE no es intuitivo porque:

- El precio del kWh no es fijo
- Cambia según el consumo acumulado
- Existe un límite de subsidio (≈300 kWh)
- El valor real incluye ajustes no visibles

Esto hace que el usuario no pueda predecir fácilmente cuánto le rinde su dinero.

---

## 💡 Solución

Desarrollar una app que simule el comportamiento real del sistema MIDE mediante:

- Un motor de cálculo basado en tarifas reales
- Un modelo de consumo mensual dinámico
- Visualización clara del impacto del subsidio
- Predicciones en tiempo real

---

## ⚙️ Funcionalidades principales

### 1. Calculadora de carga

- Input: monto en pesos
- Output: kWh estimados

---

### 2. Simulación mensual

- Consumo diario configurable
- Evolución del consumo en el mes
- Impacto del subsidio en el tiempo

---

### 3. Alertas inteligentes

- “Estás a X kWh de perder el subsidio”
- “Cargar hoy te rinde X% más”

---

### 4. Comparador temporal

- Simular carga en distintos días del mes
- Comparar rendimiento del dinero

---

### 5. Modo offline

- Uso sin conexión
- Tarifas cacheadas localmente

---

## 🧠 Modelo de cálculo

El sistema se basa en:

### Subsidio

- Hasta 300 kWh → precio reducido
- Excedente → precio completo

---

### Fórmula simplificada

```ts
kWh = (monto / precio_kWh) * factorAjuste;
```

---

### Consideraciones

- El precio cambia según consumo acumulado
- Se aplica un factor de ajuste para reflejar MIDE real
- No es un modelo lineal

---

## 🗂️ Modelo de datos

```ts
type Tarifa = {
  fechaVigencia: string;

  subsidio: {
    limiteKWh: number;
    precioSubvencionado: number;
    precioExcedente: number;
  };

  cargos: {
    factorAjusteMIDE: number;
  };
};
```

---

## 🏗️ Arquitectura

### Cliente (principal)

- React Native + Expo
- Lógica de cálculo local
- Persistencia en AsyncStorage

---

### Backend (opcional)

- Node.js + Express
- API de tarifas
- Sin dependencia crítica

---

### Scraper (batch)

- Python
- Extracción de tarifas desde ENRE
- Exportación a JSON

---

## 🔄 Flujo de datos

```text
Scraper → JSON tarifas → App móvil → Simulación local
```

---

## 🚀 MVP

Incluye:

- Input de monto
- Consumo mensual manual
- Cálculo de kWh
- Visualización simple

---

## 🔮 Futuras mejoras

- Gráficos de consumo
- Historial de cargas
- Integración con APIs reales
- Notificaciones inteligentes
- Predicción basada en hábitos

---

## 📱 Plataforma

- Android (prioridad)
- Web (opcional via React Native Web o PWA)

---

## 🧩 Stack tecnológico

- Frontend: React Native + Expo
- Backend: Node.js (opcional)
- Scraping: Python
- Storage: JSON / SQLite

---

## 📊 Diferencial del producto

No es solo una calculadora.

Es un **simulador inteligente de consumo energético**, que permite:

- Optimizar cargas
- Reducir gasto
- Entender el sistema tarifario

---

## 📌 Estado del proyecto

🟡 En diseño / prototipo

---

## 👤 Autor

Proyecto personal orientado a resolver un problema cotidiano mediante tecnología.
