import { useMemo, useState } from 'react';
import { colorScale, formatValue, textOn } from '../format.js';

const SIZE = 56;
const GAP = 5;

export default function TileMap({ states, metric, selected, onSelect }) {
  const [hover, setHover] = useState(null);
  const scale = useMemo(
    () => colorScale(metric, states.map((s) => s.metrics[metric.key])),
    [metric, states]
  );
  const cols = Math.max(...states.map((s) => s.grid.col)) + 1;
  const rows = Math.max(...states.map((s) => s.grid.row)) + 1;
  const w = cols * (SIZE + GAP);
  const h = rows * (SIZE + GAP);

  return (
    <div className="tilemap-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="tilemap" role="img" aria-label={`US map of ${metric.label}`}>
        {states.map((s) => {
          const v = s.metrics[metric.key];
          const missing = v == null;
          const fill = missing ? 'rgb(229, 232, 236)' : scale(v);
          const x = s.grid.col * (SIZE + GAP);
          const y = s.grid.row * (SIZE + GAP);
          const isSel = selected === s.code;
          return (
            <g
              key={s.code}
              transform={`translate(${x},${y})`}
              className={`tile ${isSel ? 'selected' : ''}`}
              onClick={() => onSelect(s.code)}
              onMouseEnter={() => setHover({ s, x, y })}
              onMouseLeave={() => setHover(null)}
            >
              <rect width={SIZE} height={SIZE} rx={8} fill={fill} />
              <text x={SIZE / 2} y={24} textAnchor="middle" className="tile-code" fill={textOn(fill)}>
                {s.code}
              </text>
              <text x={SIZE / 2} y={41} textAnchor="middle" className="tile-val" fill={textOn(fill)}>
                {missing ? 'n/a' : formatValue(v, metric.format)}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && (
        <div
          className="tooltip"
          style={{
            left: `${((hover.x + SIZE / 2) / w) * 100}%`,
            top: `${(hover.y / h) * 100}%`,
          }}
        >
          <strong>{hover.s.name}</strong>
          <span>{metric.label}: {formatValue(hover.s.metrics[metric.key], metric.format)}</span>
        </div>
      )}
    </div>
  );
}
