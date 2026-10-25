import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import MetricPicker from './components/MetricPicker.jsx';
import TileMap from './components/TileMap.jsx';
import Legend from './components/Legend.jsx';
import StatePanel from './components/StatePanel.jsx';
import Rankings from './components/Rankings.jsx';
import SearchBar from './components/SearchBar.jsx';
import DrillDown from './components/DrillDown.jsx';
import AreaPanel from './components/AreaPanel.jsx';
import Breadcrumbs from './components/Breadcrumbs.jsx';
import { DEALS, formatMonth } from './format.js';

export default function App() {
  const [metrics, setMetrics] = useState([]);
  const [states, setStates] = useState([]);
  const [national, setNational] = useState(null);
  const [meta, setMeta] = useState(null);
  const [metricKey, setMetricKey] = useState('homeValue');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  // Drill-down: state → county → ZIP code
  const [drill, setDrill] = useState(false);
  const [county, setCounty] = useState(null);
  const [zip, setZip] = useState(null);
  const [areas, setAreas] = useState(null);
  const [areasError, setAreasError] = useState(null);

  useEffect(() => {
    Promise.all([api.metrics(), api.states(), api.national(), api.meta()])
      .then(([m, s, n, mt]) => {
        setMetrics(m); setStates(s); setNational(n); setMeta(mt);
        if (!m.some((x) => x.key === 'homeValue') && m[0]) setMetricKey(m[0].key);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!drill || !selected) return;
    let live = true;
    setAreas((a) => (a?.state === selected ? a : null));
    setAreasError(null);
    api.areas(selected)
      .then((a) => live && setAreas(a))
      .catch((e) => live && setAreasError(e.message));
    return () => { live = false; };
  }, [drill, selected]);

  const areaReady = drill && areas?.state === selected;
  // In the drill-down, only metrics that exist for counties/ZIPs can be picked.
  const pickerMetrics = areaReady ? areas.metrics : metrics;
  const metric = useMemo(
    () => pickerMetrics.find((m) => m.key === metricKey) || pickerMetrics.find((m) => m.key === 'homeValue') || pickerMetrics[0],
    [pickerMetrics, metricKey]
  );
  const hasDeals = metrics.some((m) => m.key === 'overvaluation');
  const stateName = states.find((s) => s.code === selected)?.name;

  const scrollToDetails = () => {
    if (window.innerWidth < 1200) {
      setTimeout(() => document.getElementById('details')?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };
  const select = (code) => {
    setSelected(code);
    setDrill(false); setCounty(null); setZip(null);
    if (code) scrollToDetails();
  };
  const explore = (code, countyId = null, zipId = null) => {
    setSelected(code); setDrill(true); setCounty(countyId); setZip(zipId);
    document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const selectCounty = (id) => { setCounty(id === county ? null : id); setZip(null); };
  const selectZip = (id) => { setZip(id); scrollToDetails(); };
  const leaveDrill = () => { setDrill(false); setCounty(null); setZip(null); };

  const countyRec = areaReady && county ? areas.counties.find((c) => c.id === county) : null;
  const zipRec = areaReady && zip ? areas.zips.find((z) => z.id === zip) : null;

  if (error) return <div className="center-msg">Couldn't reach the API ({error}). Is the server running on port 4000?</div>;
  if (!metric) return <div className="center-msg">Loading market data…</div>;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/">
            <span className="logo-mark">Dr.</span>
            <span className="logo-text">Mojo</span>
          </a>
          <nav>
            <a href="#map">Market Map</a>
            <a href="#rankings">Top Markets</a>
            <a href="#details">Market Details</a>
          </nav>
          <div className="topbar-actions">
            <span className="tag">{meta?.isSample ? 'Demo data' : `Data through ${formatMonth(meta?.asOf)}`}</span>
            <button className="btn-outline">Sign in</button>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <h1>Find the best housing deals in America</h1>
          <p>
            {hasDeals
              ? 'We analyze home prices, inventory and incomes to rate every market from Great Deal to Overpriced.'
              : 'Compare prices, inventory, days on market and price cuts across every state.'}
          </p>
          <SearchBar states={states} onSelectState={select} onExplore={explore} canDrill={Boolean(meta?.hasAreas)} />
          {hasDeals && <div className="deal-key">
            {DEALS.map((d) => (
              <span key={d.cls} className="deal-key-item">
                <i style={{ background: d.color }} /> {d.label}
              </span>
            ))}
          </div>}
        </div>
      </section>

      <main className="layout">
        <aside className="sidebar card">
          <h3>Filter by metric</h3>
          <MetricPicker metrics={pickerMetrics} value={metric.key} onChange={setMetricKey} />
        </aside>

        <section className="content" id="map">
          {drill ? (
            <>
              <Breadcrumbs
                items={[
                  { label: 'United States', onClick: leaveDrill },
                  { label: stateName, onClick: () => { setCounty(null); setZip(null); } },
                  countyRec && { label: countyRec.name, onClick: () => setZip(null) },
                  zipRec && { label: `ZIP ${zipRec.id}` },
                ].filter(Boolean)}
              />
              {areaReady ? (
                <DrillDown
                  areas={areas}
                  metric={metric}
                  stateName={stateName}
                  selectedCounty={county}
                  selectedZip={zip}
                  onSelectCounty={selectCounty}
                  onSelectZip={selectZip}
                />
              ) : (
                <div className="map-card card center-card">
                  {areasError ? `Couldn't load county data (${areasError}).` : `Loading counties and ZIP codes for ${stateName}…`}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="map-card card">
                <div className="map-head">
                  <div>
                    <h2>{metric.label}</h2>
                    <p className="muted">{metric.description}</p>
                  </div>
                  <Legend metric={metric} states={states} />
                </div>
                <TileMap
                  states={states}
                  metric={metric}
                  selected={selected}
                  onSelect={(code) => select(code === selected ? null : code)}
                />
                <p className="hint">Click a state to see its {hasDeals ? 'deal rating and ' : ''}market details{meta?.hasAreas ? ', then explore its counties and ZIP codes' : ''}.</p>
              </div>

              <div id="rankings">
                <Rankings states={states} metric={metric} priceLabel={metrics.find((m) => m.key === 'homeValue')?.label} selected={selected} onSelect={select} />
              </div>
            </>
          )}
        </section>

        <div id="details" className="details-col">
          {zipRec ? (
            <AreaPanel key={zipRec.id} area={zipRec} kind="zip" stateName={stateName} county={areas.counties.find((c) => c.id === zipRec.county)} areas={areas} activeMetric={metric.key} onClose={() => setZip(null)} />
          ) : countyRec ? (
            <AreaPanel key={countyRec.id} area={countyRec} kind="county" stateName={stateName} areas={areas} activeMetric={metric.key} onClose={() => setCounty(null)} />
          ) : (
            <StatePanel
              code={selected}
              metrics={metrics}
              national={national}
              meta={meta}
              activeMetric={metricKey}
              onClose={() => select(null)}
              onExplore={meta?.hasAreas && !drill ? () => explore(selected) : null}
            />
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span className="brand small"><span className="logo-mark">Dr.</span><span className="logo-text">Mojo</span></span>
          <span className="sources">
            {meta?.isSample ? (
              'All figures are sample data for demonstration. Run npm run fetch-data for real data.'
            ) : (
              <>
                Sources:{' '}
                {meta?.sources.filter((s) => s.ok).map((s, i) => (
                  <span key={s.name}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>{s.asOf && ` (${formatMonth(s.asOf)})`}</span>
                ))}
                {meta?.sources.some((s) => !s.ok) && (
                  <span className="unavailable"> · Unavailable: {meta.sources.filter((s) => !s.ok).map((s) => s.name).join(', ')}</span>
                )}
              </>
            )}
          </span>
        </div>
      </footer>
    </div>
  );
}
