import type { DetalleTramo, ResultadoCalculo, Tarifa } from './types';

// Regla de redondeo congelada: se calcula en flotante y se redondea a 2 decimales
// solo en los valores de salida (subtotales, costoEnergia, total).
function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// Pendiente: factor de ajuste MIDE (recargos/redondeos del prepago real).
// Se calibra cuando haya cargas reales contra las cuales validar.

/**
 * Calcula el costo de un consumo nuevo dado el acumulado del mes.
 * El acumulado importa porque los tramos se aplican sobre el total mensual:
 * el consumo nuevo entra en los tramos a partir de donde quedó el acumulado.
 */
export function calcularCosto(
  consumoKwh: number,
  tarifa: Tarifa,
  acumuladoMesKwh = 0
): ResultadoCalculo {
  if (consumoKwh < 0) {
    throw new Error(`Consumo negativo: ${consumoKwh}`);
  }
  if (acumuladoMesKwh < 0) {
    throw new Error(`Acumulado mensual negativo: ${acumuladoMesKwh}`);
  }

  const desdeTotal = acumuladoMesKwh;
  const hastaTotal = acumuladoMesKwh + consumoKwh;

  const detalle: DetalleTramo[] = [];
  let costoEnergia = 0;

  for (const tramo of tarifa.tramos) {
    const inicio = Math.max(desdeTotal, tramo.desdeKwh);
    const fin = tramo.hastaKwh === null ? hastaTotal : Math.min(hastaTotal, tramo.hastaKwh);
    const kwhEnTramo = fin - inicio;
    if (kwhEnTramo <= 0) {
      continue;
    }
    const subtotal = kwhEnTramo * tramo.precioKwh;
    costoEnergia += subtotal;
    detalle.push({ tramo, kwhEnTramo, subtotal: redondear2(subtotal) });
  }

  costoEnergia = redondear2(costoEnergia);
  return {
    consumoKwh,
    costoEnergia,
    cargoFijo: tarifa.cargoFijo,
    total: redondear2(costoEnergia + tarifa.cargoFijo),
    detalle,
  };
}
