// Casos de prueba manuales del motor de cálculo.
// Ejecutar con: npx tsx domain/casos.ts
//
// Lo que manda es reproducir los comprobantes reales. Los tickets están en
// .transcripciones/ (fuera de git, llevan nombre y dirección), así que los números van
// hardcodeados acá: los casos tienen que poder correr sin ellos.
//
// El assert que de verdad prueba el modelo es el de PRECIOS: los $/kWh que se derivan del
// cuadro del ENRE tienen que coincidir al milésimo con los que imprime cada ticket. Los kWh
// y los importes se comparan con tolerancia porque el ticket redondea los kWh a 1 decimal.

import { calcularRecarga, montoParaKwh, proximidadAlSalto } from './calculadora';
import { CUADROS_EMBEBIDOS, cuadrosVigentes, periodoVigente } from './cuadrosEnre';
import { multiplicadorImpuestos, tarifaDe, tarifaVigente, tramoPara } from './tarifas';
import { RECARGA_MAXIMA, RECARGA_MINIMA, TOPES_KWH } from './types';

let fallos = 0;

function assertIgual(caso: string, campo: string, actual: unknown, esperado: unknown): void {
  if (actual !== esperado) {
    console.error(`✗ ${caso} — ${campo}: esperado ${esperado}, obtenido ${actual}`);
    fallos++;
  }
}

function assertCerca(
  caso: string,
  campo: string,
  actual: number,
  esperado: number,
  tolerancia: number,
): void {
  if (Math.abs(actual - esperado) > tolerancia) {
    console.error(
      `✗ ${caso} — ${campo}: esperado ~${esperado} (±${tolerancia}), obtenido ${actual}`,
    );
    fallos++;
  }
}

function assertLanza(caso: string, campo: string, fn: () => unknown): void {
  try {
    fn();
    console.error(`✗ ${caso} — ${campo}: debería haber lanzado y no lo hizo`);
    fallos++;
  } catch {
    /* esperado */
  }
}

// ---------------------------------------------------------------------------
// Los 12 comprobantes reales
// ---------------------------------------------------------------------------
//
// `acumuladoPrevio` sale de restarle al "kWh Acumulados" del ticket los kWh de la compra:
// el acumulado que imprime el papel es el de DESPUÉS de acreditar. Las cadenas cierran
// entre tickets consecutivos (julio: 611,2 → 755,3 → 957,0 → 1125,1), que es lo que
// confirma tanto la lectura del campo como el reseteo mensual.

type CasoTicket = {
  id: string;
  periodo: string;
  monto: number;
  acumuladoPrevio: number;
  /** [tope del tramo, precio impreso, kWh impresos, importe impreso] */
  renglones: [number, number, number, number][];
  subtotalA: number;
  subtotalB: number;
  tasaMunicipal: number;
  kwhTotal: number;
  acumuladoFinal: number;
};

const TICKETS: CasoTicket[] = [
  {
    // El caso más limpio de todos: el cuadro de 10/25 se consiguió DESPUÉS de derivar la
    // fórmula (lo trajo el scraper), así que estos dos precios no participaron de deducirla.
    // Que salgan exactos es una validación independiente, no un ajuste.
    id: '58350 (30/10/25, cuadro traído por el scraper)',
    periodo: '2025-10',
    monto: 40000,
    acumuladoPrevio: 577.4,
    renglones: [
      [600, 187.63, 22.6, 4240.44],
      [700, 282.31, 96.0, 27096.26],
    ],
    subtotalA: 31336.7,
    subtotalB: 8584.35,
    tasaMunicipal: 78.95,
    kwhTotal: 118.6,
    acumuladoFinal: 696.0,
  },
  {
    id: '58351 (nov/25, primera carga del mes, cruza 3 tramos)',
    periodo: '2025-11',
    monto: 40000,
    acumuladoPrevio: 0,
    renglones: [
      [150, 59.64, 150.0, 8946.0],
      [400, 69.343, 250.0, 17335.75],
      [500, 221.964, 17.9, 3969.18],
    ],
    subtotalA: 30250.93,
    subtotalB: 8289.21,
    tasaMunicipal: 1459.86,
    kwhTotal: 417.9,
    acumuladoFinal: 417.9,
  },
  {
    id: '58349 (28/11/25, cruza 700 hacia el tramo más barato)',
    periodo: '2025-11',
    monto: 40000,
    acumuladoPrevio: 696.4,
    renglones: [
      [700, 292.229, 3.6, 1052.02],
      [1400, 171.98, 176.5, 30347.98],
    ],
    subtotalA: 31400.0,
    subtotalB: 8600.0,
    tasaMunicipal: 0,
    kwhTotal: 180.1,
    acumuladoFinal: 876.5,
  },
  {
    id: '58348 (dic/25, primera carga del mes, cruza 3 tramos)',
    periodo: '2025-12',
    monto: 40000,
    acumuladoPrevio: 0,
    renglones: [
      [150, 61.675, 150.0, 9251.25],
      [400, 71.498, 250.0, 17874.5],
      [500, 226.786, 13.9, 3143.17],
    ],
    subtotalA: 30268.92,
    subtotalB: 8285.19,
    tasaMunicipal: 1445.89,
    kwhTotal: 413.9,
    acumuladoFinal: 413.9,
  },
  {
    id: '58337 (14/02/26, cruza 600: la tasa municipal corta ahí)',
    periodo: '2026-02',
    monto: 40000,
    acumuladoPrevio: 534.9,
    renglones: [
      [600, 222.364, 65.1, 14475.9],
      [700, 327.69, 50.9, 16665.91],
    ],
    subtotalA: 31141.81,
    subtotalB: 8517.07,
    tasaMunicipal: 341.12,
    kwhTotal: 116.0,
    acumuladoFinal: 650.9,
  },
  {
    id: '58338 (01/03/26, consumo base 150: el ≤400 pasa a ser todo excedente)',
    periodo: '2026-03',
    monto: 40000,
    acumuladoPrevio: 0,
    renglones: [
      [150, 64.454, 150.0, 9668.1],
      [400, 139.626, 146.9, 20507.29],
    ],
    subtotalA: 30175.39,
    subtotalB: 8268.85,
    tasaMunicipal: 1555.76,
    kwhTotal: 296.9,
    acumuladoFinal: 296.9,
  },
  {
    id: '58339 (01/04/26, consumo base 150)',
    periodo: '2026-04',
    monto: 40000,
    acumuladoPrevio: 0,
    renglones: [
      [150, 67.958, 150.0, 10193.7],
      [400, 140.585, 142.3, 20001.11],
    ],
    subtotalA: 30194.81,
    subtotalB: 8273.54,
    tasaMunicipal: 1531.65,
    kwhTotal: 292.3,
    acumuladoFinal: 292.3,
  },
  {
    // La transcripción dice "COMPRA ACTUAL 40.000,00", pero A + B = 60.000,00 exacto y el
    // 58215 es el mismo ticket con acumulado distinto y dice 60.000. Es un error de
    // transcripción del monto, no del resto.
    id: '58322 (19/06/26)',
    periodo: '2026-06',
    monto: 60000,
    acumuladoPrevio: 914.2,
    renglones: [[1400, 222.893, 211.3, 47092.85]],
    subtotalA: 47092.85,
    subtotalB: 12907.15,
    tasaMunicipal: 0,
    kwhTotal: 211.3,
    acumuladoFinal: 1125.5,
  },
  {
    id: '58215 (23/06/26, el acumulado más alto visto: 1336,8)',
    periodo: '2026-06',
    monto: 60000,
    acumuladoPrevio: 1125.5,
    renglones: [[1400, 222.893, 211.3, 47092.85]],
    subtotalA: 47092.85,
    subtotalB: 12907.15,
    tasaMunicipal: 0,
    kwhTotal: 211.3,
    acumuladoFinal: 1336.8,
  },
  {
    id: '58214 (13/07/26, el que probó que la recarga se PARTE entre tramos)',
    periodo: '2026-07',
    monto: 60000,
    acumuladoPrevio: 611.2,
    renglones: [
      [700, 385.08, 88.8, 34195.1],
      [1400, 233.477, 55.3, 12902.98],
    ],
    subtotalA: 47098.08,
    subtotalB: 12901.92,
    tasaMunicipal: 0,
    kwhTotal: 144.1,
    acumuladoFinal: 755.3,
  },
  {
    id: '58213 (18/07/26)',
    periodo: '2026-07',
    monto: 60000,
    acumuladoPrevio: 755.3,
    renglones: [[1400, 233.477, 201.7, 47089.99]],
    subtotalA: 47089.99,
    subtotalB: 12910.01,
    tasaMunicipal: 0,
    kwhTotal: 201.7,
    acumuladoFinal: 957.0,
  },
  {
    id: '009402425710 (26/07/26, el comprobante original del proyecto)',
    periodo: '2026-07',
    monto: 50000,
    acumuladoPrevio: 957.0,
    renglones: [[1400, 233.477, 168.1, 39243.89]],
    subtotalA: 39243.89,
    subtotalB: 10756.11,
    tasaMunicipal: 0,
    kwhTotal: 168.1,
    acumuladoFinal: 1125.1,
  },
];

for (const t of TICKETS) {
  const tarifa = tarifaDe(t.periodo);
  const r = calcularRecarga(t.monto, t.acumuladoPrevio, tarifa);

  // 1. Los precios derivados del cuadro contra los impresos. Es la prueba de que la fórmula
  //    es la correcta.
  //
  //    Tolerancia 0,001 = una unidad en el último dígito que imprime el ticket. Hace falta
  //    porque el emisor no redondea de forma consistente: en el 58351 el ≤500 sale 221,9634
  //    y lo imprime 221,964 (hacia arriba), y en el 58322 el ≤1400 sale 222,89387 y lo
  //    imprime 222,893 (truncado). El desvío es de 4 diezmilésimas de peso por kWh.
  assertIgual(t.id, 'cantidad de renglones', r.renglones.length, t.renglones.length);
  t.renglones.forEach(([tope, precio], i) => {
    const renglon = r.renglones[i];
    if (!renglon) return;
    assertIgual(t.id, `renglón ${i + 1} tope`, renglon.hastaKwhAcumulados, tope);
    assertCerca(t.id, `renglón ${i + 1} $/kWh`, renglon.precioKwh, precio, 0.001);
  });

  // 2. Los kWh, que es el número que le importa al usuario.
  //
  //    Tolerancia 0,1 por renglón: el ticket los imprime con 1 decimal (±0,05) y el último
  //    renglón arrastra además el redondeo de los anteriores. Se puede ver en el 58348, que
  //    imprime "13,9" pero cuyo propio importe (3.143,17 / 226,786) implica 13,86.
  const tolKwh = 0.1 * t.renglones.length;
  assertCerca(t.id, 'kWh acreditados', r.kwh, t.kwhTotal, tolKwh);
  assertCerca(t.id, 'acumulado final', r.acumuladoFinalKwh, t.acumuladoFinal, tolKwh);
  t.renglones.forEach(([, , kwh], i) => {
    if (r.renglones[i]) assertCerca(t.id, `renglón ${i + 1} kWh`, r.renglones[i].kwh, kwh, 0.1);
  });

  // 3. Los importes. La tolerancia se deriva del redondeo de kWh: medio decilitro de kWh a
  //    ~$390 el kWh son ~$20 por renglón, no es holgura arbitraria.
  const tolPesos = 25 * t.renglones.length;
  assertCerca(t.id, 'Subtotal A (energía)', r.subtotalEnergia, t.subtotalA, tolPesos);
  assertCerca(t.id, 'Subtotal B (impuestos)', r.subtotalImpuestos, t.subtotalB, tolPesos);
  assertCerca(t.id, 'Tasa Municipal', r.tasaMunicipal, t.tasaMunicipal, tolPesos);
  t.renglones.forEach(([, , , importe], i) => {
    if (r.renglones[i]) {
      assertCerca(t.id, `renglón ${i + 1} importe`, r.renglones[i].importe, importe, 25);
    }
  });

  // 4. La identidad que define el modelo. Acá no hay tolerancia que valga: el motor reparte
  //    el monto, así que tiene que cerrar contra el monto exacto.
  assertCerca(
    t.id,
    'A + B + Tasa = monto recargado',
    r.subtotalEnergia + r.subtotalImpuestos + r.tasaMunicipal,
    t.monto,
    0.02,
  );
}

console.log(
  `✓ Caso 1: ${TICKETS.length} comprobantes reales, precios derivados del cuadro del ENRE`,
);

// ---------------------------------------------------------------------------
// La fórmula del ENRE, mirada de cerca
// ---------------------------------------------------------------------------

{
  // Los topes de la escalera son los bloques del cuadro, en todos los períodos.
  for (const cuadro of CUADROS_EMBEBIDOS) {
    assertIgual(
      `cuadro ${cuadro.periodo}`,
      'topes de bloque',
      cuadro.bloques.map((b) => b.hastaKwh).join(','),
      TOPES_KWH.join(','),
    );
  }

  // La escalera NO es monótona: sube hasta 700 y baja fuerte en el ≤1400, porque ahí el
  // cargo fijo se reparte sobre 700 kWh de ancho en vez de 100. Si esto se rompe, alguien
  // "arregló" la fórmula asumiendo que los precios crecen.
  const t = tarifaDe('2026-07');
  const precios = t.tramos.map((x) => x.precioKwh);
  assertIgual('escalera', 'el ≤700 es el más caro', Math.max(...precios), precios[4]);
  assertIgual('escalera', 'el ≤1400 es más barato que el ≤700', precios[5] < precios[4], true);
  assertIgual('escalera', 'el ≤500 es más caro que el ≤600', precios[2] > precios[3], true);

  // El período vigente quedó completo: los 6 tramos tienen precio, incluidos los 4 que
  // ningún ticket de julio prueba.
  const vigente = tarifaVigente();
  assertIgual('vigente', 'tramos con precio', vigente.tramos.length, 6);
  assertIgual(
    'vigente',
    'todos los precios son finitos',
    vigente.tramos.every((x) => Number.isFinite(x.precioKwh) && x.precioKwh > 0),
    true,
  );

  console.log('✓ Caso 2: la escalera sale del cuadro y no es monótona');
}

// ---------------------------------------------------------------------------
// El filtro de nivel sobre el JSON del scraper
// ---------------------------------------------------------------------------
//
// cuadrosEnre.json trae los tres niveles de cada período y cuadroDe() busca solo por período,
// así que los cuadros activos tienen que venir filtrados a Edenor N2. Si ese filtro se
// rompiera, el motor calcularía con la tarifa sin subsidio sin que nada falle.

{
  const activos = cuadrosVigentes();
  assertIgual('filtro', 'un solo nivel', [...new Set(activos.map((c) => c.nivel))].join(), 'N2');
  assertIgual(
    'filtro',
    'una sola distribuidora',
    [...new Set(activos.map((c) => c.distribuidora))].join(),
    'edenor',
  );

  const periodos = activos.map((c) => c.periodo);
  assertIgual('filtro', 'un cuadro por período', periodos.length, new Set(periodos).size);
  assertIgual('filtro', 'ordenados por período', periodos.join(), [...periodos].sort().join());
  assertIgual(
    'filtro',
    'el vigente es el último',
    periodoVigente(),
    periodos[periodos.length - 1],
  );

  // El discriminante: en los tramos altos N1 y N2 dan lo mismo (el consumo base ya está
  // agotado y el excedente se cobra a precio pleno), así que solo los tramos bajos delatan si
  // se tomó el nivel equivocado. Con el cuadro N1 de jul/26 el ≤150 daría 166,286.
  assertCerca(
    'filtro',
    'el ≤150 de jul/26 es el de N2',
    tarifaDe('2026-07').tramos[0].precioKwh,
    80.708,
    0.001,
  );

  console.log(`✓ Caso 3: el JSON queda filtrado a Edenor N2 (${activos.length} períodos)`);
}

// ---------------------------------------------------------------------------
// Los impuestos y la tasa salen del monto, no se suman encima
// ---------------------------------------------------------------------------

{
  assertCerca('impuestos', 'multiplicador', multiplicadorImpuestos(), 1.273885, 0.0001);

  // Arriba de 600 kWh no hay tasa municipal, así que la proporción es solo impuestos.
  const r = calcularRecarga(50000, 700);
  assertCerca(
    'impuestos',
    'proporción que compra energía',
    r.subtotalEnergia / 50000,
    0.785,
    0.001,
  );

  // Por debajo de 600 la tasa municipal se lleva su parte, y hay que verla en el resultado.
  const conTasa = calcularRecarga(40000, 0, tarifaDe('2026-03'));
  assertCerca('tasa municipal', 'sobre 296,9 kWh a $5,24', conTasa.tasaMunicipal, 1555.76, 25);
  assertIgual('tasa municipal', 'es mayor a cero bajo 600', conTasa.tasaMunicipal > 0, true);

  console.log('✓ Caso 4: impuestos y tasa municipal salen del monto recargado');
}

// ---------------------------------------------------------------------------
// Ida y vuelta con el monto, incluso cruzando tramos
// ---------------------------------------------------------------------------

{
  // Tolerancia de $2: calcularRecarga redondea los kWh a 2 decimales y a ~$490 el kWh con
  // impuestos, medio centésimo ya vale $2,45.
  for (const acumulado of [0, 500, 611.2, 1000]) {
    for (const monto of [RECARGA_MINIMA, 20000, 50000, RECARGA_MAXIMA]) {
      const r = calcularRecarga(monto, acumulado);
      const vuelta = montoParaKwh(r.kwh, acumulado);
      assertCerca(`ida y vuelta (${monto} desde ${acumulado})`, 'monto', vuelta, monto, 3);
    }
  }
  console.log('✓ Caso 5: ida y vuelta monto ↔ kWh, en 4 acumulados y 4 montos');
}

// ---------------------------------------------------------------------------
// El salto de tramo y su signo
// ---------------------------------------------------------------------------

{
  const p = proximidadAlSalto(611.2, tarifaDe('2026-07'));
  assertCerca('salto', 'precio actual (≤700)', p.precioActual, 385.08, 0.001);
  assertCerca('salto', 'kWh hasta el salto', p.kwhHastaElSalto ?? -1, 88.8, 0.01);
  assertCerca('salto', 'precio siguiente (≤1400)', p.precioSiguiente ?? -1, 233.477, 0.001);

  // Cruzar 700 ABARATA el kWh. Si esto sale positivo, la UI va a avisar de un
  // encarecimiento que no existe.
  assertIgual('salto', 'la variación es negativa', (p.variacionPorKwh ?? 0) < 0, true);

  // En el último tramo no hay siguiente.
  const ultimo = proximidadAlSalto(1300, tarifaDe('2026-07'));
  assertIgual('salto', 'sin tramo siguiente en el ≤1400', ultimo.precioSiguiente, null);

  console.log('✓ Caso 6: el salto de 700 kWh abarata el kWh, y se reporta con signo');
}

// ---------------------------------------------------------------------------
// Bordes: lo desconocido falla, no se inventa
// ---------------------------------------------------------------------------

{
  assertIgual('bordes', 'tramo dentro de la escalera', tramoPara(1125.1)?.hastaKwhAcumulados, 1400);
  assertIgual('bordes', 'justo en el tope', tramoPara(1400)?.hastaKwhAcumulados, 1400);
  assertIgual('bordes', 'pasado el tope no hay dato', tramoPara(1400.1), null);

  assertIgual('bordes', 'monto 0 no acredita nada', calcularRecarga(0, 0).kwh, 0);

  assertLanza('bordes', 'acumulado arriba de 1400', () => calcularRecarga(10000, 1500));
  assertLanza('bordes', 'monto negativo', () => calcularRecarga(-1, 0));
  assertLanza('bordes', 'acumulado negativo', () => calcularRecarga(1000, -1));
  assertLanza('bordes', 'kWh negativos', () => montoParaKwh(-1, 0));
  // Anterior al primer cuadro que el ENRE tiene publicado en su índice.
  assertLanza('bordes', 'período sin cuadro', () => tarifaDe('2020-01'));

  // Una recarga que no cabe en la escalera tampoco se puede liquidar: los kWh de más no
  // tienen precio conocido.
  assertLanza('bordes', 'recarga que desborda el ≤1400', () =>
    calcularRecarga(RECARGA_MAXIMA, 1399),
  );

  console.log('✓ Caso 7: fuera de la escalera falla en vez de extrapolar');
}

if (fallos > 0) {
  console.error(`\n${fallos} assert(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodos los casos pasan.');
