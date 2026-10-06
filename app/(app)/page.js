import Link from 'next/link';
import { getProducts, getSales, getMonthly, getTotals, getPurchases, getCortes } from '@/lib/data';
import { mxn, fecha, thisMonth, mes } from '@/lib/format';
import { CorteProgress, corteTitle, dias } from '@/components/Corte';

export default async function Inicio() {
  const [products, allSalesList, monthly, totals, purchases, cortes] = await Promise.all([
    getProducts(), getSales({ limit: 1000 }), getMonthly(), getTotals(), getPurchases(), getCortes(),
  ]);

  const sales = allSalesList.slice(0, 5);
  const m = monthly.find((r) => r.month === thisMonth()) ?? { revenue: 0, cogs: 0, expenses: 0, units: 0 };
  const monthProfit = m.revenue - m.cogs - m.expenses;

  const allSales = monthly.reduce((a, r) => a + r.revenue, 0);
  const allCogs = monthly.reduce((a, r) => a + r.cogs, 0);
  const invValue = products.reduce((a, p) => a + p.stock_value, 0);
  const invUnits = products.reduce((a, p) => a + Math.max(p.stock, 0), 0);
  const potential = products.reduce((a, p) => a + Math.max(p.stock, 0) * p.sale_price, 0);
  const invested = totals.inventory_spend + totals.expenses;
  const recovered = allSales;
  const pending = allSalesList.filter((s) => s.status === 'pendiente');
  const pendingTotal = pending.reduce((a, s) => a + s.total, 0);

  const noPrice = products.filter((p) => !p.sale_price && p.stock > 0);
  const low = products.filter((p) => p.stock <= p.min_stock && p.received > 0 && !p.unmatched);
  const transit = purchases.filter((p) => p.status === 'en_camino');
  const oversold = products.filter((p) => p.unmatched > 0);

  return (
    <div className="stack-lg">
      <section className="hero">
        <p className="eyebrow">{mes(thisMonth())}</p>
        <div className="hero-row">
          <div>
            <p className="label">Ventas del mes</p>
            <p className="big-num">{mxn(m.revenue)}</p>
          </div>
          <div className="right">
            <p className="label">Utilidad del mes</p>
            <p className={'mid-num ' + (monthProfit >= 0 ? 'pos' : 'neg')}>{mxn(monthProfit)}</p>
          </div>
        </div>
        <div className="quick">
          <Link className="btn" href="/ventas#nueva">+ Venta</Link>
          <Link className="btn-soft" href="/pedidos#nuevo">+ Pedido</Link>
          <Link className="btn-soft" href="/finanzas#gasto">+ Gasto</Link>
        </div>
      </section>

      <section className="kpis">
        <div className="kpi">
          <p className="label">Inventario</p>
          <p className="num">{invUnits} pzas</p>
          <p className="sub">Costo {mxn(invValue)}</p>
        </div>
        <div className="kpi">
          <p className="label">Si lo vendes todo</p>
          <p className="num">{mxn(potential)}</p>
          <p className="sub">a tus precios de venta</p>
        </div>
        <div className="kpi">
          <p className="label">Has invertido</p>
          <p className="num">{mxn(invested)}</p>
          <p className="sub">compras − reembolsos + gastos</p>
        </div>
        <div className="kpi">
          <p className="label">Has vendido</p>
          <p className="num">{mxn(recovered)}</p>
          <p className="sub">ganancia bruta {mxn(allSales - allCogs)}</p>
        </div>
      </section>

      {cortes.open.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Cortes activos</h2>
            <Link href="/pedidos" className="link">Ver pedidos</Link>
          </div>
          <ul className="list">
            {cortes.open.map((c) => (
              <li key={c.id} className="row wrap">
                <div>
                  <p className="title">{corteTitle(c)}</p>
                  <p className="muted small">{c.supplier} · {fecha(c.date)} · lleva {dias(c.days)}</p>
                </div>
                <CorteProgress c={c} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(noPrice.length > 0 || low.length > 0 || transit.length > 0 || pending.length > 0 || oversold.length > 0) && (
        <section className="card">
          <h2>Pendientes</h2>
          <ul className="alerts">
            {noPrice.length > 0 && (
              <li>
                <Link href="/inventario">
                  <strong>{noPrice.length} {noPrice.length === 1 ? 'producto' : 'productos'} sin precio de venta.</strong> Ponles precio para calcular tu margen.
                </Link>
              </li>
            )}
            {low.map((p) => (
              <li key={p.id}>
                <Link href="/inventario">
                  <strong>{p.name}</strong>: {p.stock <= 0 ? 'agotado' : `quedan ${p.stock}`}
                </Link>
              </li>
            ))}
            {oversold.map((p) => (
              <li key={'o' + p.id}>
                <Link href="/pedidos">
                  <strong>{p.name}: salieron {p.unmatched} {p.unmatched === 1 ? 'pieza' : 'piezas'} más de las que tenías.</strong> Su costo es estimado hasta que recibas el siguiente pedido.
                </Link>
              </li>
            ))}
            {transit.length > 0 && (
              <li>
                <Link href="/pedidos"><strong>{transit.length} {transit.length === 1 ? 'pedido' : 'pedidos'} en camino.</strong> Márcalos como recibidos al llegar.</Link>
              </li>
            )}
            {pending.length > 0 && (
              <li>
                <Link href="/ventas"><strong>Te deben {mxn(pendingTotal)}</strong> de {pending.length} ventas sin cobrar.</Link>
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Últimas ventas</h2>
          <Link href="/ventas" className="link">Ver todas</Link>
        </div>
        {sales.length === 0 ? (
          <p className="muted">Aún no registras ventas. <Link className="link" href="/ventas#nueva">Registra la primera</Link>.</p>
        ) : (
          <ul className="list">
            {sales.map((s) => (
              <li key={s.id} className="row">
                <div>
                  <p className="title">{s.customer || 'Cliente'} </p>
                  <p className="muted small">{fecha(s.date)} · {s.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</p>
                </div>
                <div className="right">
                  <p className="title">{mxn(s.total)}</p>
                  <p className={'small ' + (s.profit >= 0 ? 'pos' : 'neg')}>+{mxn(s.profit)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
