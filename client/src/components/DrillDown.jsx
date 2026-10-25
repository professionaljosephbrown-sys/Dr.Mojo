import { useMemo } from 'react';
import { colorScale } from '../format.js';
import CountyMap from './CountyMap.jsx';
import AreaTable from './AreaTable.jsx';
import Legend from './Legend.jsx';

// County map + table for one state; zooms into a county to show its ZIP codes.
export default function DrillDown({ areas, metric, stateName, selectedCounty, selectedZip, onSelectCounty, onSelectZip }) {
  const county = selectedCounty ? areas.counties.find((c) => c.id === selectedCounty) : null;
  const countyZips = useMemo(
    () => (selectedCounty ? areas.zips.filter((z) => z.county === selectedCounty) : []),
    [areas, selectedCounty]
  );

  const countyColor = useMemo(() => colorScale(metric, areas.counties.map((c) => c.metrics[metric.key])), [areas, metric]);
  const zipColor = useMemo(() => colorScale(metric, areas.zips.map((z) => z.metrics[metric.key])), [areas, metric]);
  const legendItems = selectedCounty ? areas.zips : areas.counties;

  const priceDef = areas.metrics.find((d) => d.key === 'homeValue');
  const yoyDef = areas.metrics.find((d) => d.key === 'yoy');
  const withData = areas.counties.filter((c) => c.metrics[metric.key] != null).length;

  return (
    <div className="map-card card">
      <div className="map-head">
        <div>
          <h2>
            {metric.label} {county ? <>by ZIP code · {county.name}</> : <>by county · {stateName}</>}
          </h2>
          <p className="muted">
            {county
              ? `${countyZips.length} ZIP codes with data. Click a dot or a row for details, or another county to move there.`
              : `${withData} of ${areas.counties.length} counties have data. Click a county to see its ZIP codes.`}
          </p>
        </div>
        <Legend metric={metric} states={legendItems} />
      </div>

      <CountyMap
        shapes={areas.shapes}
        counties={areas.counties}
        zips={areas.zips}
        metric={metric}
        countyColor={countyColor}
        zipColor={zipColor}
        selectedCounty={selectedCounty}
        selectedZip={selectedZip}
        onSelectCounty={onSelectCounty}
        onSelectZip={onSelectZip}
      />

      <h3 className="table-title">{county ? `ZIP codes in ${county.name}` : `Counties in ${stateName}`}</h3>
      {county ? (
        <AreaTable
          key={`zips-${selectedCounty}`}
          kind="zip"
          rows={countyZips.map((z) => ({ ...z, sub: z.city }))}
          metric={metric}
          priceDef={priceDef}
          yoyDef={yoyDef}
          selectedId={selectedZip}
          onSelect={onSelectZip}
        />
      ) : (
        <AreaTable
          kind="county"
          rows={areas.counties}
          metric={metric}
          priceDef={priceDef}
          yoyDef={yoyDef}
          selectedId={selectedCounty}
          onSelect={onSelectCounty}
        />
      )}
    </div>
  );
}
