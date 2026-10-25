import { useMemo, useRef, useState } from 'react';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { formatValue } from '../format.js';

const W = 720, H = 460, PAD = 14;
const NO_DATA = 'rgb(229, 232, 236)';

// County choropleth for one state. When a county is selected, the map zooms to it
// and shows its ZIP codes as dots.
export default function CountyMap({
  shapes, counties, zips, metric, countyColor, zipColor,
  selectedCounty, selectedZip, onSelectCounty, onSelectZip,
}) {
  const wrap = useRef(null);
  const [hover, setHover] = useState(null);
  const byId = useMemo(() => new Map(counties.map((c) => [c.id, c])), [counties]);

  const focus = useMemo(
    () => (selectedCounty && shapes.features.find((f) => f.id === selectedCounty)) || shapes,
    [shapes, selectedCounty]
  );
  const { path, projection } = useMemo(() => {
    const projection = geoAlbersUsa().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], focus);
    return { projection, path: geoPath(projection) };
  }, [focus]);

  const countyPaths = useMemo(
    () => shapes.features.map((f) => ({ id: f.id, name: f.properties.name, d: path(f) })),
    [shapes, path]
  );

  const zipDots = useMemo(() => {
    if (!selectedCounty) return [];
    return zips
      .filter((z) => z.county === selectedCounty && z.lat != null)
      .map((z) => ({ z, p: projection([z.lon, z.lat]) }))
      .filter((d) => d.p);
  }, [zips, selectedCounty, projection]);

  const showTip = (e, title, value, extra) => {
    const rect = wrap.current.getBoundingClientRect();
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, title, value, extra });
  };

  return (
    <div className="countymap-wrap" ref={wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className="countymap" role="img" aria-label={`County map of ${metric.label}`}>
        {countyPaths.map(({ id, name, d }) => {
          const c = byId.get(id);
          const v = c?.metrics[metric.key];
          const isSel = id === selectedCounty;
          const dimmed = selectedCounty && !isSel;
          return (
            <path
              key={id}
              d={d}
              className={`county ${isSel ? 'selected' : ''} ${dimmed ? 'dimmed' : ''}`}
              fill={v == null ? NO_DATA : countyColor(v)}
              onClick={() => onSelectCounty(id)}
              onMouseMove={(e) => showTip(e, c?.name || name, v == null ? 'No data' : `${metric.label}: ${formatValue(v, metric.format)}`, c?.lowSample ? 'Few listings — numbers may be noisy' : null)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        {zipDots.map(({ z, p }) => {
          const v = z.metrics[metric.key];
          const isSel = z.id === selectedZip;
          return (
            <circle
              key={z.id}
              cx={p[0]}
              cy={p[1]}
              r={isSel ? 9 : 6.5}
              className={`zip-dot ${isSel ? 'selected' : ''} ${z.lowSample ? 'low' : ''}`}
              fill={v == null ? NO_DATA : zipColor(v)}
              onClick={(e) => { e.stopPropagation(); onSelectZip(z.id); }}
              onMouseMove={(e) => showTip(e, `${z.id}${z.city ? ` · ${z.city}` : ''}`, v == null ? 'No data' : `${metric.label}: ${formatValue(v, metric.format)}`, z.lowSample ? 'Few listings — numbers may be noisy' : null)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>
      {hover && (
        <div className="tooltip map-tip" style={{ left: hover.x, top: hover.y }}>
          <strong>{hover.title}</strong>
          <span>{hover.value}</span>
          {hover.extra && <em>{hover.extra}</em>}
        </div>
      )}
    </div>
  );
}
