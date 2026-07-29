import { bloqueBaseKwh, categoriaPara, CUADRO_EDENOR } from './tarifas';
import type {
  CuadroTarifario,
  Mes,
  ProximidadSalto,
  ResultadoInverso,
  ResultadoMensual,
  TramoConsumido,
} from './types';

// Regla de redondeo congelada: se calcula en flotante y se redondea a 2 decimales
// solo en los valores de salida.
function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export type OpcionesCalculo = {
  mes: Mes;
  conSubsidio: boolean;
  cuadro?: CuadroTarifario;
};

/**
 * Puntos donde cambia el precio del kWh: las fronteras de categoría y, si hay
 * subsidio, el fin del bloque base bonificado.
 */
function fronteras(opciones: OpcionesCalculo): number[] {
  const cuadro = opciones.cuadro ?? CUADRO_EDENOR;
  const puntos = new Set<number>([0]);
  for (const fila of cuadro.categorias) {
    if (fila.hastaKwh !== null) {
      puntos.add(fila.hastaKwh);
    }
  }
  if (opciones.conSubsidio) {
    puntos.add(bloqueBaseKwh(opciones.mes));
  }
  return [...puntos].sort((a, b) => a - b);
}

/** Precio del kWh que está justo por encima de `kwh`. */
function precioEn(kwh: number, opciones: OpcionesCalculo): { precio: number; bonificado: boolean } {
  const cuadro = opciones.cuadro ?? CUADRO_EDENOR;
  // Se evalúa un pelo por encima del borde: el kWh 400,5 pertenece a R2, el 400,5+
  // de un tramo que empieza en 400 pertenece a R3.
  const fila = categoriaPara(kwh + 1e-9, cuadro);
  const bloqueBase = opciones.conSubsidio ? bloqueBaseKwh(opciones.mes) : 0;
  const bonificado = kwh < bloqueBase;
  return { precio: bonificado ? fila.precioBase : fila.precioSinSubsidio, bonificado };
}

/**
 * Descompone el consumo entre `desdeKwh` y `hastaKwh` en tramos de precio homogéneo.
 * La energía es marginal: cada kWh se paga al precio de la categoría en la que cae.
 */
function tramosEntre(
  desdeKwh: number,
  hastaKwh: number,
  opciones: OpcionesCalculo,
): TramoConsumido[] {
  const cuadro = opciones.cuadro ?? CUADRO_EDENOR;
  const cortes = fronteras(opciones).filter((p) => p > desdeKwh && p < hastaKwh);
  const bordes = [desdeKwh, ...cortes, hastaKwh];

  const tramos: TramoConsumido[] = [];
  for (let i = 0; i < bordes.length - 1; i++) {
    const desde = bordes[i];
    const hasta = bordes[i + 1];
    const kwh = hasta - desde;
    if (kwh <= 0) {
      continue;
    }
    const { precio, bonificado } = precioEn(desde, opciones);
    tramos.push({
      desdeKwh: desde,
      hastaKwh: hasta,
      kwh: redondear2(kwh),
      categoria: categoriaPara(desde + 1e-9, cuadro).categoria,
      bonificado,
      precioKwh: precio,
      subtotal: redondear2(kwh * precio),
    });
  }
  return tramos;
}

function costoEnergia(desdeKwh: number, hastaKwh: number, opciones: OpcionesCalculo): number {
  let total = 0;
  for (const t of tramosEntre(desdeKwh, hastaKwh, opciones)) {
    total += t.kwh * t.precioKwh;
  }
  return total;
}

/**
 * Costo del mes completo: la energía consumida de forma marginal más el cargo fijo,
 * que lo fija la categoría en la que termina el mes.
 */
export function calcularMes(consumoKwh: number, opciones: OpcionesCalculo): ResultadoMensual {
  if (consumoKwh < 0) {
    throw new Error(`Consumo negativo: ${consumoKwh}`);
  }

  const cuadro = opciones.cuadro ?? CUADRO_EDENOR;
  const filaFinal = categoriaPara(consumoKwh, cuadro);
  const tramos = tramosEntre(0, consumoKwh, opciones);
  const energia = tramos.reduce((acc, t) => acc + t.kwh * t.precioKwh, 0);

  return {
    consumoKwh,
    categoriaFinal: filaFinal.categoria,
    cargoFijo: filaFinal.cargoFijo,
    bloqueBaseKwh: opciones.conSubsidio ? bloqueBaseKwh(opciones.mes) : 0,
    costoEnergia: redondear2(energia),
    total: redondear2(energia + filaFinal.cargoFijo),
    tramos,
  };
}

/**
 * Cuánto falta para que el mes termine una categoría más arriba y cuánto cuesta eso.
 *
 * El grueso del salto no es el precio del kWh que cruza sino el cargo fijo, que se
 * recalcula entero por la categoría final del mes.
 */
export function proximidadAlSalto(consumoKwh: number, opciones: OpcionesCalculo): ProximidadSalto {
  const cuadro = opciones.cuadro ?? CUADRO_EDENOR;
  const actual = calcularMes(consumoKwh, opciones);
  const fila = categoriaPara(consumoKwh, cuadro);

  if (fila.hastaKwh === null) {
    return {
      categoriaActual: actual.categoriaFinal,
      categoriaSiguiente: null,
      kwhHastaElSalto: null,
      totalActual: actual.total,
      totalTrasElSalto: null,
      saltoTotal: null,
      saltoCargoFijo: null,
    };
  }

  const trasElSalto = calcularMes(fila.hastaKwh + 1, opciones);

  return {
    categoriaActual: actual.categoriaFinal,
    categoriaSiguiente: trasElSalto.categoriaFinal,
    kwhHastaElSalto: redondear2(fila.hastaKwh - consumoKwh),
    totalActual: actual.total,
    totalTrasElSalto: trasElSalto.total,
    saltoTotal: redondear2(trasElSalto.total - actual.total),
    saltoCargoFijo: redondear2(trasElSalto.cargoFijo - actual.cargoFijo),
  };
}

/**
 * Función inversa: cuántos kWh compra un monto, partiendo del consumo ya acumulado
 * en el mes. El acumulado importa porque define desde qué categoría se empieza a
 * comprar.
 *
 * El monto compra energía; el cargo fijo del mes es un cargo aparte y no se descuenta
 * de la recarga.
 */
export function calcularKwh(
  monto: number,
  opciones: OpcionesCalculo,
  acumuladoKwh = 0,
): ResultadoInverso {
  if (monto < 0) {
    throw new Error(`Monto negativo: ${monto}`);
  }
  if (acumuladoKwh < 0) {
    throw new Error(`Consumo acumulado negativo: ${acumuladoKwh}`);
  }

  const cuadro = opciones.cuadro ?? CUADRO_EDENOR;
  const cortes = fronteras(opciones).filter((p) => p > acumuladoKwh);

  const tramos: TramoConsumido[] = [];
  let restante = monto;
  let posicion = acumuladoKwh;

  // Se van llenando los tramos completos que el dinero pueda pagar; en el último se
  // compra solo lo que alcance.
  for (const corte of [...cortes, Infinity]) {
    if (restante <= 0) {
      break;
    }
    const { precio, bonificado } = precioEn(posicion, opciones);
    const capacidad = corte - posicion;
    const costoCompleto = capacidad * precio;
    const kwh = restante >= costoCompleto ? capacidad : restante / precio;
    if (kwh <= 0) {
      continue;
    }

    const subtotal = kwh * precio;
    tramos.push({
      desdeKwh: posicion,
      hastaKwh: posicion + kwh,
      kwh: redondear2(kwh),
      categoria: categoriaPara(posicion + 1e-9, cuadro).categoria,
      bonificado,
      precioKwh: precio,
      subtotal: redondear2(subtotal),
    });

    restante -= subtotal;
    posicion += kwh;
  }

  const comprados = posicion - acumuladoKwh;
  return {
    monto,
    acumuladoPrevioKwh: acumuladoKwh,
    kwhComprados: redondear2(comprados),
    consumoFinalKwh: redondear2(posicion),
    categoriaFinal: categoriaPara(posicion, cuadro).categoria,
    tramos,
  };
}

/** Costo de sumar `deltaKwh` al consumo del mes, incluido el cambio de cargo fijo. */
export function costoIncremental(
  acumuladoKwh: number,
  deltaKwh: number,
  opciones: OpcionesCalculo,
): number {
  const antes = calcularMes(acumuladoKwh, opciones);
  const despues = calcularMes(acumuladoKwh + deltaKwh, opciones);
  return redondear2(despues.total - antes.total);
}

export { costoEnergia };
