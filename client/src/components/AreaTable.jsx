import { useMemo, useState } from 'react';
import { formatValue } from '../format.js';

// Sortable list of counties or ZIP codes.
export default function AreaTable({ rows, metric, priceDef, yoyDef, selectedId, onSelect, kind }) {
  const [sort, setSort] = useState({ key: metric.key, dir: -1 });
  const sortKey = sort.key === 'name' || rows.some((r) => r.metrics[sort.key] != null) ? sort.key : metric.key;

  const cols = [
    priceDef && { key: priceDef.key, label: priceDef.key === 'homeValue' ? (priceDef.label === 'Median List Price' ? 'List price' : 'Home value') : priceDef.label, def: priceDef },
    yoyDef && { key: yoyDef.key, label: 'YoY', def: yoyDef },
    ![priceDef?.key, yoyDef?.key].includes(metric.key) && { key: metric.key, label: metric.label, def: metric },
  ].filter(Boolean);

  const sorted = useMemo(() => {
    const val = (r) => (sortKey === 'name' ? r.name : r.metrics[sortKey]);
    return [...rows].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      return sortKey === 'name' ? sort.dir * -String(va).localeCompare(String(vb)) : sort.dir * (va - vb);
    });
  }, [rows, sortKey, sort.dir]);

  const header = (key, label) => (
    <th
      className={sortKey === key ? 'sorted' : ''}
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : key === 'name' ? 1 : -1 }))}
      aria-sort={sortKey === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
    >
      {label}{sortKey === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <div className="area-table-wrap">
      <table className="area-table">
        <thead>
          <tr>
            {header('name', kind === 'zip' ? 'ZIP code' : 'County')}
            {cols.map((c) => <th key={c.key} className={`num ${sortKey === c.key ? 'sorted' : ''}`} onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : -1 }))}>{c.label}{sortKey === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</th>)}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className={r.id === selectedId ? 'selected' : ''} onClick={() => onSelect(r.id)}>
              <td>
                <span className="area-name">{r.name}</span>
                {r.sub && <span className="area-sub">{r.sub}</span>}
                {r.lowSample && <span className="low-tag" title="Fewer than 10 active listings">few listings</span>}
              </td>
              {cols.map((c) => <td key={c.key} className="num">{formatValue(r.metrics[c.key], c.def.format)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
