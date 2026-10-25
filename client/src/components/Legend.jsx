import { legendStops, formatValue } from '../format.js';

export default function Legend({ metric, states }) {
  const { min, max, colors } = legendStops(metric, states.map((s) => s.metrics[metric.key]));
  return (
    <div className="legend">
      <div className="legend-bar" style={{ background: `linear-gradient(90deg, ${colors.join(',')})` }} />
      <div className="legend-labels">
        <span>{formatValue(min, metric.format)}</span>
        <span>{formatValue(max, metric.format)}</span>
      </div>
    </div>
  );
}
