// Casos de prueba manuales del motor de cálculo.
// Ejecutar con: npx tsx domain/casos.ts
//
// Valores calculados a mano contra el cuadro real de Edenor, período 07/2026
// (Res. ENRE 206/2026), ver tarifas.ts.

import { calcularKwh, calcularMes, costoIncremental, proximidadAlSalto } from './calculadora';
import { bloqueBaseKwh, categoriaPara } from './tarifas';
import type { Mes } from './types';

function assertIgual(caso: string, campo: string, actual: unknown, esperado: unknown): void {
  if (actual !== esperado) {
    throw new Error(`${caso} — ${campo}: esperado ${esperado}, obtenido ${actual}`);
  }
}

function assertCerca(
  caso: string,
  campo: string,
  actual: number,
  esperado: number,
  tolerancia = 0.02,
): void {
  if (Math.abs(actual - esperado) > tolerancia) {
    throw new Error(
      `${caso} — ${campo}: esperado ~${esperado} (±${tolerancia}), obtenido ${actual}`,
    );
  }
}

const JULIO: Mes = 7; // bloque base 300 kWh
const MARZO: Mes = 3; // bloque base 150 kWh
const SIN_SUBSIDIO = { mes: JULIO, conSubsidio: false };
const CON_SUBSIDIO = { mes: JULIO, conSubsidio: true };

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

{
  const esperados: [number, string][] = [
    [0, 'R1'],
    [150, 'R1'],
    [151, 'R2'],
    [400, 'R2'],
    [401, 'R3'],
    [500, 'R3'],
    [700, 'R5'],
    [701, 'R6'],
  ];
  for (const [consumo, categoria] of esperados) {
    assertIgual('categorías', `${consumo} kWh`, categoriaPara(consumo).categoria, categoria);
  }
  console.log('✓ Caso 1: el consumo mensual cae en la categoría correcta');
}

// ---------------------------------------------------------------------------
// Energía marginal: cada kWh al precio de su categoría
// ---------------------------------------------------------------------------

{
  // 400 kWh sin subsidio = 150 @ R1 (154,881) + 250 @ R2 (155,504)
  const r = calcularMes(400, SIN_SUBSIDIO);
  assertIgual('marginal', 'cantidad de tramos', r.tramos.length, 2);
  assertIgual('marginal', 'kWh en R1', r.tramos[0].kwh, 150);
  assertIgual('marginal', 'precio en R1', r.tramos[0].precioKwh, 154.881);
  assertIgual('marginal', 'kWh en R2', r.tramos[1].kwh, 250);
  assertIgual('marginal', 'precio en R2', r.tramos[1].precioKwh, 155.504);
  assertIgual('marginal', 'energía', r.costoEnergia, 62108.15);
  assertIgual('marginal', 'cargo fijo (categoría final R2)', r.cargoFijo, 3648.68);
  assertIgual('marginal', 'total', r.total, 65756.83);
  console.log('✓ Caso 2: la energía se cobra marginalmente por tramo');
}

// ---------------------------------------------------------------------------
// El salto de categoría: lo caro es el cargo fijo, no el kWh que cruza
// ---------------------------------------------------------------------------

{
  const en400 = calcularMes(400, SIN_SUBSIDIO);
  const en401 = calcularMes(401, SIN_SUBSIDIO);

  // El kWh 401 vale $167,037 de energía...
  assertCerca('salto', 'energía del kWh 401', en401.costoEnergia - en400.costoEnergia, 167.04);
  // ...pero arrastra el cargo fijo de R2 a R3.
  assertIgual('salto', 'cargo fijo en 401', en401.cargoFijo, 11981.48);
  assertIgual('salto', 'total en 401', en401.total, 74256.67);

  const p = proximidadAlSalto(390, SIN_SUBSIDIO);
  assertIgual('salto', 'categoría actual', p.categoriaActual, 'R2');
  assertIgual('salto', 'categoría siguiente', p.categoriaSiguiente, 'R3');
  assertIgual('salto', 'kWh hasta el salto', p.kwhHastaElSalto, 10);
  assertIgual('salto', 'salto del cargo fijo', p.saltoCargoFijo, 8332.8);

  // El costo incremental de cruzar incluye el salto del cargo fijo.
  assertIgual('salto', 'cruzar de 400 a 401', costoIncremental(400, 1, SIN_SUBSIDIO), 8499.84);

  const enR6 = proximidadAlSalto(900, SIN_SUBSIDIO);
  assertIgual('salto', 'R6 no tiene siguiente', enR6.categoriaSiguiente, null);
  console.log('✓ Caso 3: cruzar de R2 a R3 cuesta $8.499,84 — casi todo cargo fijo');
}

// ---------------------------------------------------------------------------
// Bloque base estacional
// ---------------------------------------------------------------------------

{
  assertIgual('bloque base', 'julio', bloqueBaseKwh(JULIO), 300);
  assertIgual('bloque base', 'marzo', bloqueBaseKwh(MARZO), 150);

  // Julio: los 300 kWh entran enteros en el bloque bonificado.
  const julio = calcularMes(300, CON_SUBSIDIO);
  assertIgual('bloque base', 'tramos en julio', julio.tramos.length, 2);
  assertIgual(
    'bloque base',
    'todo bonificado en julio',
    julio.tramos.every((t) => t.bonificado),
    true,
  );
  assertIgual('bloque base', 'energía en julio', julio.costoEnergia, 20884.35);

  // Marzo: solo los primeros 150 kWh están bonificados.
  const marzo = calcularMes(300, { mes: MARZO, conSubsidio: true });
  assertIgual('bloque base', 'bonificado el primer tramo', marzo.tramos[0].bonificado, true);
  assertIgual('bloque base', 'sin bonificar el segundo', marzo.tramos[1].bonificado, false);
  assertIgual('bloque base', 'energía en marzo', marzo.costoEnergia, 33721.05);

  if (marzo.total <= julio.total) {
    throw new Error('bloque base — el mismo consumo debería costar más en marzo que en julio');
  }
  console.log('✓ Caso 4: el bloque base estacional cambia el costo del mismo consumo');
}

// ---------------------------------------------------------------------------
// El acumulado define desde qué categoría se compra
// ---------------------------------------------------------------------------

{
  // Con 350 kWh ya consumidos en julio, el bloque base (300) está agotado: se compra
  // a precio pleno, arrancando en R2 y cruzando a R3 a los 400.
  const r = calcularKwh(60000, CON_SUBSIDIO, 350);
  assertIgual('acumulado', 'arranca en R2', r.tramos[0].categoria, 'R2');
  assertIgual(
    'acumulado',
    'nada bonificado',
    r.tramos.every((t) => !t.bonificado),
    true,
  );
  assertIgual('acumulado', 'primer tramo hasta la frontera', r.tramos[0].kwh, 50);
  assertIgual('acumulado', 'segundo tramo en R3', r.tramos[1].categoria, 'R3');
  assertCerca('acumulado', 'kWh comprados', r.kwhComprados, 357.17);
  assertIgual('acumulado', 'consumo final', r.consumoFinalKwh, 707.17);
  assertIgual('acumulado', 'categoría final', r.categoriaFinal, 'R6');

  // El mismo monto arrancando de cero rinde más, porque aprovecha el bloque bonificado.
  const desdeCero = calcularKwh(60000, CON_SUBSIDIO, 0);
  if (desdeCero.kwhComprados <= r.kwhComprados) {
    throw new Error('acumulado — arrancar de cero debería rendir más que con 350 kWh ya gastados');
  }
  console.log('✓ Caso 5: el acumulado del mes cambia cuánto rinde la misma plata');
}

// ---------------------------------------------------------------------------
// Ida y vuelta: directa ↔ inversa (sobre la energía, sin cargo fijo)
// ---------------------------------------------------------------------------

{
  const escenarios: { acumulado: number; consumo: number; mes: Mes; conSubsidio: boolean }[] = [
    { acumulado: 0, consumo: 100, mes: JULIO, conSubsidio: true },
    { acumulado: 0, consumo: 300, mes: JULIO, conSubsidio: true },
    { acumulado: 0, consumo: 300, mes: MARZO, conSubsidio: true },
    { acumulado: 350, consumo: 150, mes: JULIO, conSubsidio: true },
    { acumulado: 0, consumo: 450, mes: JULIO, conSubsidio: false },
    { acumulado: 690, consumo: 60, mes: JULIO, conSubsidio: false },
  ];

  for (const { acumulado, consumo, mes, conSubsidio } of escenarios) {
    const opciones = { mes, conSubsidio };
    const hasta = calcularMes(acumulado + consumo, opciones);
    const desde = calcularMes(acumulado, opciones);
    const soloEnergia = hasta.costoEnergia - desde.costoEnergia;

    const vuelta = calcularKwh(soloEnergia, opciones, acumulado);
    assertCerca(
      `ida y vuelta (acum ${acumulado} + ${consumo} kWh, mes ${mes})`,
      'kWh recuperados',
      vuelta.kwhComprados,
      consumo,
    );
  }
  console.log('✓ Caso 6: ida y vuelta directa ↔ inversa en 6 escenarios');
}

// ---------------------------------------------------------------------------
// Bordes
// ---------------------------------------------------------------------------

{
  const cero = calcularMes(0, SIN_SUBSIDIO);
  assertIgual('bordes', 'consumo 0 cae en R1', cero.categoriaFinal, 'R1');
  assertIgual('bordes', 'energía con consumo 0', cero.costoEnergia, 0);
  assertIgual('bordes', 'cargo fijo con consumo 0', cero.total, 1710.71);

  assertIgual('bordes', 'monto 0 no compra nada', calcularKwh(0, SIN_SUBSIDIO, 0).kwhComprados, 0);

  for (const [nombre, fn] of [
    ['monto negativo', () => calcularKwh(-1, SIN_SUBSIDIO, 0)],
    ['acumulado negativo', () => calcularKwh(100, SIN_SUBSIDIO, -1)],
    ['consumo negativo', () => calcularMes(-1, SIN_SUBSIDIO)],
  ] as const) {
    let rechazado = false;
    try {
      fn();
    } catch {
      rechazado = true;
    }
    assertIgual('bordes', `${nombre} rechazado`, rechazado, true);
  }
  console.log('✓ Caso 7: consumo cero, monto cero y validación de negativos');
}

console.log('\nTodos los casos pasan.');
