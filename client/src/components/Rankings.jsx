import { formatValue, formatFull } from '../format.js';
import DealBadge from './DealBadge.jsx';

function ListingCard({ s, rank, metric, priceLabel, selected, onSelect }) {
  const m = s.metrics;
  return (
    <li className={`listing ${selected ? 'selected' : ''}`} onClick={() => onSelect(s.code)}>
      <div className="listing-thumb">
        <span>{s.code}</span>
        <em>#{rank}</em>
      </div>
      <div className="listing-body">
        {m.overvaluation != null && <DealBadge overvaluation={m.overvaluation} size="sm" />}
        <h4>{s.name}</h4>
        <div className="listing-price">{formatFull(m.homeValue)}{priceLabel && priceLabel !== 'Home Value' && <small> {priceLabel.toLowerCase()}</small>}</div>
        <div className="listing-meta">
          {metric.key !== 'homeValue' && <span>{metric.label}: <b>{formatValue(m[metric.key], metric.format)}</b></span>}
          {m.daysOnMarket != null && <span>{m.daysOnMarket} days on market</span>}
        </div>
      </div>
    </li>
  );
}

export default function Rankings({ states, metric, priceLabel, selected, onSelect }) {
  const sorted = states.filter((s) => s.metrics[metric.key] != null).sort((a, b) => b.metrics[metric.key] - a.metrics[metric.key]);
  const top = sorted.slice(0, 6);
  const bottom = sorted.slice(-6).reverse();
  return (
    <div className="card rankings">
      <div className="rank-head">
        <h2>Top markets by {metric.label}</h2>
        <span className="muted">{states.length} markets analyzed</span>
      </div>
      <div className="rank-grid">
        <div>
          <h4 className="rank-sub">Highest</h4>
          <ul className="listings">
            {top.map((s, i) => (
              <ListingCard key={s.code} s={s} rank={i + 1} metric={metric} priceLabel={priceLabel} selected={selected === s.code} onSelect={onSelect} />
            ))}
          </ul>
        </div>
        <div>
          <h4 className="rank-sub">Lowest</h4>
          <ul className="listings">
            {bottom.map((s, i) => (
              <ListingCard key={s.code} s={s} rank={sorted.length - i} metric={metric} priceLabel={priceLabel} selected={selected === s.code} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
