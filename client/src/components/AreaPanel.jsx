import { formatValue, formatFull } from '../format.js';
import PriceChart from './PriceChart.jsx';
import DealBadge from './DealBadge.jsx';

function marketLabel(score) {
  if (score >= 65) return "Seller's market";
  if (score <= 35) return "Buyer's market";
  return 'Balanced market';
}

// Details for one county or ZIP code.
export default function AreaPanel({ area, kind, stateName, county, areas, activeMetric, onClose }) {
  const m = area.metrics;
  const isListPrice = areas.metrics.find((d) => d.key === 'homeValue')?.label === 'Median List Price';
  const title = kind === 'zip' ? `ZIP ${area.id}` : area.name.match(/(County|Parish|Borough|Region|Area|city)$/i) ? area.name : `${area.name} County`;
  const subtitle = kind === 'zip'
    ? [area.city, county?.name && `${county.name}${/(County|Parish|Borough|Region|Area)$/i.test(county.name) ? '' : ' County'}`, stateName].filter(Boolean).join(', ')
    : stateName;
  const compare = [
    kind === 'zip' && county && { label: 'County', metrics: county.metrics },
    { label: 'State', metrics: areas.stateMetrics },
  ].filter(Boolean);

  return (
    <aside className="panel card">
      <div className="panel-head">
        <div>
          {m.overvaluation != null && <DealBadge overvaluation={m.overvaluation} size="lg" />}
          <h2>{title}</h2>
          <span className="muted small-text">{subtitle}</span>
        </div>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {area.lowSample && (
        <p className="warn">Only {m.activeListings ?? 'a few'} homes for sale here, so these numbers can jump around month to month.</p>
      )}

      <div className="hero-stat">
        <span className="muted">{isListPrice ? 'Median list price' : 'Typical home value'}</span>
        <strong>{formatFull(m.homeValue)}</strong>
        {m.yoy != null && <span className={m.yoy >= 0 ? 'up' : 'down'}>{formatValue(m.yoy, 'percent')} past year</span>}
        <span className="muted small-text">
          {[m.marketScore != null && marketLabel(m.marketScore), m.activeListings != null && `${m.activeListings.toLocaleString()} homes for sale`, m.daysOnMarket != null && `${m.daysOnMarket} days on market`].filter(Boolean).join(' · ')}
        </span>
      </div>

      <PriceChart history={area.history} label={areas.historyLabel} />

      <table className="stat-table">
        <thead>
          <tr><th>Metric</th><th>{kind === 'zip' ? area.id : 'County'}</th>{compare.map((c) => <th key={c.label}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {areas.metrics.map((def) => (
            <tr key={def.key} className={def.key === activeMetric ? 'active' : ''}>
              <td>{def.label}</td>
              <td>{formatValue(m[def.key], def.format)}</td>
              {compare.map((c) => <td key={c.label} className="muted">{formatValue(c.metrics?.[def.key], def.format)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>

      {m.mortgagePayment != null && (
        <div className="afford">
          <h4>Monthly cost</h4>
          <div className="afford-row"><span>Est. mortgage (10% down, 30 yr)</span><strong>{formatFull(m.mortgagePayment)}/mo</strong></div>
        </div>
      )}
    </aside>
  );
}
