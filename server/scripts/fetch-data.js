#!/usr/bin/env node
// Downloads real housing data and writes server/data/snapshot.json.
//
//   npm run fetch-data            (from the server folder)
//
// Sources (all free, no login needed):
//   • Zillow Home Value Index (ZHVI), state level, monthly   → home values, growth, price history, overvaluation
//   • Zillow Home Value Forecast (ZHVF), state level         → 12-month forecast (optional)
//   • Realtor.com Residential Data, state level, monthly     → listings, days on market, price cuts, list prices
//   • US Census ACS 1-year estimates                         → household income, rent, population
//   • County + ZIP code data for the drill-down view (see areas.js)
//
// Flags: --states-only (skip counties/ZIPs, much faster), --areas-only (keep current state data)
//
// Each source is optional: if one can't be downloaded the script records why
// and keeps going, and the site hides the metrics that depend on it.
// Optional env vars: CENSUS_API_KEY (raises Census rate limits), MORTGAGE_RATE (default 6.25).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATES } from '../states-list.js';
import { buildAreas } from './areas.js';

const OUT = process.env.SNAPSHOT_OUT ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/snapshot.json');

const URLS = {
  zhvi: 'https://files.zillowstatic.com/research/public_csvs/zhvi/State_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  zhvf: 'https://files.zillowstatic.com/research/public_csvs/zhvf_growth/State_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  rdc: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_State.csv',
  rdcHistory: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_State_History.csv',
  census: (year) =>
    `https://api.census.gov/data/${year}/acs/acs1?get=NAME,B19013_001E,B25064_001E,B01003_001E&for=state:*` +
    (process.env.CENSUS_API_KEY ? `&key=${process.env.CENSUS_API_KEY}` : ''),
};

const byName = new Map(STATES.map(([code, name]) => [name.toLowerCase(), code]));
const codes = new Set(STATES.map(([code]) => code));
// Keep full monthly history (Zillow: since 2000, Realtor.com: since mid-2016)
const HISTORY_MONTHS = Infinity;

// ---------- helpers ----------
async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'dr-mojo-data-fetch/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// Minimal CSV parser (handles quoted fields and commas inside quotes).
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const num = (v) => (v === undefined || v === '' || v === null || Number.isNaN(Number(v)) ? null : Number(v));
const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
const yyyymm = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}`;

// Fit log(value) = a + b·t on a date range, return the trend value at index `atIndex`.
function logTrendAt(points, atIndex) {
  const n = points.length;
  if (n < 24) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const { t, v } of points) { const y = Math.log(v); sx += t; sy += y; sxx += t * t; sxy += t * y; }
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const a = (sy - b * sx) / n;
  return Math.exp(a + b * atIndex);
}

// ---------- sources ----------
async function zillowHomeValues() {
  const rows = parseCSV(await download(URLS.zhvi));
  const dateCols = Object.keys(rows[0]).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  const out = {};
  for (const r of rows) {
    const code = byName.get(String(r.RegionName).toLowerCase());
    if (!code) continue;
    const series = dateCols.map((d) => ({ date: d.slice(0, 7), value: num(r[d]) })).filter((p) => p.value);
    if (series.length < 13) continue;
    const latest = series.at(-1);
    const yearAgo = series.at(-13);
    // Long-term trend: fit Jan 2000 – Dec 2019 (pre-pandemic) and extrapolate to today.
    const fit = series
      .map((p, t) => ({ ...p, t }))
      .filter((p) => p.date >= '2000-01' && p.date <= '2019-12')
      .map(({ t, value }) => ({ t, v: value }));
    const trend = logTrendAt(fit, series.length - 1);
    out[code] = {
      homeValue: Math.round(latest.value),
      yoy: round((latest.value / yearAgo.value - 1) * 100),
      overvaluation: trend ? round((latest.value / trend - 1) * 100) : null,
      history: series.slice(-HISTORY_MONTHS).map((p) => ({ date: p.date, value: Math.round(p.value) })),
    };
  }
  return { asOf: dateCols.at(-1).slice(0, 7), data: out };
}

async function zillowForecast() {
  const rows = parseCSV(await download(URLS.zhvf));
  const cols = Object.keys(rows[0]).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  const twelveMonth = cols.at(-1); // last forecast column is the 12-month horizon
  const out = {};
  for (const r of rows) {
    const code = byName.get(String(r.RegionName).toLowerCase());
    if (code && num(r[twelveMonth]) != null) out[code] = { forecast: round(num(r[twelveMonth])) };
  }
  if (!Object.keys(out).length) throw new Error('No state rows found in forecast file');
  return { asOf: rows[0]?.BaseDate?.slice(0, 7) ?? null, data: out };
}

async function realtorCurrent() {
  const rows = parseCSV(await download(URLS.rdc));
  const out = {};
  let asOf = null;
  for (const r of rows) {
    const code = String(r.state_id || '').toUpperCase();
    if (!codes.has(code)) continue;
    asOf = yyyymm(r.month_date_yyyymm);
    out[code] = {
      listPrice: num(r.median_listing_price),
      listPriceYoY: round(num(r.median_listing_price_yy) * 100),
      inventoryYoY: round(num(r.active_listing_count_yy) * 100),
      activeListings: num(r.active_listing_count),
      daysOnMarket: num(r.median_days_on_market),
      priceCutShare: round(num(r.price_reduced_share) * 100),
    };
  }
  return { asOf, data: out };
}

async function realtorHistory() {
  const rows = parseCSV(await download(URLS.rdcHistory));
  const out = {};
  for (const r of rows) {
    const code = String(r.state_id || '').toUpperCase();
    const v = num(r.median_listing_price);
    if (!codes.has(code) || !v || !/^\d{6}$/.test(r.month_date_yyyymm)) continue;
    (out[code] ||= []).push({ date: yyyymm(r.month_date_yyyymm), value: Math.round(v) });
  }
  for (const code of Object.keys(out)) {
    out[code] = { listHistory: out[code].sort((a, b) => a.date.localeCompare(b.date)).slice(-HISTORY_MONTHS) };
  }
  return { asOf: null, data: out };
}

// Finds the newest ACS 1-year release, plus the year before for population growth.
async function census() {
  const thisYear = new Date().getFullYear();
  let latest = null;
  let lastError;
  for (let y = thisYear - 1; y >= thisYear - 5 && !latest; y--) {
    try { latest = { year: y, rows: JSON.parse(await download(URLS.census(y))) }; }
    catch (e) { lastError = e; }
  }
  if (!latest) throw lastError;

  let prev = null;
  for (let y = latest.year - 1; y >= latest.year - 2 && !prev; y--) {
    try { prev = { year: y, rows: JSON.parse(await download(URLS.census(y))) }; } catch { /* try older */ }
  }

  const toMap = ({ rows }) => {
    const [header, ...body] = rows;
    return new Map(body.map((r) => [byName.get(r[0].toLowerCase()), Object.fromEntries(header.map((h, i) => [h, r[i]]))]));
  };
  const cur = toMap(latest);
  const old = prev ? toMap(prev) : new Map();
  const yearsApart = prev ? latest.year - prev.year : 1;

  const out = {};
  for (const [code, r] of cur) {
    if (!code) continue;
    const pop = num(r.B01003_001E);
    const oldPop = num(old.get(code)?.B01003_001E);
    out[code] = {
      income: num(r.B19013_001E),
      medianRent: num(r.B25064_001E),
      population: pop,
      popGrowth: pop && oldPop ? round((Math.pow(pop / oldPop, 1 / yearsApart) - 1) * 100, 2) : null,
    };
  }
  return { asOf: String(latest.year), data: out };
}

// ---------- main ----------
const SOURCES = [
  { id: 'zillowZhvi', name: 'Zillow Home Value Index', url: 'https://www.zillow.com/research/data/', run: zillowHomeValues },
  { id: 'zillowZhvf', name: 'Zillow Home Value Forecast', url: 'https://www.zillow.com/research/data/', run: zillowForecast },
  { id: 'realtor', name: 'Realtor.com Residential Data', url: 'https://www.realtor.com/research/data/', run: realtorCurrent },
  { id: 'realtorHistory', name: 'Realtor.com price history', url: 'https://www.realtor.com/research/data/', run: realtorHistory },
  { id: 'census', name: 'US Census ACS 1-year', url: 'https://www.census.gov/programs-surveys/acs', run: census },
];

const args = new Set(process.argv.slice(2));
const AREAS_DIR = path.join(path.dirname(OUT), 'areas');

if (args.has('--areas-only')) {
  const snap = JSON.parse(await fs.readFile(OUT, 'utf8'));
  snap.areaSources = await buildAreas({ outDir: AREAS_DIR });
  snap.areasGeneratedAt = new Date().toISOString();
  await fs.writeFile(OUT, JSON.stringify(snap, null, 1));
  console.log(`\nUpdated ${path.relative(process.cwd(), OUT)}`);
  process.exit(0);
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  mortgageRate: Number(process.env.MORTGAGE_RATE) || 6.25,
  sources: {},
  states: Object.fromEntries(STATES.map(([code]) => [code, {}])),
};

for (const src of SOURCES) {
  process.stdout.write(`• ${src.name} … `);
  try {
    const { asOf, data } = await src.run();
    const count = Object.keys(data).length;
    for (const [code, values] of Object.entries(data)) Object.assign(snapshot.states[code], values);
    snapshot.sources[src.id] = { name: src.name, url: src.url, ok: true, asOf, states: count };
    console.log(`ok (${count} states${asOf ? `, as of ${asOf}` : ''})`);
  } catch (e) {
    const reason = e.cause?.message || e.message;
    snapshot.sources[src.id] = { name: src.name, url: src.url, ok: false, error: reason };
    console.log(`FAILED — ${reason}`);
  }
}

if (!Object.values(snapshot.sources).some((s) => s.ok)) {
  console.error('\nNo sources could be downloaded; snapshot not written.');
  process.exit(1);
}
if (args.has('--states-only')) {
  // Keep the existing county/ZIP files' source info
  try {
    const old = JSON.parse(await fs.readFile(OUT, 'utf8'));
    if (old.areaSources) { snapshot.areaSources = old.areaSources; snapshot.areasGeneratedAt = old.areasGeneratedAt; }
  } catch { /* no previous snapshot */ }
} else {
  console.log('\nCounties and ZIP codes:');
  snapshot.areaSources = await buildAreas({ outDir: AREAS_DIR });
  snapshot.areasGeneratedAt = new Date().toISOString();
}

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(snapshot, null, 1));
console.log(`\nWrote ${path.relative(process.cwd(), OUT)}`);
