// Casos de prueba manuales del motor de cálculo.
// Ejecutar con: npx tsx domain/casos.ts
//
// Valores esperados calculados a mano contra la tarifa N2 placeholder:
// subsidiado 0-350 kWh a $80, excedente a $200, cargo fijo $1200, factorAjusteMide 0.

import { calcularCosto, calcularCostoMensual, calcularKwh } from './calculadora';
import { getTarifa } from './tarifas';
import type { Tarifa } from './types';

function assertIgual(caso: string, campo: string, actual: number, esperado: number): void {
  if (actual !== esperado) {
    throw new Error(`${caso} — ${campo}: esperado ${esperado}, obtenido ${actual}`);
  }
}

// Para comparar flotantes que pasaron por división (la inversa) contra valores exactos.
function assertCerca(
  caso: string,
  campo: string,
  actual: number,
  esperado: number,
  tolerancia = 0.01,
): void {
  if (Math.abs(actual - esperado) > tolerancia) {
    throw new Error(
      `${caso} — ${campo}: esperado ~${esperado} (±${tolerancia}), obtenido ${actual}`,
    );
  }
}

const n2 = getTarifa('N2');

// ---------------------------------------------------------------------------
// Función directa — calculoKWH.md §2-§6
// ---------------------------------------------------------------------------

// Caso 1: bajo consumo — todo dentro del tramo subsidiado
{
  const r = calcularCosto(100, n2, 0);
  assertIgual('bajo consumo', 'costoEnergia', r.costoEnergia, 100 * 80);
  assertIgual('bajo consumo', 'cantidad de tramos', r.detalle.length, 1);
  console.log('✓ Caso 1: bajo consumo (todo subsidiado)');
}

// Caso 2: cruce de subsidio — acumulado 300, consumo 100 → 50 subsidiados + 50 plenos
{
  const r = calcularCosto(100, n2, 300);
  assertIgual('cruce', 'cantidad de tramos', r.detalle.length, 2);
  assertIgual('cruce', 'kWh subsidiados', r.detalle[0].kwhEnTramo, 50);
  assertIgual('cruce', 'subtotal subsidiado', r.detalle[0].subtotal, 50 * 80);
  assertIgual('cruce', 'kWh plenos', r.detalle[1].kwhEnTramo, 50);
  assertIgual('cruce', 'subtotal pleno', r.detalle[1].subtotal, 50 * 200);
  assertIgual('cruce', 'costoEnergia', r.costoEnergia, 50 * 80 + 50 * 200);
  console.log('✓ Caso 2: cruce de subsidio');
}

// Caso 3: consumo alto — acumulado ya pasado el límite, todo a precio pleno
{
  const r = calcularCosto(100, n2, 400);
  assertIgual('consumo alto', 'cantidad de tramos', r.detalle.length, 1);
  assertIgual('consumo alto', 'precio aplicado', r.detalle[0].tramo.precioKwh, 200);
  assertIgual('consumo alto', 'costoEnergia', r.costoEnergia, 100 * 200);
  console.log('✓ Caso 3: consumo alto (todo sin subsidio)');
}

// ---------------------------------------------------------------------------
// Cargo fijo — calculoKWH.md §7: mensual, nunca por carga
// ---------------------------------------------------------------------------

// Caso 4: las cargas individuales no arrastran el cargo fijo; el mes lo suma una vez
{
  const carga1 = calcularCosto(100, n2, 0);
  const carga2 = calcularCosto(100, n2, 100);
  const mes = calcularCostoMensual(200, n2);

  assertIgual(
    'cargo fijo',
    'energia de las dos cargas',
    carga1.costoEnergia + carga2.costoEnergia,
    200 * 80,
  );
  assertIgual('cargo fijo', 'energia del mes', mes.costoEnergia, 200 * 80);
  assertIgual('cargo fijo', 'cargo fijo del mes', mes.cargoFijo, 1200);
  assertIgual('cargo fijo', 'total del mes', mes.total, 200 * 80 + 1200);
  console.log('✓ Caso 4: el cargo fijo se cobra una vez por mes, no por carga');
}

// ---------------------------------------------------------------------------
// Factor MIDE — calculoKWH.md §9
// ---------------------------------------------------------------------------

// Caso 5: con α, costoReal = costoEnergia * (1 + α)
{
  const conAjuste: Tarifa = { ...n2, factorAjusteMide: 0.03 };
  const r = calcularCosto(100, conAjuste, 0);
  assertIgual('factor MIDE', 'costoEnergia', r.costoEnergia, 100 * 80);
  assertIgual('factor MIDE', 'costoReal', r.costoReal, 100 * 80 * 1.03);

  const sinAjuste = calcularCosto(100, n2, 0);
  assertIgual('factor MIDE', 'con α=0 no cambia nada', sinAjuste.costoReal, sinAjuste.costoEnergia);
  console.log('✓ Caso 5: factor MIDE aplicado sobre el costo base');
}

// ---------------------------------------------------------------------------
// Función inversa — calculoKWH.md §8
// ---------------------------------------------------------------------------

// Caso 6 (§8 caso 1): el dinero se queda dentro de la zona subsidiada
{
  const r = calcularKwh(8000, n2, 0);
  assertIgual('inversa subsidiada', 'kWh', r.kwh, 100); // 8000 / 80
  assertIgual('inversa subsidiada', 'cantidad de tramos', r.detalle.length, 1);
  console.log('✓ Caso 6: inversa, el monto no llega al límite de subsidio');
}

// Caso 7 (§8 caso 2): el dinero cruza el límite
// Acumulado 300 → quedan 50 kWh subsidiados ($4000); con $14000 sobran $10000 → 50 kWh plenos.
{
  const r = calcularKwh(14000, n2, 300);
  assertIgual('inversa cruce', 'cantidad de tramos', r.detalle.length, 2);
  assertIgual('inversa cruce', 'kWh subsidiados', r.detalle[0].kwhEnTramo, 50);
  assertIgual('inversa cruce', 'kWh plenos', r.detalle[1].kwhEnTramo, 50);
  assertIgual('inversa cruce', 'kWh totales', r.kwh, 100);
  console.log('✓ Caso 7: inversa, el monto cruza el límite de subsidio');
}

// Caso 8 (§8 caso 3): el acumulado ya pasó el límite, todo a precio pleno
{
  const r = calcularKwh(10000, n2, 400);
  assertIgual('inversa sin subsidio', 'cantidad de tramos', r.detalle.length, 1);
  assertIgual('inversa sin subsidio', 'precio aplicado', r.detalle[0].tramo.precioKwh, 200);
  assertIgual('inversa sin subsidio', 'kWh', r.kwh, 50); // 10000 / 200
  console.log('✓ Caso 8: inversa, acumulado ya sin subsidio');
}

// Caso 9: monto 0 no compra nada
{
  const r = calcularKwh(0, n2, 0);
  assertIgual('inversa monto 0', 'kWh', r.kwh, 0);
  console.log('✓ Caso 9: inversa con monto 0');
}

// ---------------------------------------------------------------------------
// Ida y vuelta: las dos funciones tienen que ser consistentes entre sí
// ---------------------------------------------------------------------------

// Caso 10: calcularKwh(calcularCosto(x)) ≈ x, incluso cruzando tramos y con α
{
  const escenarios: { consumo: number; acumulado: number; alfa: number }[] = [
    { consumo: 100, acumulado: 0, alfa: 0 }, // dentro del subsidio
    { consumo: 100, acumulado: 300, alfa: 0 }, // cruzando el límite
    { consumo: 100, acumulado: 400, alfa: 0 }, // ya sin subsidio
    { consumo: 250, acumulado: 200, alfa: 0.03 }, // cruzando, con factor MIDE
  ];

  for (const { consumo, acumulado, alfa } of escenarios) {
    const tarifa: Tarifa = { ...n2, factorAjusteMide: alfa };
    const costo = calcularCosto(consumo, tarifa, acumulado);
    const vuelta = calcularKwh(costo.costoReal, tarifa, acumulado);
    assertCerca(
      `ida y vuelta (consumo ${consumo}, acumulado ${acumulado}, α ${alfa})`,
      'kWh recuperados',
      vuelta.kwh,
      consumo,
    );
  }
  console.log('✓ Caso 10: ida y vuelta directa ↔ inversa en 4 escenarios');
}

console.log('\nTodos los casos pasan.');
