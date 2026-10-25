import { STATES } from './states-list.js';
import { METRICS } from './metrics.js';

// DEMO data generator — used only when server/data/snapshot.json is missing.
// Run `npm run fetch-data` to download real data instead.
// Base values are rough approximations; derived metrics are generated
// deterministically (seeded) so the numbers stay stable between restarts.
// This is demo data — not real market data.



// Small seeded PRNG (mulberry32) so data is stable.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedFrom = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

// Regions where demo data leans "cooling" (lots of new supply) vs "tight".
const COOLING = new Set(['FL', 'TX', 'AZ', 'CO', 'ID', 'UT', 'NV', 'TN', 'LA', 'HI', 'OR', 'WA', 'CA']);
const TIGHT = new Set(['NJ', 'CT', 'NY', 'RI', 'MA', 'NH', 'IL', 'OH', 'WI', 'PA', 'MI', 'ME', 'VT', 'IA']);

function buildState([code, name, col, row, valueK, incomeK]) {
  const r = rng(seedFrom(code));
  const bias = COOLING.has(code) ? -1 : TIGHT.has(code) ? 1 : 0;

  const homeValue = valueK * 1000;
  const income = incomeK * 1000;
  const priceToIncome = homeValue / income;

  // Year-over-year change and 12‑month forecast (%)
  const yoy = round(1.2 + bias * 2.6 + (r() - 0.5) * 3);
  const forecast = round(yoy * 0.5 + bias * 0.8 + (r() - 0.5) * 1.5);

  // Overvaluation vs. long-term trend (%) — higher price/income => more overvalued
  const overvaluation = round((priceToIncome - 3.9) * 9 + (r() - 0.3) * 8);

  // Inventory change YoY (%), days on market, share of listings with price cuts
  const inventoryYoY = round(10 - bias * 14 + (r() - 0.5) * 12);
  const daysOnMarket = Math.round(45 - bias * 12 + (r() - 0.5) * 14);
  const priceCutShare = round(24 - bias * 7 + (r() - 0.5) * 8);

  const medianRent = Math.round((homeValue * (0.0048 + r() * 0.0012)) / 10) * 10;
  const mortgagePayment = Math.round(monthlyPayment(homeValue * 0.9, 0.0625, 30));
  const popGrowth = round(0.4 - bias * 0.5 + (r() - 0.5) * 0.8);

  // Buyer/seller market score: 0 = strong buyer's market, 100 = strong seller's market
  const marketScore = Math.max(0, Math.min(100, Math.round(
    50 + 0.6 * (yoy * 4 - inventoryYoY * 0.8 - (daysOnMarket - 45) * 0.6 - (priceCutShare - 22) * 1.2 + 8)
  )));

  // 36 months of price history ending at today's value
  const history = [];
  const monthly = yoy / 100 / 12;
  let v = homeValue / Math.pow(1 + monthly, 35) * (1 - (r() * 0.04));
  const now = new Date();
  for (let i = 35; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const season = Math.sin(((d.getMonth() - 2) / 12) * Math.PI * 2) * 0.006;
    history.push({ date: d.toISOString().slice(0, 7), value: Math.round(v * (1 + season)) });
    v *= 1 + monthly + (r() - 0.5) * 0.003;
  }
  history[history.length - 1].value = homeValue;

  return {
    code, name, grid: { col, row },
    metrics: {
      homeValue, yoy, forecast, overvaluation, inventoryYoY, daysOnMarket,
      priceCutShare, medianRent, mortgagePayment, income, priceToIncome: round(priceToIncome, 2),
      popGrowth, marketScore,
    },
    history,
  };
}

function monthlyPayment(principal, annualRate, years) {
  const i = annualRate / 12;
  const n = years * 12;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}



export const sampleStates = STATES.map(buildState);
export const sampleMetrics = METRICS;
