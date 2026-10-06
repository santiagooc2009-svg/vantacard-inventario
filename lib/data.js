import { cache } from 'react';
import { q, one } from './db';
import { ensureSchema } from './schema';
import { ITEM_COST_CTE, loadCortes } from './cortes';
import { INICIO } from './format';

// Cortes calculados con PEPS. cache() evita repetir el cálculo dentro de una misma página.
export const getCortes = cache(async () => {
  await ensureSchema();
  return loadCortes();
});

export async function getProducts({ includeInactive = false } = {}) {
  await ensureSchema();
  const [rows, { products }] = await Promise.all([q(
    `with ${ITEM_COST_CTE},
     rec as (
       select product_id, sum(units) units, sum(cost) cost
       from ic where status = 'recibido' group by product_id
     ),
     tr as (
       select product_id, sum(units) units from ic where status = 'en_camino' group by product_id
     ),
     sold as (
       select product_id, sum(qty) qty, sum(qty * unit_price) revenue, sum(qty * unit_cost) cogs
       from sale_items group by product_id
     ),
     adj as (select product_id, sum(qty) qty from stock_adjustments group by product_id)
     select pr.id, pr.name, pr.sku, pr.notes, pr.active, pr.min_stock,
       pr.sale_price::float8 as sale_price,
       coalesce(rec.units, 0)::int as received,
       coalesce(tr.units, 0)::int as in_transit,
       coalesce(sold.qty, 0)::int as sold,
       coalesce(adj.qty, 0)::int as adjusted,
       (coalesce(rec.units,0) - coalesce(sold.qty,0) + coalesce(adj.qty,0))::int as stock,
       coalesce(rec.cost / nullif(rec.units, 0), 0)::float8 as avg_cost,
       coalesce(sold.revenue, 0)::float8 as revenue,
       coalesce(sold.cogs, 0)::float8 as cogs
     from products pr
     left join rec on rec.product_id = pr.id
     left join tr on tr.product_id = pr.id
     left join sold on sold.product_id = pr.id
     left join adj on adj.product_id = pr.id
     where ($1::boolean or pr.active)
     order by pr.active desc, pr.name`,
    [includeInactive]
  ), getCortes()]);
  // unit_cost: lo que cuesta la siguiente pieza que vas a vender (la del corte que se está gastando).
  // stock_value: lo que te costaron las piezas que te quedan. lots: lo que queda de cada corte, en orden.
  return rows.map((p) => {
    const f = products.get(p.id);
    return {
      ...p,
      unit_cost: f ? f.unit_cost : p.avg_cost,
      stock_value: f ? f.stock_value : 0,
      lots: f ? f.lots : [],
      estimate: f ? f.estimate : p.avg_cost,
      unmatched: f ? f.unmatched : 0,
    };
  });
}

export async function getPurchases() {
  await ensureSchema();
  const purchases = await q(
    `select id, to_char(date, 'YYYY-MM-DD') as date, supplier, platform, order_number,
       total_paid::float8 total_paid, refund::float8 refund, status, notes
     from purchases order by date desc, id desc`
  );
  const items = await q(
    `with ${ITEM_COST_CTE}
     select ic.id, ic.purchase_id, ic.units, ic.cost::float8 as cost, pr.name
     from ic join products pr on pr.id = ic.product_id order by ic.id`
  );
  return purchases.map((p) => ({ ...p, items: items.filter((i) => i.purchase_id === p.id) }));
}

export async function getSales({ limit = 200 } = {}) {
  await ensureSchema();
  const sales = await q(
    `select id, to_char(date, 'YYYY-MM-DD') as date, customer, channel, payment_method,
       shipping_charged::float8 shipping_charged, discount::float8 discount, status, notes
     from sales order by date desc, id desc limit $1`,
    [limit]
  );
  if (!sales.length) return [];
  const items = await q(
    `select si.id, si.sale_id, si.qty, si.unit_price::float8 unit_price, si.unit_cost::float8 unit_cost, pr.name
     from sale_items si join products pr on pr.id = si.product_id
     where si.sale_id = any($1::int[]) order by si.id`,
    [sales.map((s) => s.id)]
  );
  return sales.map((s) => {
    const its = items.filter((i) => i.sale_id === s.id);
    const goods = its.reduce((a, i) => a + i.qty * i.unit_price, 0);
    const cost = its.reduce((a, i) => a + i.qty * i.unit_cost, 0);
    const total = goods + s.shipping_charged - s.discount;
    return { ...s, items: its, total, cost, profit: total - cost };
  });
}

export async function getExpenses() {
  await ensureSchema();
  return q(
    `select id, to_char(date, 'YYYY-MM-DD') as date, category, description, amount::float8 amount
     from expenses order by date desc, id desc`
  );
}

export async function getAdjustments() {
  await ensureSchema();
  return q(
    `select a.id, to_char(a.date, 'YYYY-MM-DD') as date, a.qty, a.reason, pr.name
     from stock_adjustments a join products pr on pr.id = a.product_id
     order by a.date desc, a.id desc limit 50`
  );
}

// Resumen por mes: ventas, costo de lo vendido, gastos y dinero puesto en inventario.
// Lo anterior a INICIO se suma al primer mes del negocio.
export async function getMonthly() {
  await ensureSchema();
  return q(
    `with s as (
       select greatest(to_char(sa.date, 'YYYY-MM'), $1) m,
         sum(sa.shipping_charged - sa.discount) extra
       from sales sa group by 1
     ),
     si as (
       select greatest(to_char(sa.date, 'YYYY-MM'), $1) m,
         sum(i.qty * i.unit_price) goods, sum(i.qty * i.unit_cost) cogs, sum(i.qty) units
       from sale_items i join sales sa on sa.id = i.sale_id group by 1
     ),
     e as (select greatest(to_char(date, 'YYYY-MM'), $1) m, sum(amount) amt from expenses group by 1),
     p as (select greatest(to_char(date, 'YYYY-MM'), $1) m, sum(total_paid - refund) amt from purchases group by 1),
     months as (select m from s union select m from si union select m from e union select m from p)
     select months.m as month,
       (coalesce(si.goods,0) + coalesce(s.extra,0))::float8 as revenue,
       coalesce(si.cogs,0)::float8 as cogs,
       coalesce(si.units,0)::int as units,
       coalesce(e.amt,0)::float8 as expenses,
       coalesce(p.amt,0)::float8 as inventory_spend
     from months
     left join s on s.m = months.m
     left join si on si.m = months.m
     left join e on e.m = months.m
     left join p on p.m = months.m
     order by months.m desc`,
    [INICIO]
  );
}

// Meta de ventas al mes. Se guarda en app_meta para no crear tablas nuevas.
export async function getGoal() {
  await ensureSchema();
  const row = await one(`select value from app_meta where key = 'meta_ventas'`);
  const n = row ? Number(row.value) : 0;
  return n > 0 ? n : null;
}

// Retiro mensual al fondo de euros (lo que vale Claude). No es gasto del negocio: es dinero que sale
// cada mes desde INICIO y cuenta en el punto de equilibrio y en el flujo. Si nunca se ha cambiado, son $400.
export const RETIRO_DEFAULT = 400;
export async function getRetiro() {
  await ensureSchema();
  const row = await one(`select value from app_meta where key = 'retiro_euros'`);
  const n = row ? Number(row.value) : RETIRO_DEFAULT;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function getTotals() {
  await ensureSchema();
  return one(
    `select
       (select coalesce(sum(total_paid - refund),0) from purchases)::float8 as inventory_spend,
       (select coalesce(sum(refund),0) from purchases)::float8 as refunds,
       (select coalesce(sum(amount),0) from expenses)::float8 as expenses,
       (select count(*) from purchases where status = 'en_camino')::int as in_transit_orders`
  );
}
