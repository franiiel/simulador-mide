// Casos de prueba manuales (docs/implementaciones.md, punto 9).
// Ejecutar con: npx tsx domain/casos.ts
// Valores esperados calculados a mano contra la tarifa N2 placeholder:
// subsidiado 0-350 kWh a $80, excedente a $200, cargo fijo $1200.

import { calcularCosto } from './calculadora';
import { getTarifa } from './tarifas';

function assertIgual(caso: string, campo: string, actual: number, esperado: number): void {
  if (actual !== esperado) {
    throw new Error(`${caso} — ${campo}: esperado ${esperado}, obtenido ${actual}`);
  }
}

const n2 = getTarifa('N2');

// Caso 1: bajo consumo — todo dentro del tramo subsidiado
{
  const r = calcularCosto(100, n2, 0);
  assertIgual('bajo consumo', 'costoEnergia', r.costoEnergia, 100 * 80);
  assertIgual('bajo consumo', 'total', r.total, 100 * 80 + 1200);
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
  assertIgual('cruce', 'total', r.total, 50 * 80 + 50 * 200 + 1200);
  console.log('✓ Caso 2: cruce de subsidio');
}

// Caso 3: consumo alto — acumulado ya pasado el límite, todo a precio pleno
{
  const r = calcularCosto(100, n2, 400);
  assertIgual('consumo alto', 'cantidad de tramos', r.detalle.length, 1);
  assertIgual('consumo alto', 'precio aplicado', r.detalle[0].tramo.precioKwh, 200);
  assertIgual('consumo alto', 'costoEnergia', r.costoEnergia, 100 * 200);
  assertIgual('consumo alto', 'total', r.total, 100 * 200 + 1200);
  console.log('✓ Caso 3: consumo alto (todo sin subsidio)');
}

console.log('Los 3 casos pasan.');
