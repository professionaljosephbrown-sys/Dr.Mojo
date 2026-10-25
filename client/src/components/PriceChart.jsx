import { useState } from 'react';
import { formatFull } from '../format.js';

const W = 320, H = 140, PAD = { t: 10, r: 8, b: 22, l: 8 };

export default function PriceChart({ history, label = '3-year price trend' }) {
  const [hover, setHover] = useState(null);
  const values = history.map((p) => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const x = (i) => PAD.l + (i / (history.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - min) / (max - min || 1)) * (H - PAD.t - PAD.b);
  const line = history.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const area = `${line} L${x(history.length - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`;
  const rising = values.at(-1) >= values[0];
  const color = rising ? '#3fa037' : '#d0021b';

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((rel - PAD.l) / (W - PAD.l - PAD.r)) * (history.length - 1));
    setHover(Math.max(0, Math.min(history.length - 1, i)));
  };

  const p = hover != null ? history[hover] : null;

  return (
    <div className="chart">
      <div className="chart-label">
        {p ? <><strong>{formatFull(p.value)}</strong> <span className="muted">{p.date}</span></> : <span className="muted">{label}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#area)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" />
        <text x={PAD.l} y={H - 6} className="axis">{history[0].date}</text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" className="axis">{history.at(-1).date}</text>
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
