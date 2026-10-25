// Turns the downloaded snapshot (data/snapshot.json, made by `npm run fetch-data`)
// into the states + metrics the API serves.
//
// Rules:
//   • A metric is shown only if its source data was downloaded; nothing is invented.
//   • Home value comes from Zillow when available. If only Realtor.com is available,
//     the "Home Value" slot shows Realtor.com's median LIST price instead, clearly relabeled.
//   • If there is no snapshot at all, the demo generator in sample-data.js is used and
//     the site is labeled "Demo data".

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATES } from './states-list.js';
import { METRICS as BASE_METRICS } from './metrics.js';
import { sampleStates, sampleMetrics } from './sample-data.js';

const SNAPSHOT = process.env.SNAPSHOT_PATH ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'data/snapshot.json');
const round = (n, d = 1) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const has = (...vals) => vals.every((v) => v != null && !Number.isNaN(v));

function monthlyPayment(principal, annualRatePct, years = 30) {
  const i = annualRatePct / 100 / 12;
  const n = years * 12;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

// 0 = strong buyer's market, 100 = strong seller's market.
function marketScore({ yoy, inventoryYoY, daysOnMarket, priceCutShare }) {
  if (!has(yoy, inventoryYoY, daysOnMarket, priceCutShare)) return null;
  const raw = yoy * 4 - inventoryYoY * 0.8 - (daysOnMarket - 50) * 0.6 - (priceCutShare - 18) * 1.2;
  return Math.max(0, Math.min(100, Math.round(50 + 0.6 * raw)));
}

function fromSnapshot(snap) {
  const zillow = snap.sources.zillowZhvi?.ok;
  const rate = snap.mortgageRate;

  const states = STATES.map(([code, name, col, row]) => {
    const r = snap.states[code] || {};
    const homeValue = zillow ? r.homeValue : r.listPrice;
    const yoy = zillow ? r.yoy : r.listPriceYoY;
    const metrics = {
      homeValue,
      yoy,
      forecast: r.forecast,
      overvaluation: r.overvaluation,
      inventoryYoY: r.inventoryYoY,
      daysOnMarket: r.daysOnMarket,
      priceCutShare: r.priceCutShare,
      medianRent: r.medianRent,
      income: r.income,
      popGrowth: r.popGrowth,
      priceToIncome: has(homeValue, r.income) ? round(homeValue / r.income, 2) : null,
      mortgagePayment: has(homeValue) ? Math.round(monthlyPayment(homeValue * 0.9, rate)) : null,
    };
    metrics.marketScore = marketScore(metrics);
    for (const k of Object.keys(metrics)) if (metrics[k] == null) delete metrics[k];
    return {
      code, name, grid: { col, row }, metrics,
      history: (zillow ? r.history : r.listHistory) || [],
    };
  });

  // Keep only metrics that most states actually have.
  const metrics = BASE_METRICS
    .filter((m) => states.filter((s) => has(s.metrics[m.key])).length >= 40)
    .map((m) => {
      if (zillow || !['homeValue', 'yoy', 'priceToIncome'].includes(m.key)) return m;
      // Realtor.com fallback: be explicit that these are list prices.
      const relabel = {
        homeValue: { label: 'Median List Price', source: 'Realtor.com',
          description: 'Median asking price of homes listed for sale (Realtor.com). Shown because Zillow data is unavailable.' },
        yoy: { label: 'List Price Growth (YoY)', source: 'Realtor.com',
          description: 'Change in median list price over the last 12 months (Realtor.com).' },
        priceToIncome: { source: 'Realtor.com + Census',
          description: 'Median list price divided by median household income. Lower is more affordable.' },
      };
      return { ...m, ...relabel[m.key] };
    });

  const sources = Object.values(snap.sources);
  return {
    states,
    metrics,
    meta: {
      isSample: false,
      generatedAt: snap.generatedAt,
      asOf: snap.sources.zillowZhvi?.asOf || snap.sources.realtor?.asOf || null,
      mortgageRate: rate,
      homeValueSource: zillow ? 'zillow' : 'realtor',
      historyLabel: zillow ? '3-year home value trend (Zillow)' : '3-year median list price trend (Realtor.com)',
      sources,
    },
  };
}

function load() {
  if (fs.existsSync(SNAPSHOT)) {
    try {
      return fromSnapshot(JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')));
    } catch (e) {
      console.error(`Could not read ${SNAPSHOT}: ${e.message}. Falling back to demo data.`);
    }
  } else {
    console.warn('No data/snapshot.json found — serving DEMO data. Run `npm run fetch-data` for real data.');
  }
  return {
    states: sampleStates,
    metrics: sampleMetrics,
    meta: {
      isSample: true, generatedAt: null, asOf: null, mortgageRate: 6.25, homeValueSource: 'sample',
      historyLabel: '3-year home value trend (demo data)', sources: [],
    },
  };
}

export const { states, metrics: METRICS, meta } = load();
