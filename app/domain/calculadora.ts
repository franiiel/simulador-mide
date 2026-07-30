import { multiplicadorImpuestos, tarifaVigente, topeEscalera, tramoPara } from './tarifas';
import type {
  ProximidadSalto,
  RenglonTramo,
  ResultadoRecarga,
  TarifaMide,
  TramoPrecio,
} from './types';
import { TOPE_TASA_MUNICIPAL_KWH } from './types';

// Regla de redondeo congelada: se calcula en flotante y se redondea a 2 decimales solo en
// los valores de salida. El ticket imprime los kWh con 1 decimal, así que contrastar
// contra el papel siempre deja un desvío de hasta medio decilitro de kWh en cada renglón.
function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Los kWh de este tramo pagan tasa municipal (solo por debajo de 600 kWh acumulados). */
function pagaTasaMunicipal(tramo: TramoPrecio): boolean {
  return tramo.hastaKwhAcumulados <= TOPE_TASA_MUNICIPAL_KWH;
}

/**
 * Cuánto cuesta cada kWh de un tramo, todo incluido.
 *
 * Es constante dentro del tramo porque el corte de la tasa municipal (600 kWh) coincide con
 * un tope de la escalera. Eso hace que el costo total sea lineal por tramos y que la
 * inversa (monto → kWh) salga exacta con una división, sin búsqueda numérica.
 */
function costoMarginal(tramo: TramoPrecio, tarifa: TarifaMide): number {
  const energia = tramo.precioKwh * multiplicadorImpuestos(tarifa.impuestos);
  return energia + (pagaTasaMunicipal(tramo) ? tarifa.tasaMunicipalPorKwh : 0);
}

/** Los tramos que quedan por delante de un acumulado, con cuántos kWh cabe en cada uno. */
function tramosDesde(
  acumuladoKwh: number,
  tarifa: TarifaMide,
): { tramo: TramoPrecio; capacidad: number }[] {
  let desde = acumuladoKwh;

  return tarifa.tramos
    .filter((t) => t.hastaKwhAcumulados > acumuladoKwh)
    .map((tramo) => {
      const capacidad = tramo.hastaKwhAcumulados - desde;
      desde = tramo.hastaKwhAcumulados;
      return { tramo, capacidad };
    });
}

function errorFueraDeEscalera(acumuladoKwh: number, tarifa: TarifaMide): Error {
  return new Error(
    `No se conoce el precio para un acumulado de ${acumuladoKwh} kWh: la escalera de ` +
      `${tarifa.periodo} llega a ${topeEscalera(tarifa)} kWh. El cuadro del ENRE publica el ` +
      `último bloque como "+700" sin techo, así que arriba de ese tope no hay dato.`,
  );
}

/**
 * Calcula una recarga tal como la liquida MIDE.
 *
 * El monto es bruto: se reparte entre energía, impuestos y tasa municipal. La energía se
 * cobra en escalera sobre el acumulado del mes, así que una recarga que cruza un tope se
 * parte en varios renglones, igual que en el ticket.
 */
export function calcularRecarga(
  montoBruto: number,
  acumuladoKwh: number,
  tarifa: TarifaMide = tarifaVigente(),
): ResultadoRecarga {
  if (montoBruto < 0) {
    throw new Error(`Monto negativo: ${montoBruto}`);
  }
  if (acumuladoKwh < 0) {
    throw new Error(`Consumo acumulado negativo: ${acumuladoKwh}`);
  }
  if (acumuladoKwh > topeEscalera(tarifa)) {
    throw errorFueraDeEscalera(acumuladoKwh, tarifa);
  }

  const renglones: RenglonTramo[] = [];
  let restante = montoBruto;
  let kwhTotal = 0;
  let kwhGravadosPorTasa = 0;
  // Se acumula aparte de los renglones porque estos exponen los kWh ya redondeados, y
  // sumar sobre eso arrastraría el redondeo al subtotal.
  let subtotalEnergia = 0;

  // Medio centavo: si el monto se agota justo en un tope, lo que queda es residuo de punto
  // flotante y no tiene que generar un renglón de 0 kWh.
  const AGOTADO = 0.005;

  for (const { tramo, capacidad } of tramosDesde(acumuladoKwh, tarifa)) {
    if (restante <= AGOTADO) break;

    const marginal = costoMarginal(tramo, tarifa);
    const kwh = Math.min(capacidad, restante / marginal);

    restante -= kwh * marginal;
    kwhTotal += kwh;
    subtotalEnergia += kwh * tramo.precioKwh;
    if (pagaTasaMunicipal(tramo)) kwhGravadosPorTasa += kwh;

    renglones.push({
      hastaKwhAcumulados: tramo.hastaKwhAcumulados,
      precioKwh: tramo.precioKwh,
      kwh: redondear2(kwh),
      importe: redondear2(kwh * tramo.precioKwh),
    });
  }

  // Si sobró monto es porque la recarga llenaría la escalera entera: no sabemos a qué
  // precio se venderían los kWh de más.
  if (restante > 0.01) {
    throw errorFueraDeEscalera(topeEscalera(tarifa), tarifa);
  }

  const tasaMunicipal = kwhGravadosPorTasa * tarifa.tasaMunicipalPorKwh;
  const { iva, contribucionMunicipal, contribucionProvincial } = tarifa.impuestos;

  return {
    montoBruto,
    renglones,
    subtotalEnergia: redondear2(subtotalEnergia),
    iva: redondear2(subtotalEnergia * iva),
    contribucionMunicipal: redondear2(subtotalEnergia * contribucionMunicipal),
    contribucionProvincial: redondear2(subtotalEnergia * contribucionProvincial),
    subtotalImpuestos: redondear2(
      subtotalEnergia * (iva + contribucionMunicipal + contribucionProvincial),
    ),
    tasaMunicipal: redondear2(tasaMunicipal),
    kwh: redondear2(kwhTotal),
    precioEfectivoPorKwh: kwhTotal > 0 ? redondear2(montoBruto / kwhTotal) : 0,
    acumuladoPrevioKwh: acumuladoKwh,
    acumuladoFinalKwh: redondear2(acumuladoKwh + kwhTotal),
  };
}

/** Cuánto hay que recargar (bruto, con impuestos y tasa) para obtener cierta cantidad de kWh. */
export function montoParaKwh(
  kwh: number,
  acumuladoKwh: number,
  tarifa: TarifaMide = tarifaVigente(),
): number {
  if (kwh < 0) {
    throw new Error(`kWh negativos: ${kwh}`);
  }
  if (acumuladoKwh > topeEscalera(tarifa)) {
    throw errorFueraDeEscalera(acumuladoKwh, tarifa);
  }

  let pendiente = kwh;
  let monto = 0;

  for (const { tramo, capacidad } of tramosDesde(acumuladoKwh, tarifa)) {
    if (pendiente <= 0) break;

    const enEsteTramo = Math.min(capacidad, pendiente);
    monto += enEsteTramo * costoMarginal(tramo, tarifa);
    pendiente -= enEsteTramo;
  }

  if (pendiente > 0) {
    throw errorFueraDeEscalera(acumuladoKwh + kwh, tarifa);
  }

  return redondear2(monto);
}

/**
 * Cuántos kWh faltan para cambiar de tramo y cuánto varía el kWh del otro lado.
 *
 * `variacionPorKwh` puede ser negativa, y de hecho lo es en el salto que más importa:
 * cruzando los 700 kWh acumulados el kWh se abarata (en 2026-07, de $385,08 a $233,48),
 * porque ahí el cargo fijo del bloque se reparte sobre 700 kWh en vez de 100.
 */
export function proximidadAlSalto(
  acumuladoKwh: number,
  tarifa: TarifaMide = tarifaVigente(),
): ProximidadSalto {
  const tramo = tramoPara(acumuladoKwh, tarifa);
  if (!tramo) {
    throw errorFueraDeEscalera(acumuladoKwh, tarifa);
  }

  const siguiente = tarifa.tramos[tarifa.tramos.indexOf(tramo) + 1] ?? null;

  return {
    precioActual: tramo.precioKwh,
    precioSiguiente: siguiente?.precioKwh ?? null,
    kwhHastaElSalto: redondear2(tramo.hastaKwhAcumulados - acumuladoKwh),
    variacionPorKwh: siguiente ? redondear2(siguiente.precioKwh - tramo.precioKwh) : null,
  };
}
