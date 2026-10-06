import Link from 'next/link';
import { getProducts, getSales, getMonthly, getTotals, getPurchases, getGoal, getRetiro } from '@/lib/data';
import { mxn, fecha, thisMonth, mes, mesDe, mesesEntre, INICIO, today, pct, diaEntrega } from '@/lib/format';
import { plural, dias } from '@/components/Corte';
import StackBar from '@/components/StackBar';

const daysSince = (date) =>
  Math.max(0, Math.round((Date.parse(today() + 'T00:00:00Z') - Date.parse(date + 'T00:00:00Z')) / 86400000));
const hace = (date) => {
  const d = daysSince(date);
  return d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${dias(d)}`;
};
const width = (n) => `${(Math.min(Math.max(n, 0), 1) * 100).toFixed(1)}%`;
const sumBy = (list, f) => list.reduce((a, x) => a + f(x), 0);
const decimal = (n) => n.toLocaleString('es-MX', { maximumFractionDigits: 1 });

export default async function Inicio() {
  const [products, salesList, monthly, totals, purchases, goal, retiro] = await Promise.all([
    getProducts(), getSales({ limit: 100000 }), getMonthly(), getTotals(), getPurchases(), getGoal(), getRetiro(),
  ]);
  // Solo las entregadas cuentan como venta; las por entregar van aparte en Pendientes.
  const allSales = salesList.filter((s) => s.delivered);
  const toDeliver = salesList.filter((s) => !s.delivered).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const month = thisMonth();
  const m = monthly.find((r) => r.month === month) ?? { revenue: 0, cogs: 0, expenses: 0, units: 0, inventory_spend: 0 };
  const monthProfit = m.revenue - m.cogs - m.expenses;
  const monthSales = allSales.filter((s) => mesDe(s.date) === month);

  // Meta y punto de equilibrio del mes (igual que en Finanzas, con el retiro al fondo euros).
  const fundTotal = retiro * mesesEntre(INICIO, month);
  const breakEven = m.expenses + m.inventory_spend + (month >= INICIO ? retiro : 0);
  const shortfall = Math.max(breakEven - m.revenue, 0);

  // Ventas recientes
  const todayStr = today();
  const weekStart = new Date(todayStr + 'T00:00:00Z');
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const since = weekStart.toISOString().slice(0, 10);
  const salesToday = allSales.filter((s) => s.date === todayStr);
  const salesWeek = allSales.filter((s) => s.date >= since);
  const piecesOf = (s) => sumBy(s.items, (i) => i.qty);

  // Tu negocio
  const allRevenue = sumBy(monthly, (r) => r.revenue);
  const invValue = sumBy(products, (p) => p.stock_value);
  const invUnits = sumBy(products, (p) => Math.max(p.stock, 0));
  const priced = products.filter((p) => p.stock > 0 && p.sale_price > 0);
  const potential = sumBy(priced, (p) => p.stock * p.sale_price);
  const potentialProfit = potential - sumBy(priced, (p) => p.stock_value);
  const invested = totals.inventory_spend + totals.expenses + fundTotal;

  // Lo más vendido del mes
  const byProduct = new Map();
  for (const s of monthSales) {
    for (const i of s.items) {
      const r = byProduct.get(i.name) ?? { name: i.name, units: 0, revenue: 0 };
      r.units += i.qty;
      r.revenue += i.qty * i.unit_price;
      byProduct.set(i.name, r);
    }
  }
  const stockByName = Object.fromEntries(products.map((p) => [p.name, p.stock]));
  const top = [...byProduct.values()].sort((a, b) => b.units - a.units).slice(0, 5);

  // Pendientes
  const pending = allSales.filter((s) => s.status === 'pendiente');
  const transit = purchases.filter((p) => p.status === 'en_camino');
  const oversold = products.filter((p) => p.unmatched > 0);
  const low = products.filter((p) => p.stock <= p.min_stock && p.received > 0 && !p.unmatched);
  const noPrice = products.filter((p) => !p.sale_price && p.stock > 0);
  const todoCount = toDeliver.length + pending.length + transit.length + oversold.length + low.length + noPrice.length;

  const recent = allSales.slice(0, 8);

  return (
    <div className="stack-lg">
      <section className="hero">
        <p className="eyebrow">{mes(month)}</p>
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
        <div className="hero-meters">
          <Link href="/finanzas" className="hero-meter">
            <span className="hm-head"><span>Meta del mes</span><strong>{goal ? pct(m.revenue / goal) : '—'}</strong></span>
            <span className="hm-track"><span className={m.revenue >= goal && goal ? 'done' : ''} style={{ width: width(goal ? m.revenue / goal : 0) }} /></span>
            <span className="hm-sub">{goal ? (m.revenue >= goal ? '✓ Meta cumplida' : `faltan ${mxn(goal - m.revenue)}`) : 'Ponte una meta'}</span>
          </Link>
          <Link href="/finanzas" className="hero-meter">
            <span className="hm-head"><span>Equilibrio</span><strong>{breakEven ? pct(m.revenue / breakEven) : '—'}</strong></span>
            <span className="hm-track"><span className={breakEven && !shortfall ? 'done' : ''} style={{ width: width(breakEven ? m.revenue / breakEven : 1) }} /></span>
            <span className="hm-sub">{!breakEven ? 'nada que recuperar' : shortfall ? `faltan ${mxn(shortfall)}` : '✓ ya lo pasaste'}</span>
          </Link>
        </div>
        <div className="quick">
          <Link className="btn" href="/ventas#nueva">+ Venta</Link>
          <Link className="btn-soft" href="/pedidos#nuevo">+ Pedido</Link>
          <Link className="btn-soft" href="/finanzas#gasto">+ Gasto</Link>
        </div>
      </section>

      <div className="stack">
        <p className="section-label">Ventas</p>
        <section className="kpis">
          <div className="kpi">
            <p className="label">Hoy</p>
            <p className="num">{mxn(sumBy(salesToday, (s) => s.total))}</p>
            <p className="sub">{salesToday.length ? `${plural(salesToday.length, 'venta')} · ${sumBy(salesToday, piecesOf)} pzas` : 'sin ventas todavía'}</p>
          </div>
          <div className="kpi">
            <p className="label">Últimos 7 días</p>
            <p className="num">{mxn(sumBy(salesWeek, (s) => s.total))}</p>
            <p className="sub">{plural(salesWeek.length, 'venta')} · {sumBy(salesWeek, piecesOf)} pzas</p>
          </div>
          <div className="kpi">
            <p className="label">Ticket promedio</p>
            <p className="num">{mxn(monthSales.length ? m.revenue / monthSales.length : 0)}</p>
            <p className="sub">{monthSales.length ? `${decimal(m.units / monthSales.length)} pzas por venta este mes` : 'sin ventas este mes'}</p>
          </div>
          <div className="kpi">
            <p className="label">Margen del mes</p>
            <p className="num">{m.revenue ? pct((m.revenue - m.cogs) / m.revenue) : '—'}</p>
            <p className="sub">ganancia bruta {mxn(m.revenue - m.cogs)}</p>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Pendientes</h2>
          {todoCount > 0 && <span className="count-pill">{todoCount}</span>}
        </div>
        {todoCount === 0 ? (
          <p className="muted">✓ Todo al día: nada por entregar ni por cobrar, sin pedidos en camino y con existencias.</p>
        ) : (
          <div className="todo">
            {toDeliver.length > 0 && (
              <div className="todo-group">
                <p className="todo-title">
                  <span>Por entregar <strong>{mxn(sumBy(toDeliver, (s) => s.total))}</strong></span>
                  <Link href="/ventas" className="link small">Entregar</Link>
                </p>
                <ul>
                  {toDeliver.map((s) => (
                    <li key={s.id}>
                      <span>
                        {s.customer || 'Cliente'} <span className="muted">· {s.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</span>
                      </span>
                      <span className={'nowrap ' + (s.date < todayStr ? 'neg' : s.date === todayStr ? 'warn' : 'muted')}>
                        {s.date < todayStr ? `atrasada (${diaEntrega(s.date)})` : diaEntrega(s.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pending.length > 0 && (
              <div className="todo-group">
                <p className="todo-title">
                  <span>Te deben <strong>{mxn(sumBy(pending, (s) => s.total))}</strong></span>
                  <Link href="/ventas" className="link small">Cobrar</Link>
                </p>
                <ul>
                  {pending.map((s) => (
                    <li key={s.id}>
                      <span>{s.customer || 'Cliente'} <span className="muted">· {hace(s.date)}</span></span>
                      <strong>{mxn(s.total)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {transit.length > 0 && (
              <div className="todo-group">
                <p className="todo-title">
                  <span>{plural(transit.length, 'pedido')} en camino</span>
                  <Link href="/pedidos" className="link small">Marcar recibido</Link>
                </p>
                <ul>
                  {transit.map((p) => (
                    <li key={p.id}>
                      <span>{p.supplier} <span className="muted">· {p.items.map((i) => `${i.units} ${i.name}`).join(', ')}</span></span>
                      <span className="muted nowrap">{hace(p.date)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(oversold.length > 0 || low.length > 0) && (
              <div className="todo-group">
                <p className="todo-title">
                  <span>Se están acabando</span>
                  <Link href="/inventario" className="link small">Inventario</Link>
                </p>
                <ul>
                  {oversold.map((p) => (
                    <li key={p.id}>
                      <span>{p.name}</span>
                      <span className="neg nowrap">faltan {p.unmatched}</span>
                    </li>
                  ))}
                  {low.map((p) => (
                    <li key={p.id}>
                      <span>{p.name}</span>
                      <span className={(p.stock <= 0 ? 'neg' : 'warn') + ' nowrap'}>{p.stock <= 0 ? 'agotado' : `quedan ${p.stock}`}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {noPrice.length > 0 && (
              <div className="todo-group">
                <p className="todo-title">
                  <span>Sin precio de venta</span>
                  <Link href="/inventario" className="link small">Poner precio</Link>
                </p>
                <ul>
                  {noPrice.map((p) => (
                    <li key={p.id}>
                      <span>{p.name}</span>
                      <span className="muted nowrap">{p.stock} pzas</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="stack">
        <p className="section-label">Tu negocio</p>
        <section className="kpis">
          <div className="kpi">
            <p className="label">Inventario</p>
            <p className="num">{invUnits} pzas</p>
            <p className="sub">costo {mxn(invValue)}</p>
          </div>
          <div className="kpi">
            <p className="label">Si lo vendes todo</p>
            <p className="num">{mxn(potential)}</p>
            <p className="sub">ganancia {mxn(potentialProfit)}</p>
          </div>
          <div className="kpi">
            <p className="label">Has invertido</p>
            <p className="num">{mxn(invested)}</p>
            <p className="sub">{fundTotal > 0 ? 'compras + gastos + fondo euros' : 'compras + gastos'}</p>
          </div>
          <div className="kpi">
            <p className="label">Has vendido</p>
            <p className="num">{mxn(allRevenue)}</p>
            <p className="sub">{invested ? `recuperaste ${pct(allRevenue / invested)}` : 'desde el inicio'}</p>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Lo más vendido del mes</h2>
          <Link href="/finanzas" className="link">Finanzas</Link>
        </div>
        {top.length === 0 ? (
          <p className="muted">Todavía no hay ventas este mes.</p>
        ) : (
          <ul className="bars">
            {top.map((r) => (
              <li key={r.name}>
                <div className="bar-head">
                  <span className="title">{r.name}</span>
                  <strong>{plural(r.units, 'pieza')}</strong>
                </div>
                <StackBar size="sm" pieces segments={[{ label: 'Vendidas', value: r.units, tone: 'in' }]} scale={top[0].units} />
                <p className="muted small">
                  {mxn(r.revenue)} · {stockByName[r.name] == null ? 'archivado' : stockByName[r.name] > 0 ? `quedan ${stockByName[r.name]}` : 'agotado'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Últimas ventas</h2>
          <Link href="/ventas" className="link">Ver todas</Link>
        </div>
        {recent.length === 0 ? (
          <p className="muted">Aún no registras ventas. <Link className="link" href="/ventas#nueva">Registra la primera</Link>.</p>
        ) : (
          <ul className="list">
            {recent.map((s) => (
              <li key={s.id} className="row">
                <div>
                  <p className="title">
                    {s.customer || 'Cliente'}
                    {s.status === 'pendiente' && <span className="tag warn">Por cobrar</span>}
                  </p>
                  <p className="muted small">
                    {[fecha(s.date), s.items.map((i) => `${i.qty}× ${i.name}`).join(', '), s.channel].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="right">
                  <p className="title">{mxn(s.total)}</p>
                  <p className={'small ' + (s.profit >= 0 ? 'pos' : 'neg')}>{s.profit >= 0 ? '+' : ''}{mxn(s.profit)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
