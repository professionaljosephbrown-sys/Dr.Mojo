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

// Builds the metrics shown in the UI from one area's raw downloaded values.
// `zillow` says whether home values at this level come from Zillow (else Realtor.com list prices).
function deriveMetrics(r, zillow, rate) {
  const homeValue = zillow ? r.homeValue : r.listPrice;
  const yoy = zillow ? r.yoy : r.listPriceYoY;
  const metrics = {
    homeValue,
    yoy,
    forecast: r.forecast,
    overvaluation: r.overvaluation,
    inventoryYoY: r.inventoryYoY,
    activeListings: r.activeListings,
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
  return metrics;
}

// Realtor.com fallback labels: be explicit that these are list prices.
const LIST_PRICE_LABELS = {
  homeValue: { label: 'Median List Price', source: 'Realtor.com',
    description: 'Median asking price of homes listed for sale (Realtor.com). Shown because Zillow data is unavailable.' },
  yoy: { label: 'List Price Growth (YoY)', source: 'Realtor.com',
    description: 'Change in median list price over the last 12 months (Realtor.com).' },
  priceToIncome: { source: 'Realtor.com + Census',
    description: 'Median list price divided by median household income. Lower is more affordable.' },
};

function metricDefs(items, zillow, minCount) {
  return BASE_METRICS
    .filter((m) => items.filter((s) => has(s.metrics[m.key])).length >= minCount)
    .map((m) => (zillow || !LIST_PRICE_LABELS[m.key] ? m : { ...m, ...LIST_PRICE_LABELS[m.key] }));
}

function fromSnapshot(snap) {
  const zillow = snap.sources.zillowZhvi?.ok;
  const rate = snap.mortgageRate;

  const states = STATES.map(([code, name, col, row]) => {
    const r = snap.states[code] || {};
    const metrics = deriveMetrics(r, zillow, rate);
    return {
      code, name, grid: { col, row }, metrics,
      history: (zillow ? r.history : r.listHistory) || [],
    };
  });

  // Keep only metrics that most states actually have.
  const metrics = metricDefs(states, zillow, 40);

  const sources = [...Object.values(snap.sources), ...Object.values(snap.areaSources || {})];
  return {
    states,
    metrics,
    meta: {
      isSample: false,
      generatedAt: snap.generatedAt,
      asOf: snap.sources.zillowZhvi?.asOf || snap.sources.realtor?.asOf || null,
      mortgageRate: rate,
      homeValueSource: zillow ? 'zillow' : 'realtor',
      historyLabel: zillow ? 'Home value history (Zillow)' : 'Median list price history (Realtor.com)',
      hasAreas: Boolean(snap.areaSources),
      sources,
    },
  };
}

let snapshotCache = null;
function readSnapshot() {
  if (!snapshotCache && fs.existsSync(SNAPSHOT)) snapshotCache = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  return snapshotCache;
}

function load() {
  if (fs.existsSync(SNAPSHOT)) {
    try {
      return fromSnapshot(readSnapshot());
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
      historyLabel: '3-year home value trend (demo data)', sources: [], hasAreas: false,
    },
  };
}

export const { states, metrics: METRICS, meta } = load();

// US averages (simple mean across states that have the value)
export const national = Object.fromEntries(METRICS.map((m) => {
  const vals = states.map((s) => s.metrics[m.key]).filter((v) => v != null);
  return [m.key, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null];
}));

// ---------- Counties and ZIP codes (drill-down) ----------
const AREAS_DIR = path.join(path.dirname(SNAPSHOT), 'areas');
const LOW_SAMPLE = 10; // fewer active listings than this → numbers are noisy

// Small lookup used by the search box: ZIP → state/city/county, plus every county.
let searchIndex = null;
export function loadSearchIndex() {
  if (searchIndex) return searchIndex;
  if (!fs.existsSync(AREAS_DIR)) return null;
  const zips = {}, counties = [];
  for (const [code] of STATES) {
    const file = path.join(AREAS_DIR, `${code}.json`);
    if (!fs.existsSync(file)) continue;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const c of raw.counties) counties.push([c.fips, c.name, code]);
    for (const z of raw.zips) zips[z.zip] = [code, z.city || '', z.county || ''];
  }
  searchIndex = { zips, counties };
  return searchIndex;
}

const areaCache = new Map();
export function loadAreas(code) {
  code = String(code).toUpperCase();
  if (areaCache.has(code)) return areaCache.get(code);
  const snap = readSnapshot();
  const file = path.join(AREAS_DIR, `${code}.json`);
  if (!snap || !fs.existsSync(file)) return null;

  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rate = snap.mortgageRate;
  const zCounty = Boolean(snap.areaSources?.zillowCounty?.ok);
  const zZip = Boolean(snap.areaSources?.zillowZip?.ok);
  const lowSample = (r) => r.activeListings != null && r.activeListings < LOW_SAMPLE;

  const counties = raw.counties.map((c) => ({
    id: c.fips, name: c.name,
    metrics: deriveMetrics(c, zCounty, rate),
    lowSample: lowSample(c),
    history: (zCounty ? c.zhviHistory : c.listHistory) || null, // compact { start, values }
  }));
  const zips = raw.zips.map((z) => ({
    id: z.zip, name: z.zip, city: z.city || '', county: z.county, lat: z.lat, lon: z.lon,
    metrics: deriveMetrics(z, zZip, rate),
    lowSample: lowSample(z),
    history: (zZip ? z.zhviHistory : z.listHistory) || null,
  }));
  const zillowAny = zCounty && zZip;
  const result = {
    state: code,
    metrics: metricDefs([...counties, ...zips], zillowAny, 1),
    stateMetrics: deriveMetrics(snap.states[code] || {}, zillowAny, rate),
    historyLabel: zillowAny ? 'Home value history (Zillow)' : 'Median list price history (Realtor.com)',
    lowSampleThreshold: LOW_SAMPLE,
    counties,
    zips,
    shapes: raw.shapes,
  };
  areaCache.set(code, result);
  return result;
}
