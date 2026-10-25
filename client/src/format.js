const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function formatValue(value, format) {
  if (value == null || Number.isNaN(value)) return '—';
  switch (format) {
    case 'currency':
      if (value >= 1e6) return `$${(value / 1e6).toFixed(value >= 1e7 ? 1 : 2)}M`;
      return value >= 100000 ? `$${Math.round(value / 1000)}K` : usd.format(value);
    case 'percent':
      return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
    case 'days':
      return `${Math.round(value)} days`;
    case 'ratio':
      return `${value.toFixed(1)}x`;
    case 'score':
      return `${Math.round(value)}`;
    case 'number':
      return Math.round(value).toLocaleString('en-US');
    default:
      return String(value);
  }
}

export const formatFull = (v) => (v == null ? '—' : usd.format(v));

export function formatMonth(yyyyMm) {
  if (!yyyyMm) return '';
  if (/^\d{4}$/.test(yyyyMm)) return yyyyMm;
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

// Color stops: red (bad for buyers / declining) -> neutral -> green
const RED = [208, 2, 27];
const MID = [242, 244, 247];
const GREEN = [0, 132, 61];
const BLUE_LOW = [230, 240, 252];
const BLUE_HIGH = [0, 74, 173];

const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

// Builds a color function for a metric given all values on the map.
export function colorScale(metric, values) {
  values = values.filter((v) => v != null);
  const sorted = [...values].sort((a, b) => a - b);
  // Clip to the 5th–95th percentile so outliers don't wash everything out.
  const lo = sorted[Math.floor(sorted.length * 0.05)];
  const hi = sorted[Math.ceil(sorted.length * 0.95) - 1];

  if (metric.scale === 'diverging') {
    const center = metric.center ?? 0;
    const span = Math.max(Math.abs(hi - center), Math.abs(lo - center)) || 1;
    return (v) => {
      let t = Math.max(-1, Math.min(1, (v - center) / span));
      if (metric.invert) t = -t;
      return rgb(t >= 0 ? mix(MID, GREEN, t) : mix(MID, RED, -t));
    };
  }
  return (v) => {
    const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)));
    return rgb(mix(BLUE_LOW, BLUE_HIGH, t));
  };
}

export function legendStops(metric, values) {
  values = values.filter((v) => v != null);
  const scale = colorScale(metric, values);
  const sorted = [...values].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.05)];
  const hi = sorted[Math.ceil(sorted.length * 0.95) - 1];
  let min = lo, max = hi;
  if (metric.scale === 'diverging') {
    const c = metric.center ?? 0;
    const span = Math.max(Math.abs(hi - c), Math.abs(lo - c));
    min = c - span; max = c + span;
  }
  const steps = 7;
  return {
    min, max,
    colors: Array.from({ length: steps }, (_, i) => scale(min + ((max - min) * i) / (steps - 1))),
  };
}

// Text color that stays readable on a given fill
export function textOn(fill) {
  const [r, g, b] = fill.match(/\d+/g).map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1c2430' : '#ffffff';
}

// Deal rating (CarGurus-style) based on how overvalued a market is.
export const DEALS = [
  { max: 0, label: 'Great Deal', cls: 'great', color: '#00703c' },
  { max: 8, label: 'Good Deal', cls: 'good', color: '#3fa037' },
  { max: 16, label: 'Fair Deal', cls: 'fair', color: '#2b7bb9' },
  { max: 25, label: 'High Price', cls: 'high', color: '#e58a00' },
  { max: Infinity, label: 'Overpriced', cls: 'over', color: '#d0021b' },
];
export const dealRating = (overvaluation) => DEALS.find((d) => overvaluation < d.max);

// History comes either as [{ date, value }] or compact { start: 'YYYY-MM', values: [...] }.
export function toPoints(history) {
  if (!history) return [];
  if (Array.isArray(history)) return history;
  const [y, m] = history.start.split('-').map(Number);
  const out = [];
  history.values.forEach((value, i) => {
    if (value == null) return;
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    out.push({ date: d.toISOString().slice(0, 7), value });
  });
  return out;
}
