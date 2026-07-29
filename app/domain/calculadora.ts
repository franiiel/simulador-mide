import type {
  DetalleTramo,
  ResultadoCalculo,
  ResultadoInverso,
  ResultadoMensual,
  Tarifa,
} from './types';

// Regla de redondeo congelada: se calcula en flotante y se redondea solo en los
// valores de salida — la plata a 2 decimales, los kWh a 2 decimales.
function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Calcula el costo de un consumo nuevo dado el acumulado del mes (calculoKWH.md §2-§6).
 * El acumulado importa porque los tramos se aplican sobre el total mensual: el consumo
 * nuevo entra en los tramos a partir de donde quedó el acumulado.
 *
 * Devuelve solo energía. El cargo fijo es mensual y no se cobra por carga; para el total
 * del mes, ver calcularCostoMensual().
 */
export function calcularCosto(
  consumoKwh: number,
  tarifa: Tarifa,
  acumuladoMesKwh = 0,
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

  return {
    consumoKwh,
    costoEnergia: redondear2(costoEnergia),
    costoReal: redondear2(costoEnergia * (1 + tarifa.factorAjusteMide)),
    detalle,
  };
}

/**
 * Costo del mes completo (calculoKWH.md §7): energía de todo el acumulado más el cargo
 * fijo, que se suma una sola vez por mes y no por carga.
 */
export function calcularCostoMensual(consumoMesKwh: number, tarifa: Tarifa): ResultadoMensual {
  const energia = calcularCosto(consumoMesKwh, tarifa, 0);

  return {
    consumoKwh: energia.consumoKwh,
    costoEnergia: energia.costoEnergia,
    costoReal: energia.costoReal,
    cargoFijo: tarifa.cargoFijo,
    total: redondear2(energia.costoReal + tarifa.cargoFijo),
    detalle: energia.detalle,
  };
}

/**
 * Función inversa (calculoKWH.md §8): cuántos kWh compra un monto, dado el acumulado
 * del mes. Generaliza los tres casos del documento a N tramos recorriéndolos en orden
 * y gastando el dinero hasta agotarlo.
 */
export function calcularKwh(monto: number, tarifa: Tarifa, acumuladoMesKwh = 0): ResultadoInverso {
  if (monto < 0) {
    throw new Error(`Monto negativo: ${monto}`);
  }
  if (acumuladoMesKwh < 0) {
    throw new Error(`Acumulado mensual negativo: ${acumuladoMesKwh}`);
  }

  // El ajuste se descuenta antes de comprar energía: como costoReal = costoEnergia * (1+α),
  // el monto compra a precio de tarifa solo lo que queda después de sacarle el α.
  let restante = monto / (1 + tarifa.factorAjusteMide);

  const detalle: DetalleTramo[] = [];
  let kwh = 0;
  let posicion = acumuladoMesKwh;

  for (const tramo of tarifa.tramos) {
    if (restante <= 0) {
      break;
    }
    // Tramos que quedaron atrás por el acumulado.
    if (tramo.hastaKwh !== null && tramo.hastaKwh <= posicion) {
      continue;
    }

    const inicio = Math.max(posicion, tramo.desdeKwh);
    const capacidad = tramo.hastaKwh === null ? Infinity : tramo.hastaKwh - inicio;
    const costoCompleto = capacidad * tramo.precioKwh;

    const kwhEnTramo = restante >= costoCompleto ? capacidad : restante / tramo.precioKwh;
    const subtotal = kwhEnTramo * tramo.precioKwh;

    kwh += kwhEnTramo;
    restante -= subtotal;
    posicion = inicio + kwhEnTramo;
    detalle.push({ tramo, kwhEnTramo: redondear2(kwhEnTramo), subtotal: redondear2(subtotal) });
  }

  return { monto, kwh: redondear2(kwh), detalle };
}
