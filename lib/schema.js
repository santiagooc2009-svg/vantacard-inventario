import { q, one } from './db';
import { syncSaleCosts } from './cortes';

// Crea las tablas la primera vez que abre la app y carga los pedidos iniciales.
// No hay que correr ningún comando: todo pasa solo al primer uso.

const TABLES = [
  `create table if not exists app_meta (
     key text primary key,
     value text,
     created_at timestamptz not null default now()
   )`,
  `create table if not exists products (
     id serial primary key,
     name text not null,
     sku text,
     sale_price numeric(12,2) not null default 0,
     min_stock int not null default 0,
     notes text,
     active boolean not null default true,
     created_at timestamptz not null default now()
   )`,
  // status: en_camino | recibido | cancelado
  `create table if not exists purchases (
     id serial primary key,
     date date not null,
     supplier text not null,
     platform text,
     order_number text,
     total_paid numeric(12,2) not null default 0,
     refund numeric(12,2) not null default 0,
     status text not null default 'en_camino',
     notes text,
     created_at timestamptz not null default now()
   )`,
  `create table if not exists purchase_items (
     id serial primary key,
     purchase_id int not null references purchases(id) on delete cascade,
     product_id int not null references products(id) on delete restrict,
     units int not null,
     subtotal numeric(12,2) not null default 0
   )`,
  // status: pagada | pendiente
  `create table if not exists sales (
     id serial primary key,
     date date not null,
     customer text,
     channel text,
     payment_method text,
     shipping_charged numeric(12,2) not null default 0,
     discount numeric(12,2) not null default 0,
     status text not null default 'pagada',
     notes text,
     created_at timestamptz not null default now()
   )`,
  // Ventas por entregar: delivered = false aparta las piezas pero no cuenta como venta.
  // Las ventas que ya existían quedan como entregadas.
  `alter table sales add column if not exists delivered boolean not null default true`,
  `create table if not exists sale_items (
     id serial primary key,
     sale_id int not null references sales(id) on delete cascade,
     product_id int not null references products(id) on delete restrict,
     qty int not null,
     unit_price numeric(12,2) not null,
     unit_cost numeric(12,2) not null default 0
   )`,
  `create table if not exists expenses (
     id serial primary key,
     date date not null,
     category text not null,
     description text,
     amount numeric(12,2) not null,
     created_at timestamptz not null default now()
   )`,
  // Passkeys (Face ID / Touch ID) para entrar sin contraseña. La contraseña sigue de respaldo.
  `create table if not exists passkeys (
     id text primary key,
     public_key text not null,
     counter bigint not null default 0,
     transports text,
     device text,
     created_at timestamptz not null default now(),
     last_used_at timestamptz
   )`,
  `create table if not exists stock_adjustments (
     id serial primary key,
     date date not null,
     product_id int not null references products(id) on delete cascade,
     qty int not null,
     reason text,
     created_at timestamptz not null default now()
   )`,
];

// Pedidos tomados de las capturas de AliExpress y del recibo de Alibaba.
// "subtotal" = precio de lista de los artículos; "total_paid" = lo que realmente pagaste
// (incluye envío, comisiones y descuentos). El costo real por pieza sale de total_paid − refund.
const SEED = [
  {
    product: 'Placa NFC Instagram con QR',
    purchase: {
      date: '2026-09-08', supplier: 'Shop1103847351 Store', platform: 'AliExpress',
      total_paid: 301.24, refund: 0, status: 'recibido',
      notes: 'Variante "ins". AliExpress reembolsó MX$77.75 sin necesidad de devolver el producto (no se cuenta en el costo).',
    },
    units: 5, subtotal: 279.5,
  },
  {
    product: 'Tarjeta NFC Google negra cuadrada',
    purchase: {
      date: '2026-09-20', supplier: 'HaiNuo Store', platform: 'AliExpress',
      total_paid: 396.56, refund: 0, status: 'recibido',
      notes: '3 paquetes de 5 piezas (Black 5PCS).',
    },
    units: 15, subtotal: 358.8,
  },
  {
    product: 'Tarjeta RFID QR Google lado A/B',
    purchase: {
      date: '2026-09-20', supplier: 'Momento Eterno Store', platform: 'AliExpress',
      total_paid: 142.2, refund: 142.2, status: 'cancelado',
      notes: 'Paquete de 20 piezas. Reembolso completo (MX$137.56 + MX$4.64). Si sí te llegaron, cambia el estado a "Recibido".',
    },
    units: 20, subtotal: 161.9,
  },
  {
    product: 'Tarjeta NFC de madera (nogal)',
    purchase: {
      date: '2026-09-20', supplier: 'nerina Store', platform: 'AliExpress',
      total_paid: 95.12, refund: 95.12, status: 'cancelado',
      notes: 'Reembolso completo (MX$92.02 + MX$3.10). Si sí te llegaron, cambia el estado a "Recibido".',
    },
    units: 4, subtotal: 83.2,
  },
  {
    product: 'Tarjeta NFC Google acabado mate',
    purchase: {
      date: '2026-09-08', supplier: 'Xingkaruikong NFC Store', platform: 'AliExpress',
      total_paid: 60.25, refund: 0, status: 'recibido',
      notes: 'Paquete de 10 piezas.',
    },
    units: 10, subtotal: 55.9,
  },
  {
    product: 'Tarjeta NFC Google Social Media 504B',
    purchase: {
      date: '2026-09-19', supplier: 'Alibaba', platform: 'Alibaba', order_number: '31616697050',
      total_paid: 246.38, refund: 0, status: 'recibido',
      notes: '12 piezas a MXN 17.19 + envío MXN 32.97 + comisión de pago MXN 7.19 (Apple Pay). Pagado en USD 14.05.',
    },
    units: 12, subtotal: 206.23,
  },
];

async function seed() {
  // Solo una instancia gana este insert, así nunca se duplica la carga inicial.
  const won = await one(
    `insert into app_meta (key, value) values ('seeded', 'v1')
     on conflict (key) do nothing returning key`
  );
  if (!won) return;

  for (const s of SEED) {
    const prod = await one(`insert into products (name) values ($1) returning id`, [s.product]);
    const p = s.purchase;
    const pur = await one(
      `insert into purchases (date, supplier, platform, order_number, total_paid, refund, status, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [p.date, p.supplier, p.platform, p.order_number ?? null, p.total_paid, p.refund, p.status, p.notes]
    );
    await q(
      `insert into purchase_items (purchase_id, product_id, units, subtotal) values ($1,$2,$3,$4)`,
      [pur.id, prod.id, s.units, s.subtotal]
    );
  }
}

async function migrate() {
  for (const sql of TABLES) {
    try {
      await q(sql);
    } catch (e) {
      // Si dos instancias crean la misma tabla al mismo tiempo, reintenta una vez.
      await new Promise((r) => setTimeout(r, 300));
      await q(sql);
    }
  }
  await seed();
  await migrateToFifoCosts();
}

// Una sola vez: las ventas que ya existían guardaban el costo promedio; aquí pasan a PEPS.
async function migrateToFifoCosts() {
  if (await one(`select 1 from app_meta where key = 'peps'`)) return;
  await syncSaleCosts();
  await q(`insert into app_meta (key, value) values ('peps', 'v1') on conflict (key) do nothing`);
}

export function ensureSchema() {
  if (!globalThis.__vantacardSchema) {
    globalThis.__vantacardSchema = migrate().catch((e) => {
      globalThis.__vantacardSchema = null;
      throw e;
    });
  }
  return globalThis.__vantacardSchema;
}
