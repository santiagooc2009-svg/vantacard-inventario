import { q } from './db';
import { today as todayMX } from './format';

// Costo real de cada línea de compra: lo pagado menos el reembolso, repartido entre
// los artículos del pedido según su precio (o por piezas si no hay precio).
export const ITEM_COST_CTE = `
  pt as (
    select purchase_id, sum(subtotal) s, sum(units) u
    from purchase_items group by purchase_id
  ),
  ic as (
    select pi.id, pi.purchase_id, pi.product_id, pi.units, p.status,
      case
        when pt.s > 0 then (p.total_paid - p.refund) * pi.subtotal / pt.s
        else (p.total_paid - p.refund) * pi.units / nullif(pt.u, 0)
      end as cost
    from purchase_items pi
    join purchases p on p.id = pi.purchase_id
    join pt on pt.purchase_id = pi.purchase_id
  )`;

// ---------- Cortes (PEPS) ----------
//
// Cada pedido recibido es un corte. Las ventas y las mermas (ajustes negativos) gastan
// primero las piezas del pedido más viejo. Las piezas de ajustes positivos no tienen costo
// y solo se gastan cuando ya se acabaron todos los pedidos de ese producto.
// Si vendes más de lo que hay, esas piezas quedan sin corte y su costo es estimado
// hasta que recibas el siguiente pedido.
// Las ventas por entregar apartan sus piezas (reserved) pero su dinero no cuenta en el corte
// hasta que se entregan, y un corte con piezas apartadas sigue abierto.
// Todo se calcula al momento: editar o borrar cualquier cosa recalcula los cortes.

const SALE = 0;
const LOSS = 1;

const dayDiff = (from, to) =>
  Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
const round2 = (n) => Math.round(n * 100) / 100;

// lots: líneas de pedido (todos los estados) en orden de fecha del pedido.
// saleLines: líneas de venta con los datos de su venta. adjustments: ajustes de inventario.
export function computeCortes({ lots, saleLines, adjustments, today }) {
  const queues = new Map();
  const queueOf = (productId) => {
    let qu = queues.get(productId);
    if (!qu) queues.set(productId, (qu = { lots: [], pos: 0, unmatched: 0 }));
    return qu;
  };

  // Costo estimado para piezas vendidas sin inventario: el del siguiente pedido en camino
  // o, si no hay, el del último pedido recibido de ese producto.
  const lastReceived = new Map();
  const nextInTransit = new Map();

  const cortes = new Map();
  for (const l of lots) {
    const unitCost = l.units > 0 ? l.cost / l.units : 0;
    if (l.status === 'en_camino' && !nextInTransit.has(l.product_id)) nextInTransit.set(l.product_id, unitCost);
    if (l.status !== 'recibido' || l.units <= 0) continue;
    lastReceived.set(l.product_id, unitCost);

    let c = cortes.get(l.purchase_id);
    if (!c) {
      c = { id: l.purchase_id, date: l.date, supplier: l.supplier, platform: l.platform, cost: l.net, items: [] };
      cortes.set(l.purchase_id, c);
    }
    const item = { id: l.id, product_id: l.product_id, name: l.name, units: l.units, sold: 0, lost: 0, reserved: 0, revenue: 0, endedOn: null };
    c.items.push(item);
    queueOf(l.product_id).lots.push({ item, left: l.units, unitCost });
  }
  const estimateOf = (productId) => nextInTransit.get(productId) ?? lastReceived.get(productId) ?? 0;
  for (const productId of nextInTransit.keys()) queueOf(productId);

  // Ajustes positivos: al final de la fila de su producto, sin costo.
  const extra = new Map();
  for (const a of adjustments) if (a.qty > 0) extra.set(a.product_id, (extra.get(a.product_id) ?? 0) + a.qty);
  for (const [productId, qty] of extra) queueOf(productId).lots.push({ item: null, left: qty, unitCost: 0 });

  // Lo que se vendió por pieza: el total de la venta (piezas + envío − descuento)
  // repartido entre sus piezas según su precio.
  const saleTotals = new Map();
  for (const l of saleLines) {
    const t = saleTotals.get(l.sale_id) ?? { goods: 0, qty: 0, extra: l.shipping - l.discount };
    t.goods += l.qty * l.unit_price;
    t.qty += l.qty;
    saleTotals.set(l.sale_id, t);
  }
  const unitRevenue = (l) => {
    const t = saleTotals.get(l.sale_id);
    return t.goods > 0 ? l.unit_price * (1 + t.extra / t.goods) : t.extra / t.qty;
  };

  const outs = [
    ...saleLines.filter((l) => l.qty > 0).map((l) => ({
      kind: SALE, id: l.id, product_id: l.product_id, qty: l.qty, date: l.date, ts: l.ts, revenue: unitRevenue(l),
      delivered: l.delivered !== false,
    })),
    ...adjustments.filter((a) => a.qty < 0).map((a) => ({
      kind: LOSS, id: a.id, product_id: a.product_id, qty: -a.qty, date: a.date, ts: a.ts,
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts || a.kind - b.kind || a.id - b.id));

  const saleCosts = new Map();
  const estimated = new Set();
  for (const o of outs) {
    const qu = queueOf(o.product_id);
    let need = o.qty;
    let cost = 0;
    while (need > 0 && qu.pos < qu.lots.length) {
      const lot = qu.lots[qu.pos];
      const take = Math.min(need, lot.left);
      lot.left -= take;
      need -= take;
      cost += take * lot.unitCost;
      if (lot.item) {
        if (o.kind === SALE && o.delivered) {
          lot.item.sold += take;
          lot.item.revenue += take * o.revenue;
        } else if (o.kind === SALE) {
          lot.item.reserved += take;
        } else {
          lot.item.lost += take;
        }
        if (lot.left === 0) lot.item.endedOn = o.date;
      }
      if (lot.left === 0) qu.pos++;
    }
    if (need > 0) {
      qu.unmatched += need;
      cost += need * estimateOf(o.product_id);
      if (o.kind === SALE) estimated.add(o.id);
    }
    if (o.kind === SALE) saleCosts.set(o.id, round2(cost / o.qty));
  }

  const list = [...cortes.values()].map((c) => {
    const sum = (k) => c.items.reduce((a, i) => a + i[k], 0);
    const units = sum('units');
    const sold = sum('sold');
    const lost = sum('lost');
    const reserved = sum('reserved');
    const revenue = sum('revenue');
    const left = units - sold - lost - reserved;
    const closed = left === 0 && reserved === 0;
    const endedOn = closed ? c.items.map((i) => i.endedOn).sort().at(-1) : null;
    return {
      ...c,
      units, sold, lost, reserved, left, revenue, closed, endedOn,
      profit: revenue - c.cost,
      recovered: c.cost > 0 ? revenue / c.cost : null,
      days: Math.max(0, dayDiff(c.date, endedOn ?? today)),
    };
  });

  // Lo que queda de cada producto, en el orden en que se va a gastar.
  const products = new Map();
  for (const [productId, qu] of queues) {
    const lotsLeft = qu.lots.slice(qu.pos).filter((l) => l.left > 0).map((l) => ({ units: l.left, cost: l.unitCost }));
    products.set(productId, {
      lots: lotsLeft,
      estimate: estimateOf(productId),
      unit_cost: lotsLeft[0]?.cost ?? estimateOf(productId),
      stock_value: lotsLeft.reduce((a, l) => a + l.units * l.cost, 0),
      unmatched: qu.unmatched,
    });
  }

  return {
    cortes: list,
    open: list.filter((c) => !c.closed).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id)),
    closed: list.filter((c) => c.closed).sort((a, b) => (a.endedOn < b.endedOn ? 1 : a.endedOn > b.endedOn ? -1 : b.id - a.id)),
    byPurchase: Object.fromEntries(list.map((c) => [c.id, c])),
    products,
    saleCosts,
    estimated,
  };
}

export async function loadCortes() {
  const [lots, saleLines, adjustments] = await Promise.all([
    q(`with ${ITEM_COST_CTE}
       select ic.id, ic.purchase_id, ic.product_id, ic.units, ic.status, coalesce(ic.cost, 0)::float8 as cost,
         pr.name, to_char(p.date, 'YYYY-MM-DD') as date, p.supplier, p.platform,
         (p.total_paid - p.refund)::float8 as net
       from ic
       join purchases p on p.id = ic.purchase_id
       join products pr on pr.id = ic.product_id
       order by p.date, p.id, ic.id`),
    q(`select si.id, si.sale_id, si.product_id, si.qty,
         si.unit_price::float8 unit_price, si.unit_cost::float8 unit_cost,
         to_char(sa.date, 'YYYY-MM-DD') as date, extract(epoch from sa.created_at)::float8 as ts,
         sa.shipping_charged::float8 shipping, sa.discount::float8 discount, sa.delivered
       from sale_items si join sales sa on sa.id = si.sale_id
       order by sa.date, sa.created_at, sa.id, si.id`),
    q(`select id, product_id, qty, to_char(date, 'YYYY-MM-DD') as date, extract(epoch from created_at)::float8 as ts
       from stock_adjustments order by date, created_at, id`),
  ]);
  return { ...computeCortes({ lots, saleLines, adjustments, today: todayMX() }), saleLines };
}

// Vuelve a calcular con PEPS el costo guardado en cada venta. Se llama después de
// cualquier cambio en pedidos, ventas o ajustes.
export async function syncSaleCosts() {
  const { saleCosts, saleLines } = await loadCortes();
  const changed = saleLines.filter((l) => Math.abs((saleCosts.get(l.id) ?? 0) - l.unit_cost) >= 0.005);
  if (!changed.length) return;
  await q(
    `update sale_items si set unit_cost = v.cost
     from unnest($1::int[], $2::numeric[]) as v(id, cost)
     where si.id = v.id`,
    [changed.map((l) => l.id), changed.map((l) => saleCosts.get(l.id) ?? 0)]
  );
}
