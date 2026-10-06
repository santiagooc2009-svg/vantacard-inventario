import { mxn, pct, fecha } from '@/lib/format';

export const dias = (n) => (n === 1 ? '1 día' : `${n} días`);
export const corteTitle = (c) => c.items.map((i) => i.name).join(' + ');
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const width = (n) => `${(Math.min(Math.max(n, 0), 1) * 100).toFixed(1)}%`;

// Avance de un corte abierto: piezas que ya salieron y dinero recuperado.
export function CorteProgress({ c }) {
  return (
    <div className="corte">
      <div className="corte-line">
        <span>
          Vendidas <strong>{c.sold} de {c.units}</strong>
          {c.reserved > 0 && <> · <span className="warn">{plural(c.reserved, 'apartada')}</span></>}
          {c.lost > 0 && <> · <span className="neg">{plural(c.lost, 'perdida')}</span></>}
        </span>
        <span className="muted">quedan {c.left}</span>
      </div>
      <div className="bar" aria-hidden="true">
        <span className="bar-sold" style={{ width: width(c.sold / c.units) }} />
        {c.reserved > 0 && <span className="bar-held" style={{ width: width(c.reserved / c.units) }} />}
        <span className="bar-lost" style={{ width: width(c.lost / c.units) }} />
      </div>
      <div className="corte-line">
        <span>Recuperado <strong>{mxn(c.revenue)} de {mxn(c.cost)}</strong></span>
        {c.recovered != null && <span className={c.recovered >= 1 ? 'pos' : 'muted'}>{pct(c.recovered)}</span>}
      </div>
      <div className="bar" aria-hidden="true">
        <span className="bar-money" style={{ width: width(c.recovered ?? 1) }} />
      </div>
    </div>
  );
}

// Resultado de un corte cerrado en una línea.
export function CorteResult({ c }) {
  return (
    <p className="corte small muted">
      Se acabó en {dias(c.days)} · vendiste {mxn(c.revenue)} ·{' '}
      <span className={c.profit >= 0 ? 'pos' : 'neg'}>ganancia {mxn(c.profit)}</span>
    </p>
  );
}

// Todos los números de un corte, para el detalle del pedido.
export function CorteDetails({ c }) {
  const short = c.cost - c.revenue;
  return (
    <dl className="facts">
      <dt>Costo del pedido</dt><dd>{mxn(c.cost)}</dd>
      <dt>Piezas</dt>
      <dd>{plural(c.sold, 'vendida')}{c.reserved > 0 ? ` · ${plural(c.reserved, 'apartada')}` : ''} · {plural(c.lost, 'perdida')} · quedan {c.left}</dd>
      <dt>Vendiste</dt><dd>{mxn(c.revenue)}</dd>
      {!c.closed && short > 0 ? (
        <><dt>Falta por recuperar</dt><dd>{mxn(short)}</dd></>
      ) : (
        <><dt>Ganancia</dt><dd className={c.profit >= 0 ? 'pos' : 'neg'}>{mxn(c.profit)}</dd></>
      )}
      <dt>Recuperado</dt><dd>{c.recovered == null ? '—' : pct(c.recovered)}</dd>
      {c.closed ? (
        <><dt>Se acabó en</dt><dd>{dias(c.days)} ({fecha(c.endedOn)})</dd></>
      ) : (
        <><dt>Lleva</dt><dd>{dias(c.days)}</dd></>
      )}
    </dl>
  );
}
