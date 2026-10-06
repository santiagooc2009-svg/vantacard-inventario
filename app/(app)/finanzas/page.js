import Link from 'next/link';
import { getMonthly, getExpenses, getProducts, getCortes, getSales, getGoal, getRetiro } from '@/lib/data';
import { createExpense, deleteExpense, setGoal, setRetiro } from '@/app/actions';
import Submit from '@/components/Submit';
import ConfirmButton from '@/components/ConfirmButton';
import StackBar from '@/components/StackBar';
import { Gauge, Legend, Delta } from '@/components/Viz';
import { corteTitle, dias, plural } from '@/components/Corte';
import { mxn, mes, mesCorto, mesAnterior, mesDe, mesesEntre, INICIO, fecha, today, thisMonth, pct } from '@/lib/format';

export const metadata = { title: 'Finanzas · Vantacard' };

const CATEGORIES = ['Envíos a clientes', 'Empaque', 'Publicidad', 'Diseño / impresión', 'Herramientas', 'Comisiones', 'Otros'];

const ZERO = { revenue: 0, cogs: 0, expenses: 0, spend: 0, units: 0 };
const addMonth = (a, r) => ({
  revenue: a.revenue + r.revenue, cogs: a.cogs + r.cogs, expenses: a.expenses + r.expenses,
  spend: a.spend + r.inventory_spend, units: a.units + r.units,
});
const decimal = (n) => n.toLocaleString('es-MX', { maximumFractionDigits: 1 });
const sumBy = (list, f) => list.reduce((a, x) => a + f(x), 0);

export default async function Finanzas({ searchParams }) {
  const { mes: mesParam } = await searchParams;
  const [monthly, expenses, products, cortes, sales, goal, retiro] = await Promise.all([
    getMonthly(), getExpenses(), getProducts({ includeInactive: true }), getCortes(), getSales({ limit: 100000 }), getGoal(), getRetiro(),
  ]);

  // Periodo: un mes (por defecto el actual) o todo. Todo lo de abajo se filtra con él.
  const current = thisMonth();
  const months = [...new Set([current, ...monthly.map((r) => r.month)])].sort().reverse();
  const period = mesParam === 'todo' ? null : months.includes(mesParam) ? mesParam : current;
  const inPeriod = (date) => !period || mesDe(date) === period;
  const isCurrent = period === current;

  // Fondo euros: cada mes desde INICIO se retira lo que vale Claude. No es gasto del negocio,
  // pero sale del dinero del negocio: cuenta en el flujo y en el punto de equilibrio.
  const fundMonthsTotal = mesesEntre(INICIO, current);
  const fundTotal = retiro * fundMonthsTotal;
  const fund = period ? (period >= INICIO && period <= current ? retiro : 0) : fundTotal;

  const t = monthly.filter((r) => inPeriod(r.month)).reduce(addMonth, ZERO);
  const all = monthly.reduce(addMonth, ZERO);
  const gross = t.revenue - t.cogs;
  const profit = gross - t.expenses;
  const margin = t.revenue > 0 ? gross / t.revenue : null;

  const prevKey = period && mesAnterior(period);
  const prevRow = prevKey ? monthly.find((r) => r.month === prevKey) : null;
  const prev = prevRow ? addMonth(ZERO, prevRow) : null;
  const prevName = prevKey ? mesCorto(prevKey).split(' ')[0] : '';

  const pSales = sales.filter((s) => inPeriod(s.date));
  const pending = pSales.filter((s) => s.status === 'pendiente');

  // Punto de equilibrio: lo que necesitas vender para recuperar tus gastos y lo que invertiste
  // en mercancía en el periodo. Las piezas que faltan se calculan a tu precio promedio por pieza.
  const breakEven = t.expenses + t.spend + fund;
  const pricePerPiece = t.units > 0 ? t.revenue / t.units : all.units > 0 ? all.revenue / all.units : 0;
  const shortfall = Math.max(breakEven - t.revenue, 0);
  const piecesNeeded = shortfall > 0 && pricePerPiece > 0 ? Math.ceil(shortfall / pricePerPiece) : 0;

  // Ritmo del mes actual
  const [py, pm] = (period ?? current).split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const dayNow = Number(today().slice(8, 10));
  const daysLeft = daysInMonth - dayNow + 1;
  const projection = isCurrent ? (t.revenue / dayNow) * daysInMonth : null;

  // Inventario de hoy
  const stocked = products.filter((p) => p.stock > 0);
  const invUnits = sumBy(stocked, (p) => p.stock);
  const invCost = sumBy(stocked, (p) => p.stock_value);
  const priced = stocked.filter((p) => p.sale_price > 0);
  const invPotential = sumBy(priced, (p) => p.stock * p.sale_price);
  const potentialProfit = invPotential - sumBy(priced, (p) => p.stock_value);
  const cutoff = new Date(today() + 'T00:00:00Z');
  cutoff.setUTCDate(cutoff.getUTCDate() - 29);
  const since = cutoff.toISOString().slice(0, 10);
  const sold30 = sumBy(sales.filter((s) => s.date >= since), (s) => sumBy(s.items, (i) => i.qty));
  const coverDays = sold30 > 0 ? Math.round(invUnits / (sold30 / 30)) : null;
  const openShort = sumBy(cortes.open, (c) => Math.max(c.cost - c.revenue, 0));

  // Productos, canales y gastos del periodo
  const byProduct = new Map();
  for (const s of pSales) {
    for (const i of s.items) {
      const r = byProduct.get(i.name) ?? { name: i.name, units: 0, revenue: 0, cost: 0 };
      r.units += i.qty;
      r.revenue += i.qty * i.unit_price;
      r.cost += i.qty * i.unit_cost;
      byProduct.set(i.name, r);
    }
  }
  const topProducts = [...byProduct.values()].map((r) => ({ ...r, profit: r.revenue - r.cost })).sort((a, b) => b.profit - a.profit);

  const byChannel = new Map();
  for (const s of pSales) {
    const k = s.channel || 'Sin canal';
    const r = byChannel.get(k) ?? { name: k, total: 0, count: 0 };
    r.total += s.total;
    r.count += 1;
    byChannel.set(k, r);
  }
  const channels = [...byChannel.values()].sort((a, b) => b.total - a.total);
  const channelTotal = sumBy(channels, (c) => c.total);

  const pExpenses = expenses.filter((e) => inPeriod(e.date));
  const byCategory = new Map();
  for (const e of pExpenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  const categories = [...byCategory.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);

  const closed = cortes.closed.filter((c) => inPeriod(c.endedOn));
  const ct = closed.reduce(
    (a, c) => ({ cost: a.cost + c.cost, revenue: a.revenue + c.revenue, days: a.days + c.days, sold: a.sold + c.sold, lost: a.lost + c.lost }),
    { cost: 0, revenue: 0, days: 0, sold: 0, lost: 0 }
  );

  const monthMax = Math.max(...monthly.map((r) => Math.max(r.revenue, r.cogs + r.expenses)), 0);
  const flowOut = t.spend + t.expenses + fund;
  const flowMax = Math.max(t.revenue, flowOut);
  const flowNet = t.revenue - flowOut;
  const breakdown = [
    { label: 'Costo de lo vendido', value: t.cogs, tone: 'cost' },
    { label: 'Gastos', value: t.expenses, tone: 'exp' },
  ];

  return (
    <div className="stack-lg">
      <div className="page-head">
        <h1>Finanzas</h1>
      </div>

      <nav className="chips" aria-label="Periodo">
        {months.map((m) => (
          <Link key={m} href={`/finanzas?mes=${m}`} scroll={false} className={'chip' + (period === m ? ' on' : '')}>
            {m === current ? 'Este mes' : mesCorto(m)}
          </Link>
        ))}
        <Link href="/finanzas?mes=todo" scroll={false} className={'chip' + (!period ? ' on' : '')}>Todo</Link>
      </nav>

      <section className="hero">
        <p className="eyebrow">{period ? mes(period) : 'Todo el tiempo'}</p>
        <div>
          <p className="label">Utilidad {period ? 'del mes' : 'total'}</p>
          <p className={'hero-num ' + (profit >= 0 ? 'pos' : 'neg')}>{mxn(profit)}</p>
          <div className="hero-meta">
            <span>Ventas {mxn(t.revenue)}{t.revenue > 0 ? ` · margen neto ${pct(profit / t.revenue)}` : ''}</span>
            {prev && <Delta now={profit} before={prev.revenue - prev.cogs - prev.expenses} vs={prevName} money />}
          </div>
        </div>
        {t.revenue > 0 || t.expenses > 0 ? (
          <>
            <p className="label">{profit >= 0 ? '¿A dónde se fue lo que vendiste?' : 'Tus costos y gastos superaron lo que vendiste'}</p>
            {profit >= 0 ? (
              <StackBar size="lg" segments={[...breakdown, { label: 'Utilidad', value: profit, tone: 'profit' }]} />
            ) : (
              <StackBar size="lg" segments={breakdown} marker={t.revenue > 0 ? t.revenue : undefined} />
            )}
            <Legend
              total={t.revenue}
              items={profit >= 0 ? [...breakdown, { label: 'Utilidad', value: profit, tone: 'profit' }] : [...breakdown, ...(t.revenue > 0 ? [{ label: 'Lo que vendiste (rayita)', value: t.revenue, tone: 'marker' }] : [])]}
            />
          </>
        ) : (
          <p className="hero-meta">Sin ventas ni gastos en este periodo.</p>
        )}
      </section>

      <section className="kpis">
        <div className="kpi">
          <p className="label">Ventas</p>
          <p className="num">{mxn(t.revenue)}</p>
          <p className="sub">{plural(pSales.length, 'venta')} · {t.units} pzas</p>
          {prev && <Delta now={t.revenue} before={prev.revenue} vs={prevName} />}
        </div>
        <div className="kpi">
          <p className="label">Ticket promedio</p>
          <p className="num">{mxn(pSales.length ? t.revenue / pSales.length : 0)}</p>
          <p className="sub">{pSales.length ? `${decimal(t.units / pSales.length)} piezas por venta` : 'sin ventas'}</p>
        </div>
        <div className="kpi">
          <p className="label">Margen bruto</p>
          <p className="num">{margin == null ? '—' : pct(margin)}</p>
          <p className="sub">ganancia bruta {mxn(gross)}</p>
        </div>
        <div className="kpi">
          <p className="label">Por cobrar</p>
          <p className={'num' + (pending.length ? ' warn' : '')}>{mxn(sumBy(pending, (s) => s.total))}</p>
          <p className="sub">{pending.length ? `${plural(pending.length, 'venta')} sin cobrar` : 'todo cobrado'}</p>
        </div>
      </section>

      <section className="card">
        <h2>Metas y equilibrio</h2>
        <p className="card-sub">{period ? 'Cómo vas este mes contra lo que gastaste e invertiste, y contra tu meta.' : 'Cómo vas contra todo lo que has gastado e invertido desde el inicio.'}</p>
        <div className="gauges">
          <div className="gauge-card">
            <p className="title">Punto de equilibrio</p>
            {breakEven === 0 ? (
              <p className="muted small">No hay gastos ni compras de mercancía {period ? 'este mes' : 'todavía'}: no tienes nada que recuperar.</p>
            ) : (
              <>
                <Gauge
                  value={t.revenue} max={breakEven * 2} mark={breakEven} markLabel="equilibrio"
                  label={`Ventas ${mxn(t.revenue)} de ${mxn(breakEven)} para el equilibrio`}
                />
                <p className="gauge-value">{pct(t.revenue / breakEven)}</p>
                <p className="gauge-caption">del equilibrio ({mxn(breakEven)} en ventas)</p>
                {shortfall === 0 ? (
                  <p className="gauge-text"><strong className="pos">✓ Ya recuperaste tus gastos y tu inversión.</strong> Vas {mxn(t.revenue - breakEven)} arriba del equilibrio.</p>
                ) : (
                  <p className="gauge-text">
                    Te faltan <strong>{mxn(shortfall)}</strong> en ventas{piecesNeeded > 0 ? ` (unas ${plural(piecesNeeded, 'pieza')} a tu precio promedio)` : ''} para recuperar lo que gastaste e invertiste.
                  </p>
                )}
                <p className="hint">Equilibrio = gastos {mxn(t.expenses)} + compras de mercancía {mxn(t.spend)}{fund > 0 ? ` + fondo euros ${mxn(fund)}` : ''}.</p>
              </>
            )}
          </div>

          {period ? (
            <div className="gauge-card">
              <p className="title">Meta de ventas del mes</p>
              {goal ? (
                <>
                  <Gauge value={t.revenue} max={goal} label={`Ventas ${mxn(t.revenue)} de una meta de ${mxn(goal)}`} />
                  <p className="gauge-value">{pct(t.revenue / goal)}</p>
                  <p className="gauge-caption">{mxn(t.revenue)} de {mxn(goal)}</p>
                  {t.revenue >= goal ? (
                    <p className="gauge-text"><strong className="pos">✓ Meta cumplida.</strong>{t.revenue > goal ? ` Vas ${mxn(t.revenue - goal)} arriba.` : ''}</p>
                  ) : isCurrent ? (
                    <p className="gauge-text">
                      Te faltan <strong>{mxn(goal - t.revenue)}</strong>: unos {mxn((goal - t.revenue) / daysLeft)} por día en {daysLeft === 1 ? 'el día que queda' : `los ${daysLeft} días que quedan`}.
                    </p>
                  ) : (
                    <p className="gauge-text">Cerraste el mes a {mxn(goal - t.revenue)} de tu meta.</p>
                  )}
                  {isCurrent && t.revenue > 0 && (
                    <p className="hint">A este ritmo cierras el mes en {mxn(projection)} ({pct(projection / goal)} de la meta).</p>
                  )}
                  <details>
                    <summary className="link small">Cambiar meta</summary>
                    <GoalForm goal={goal} />
                  </details>
                </>
              ) : (
                <>
                  <p className="muted small">Ponte una meta de ventas al mes y aquí verás cuánto llevas, cuánto te falta por día y en cuánto vas a cerrar.</p>
                  <GoalForm />
                </>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="card">
        <h2>Flujo de dinero</h2>
        <p className="card-sub">Lo que entró por ventas contra lo que salió en mercancía, gastos y el fondo euros {period ? 'este mes' : 'desde el inicio'}.</p>
        <ul className="legend inline">
          <li><i className="sw tone-in" />Ventas</li>
          <li><i className="sw tone-cost" />Compras de mercancía</li>
          {fund > 0 && <li><i className="sw tone-fund" />Fondo euros</li>}
          <li><i className="sw tone-exp" />Gastos</li>
        </ul>
        <ul className="bars">
          <li>
            <div className="bar-head"><span>Entró</span><strong>{mxn(t.revenue)}</strong></div>
            <StackBar segments={[{ label: 'Ventas', value: t.revenue, tone: 'in' }]} scale={flowMax} />
          </li>
          <li>
            <div className="bar-head"><span>Salió</span><strong>{mxn(flowOut)}</strong></div>
            <StackBar
              segments={[
                { label: 'Compras de mercancía', value: t.spend, tone: 'cost' },
                { label: 'Fondo euros', value: fund, tone: 'fund' },
                { label: 'Gastos', value: t.expenses, tone: 'exp' },
              ]}
              scale={flowMax}
            />
          </li>
        </ul>
        <div className="flow-net">
          <span className="muted">Neto</span>
          <strong className={flowNet >= 0 ? 'pos' : 'neg'}>{flowNet > 0 ? '+' : ''}{mxn(flowNet)}</strong>
        </div>
        <p className="hint">Aquí cuenta toda la mercancía que compraste, aunque siga en inventario. La utilidad solo cuenta el costo de lo que ya vendiste.</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Fondo euros</h2>
          <strong className="fund-total">{mxn(fundTotal)}</strong>
        </div>
        <p className="card-sub">
          Lo que cuesta Claude se retira cada mes desde {mes(INICIO).toLowerCase()} para comprar euros. No es gasto del negocio: no baja tu utilidad, pero sí cuenta en el flujo y en el punto de equilibrio.
        </p>
        <div className="stats">
          <div className="stat">
            <p className="label">Retiro al mes</p>
            <p className="num">{retiro > 0 ? mxn(retiro) : '—'}</p>
            <p className="sub">{retiro > 0 ? `desde ${mesCorto(INICIO)}` : 'sin retiro'}</p>
          </div>
          <div className="stat">
            <p className="label">Juntado</p>
            <p className="num">{mxn(fundTotal)}</p>
            <p className="sub">{fundMonthsTotal === 1 ? '1 mes' : `${fundMonthsTotal} meses`}</p>
          </div>
        </div>
        <details className="top-gap">
          <summary className="link small">Cambiar el retiro mensual</summary>
          <form action={setRetiro} className="goal-form">
            <input name="retiro" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={retiro || ''} placeholder="Ej. 400" aria-label="Retiro mensual al fondo euros" />
            <Submit className="btn small" close>Guardar</Submit>
          </form>
          <p className="hint top-gap">El monto aplica a todos los meses desde {mesCorto(INICIO)}. Pon 0 para dejar de contarlo.</p>
        </details>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Inventario hoy</h2>
          <Link href="/inventario" className="link">Ver</Link>
        </div>
        <div className="stats four">
          <div className="stat">
            <p className="label">Mercancía a costo</p>
            <p className="num">{mxn(invCost)}</p>
            <p className="sub">{invUnits} piezas</p>
          </div>
          <div className="stat">
            <p className="label">Si la vendes a tus precios</p>
            <p className="num">{mxn(invPotential)}</p>
            <p className="sub">ganancia {mxn(potentialProfit)}</p>
          </div>
          <div className="stat">
            <p className="label">Te dura</p>
            <p className="num">{coverDays == null ? '—' : `~${dias(coverDays)}`}</p>
            <p className="sub">{sold30 ? `vendes ${decimal(sold30 / 30)} pzas al día` : 'sin ventas en 30 días'}</p>
          </div>
          <div className="stat">
            <p className="label">Cortes abiertos</p>
            <p className="num">{cortes.open.length}</p>
            <p className="sub">falta recuperar {mxn(openShort)}</p>
          </div>
        </div>
        {stocked.length > priced.length && (
          <p className="hint warn top-gap">
            {plural(stocked.length - priced.length, 'producto')} con piezas sin precio de venta: no cuentan en “si la vendes”.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Por mes</h2>
        <p className="card-sub">Las ventas de cada mes repartidas en costo de lo vendido, gastos y utilidad. Toca un mes para verlo.</p>
        <ul className="legend inline">
          <li><i className="sw tone-cost" />Costo de lo vendido</li>
          <li><i className="sw tone-exp" />Gastos</li>
          <li><i className="sw tone-profit" />Utilidad</li>
        </ul>
        {monthly.length === 0 ? (
          <p className="muted">Sin movimientos todavía.</p>
        ) : (
          <ul className="bars">
            {monthly.map((r) => {
              const p = r.revenue - r.cogs - r.expenses;
              const segs = [
                { label: 'Costo de lo vendido', value: r.cogs, tone: 'cost' },
                { label: 'Gastos', value: r.expenses, tone: 'exp' },
              ];
              return (
                <li key={r.month} className={period && r.month !== period ? 'dim' : ''}>
                  <div className="bar-head">
                    <Link href={`/finanzas?mes=${r.month}`} scroll={false} className="title">{mes(r.month)}</Link>
                    <strong className={p >= 0 ? 'pos' : 'neg'}>{mxn(p)}</strong>
                  </div>
                  <StackBar
                    segments={p >= 0 ? [...segs, { label: 'Utilidad', value: p, tone: 'profit' }] : segs}
                    marker={p < 0 && r.revenue > 0 ? r.revenue : undefined}
                    scale={monthMax}
                  />
                  <p className="muted small">
                    {r.revenue > 0 ? `Ventas ${mxn(r.revenue)} · ${r.units} pzas` : 'Sin ventas'} · compras {mxn(r.inventory_spend)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Qué producto deja más</h2>
        <p className="card-sub">Ganancia de cada producto: lo que vendiste menos lo que te costaron esas piezas.</p>
        {topProducts.length === 0 ? (
          <p className="muted">Sin ventas en este periodo.</p>
        ) : (
          <ul className="bars">
            {topProducts.map((r) => (
              <li key={r.name}>
                <div className="bar-head">
                  <span className="title">{r.name}</span>
                  <strong className={r.profit >= 0 ? 'pos' : 'neg'}>{mxn(r.profit)}</strong>
                </div>
                <StackBar size="sm" segments={[{ label: 'Ganancia', value: r.profit, tone: 'profit' }]} scale={topProducts[0].profit} />
                <p className="muted small">{plural(r.units, 'vendida')} · ventas {mxn(r.revenue)} · margen {pct(r.revenue ? r.profit / r.revenue : 0)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>De dónde vienen tus ventas</h2>
        <p className="card-sub">Ventas por canal, con envío y descuento.</p>
        {channels.length === 0 ? (
          <p className="muted">Sin ventas en este periodo.</p>
        ) : (
          <ul className="bars">
            {channels.map((c) => (
              <li key={c.name}>
                <div className="bar-head">
                  <span className="title">{c.name}</span>
                  <span><strong>{mxn(c.total)}</strong> <span className="muted small">{pct(c.total / channelTotal)}</span></span>
                </div>
                <StackBar size="sm" segments={[{ label: c.name, value: c.total, tone: 'in' }]} scale={channels[0].total} />
                <p className="muted small">{plural(c.count, 'venta')} · ticket {mxn(c.total / c.count)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Cortes cerrados</h2>
        <p className="card-sub">Pedidos que ya se vendieron completos{period ? ' este mes' : ''}: lo que te costaron contra lo que vendiste.</p>
        {closed.length === 0 ? (
          <p className="muted">
            {period ? 'Ningún corte se cerró en este periodo.' : 'Todavía no se acaba ningún pedido.'} Un corte se cierra solo cuando vendes o das de baja todas sus piezas.
          </p>
        ) : (
          <div className="stack">
            <div className="stats four">
              <div className="stat"><p className="label">Cortes</p><p className="num">{closed.length}</p><p className="sub">{plural(ct.sold, 'vendida')}{ct.lost > 0 ? ` · ${plural(ct.lost, 'perdida')}` : ''}</p></div>
              <div className="stat"><p className="label">Ganancia</p><p className={'num ' + (ct.revenue - ct.cost >= 0 ? 'pos' : 'neg')}>{mxn(ct.revenue - ct.cost)}</p><p className="sub">costaron {mxn(ct.cost)}</p></div>
              <div className="stat"><p className="label">Recuperado</p><p className="num">{ct.cost > 0 ? pct(ct.revenue / ct.cost) : '—'}</p><p className="sub">vendiste {mxn(ct.revenue)}</p></div>
              <div className="stat"><p className="label">Se acaban en</p><p className="num">{dias(Math.round(ct.days / closed.length))}</p><p className="sub">en promedio</p></div>
            </div>
            <ul className="legend inline">
              <li><i className="sw tone-cost" />Costo del pedido</li>
              <li><i className="sw tone-profit" />Ganancia</li>
            </ul>
            <ul className="bars">
              {closed.map((c) => (
                <li key={c.id}>
                  <div className="bar-head">
                    <span className="title">{corteTitle(c)}</span>
                    <strong className={c.profit >= 0 ? 'pos' : 'neg'}>{mxn(c.profit)}</strong>
                  </div>
                  <StackBar
                    size="sm"
                    segments={c.profit >= 0
                      ? [{ label: 'Costo del pedido', value: c.cost, tone: 'cost' }, { label: 'Ganancia', value: c.profit, tone: 'profit' }]
                      : [{ label: 'Costo del pedido', value: c.cost, tone: 'cost' }]}
                    marker={c.profit < 0 && c.revenue > 0 ? c.revenue : undefined}
                    scale={Math.max(...closed.map((x) => Math.max(x.revenue, x.cost)))}
                  />
                  <p className="muted small">
                    {[
                      `${fecha(c.date)} → ${fecha(c.endedOn)}`, dias(c.days), plural(c.sold, 'vendida'),
                      c.lost > 0 && plural(c.lost, 'perdida'), c.recovered != null && `${pct(c.recovered)} recuperado`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Gastos{period ? ' del mes' : ''}</h2>
        <p className="card-sub">Todo lo que no es mercancía: envíos que pagas tú, bolsitas, anuncios, etc.</p>
        {pExpenses.length === 0 ? (
          <p className="muted">Sin gastos en este periodo.</p>
        ) : (
          <div className="stack">
            <ul className="bars">
              {categories.map((c) => (
                <li key={c.name}>
                  <div className="bar-head">
                    <span className="title">{c.name}</span>
                    <span><strong>{mxn(c.amount)}</strong> <span className="muted small">{pct(c.amount / t.expenses)}</span></span>
                  </div>
                  <StackBar size="sm" segments={[{ label: c.name, value: c.amount, tone: 'exp' }]} scale={categories[0].amount} />
                </li>
              ))}
            </ul>
            <details>
              <summary className="link small">{pExpenses.length === 1 ? 'Ver el gasto' : `Ver los ${pExpenses.length} gastos`}</summary>
              <ul className="list compact">
                {pExpenses.map((e) => (
                  <li key={e.id} className="row">
                    <div>
                      <p className="title">{e.category}</p>
                      <p className="muted small">{fecha(e.date)}{e.description ? ' · ' + e.description : ''}</p>
                    </div>
                    <div className="right row-actions">
                      <p className="title">{mxn(e.amount)}</p>
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={e.id} />
                        <ConfirmButton message="¿Borrar este gasto?">Borrar</ConfirmButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </section>

      <details className="card" id="gasto" open={expenses.length === 0}>
        <summary><h2>Registrar gasto</h2></summary>
        <form action={createExpense} className="stack">
          <div className="grid-2">
            <label>
              Fecha
              <input type="date" name="date" defaultValue={today()} required />
            </label>
            <label>
              Monto
              <input name="amount" type="number" step="0.01" min="0.01" inputMode="decimal" required placeholder="0.00" />
            </label>
          </div>
          <label>
            Categoría
            <select name="category" defaultValue="Envíos a clientes">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>
            Descripción
            <input name="description" placeholder="Ej. guía Estafeta para cliente de Puebla" />
          </label>
          <Submit>Guardar gasto</Submit>
        </form>
      </details>
    </div>
  );
}

function GoalForm({ goal }) {
  return (
    <form action={setGoal} className="goal-form">
      <input name="goal" type="number" step="1" min="0" inputMode="decimal" defaultValue={goal || ''} placeholder="Ej. 5000" aria-label="Meta de ventas al mes" />
      <Submit className="btn small" close>Guardar meta</Submit>
    </form>
  );
}
