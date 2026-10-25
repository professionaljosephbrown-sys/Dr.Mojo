import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatValue, formatFull, DEALS, dealRating } from '../format.js';
import DealBadge from './DealBadge.jsx';
import PriceChart from './PriceChart.jsx';

function marketLabel(score) {
  if (score >= 65) return "Seller's market";
  if (score <= 35) return "Buyer's market";
  return 'Balanced market';
}

// Horizontal gauge like a deal-rating scale, with a marker for this market.
function DealGauge({ overvaluation }) {
  const min = -10, max = 40;
  const pos = Math.max(0, Math.min(100, ((overvaluation - min) / (max - min)) * 100));
  const bounds = [min, ...DEALS.slice(0, -1).map((d) => d.max), max];
  return (
    <div className="gauge">
      <div className="gauge-bar">
        {DEALS.map((d, i) => (
          <span key={d.cls} style={{ background: d.color, flex: bounds[i + 1] - bounds[i] }} />
        ))}
        <i className="gauge-marker" style={{ left: `${pos}%` }} />
      </div>
      <div className="gauge-labels"><span>Great Deal</span><span>Overpriced</span></div>
    </div>
  );
}

export default function StatePanel({ code, metrics, national, meta, activeMetric, onClose, onExplore }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!code) return setData(null);
    let live = true;
    api.state(code).then((d) => live && setData(d));
    return () => { live = false; };
  }, [code]);

  if (!code) {
    return (
      <aside className="panel card empty">
        <div className="empty-icon">⌂</div>
        <h3>Pick a market</h3>
        <p className="muted">Search for a state or click one on the map to see its prices, trends, market conditions and affordability.</p>
      </aside>
    );
  }
  if (!data) return <aside className="panel card"><p className="muted">Loading…</p></aside>;

  const m = data.metrics;
  const hasDeal = m.overvaluation != null;
  const deal = hasDeal ? dealRating(m.overvaluation) : null;
  const priceLabel = metrics.find((d) => d.key === 'homeValue')?.label === 'Median List Price' ? 'Median list price' : 'Typical home value';
  const fairValue = Math.round(m.homeValue / (1 + m.overvaluation / 100) / 1000) * 1000;

  return (
    <aside className="panel card">
      <div className="panel-head">
        <div>
          {hasDeal && <DealBadge overvaluation={m.overvaluation} size="lg" />}
          <h2>{data.name}</h2>
          <span className="muted small-text">
            {[m.marketScore != null && marketLabel(m.marketScore), m.daysOnMarket != null && `${m.daysOnMarket} days on market`].filter(Boolean).join(' · ')}
          </span>
        </div>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {onExplore && (
        <button className="btn-primary explore-btn" onClick={onExplore}>
          Explore counties &amp; ZIP codes →
        </button>
      )}

      <div className="hero-stat">
        <span className="muted">{priceLabel}</span>
        <strong>{formatFull(m.homeValue)}</strong>
        {m.yoy != null && <span className={m.yoy >= 0 ? 'up' : 'down'}>{formatValue(m.yoy, 'percent')} past year</span>}
      </div>

      {hasDeal && <div className={`imv imv-${deal.cls}`}>
        <div className="imv-row">
          <span>Dr. Mojo Fair Value</span>
          <strong>{formatFull(fairValue)}</strong>
        </div>
        <p>
          Typical homes here are priced{' '}
          <b>{Math.abs(m.overvaluation).toFixed(1)}% {m.overvaluation >= 0 ? 'above' : 'below'}</b>{' '}
          their 2000–2019 long-term price trend.
        </p>
        <DealGauge overvaluation={m.overvaluation} />
      </div>}

      {data.history.length > 1 && <PriceChart history={data.history} label={meta?.historyLabel} />}

      {m.forecast != null && <div className="forecast">
        <span>12‑month forecast</span>
        <strong className={m.forecast >= 0 ? 'up' : 'down'}>{formatValue(m.forecast, 'percent')}</strong>
      </div>}

      <table className="stat-table">
        <thead>
          <tr><th>Metric</th><th>{data.code}</th><th>US avg</th></tr>
        </thead>
        <tbody>
          {metrics.map((def) => (
            <tr key={def.key} className={def.key === activeMetric ? 'active' : ''}>
              <td>{def.label}</td>
              <td>{formatValue(m[def.key], def.format)}</td>
              <td className="muted">{national ? formatValue(national[def.key], def.format) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="afford">
        <h4>Affordability</h4>
        {m.income != null && <div className="afford-row"><span>Median household income</span><strong>{formatFull(m.income)}</strong></div>}
        {m.mortgagePayment != null && <div className="afford-row"><span>Est. mortgage (10% down, {meta?.mortgageRate ?? 6.25}%)</span><strong>{formatFull(m.mortgagePayment)}/mo</strong></div>}
        {m.medianRent != null && <div className="afford-row"><span>Median rent</span><strong>{formatFull(m.medianRent)}/mo</strong></div>}
        {m.mortgagePayment != null && m.medianRent != null && (
          <div className="afford-row">
            <span>Buy vs. rent</span>
            <strong>{m.mortgagePayment > m.medianRent ? `Renting saves ${formatFull(m.mortgagePayment - m.medianRent)}/mo` : 'Buying is cheaper'}</strong>
          </div>
        )}
      </div>
    </aside>
  );
}
