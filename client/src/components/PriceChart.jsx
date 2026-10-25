import { useMemo, useState } from 'react';
import { formatFull, toPoints } from '../format.js';

const W = 340, H = 170, PAD = { t: 12, r: 10, b: 24, l: 44 };
const RANGES = [
  { key: '1Y', months: 12 },
  { key: '3Y', months: 36 },
  { key: '5Y', months: 60 },
  { key: '10Y', months: 120 },
  { key: 'All', months: Infinity },
];

const shortMoney = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`);

export default function PriceChart({ history, label = 'Price history' }) {
  const all = useMemo(() => toPoints(history), [history]);
  // Only offer ranges the data can fill; default to 5 years when available.
  const ranges = RANGES.filter((r) => r.months === Infinity || all.length > r.months * 0.9);
  const [rangeKey, setRangeKey] = useState(all.length > 60 ? '5Y' : 'All');
  const range = ranges.find((r) => r.key === rangeKey) || ranges.at(-1);
  const points = range.months === Infinity ? all : all.slice(-range.months);
  const [hover, setHover] = useState(null);

  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const x = (i) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - min) / (max - min || 1)) * (H - PAD.t - PAD.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`;
  const change = (values.at(-1) / values[0] - 1) * 100;
  const color = change >= 0 ? '#3fa037' : '#d0021b';
  const gridValues = [min, (min + max) / 2, max];

  // Year ticks: at most ~5 labels
  const years = [...new Set(points.map((p) => p.date.slice(0, 4)))];
  const step = Math.ceil(years.length / 5);
  const ticks = years.filter((_, i) => i % step === 0)
    .map((yr) => ({ yr, i: points.findIndex((p) => p.date.startsWith(yr)) }))
    .filter((t) => t.i > 0 || points[0].date.endsWith('-01'));

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((rel - PAD.l) / (W - PAD.l - PAD.r)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const p = hover != null ? points[hover] : null;

  return (
    <div className="chart">
      <div className="chart-top">
        <div className="chart-label">
          {p ? (
            <><strong>{formatFull(p.value)}</strong> <span className="muted">{p.date}</span></>
          ) : (
            <>
              <span className="muted">{label}</span>{' '}
              <span className={change >= 0 ? 'up' : 'down'}>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>
            </>
          )}
        </div>
        <div className="range-tabs" role="group" aria-label="Time range">
          {ranges.map((r) => (
            <button key={r.key} className={r.key === range.key ? 'active' : ''} onClick={() => setRangeKey(r.key)}>
              {r.key}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={label}>
        <defs>
          <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridValues.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className="axis">{shortMoney(v)}</text>
          </g>
        ))}
        <path d={area} fill="url(#chart-area)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" />
        <circle cx={x(points.length - 1)} cy={y(values.at(-1))} r="3.5" fill={color} />
        {ticks.map((t) => (
          <text key={t.yr} x={x(t.i)} y={H - 6} textAnchor="middle" className="axis">{t.yr}</text>
        ))}
        {p && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#9aa5b4" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(p.value)} r="4" fill={color} />
          </>
        )}
      </svg>
    </div>
  );
}
