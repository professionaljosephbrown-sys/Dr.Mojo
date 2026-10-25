// Builds county + ZIP code data for every state, used by the drill-down view.
// Called from fetch-data.js. Writes one file per state: server/data/areas/XX.json
//
// Sources:
//   • Realtor.com county + ZIP files (current month and monthly history since 2016)
//   • Zillow county + ZIP home value index (optional; history back to 2000)
//   • County boundaries: US Census 2023, via the @severo_bo/us-atlas-2023 package
//   • ZIP code locations: GeoNames (CC BY 4.0), via the zipcodes-us package
//
// Each ZIP is placed in the county whose boundary contains its location.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import { STATES } from '../states-list.js';

const require = createRequire(import.meta.url);

const RDC = 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core';
const ZILLOW = 'https://files.zillowstatic.com/research/public_csvs/zhvi';
export const AREA_URLS = {
  rdcCounty: `${RDC}/RDC_Inventory_Core_Metrics_County.csv`,
  rdcCountyHistory: `${RDC}/RDC_Inventory_Core_Metrics_County_History.csv`,
  rdcZip: `${RDC}/RDC_Inventory_Core_Metrics_Zip.csv`,
  rdcZipHistory: `${RDC}/RDC_Inventory_Core_Metrics_Zip_History.csv`,
  zillowCounty: `${ZILLOW}/County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
  zillowZip: `${ZILLOW}/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
};

const CODES = new Set(STATES.map(([code]) => code));
const NAME_TO_CODE = new Map(STATES.map(([code, name]) => [name.toLowerCase(), code]));

// ---------- small helpers ----------
const num = (v) => (v === undefined || v === '' || v === null || Number.isNaN(Number(v)) ? null : Number(v));
const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
const yyyymm = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}`;
const pad5 = (v) => String(v).trim().padStart(5, '0');
const titleCase = (s) => s.replace(/\b([a-z])([a-z']*)/g, (_m, a, b) => a.toUpperCase() + b)
  .replace(/\bMc([a-z])/g, (_m, c) => `Mc${c.toUpperCase()}`);

// Parses one CSV line (fields may be quoted and contain commas; no embedded newlines).
function parseLine(line) {
  const out = [];
  let field = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(field); field = ''; }
    else field += c;
  }
  out.push(field);
  return out;
}

// Streams a (possibly very large) CSV from a URL, calling onRow(objectByHeader) per row.
async function streamCSV(url, onRow) {
  const res = await fetch(url, { headers: { 'User-Agent': 'dr-mojo-data-fetch/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const rl = readline.createInterface({ input: Readable.fromWeb(res.body), crlfDelay: Infinity });
  let header = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const cells = parseLine(line);
    if (!header) { header = cells; continue; }
    if (cells.length < 3) continue; // footer notes
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = cells[i];
    onRow(row, header);
  }
}

// Turns [{date, value}] into a compact { start, values } series with null gaps.
function compact(points) {
  if (!points?.length) return null;
  points.sort((a, b) => a.date.localeCompare(b.date));
  const [sy, sm] = points[0].date.split('-').map(Number);
  const idx = (d) => { const [y, m] = d.split('-').map(Number); return (y - sy) * 12 + (m - sm); };
  const values = new Array(idx(points.at(-1).date) + 1).fill(null);
  for (const p of points) values[idx(p.date)] = p.value;
  return { start: points[0].date, values };
}

// Latest Zillow value and YoY change. (Overvaluation is calculated in data.js.)
function zillowStats(series) {
  if (series.length < 13) return null;
  const latest = series.at(-1), yearAgo = series.at(-13);
  return {
    homeValue: Math.round(latest.value),
    yoy: round((latest.value / yearAgo.value - 1) * 100),
  };
}

const realtorMetrics = (r) => ({
  listPrice: num(r.median_listing_price),
  listPriceYoY: round(num(r.median_listing_price_yy) * 100),
  inventoryYoY: round(num(r.active_listing_count_yy) * 100),
  activeListings: num(r.active_listing_count),
  daysOnMarket: num(r.median_days_on_market),
  priceCutShare: round(num(r.price_reduced_share) * 100),
});

// ---------- lookups (local packages, no network) ----------
function loadBoundaries() {
  const topo = require('@severo_bo/us-atlas-2023/counties-10m.json');
  const stateByFips = {};
  for (const g of topo.objects.states.geometries) {
    const code = NAME_TO_CODE.get(String(g.properties.name).toLowerCase());
    if (code) stateByFips[g.id] = code;
  }
  const byState = {};
  for (const f of feature(topo, topo.objects.counties).features) {
    const code = stateByFips[f.id.slice(0, 2)];
    if (!code) continue; // territories
    (byState[code] ||= []).push(f);
  }
  return { byState, stateByFips };
}

function loadZipLocations() {
  // The package doesn't export its data file, so find its folder from the main entry.
  let dir = path.dirname(require.resolve('zipcodes-us'));
  while (!fs.existsSync(path.join(dir, 'package.json'))) dir = path.dirname(dir);
  const file = path.join(dir, 'data', 'US.txt');
  const out = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const c = line.split('\t');
    if (c.length < 11 || !CODES.has(c[4])) continue;
    out.set(c[1], { city: c[2], state: c[4], countyName: c[5], countyCode: c[6], lat: num(c[9]), lon: num(c[10]) });
  }
  return out;
}

// Rounds coordinates to ~100 m to keep files small.
function shrinkGeometry(geom) {
  const r = (x) => Math.round(x * 1000) / 1000;
  const walk = (a) => (typeof a[0] === 'number' ? [r(a[0]), r(a[1])] : a.map(walk));
  return { type: geom.type, coordinates: walk(geom.coordinates) };
}

// ---------- main ----------
export async function buildAreas({ outDir, log = console.log }) {
  const sources = {};
  const record = async (id, name, url, fn) => {
    log(`• ${name} … `);
    try {
      const info = await fn();
      sources[id] = { name, url, ok: true, ...info };
      log(`  ok${info.rows ? ` (${info.rows.toLocaleString()} rows)` : ''}${info.asOf ? `, as of ${info.asOf}` : ''}`);
    } catch (e) {
      sources[id] = { name, url, ok: false, error: e.cause?.message || e.message };
      log(`  FAILED — ${sources[id].error}`);
    }
  };

  const { byState: shapesByState, stateByFips } = loadBoundaries();
  const zipLoc = loadZipLocations();
  sources.boundaries = { name: 'US Census county boundaries (2023)', url: 'https://www.census.gov/geographies/mapping-files.html', ok: true };
  sources.geonames = { name: 'GeoNames ZIP code locations (CC BY 4.0)', url: 'https://www.geonames.org/', ok: true };

  const counties = new Map(); // fips -> record
  const zips = new Map();     // zip  -> record
  const countyRec = (fips) => {
    if (!counties.has(fips)) counties.set(fips, { fips, state: stateByFips[fips.slice(0, 2)] });
    return counties.get(fips);
  };
  const zipRec = (zip) => {
    if (!zips.has(zip)) zips.set(zip, { zip });
    return zips.get(zip);
  };

  // Realtor.com current month
  await record('realtorCounty', 'Realtor.com county data', 'https://www.realtor.com/research/data/', async () => {
    let rows = 0, asOf = null;
    await streamCSV(AREA_URLS.rdcCounty, (r) => {
      const fips = pad5(r.county_fips);
      const c = countyRec(fips);
      if (!c.state) return;
      c.name = titleCase(String(r.county_name || '').split(',')[0]);
      Object.assign(c, realtorMetrics(r));
      asOf = yyyymm(r.month_date_yyyymm); rows++;
    });
    return { rows, asOf };
  });
  await record('realtorZip', 'Realtor.com ZIP code data', 'https://www.realtor.com/research/data/', async () => {
    let rows = 0, asOf = null;
    await streamCSV(AREA_URLS.rdcZip, (r) => {
      const z = zipRec(pad5(r.postal_code));
      const [city, st] = String(r.zip_name || '').split(',').map((s) => s.trim());
      if (city) z.city = titleCase(city);
      if (st) z.stateHint = st.toUpperCase();
      Object.assign(z, realtorMetrics(r));
      asOf = yyyymm(r.month_date_yyyymm); rows++;
    });
    return { rows, asOf };
  });

  // Realtor.com monthly history (the ZIP file is ~800 MB, so it is streamed)
  const pushHistory = (rec, key, date, value) => { if (value) (rec[key] ||= []).push({ date, value: Math.round(value) }); };
  await record('realtorCountyHistory', 'Realtor.com county history', 'https://www.realtor.com/research/data/', async () => {
    let rows = 0;
    await streamCSV(AREA_URLS.rdcCountyHistory, (r) => {
      if (!/^\d{6}$/.test(r.month_date_yyyymm)) return;
      const fips = pad5(r.county_fips);
      if (!counties.has(fips)) return;
      pushHistory(counties.get(fips), 'listHistory', yyyymm(r.month_date_yyyymm), num(r.median_listing_price)); rows++;
    });
    return { rows };
  });
  await record('realtorZipHistory', 'Realtor.com ZIP code history', 'https://www.realtor.com/research/data/', async () => {
    let rows = 0;
    await streamCSV(AREA_URLS.rdcZipHistory, (r) => {
      if (!/^\d{6}$/.test(r.month_date_yyyymm)) return;
      const zip = pad5(r.postal_code);
      if (!zips.has(zip)) return;
      pushHistory(zips.get(zip), 'listHistory', yyyymm(r.month_date_yyyymm), num(r.median_listing_price)); rows++;
    });
    return { rows };
  });

  // Zillow home values (wide files: one row per area, one column per month)
  const zillowWide = (url, keyOf) => async () => {
    let rows = 0, asOf = null;
    await streamCSV(url, (r, header) => {
      const rec = keyOf(r);
      if (!rec) return;
      const series = header.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h))
        .map((h) => ({ date: h.slice(0, 7), value: num(r[h]) })).filter((p) => p.value);
      if (!series.length) return;
      Object.assign(rec, zillowStats(series) || {});
      rec.zhviHistory = series.map((p) => ({ date: p.date, value: Math.round(p.value) }));
      asOf = series.at(-1).date; rows++;
    });
    if (!rows) throw new Error('No matching rows in file');
    return { rows, asOf };
  };
  await record('zillowCounty', 'Zillow county home values', 'https://www.zillow.com/research/data/',
    zillowWide(AREA_URLS.zillowCounty, (r) => {
      const fips = pad5(`${String(r.StateCodeFIPS).padStart(2, '0')}${String(r.MunicipalCodeFIPS).padStart(3, '0')}`);
      return stateByFips[fips.slice(0, 2)] ? countyRec(fips) : null;
    }));
  await record('zillowZip', 'Zillow ZIP code home values', 'https://www.zillow.com/research/data/',
    zillowWide(AREA_URLS.zillowZip, (r) => zipRec(pad5(r.RegionName))));

  // Place each ZIP in a state + county
  for (const z of zips.values()) {
    const loc = zipLoc.get(z.zip);
    z.state = loc?.state || (CODES.has(z.stateHint) ? z.stateHint : null);
    delete z.stateHint;
    if (loc) {
      z.lat = loc.lat; z.lon = loc.lon;
      if (!z.city || z.city.includes('\uFFFD')) z.city = loc.city;
    }
    if (!z.state) continue;
    const shapes = shapesByState[z.state] || [];
    const hit = loc?.lat != null && shapes.find((f) => geoContains(f, [loc.lon, loc.lat]));
    if (hit) z.county = hit.id;
    else if (loc?.countyCode) {
      const stateFips = shapes[0]?.id.slice(0, 2);
      if (stateFips) z.county = `${stateFips}${loc.countyCode.padStart(3, '0')}`;
    }
  }

  // Write one file per state
  fs.mkdirSync(outDir, { recursive: true });
  let totalBytes = 0;
  for (const [code] of STATES) {
    const shapes = shapesByState[code] || [];
    for (const f of shapes) {
      const c = countyRec(f.id);
      // Prefer the Census spelling when Realtor.com's name is missing or garbled (e.g. "Doña Ana")
      if (!c.name || c.name.includes('\uFFFD')) c.name = f.properties.name;
    }
    // Keep current counties only: ones on the 2023 map or in Realtor.com's list.
    // (Zillow still reports some retired counties, e.g. Connecticut's pre-2022 counties.)
    const shapeIds = new Set(shapes.map((f) => f.id));
    const stateCounties = [...counties.values()]
      .filter((c) => c.state === code && (shapeIds.has(c.fips) || c.listPrice != null) && c.name);
    const pack = (rec) => {
      const { listHistory, zhviHistory, state, ...rest } = rec;
      return { ...rest, listHistory: compact(listHistory), zhviHistory: compact(zhviHistory) };
    };
    const file = {
      state: code,
      counties: stateCounties.map(pack).sort((a, b) => a.name.localeCompare(b.name)),
      zips: [...zips.values()].filter((z) => z.state === code && (z.listPrice || z.homeValue)).map(pack),
      shapes: {
        type: 'FeatureCollection',
        features: shapes.map((f) => ({ type: 'Feature', id: f.id, properties: { name: f.properties.name }, geometry: shrinkGeometry(f.geometry) })),
      },
    };
    const json = JSON.stringify(file);
    totalBytes += json.length;
    fs.writeFileSync(path.join(outDir, `${code}.json`), json);
  }
  log(`  Wrote ${STATES.length} state area files (${Math.round(totalBytes / 1024 / 1024)} MB)`);
  return sources;
}
