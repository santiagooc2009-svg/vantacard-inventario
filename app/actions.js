'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { q, one } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { syncSaleCosts } from '@/lib/cortes';
import { COOKIE, tokenFor } from '@/lib/auth';
import { today } from '@/lib/format';

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const int = (v) => Math.trunc(num(v));
const txt = (v) => {
  const s = String(v ?? '').trim();
  return s ? s : null;
};
const dateOr = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : today());

function refresh() {
  revalidatePath('/', 'layout');
}

// Para cambios que mueven piezas: reacomoda los cortes y el costo PEPS de cada venta.
async function refreshCosts() {
  await syncSaleCosts();
  refresh();
}

// ---------- Sesión ----------

export async function login(_prev, formData) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return { error: 'Falta configurar APP_PASSWORD en Vercel (Settings → Environment Variables).' };
  if (String(formData.get('password') ?? '') !== pw) return { error: 'Contraseña incorrecta.' };
  const jar = await cookies();
  jar.set(COOKIE, await tokenFor(pw), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 60,
  });
  redirect('/');
}

export async function logout() {
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect('/login');
}

// ---------- Productos e inventario ----------

export async function createProduct(formData) {
  await ensureSchema();
  const name = txt(formData.get('name'));
  if (!name) return;
  await q(
    `insert into products (name, sku, sale_price, min_stock, notes) values ($1,$2,$3,$4,$5)`,
    [name, txt(formData.get('sku')), num(formData.get('sale_price')), int(formData.get('min_stock')), txt(formData.get('notes'))]
  );
  refresh();
}

export async function updateProduct(formData) {
  await ensureSchema();
  const id = int(formData.get('id'));
  const name = txt(formData.get('name'));
  if (!id || !name) return;
  await q(
    `update products set name=$2, sku=$3, sale_price=$4, min_stock=$5, notes=$6, active=$7 where id=$1`,
    [id, name, txt(formData.get('sku')), num(formData.get('sale_price')), int(formData.get('min_stock')),
     txt(formData.get('notes')), formData.get('active') !== 'off']
  );
  refresh();
}

export async function adjustStock(formData) {
  await ensureSchema();
  const productId = int(formData.get('product_id'));
  let qty = Math.abs(int(formData.get('qty')));
  if (!productId || !qty) return;
  if (formData.get('direction') === 'out') qty = -qty;
  await q(
    `insert into stock_adjustments (date, product_id, qty, reason) values ($1,$2,$3,$4)`,
    [dateOr(formData.get('date')), productId, qty, txt(formData.get('reason'))]
  );
  await refreshCosts();
}

export async function deleteAdjustment(formData) {
  await ensureSchema();
  await q(`delete from stock_adjustments where id=$1`, [int(formData.get('id'))]);
  await refreshCosts();
}

// ---------- Pedidos a proveedores ----------

export async function createPurchase(formData) {
  await ensureSchema();
  const supplier = txt(formData.get('supplier'));
  if (!supplier) return;

  const ids = formData.getAll('product_id');
  const newNames = formData.getAll('new_name');
  const units = formData.getAll('units');
  const subtotals = formData.getAll('subtotal');

  const lines = [];
  for (let i = 0; i < ids.length; i++) {
    const u = int(units[i]);
    if (u <= 0) continue;
    let productId = int(ids[i]);
    if (ids[i] === 'new') {
      const name = txt(newNames[i]);
      if (!name) continue;
      const p = await one(`insert into products (name) values ($1) returning id`, [name]);
      productId = p.id;
    }
    if (!productId) continue;
    lines.push({ productId, units: u, subtotal: num(subtotals[i]) });
  }
  if (!lines.length) return;

  const pur = await one(
    `insert into purchases (date, supplier, platform, order_number, total_paid, refund, status, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [dateOr(formData.get('date')), supplier, txt(formData.get('platform')), txt(formData.get('order_number')),
     num(formData.get('total_paid')), num(formData.get('refund')), statusPurchase(formData.get('status')),
     txt(formData.get('notes'))]
  );
  for (const l of lines) {
    await q(`insert into purchase_items (purchase_id, product_id, units, subtotal) values ($1,$2,$3,$4)`,
      [pur.id, l.productId, l.units, l.subtotal]);
  }
  await refreshCosts();
}

function statusPurchase(v) {
  return ['en_camino', 'recibido', 'cancelado'].includes(v) ? v : 'en_camino';
}

export async function updatePurchase(formData) {
  await ensureSchema();
  const id = int(formData.get('id'));
  if (!id) return;
  await q(
    `update purchases set status=$2, total_paid=$3, refund=$4, notes=$5, date=$6 where id=$1`,
    [id, statusPurchase(formData.get('status')), num(formData.get('total_paid')), num(formData.get('refund')),
     txt(formData.get('notes')), dateOr(formData.get('date'))]
  );
  await refreshCosts();
}

export async function deletePurchase(formData) {
  await ensureSchema();
  await q(`delete from purchases where id=$1`, [int(formData.get('id'))]);
  await refreshCosts();
}

// ---------- Ventas ----------

export async function createSale(formData) {
  await ensureSchema();
  const ids = formData.getAll('product_id');
  const qtys = formData.getAll('qty');
  const prices = formData.getAll('price');

  const lines = [];
  for (let i = 0; i < ids.length; i++) {
    const productId = int(ids[i]);
    const qty = int(qtys[i]);
    if (!productId || qty <= 0) continue;
    lines.push({ productId, qty, price: num(prices[i]) });
  }
  if (!lines.length) return;

  // Por entregar: aparta las piezas, pero cuenta como venta hasta que se marca entregada.
  // Una venta con fecha futura siempre queda por entregar.
  const date = dateOr(formData.get('date'));
  const delivered = formData.get('delivery') !== 'por_entregar' && date <= today();

  const sale = await one(
    `insert into sales (date, customer, channel, payment_method, shipping_charged, discount, status, notes, delivered)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [date, txt(formData.get('customer')), txt(formData.get('channel')),
     txt(formData.get('payment_method')), num(formData.get('shipping_charged')), num(formData.get('discount')),
     formData.get('status') === 'pendiente' ? 'pendiente' : 'pagada', txt(formData.get('notes')), delivered]
  );
  // El costo de cada pieza lo pone refreshCosts() con PEPS, según el corte que se está gastando.
  for (const l of lines) {
    await q(`insert into sale_items (sale_id, product_id, qty, unit_price) values ($1,$2,$3,$4)`,
      [sale.id, l.productId, l.qty, l.price]);
  }
  await refreshCosts();
}

// Entregada: desde ese día cuenta como venta (la fecha pasa a ser la de la entrega).
export async function markDelivered(formData) {
  await ensureSchema();
  await q(`update sales set delivered = true, date = $2 where id = $1`,
    [int(formData.get('id')), dateOr(formData.get('date'))]);
  await refreshCosts();
}

export async function toggleSaleStatus(formData) {
  await ensureSchema();
  await q(
    `update sales set status = case when status='pagada' then 'pendiente' else 'pagada' end where id=$1`,
    [int(formData.get('id'))]
  );
  refresh();
}

export async function deleteSale(formData) {
  await ensureSchema();
  await q(`delete from sales where id=$1`, [int(formData.get('id'))]);
  await refreshCosts();
}

// ---------- Gastos, metas y fondo de euros ----------

export async function setRetiro(formData) {
  await ensureSchema();
  const amount = Math.max(num(formData.get('retiro')), 0);
  await q(
    `insert into app_meta (key, value) values ('retiro_euros', $1)
     on conflict (key) do update set value = excluded.value`,
    [String(amount)]
  );
  refresh();
}

export async function setGoal(formData) {
  await ensureSchema();
  const goal = num(formData.get('goal'));
  if (goal > 0) {
    await q(
      `insert into app_meta (key, value) values ('meta_ventas', $1)
       on conflict (key) do update set value = excluded.value`,
      [String(goal)]
    );
  } else {
    await q(`delete from app_meta where key = 'meta_ventas'`);
  }
  refresh();
}

export async function createExpense(formData) {
  await ensureSchema();
  const amount = num(formData.get('amount'));
  if (amount <= 0) return;
  await q(`insert into expenses (date, category, description, amount) values ($1,$2,$3,$4)`,
    [dateOr(formData.get('date')), txt(formData.get('category')) ?? 'Otros', txt(formData.get('description')), amount]);
  refresh();
}

export async function deleteExpense(formData) {
  await ensureSchema();
  await q(`delete from expenses where id=$1`, [int(formData.get('id'))]);
  refresh();
}
