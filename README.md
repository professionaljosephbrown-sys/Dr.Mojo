# Dr. Mojo — find the best housing deals in America

React (Vite) frontend + Node/Express API. Explore US housing market metrics on a
color-coded state map, see rankings, and drill into any state.

> Real data comes from Zillow, Realtor.com and the US Census (see below). If no data
> snapshot has been downloaded yet, the site falls back to clearly labeled demo data.

## Features
- CarGurus-style design: white header, navy search banner, filter sidebar, listing cards
- Deal ratings for every market (Great Deal → Overpriced) plus a "Dr. Mojo Fair Value" estimate and gauge
- State search with autocomplete
- Tile-grid US map colored by the selected metric (hover for tooltip, click to select)
- 11 metrics: home value, YoY growth, 12‑mo forecast, overvaluation, inventory growth,
  days on market, price cuts, buyer/seller score, price-to-income, rent, population growth
- State panel: 3-year price chart, forecast, comparison to US average, buy-vs-rent
- Top/bottom 10 rankings for any metric
- Responsive layout

## Run it
```bash
npm run install:all   # installs root, server and client deps
npm run dev           # API on :4000, React on http://localhost:5173
```

Production:
```bash
npm run build && npm start   # serves app + API on http://localhost:4000
```

Static, no server needed (all data embedded in one HTML file you can host anywhere,
e.g. GitHub Pages or Netlify):
```bash
npm run build:static         # writes client/dist-static/index.html
```

## Real data

```bash
cd server && npm run fetch-data   # writes server/data/snapshot.json, then restart the server
```

| Source | Used for |
|---|---|
| [Zillow Home Value Index](https://www.zillow.com/research/data/) (state, monthly) | Home value, YoY growth, 3-year chart, Overvalued % / deal ratings |
| Zillow Home Value Forecast (state) | 12-month forecast (optional; skipped if the file isn't published at state level) |
| [Realtor.com Residential Data](https://www.realtor.com/research/data/) (state, monthly) | Inventory growth, days on market, price cuts; list prices as a fallback when Zillow is missing |
| [Census ACS 1-year](https://www.census.gov/programs-surveys/acs) | Household income, median rent, population growth |

Derived metrics:
- **Overvalued %** = today's Zillow value vs. a log-linear trend fitted to that state's 2000–2019 values.
  This drives the deal ratings (Great Deal < 0%, Good < 8%, Fair < 16%, High Price < 25%, else Overpriced).
- **Buyer / Seller score** (0–100) combines price growth, inventory growth, days on market and price cuts.
- **Price-to-income** = home value ÷ median household income. **Mortgage** assumes 10% down, 30 years,
  `MORTGAGE_RATE` env var (default 6.25%).

Every source is optional. If one can't be downloaded, its metrics are hidden instead of guessed,
and the footer lists it as unavailable. Optional `CENSUS_API_KEY` raises Census rate limits.
Re-run `npm run fetch-data` monthly to refresh.

## API
| Endpoint | Description |
|---|---|
| `GET /api/metrics` | Metric definitions |
| `GET /api/states` | All states with current metrics |
| `GET /api/states/:code` | One state incl. 36-month price history |
| `GET /api/rankings?metric=yoy&order=desc&limit=10` | Ranked states |
| `GET /api/national` | US averages |
| `GET /api/meta` | Data sources, freshness, which sources loaded |

## Structure
```
server/   index.js (Express routes), data.js (builds metrics from the snapshot),
          scripts/fetch-data.js (downloads sources), metrics.js, states-list.js,
          sample-data.js (demo fallback), data/snapshot.json (downloaded data)
client/   src/App.jsx, src/components/*, src/format.js (formatting + color scales)
```
