import { dealRating } from '../format.js';

const ARROWS = { great: '▲▲', good: '▲', fair: '●', high: '▼', over: '▼▼' };

export default function DealBadge({ overvaluation, size = 'md' }) {
  const d = dealRating(overvaluation);
  return (
    <span className={`deal deal-${d.cls} deal-${size}`}>
      <span className="deal-icon">{ARROWS[d.cls]}</span>
      {d.label}
    </span>
  );
}
