// Cálculos de precios (sin base de datos): los usan Ventas y Cotizaciones.

// Costo PEPS de `qty` piezas de un producto, después de las primeras `skip` que ya se usaron.
// Las que no alcanzan en inventario llevan el costo estimado del siguiente pedido.
export function fifoCost(p, skip, qty) {
  let cost = 0;
  for (const l of p.lots) {
    const take = Math.min(Math.max(l.units - skip, 0), qty);
    skip = Math.max(skip - l.units, 0);
    cost += take * l.cost;
    qty -= take;
    if (!qty) return cost;
  }
  return cost + qty * p.estimate;
}

// Escalas de mayoreo y margen mínimo (ganancia ÷ precio).
export const TIERS = [1, 5, 10, 20, 50];
export const MIN_MARGIN = 0.5;
// Cuánto del descuento total (de tu precio por pieza al piso de 50 pzas) se da en cada escala.
const STEP = { 1: 0, 5: 0.25, 10: 0.5, 20: 0.75, 50: 1 };

// Tabla de cotización: de tu precio por pieza baja en partes iguales hasta llegar, en 50 piezas,
// al precio que deja exactamente el margen mínimo. Ninguna escala queda debajo de su piso.
export function buildQuote(p, unitPrice) {
  const costOf = (q) => fifoCost(p, 0, q) / q;
  const floorOf = (q) => Math.ceil(costOf(q) / (1 - MIN_MARGIN));
  const top = TIERS[TIERS.length - 1];
  const bottom = floorOf(top);
  const tooLow = unitPrice <= bottom;
  const rows = TIERS.map((q) => {
    const cost = costOf(q);
    const floor = floorOf(q);
    // Si tu precio ya está debajo del piso no hay descuento de mayoreo: todas las escalas
    // quedan a tu precio (y se marcan como debajo del mínimo).
    const price = q === 1 || tooLow ? unitPrice : Math.max(Math.ceil(unitPrice - (unitPrice - bottom) * STEP[q]), floor);
    const profit = (price - cost) * q;
    return {
      qty: q, price, total: price * q, cost, floor, profit,
      margin: price > 0 ? (price - cost) / price : 0,
      room: price - floor,
      short: Math.max(q - Math.max(p.stock, 0), 0),
    };
  });
  return { rows, floor: floorOf(1), tooLow };
}
