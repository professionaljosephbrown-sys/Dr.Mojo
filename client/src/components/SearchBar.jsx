import { useState } from 'react';
import { api } from '../api.js';

const countyLabel = (name) => (/(County|Parish|Borough|Region|Area|city)$/i.test(name) ? name : `${name} County`);

// Search states, counties and ZIP codes. The county/ZIP list loads the first time the box is used.
export default function SearchBar({ states, onSelectState, onExplore, canDrill }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(null);

  const loadIndex = () => {
    if (canDrill && !index) api.searchIndex().then(setIndex).catch(() => {});
  };

  const term = q.trim().toLowerCase();
  const stateName = (code) => states.find((s) => s.code === code)?.name || code;
  let matches = [];
  if (term) {
    if (/^\d{1,5}$/.test(term)) {
      if (index) {
        matches = Object.keys(index.zips).filter((z) => z.startsWith(term)).slice(0, 8).map((z) => {
          const [st, city, county] = index.zips[z];
          return { key: `z${z}`, label: `ZIP ${z}`, sub: [city, st].filter(Boolean).join(', '), go: () => onExplore(st, county || null, z) };
        });
      }
    } else {
      const st = states
        .filter((s) => s.name.toLowerCase().includes(term) || s.code.toLowerCase() === term)
        .slice(0, 4)
        .map((s) => ({ key: s.code, label: s.name, sub: 'State', go: () => onSelectState(s.code) }));
      const co = (index?.counties || [])
        .filter(([, name]) => name.toLowerCase().includes(term))
        .slice(0, 6)
        .map(([fips, name, code]) => ({ key: fips, label: countyLabel(name), sub: stateName(code), go: () => onExplore(code, fips) }));
      matches = [...st, ...co];
    }
  }

  const pick = (m) => { m.go(); setQ(m.label); setOpen(false); };

  return (
    <form className="search" onSubmit={(e) => { e.preventDefault(); if (matches[0]) pick(matches[0]); }}>
      <div className="search-field">
        <label htmlFor="state-search">Location</label>
        <input
          id="state-search"
          placeholder={canDrill ? 'Search a state, county or ZIP code' : 'Search a state, e.g. Texas or TX'}
          value={q}
          autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setOpen(true); loadIndex(); }}
          onFocus={() => { setOpen(true); loadIndex(); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && term && (matches.length > 0 || (canDrill && !index)) && (
          <ul className="search-results">
            {matches.map((m) => (
              <li key={m.key} onMouseDown={() => pick(m)}>
                {m.label} <span className="muted">{m.sub}</span>
              </li>
            ))}
            {canDrill && !index && <li className="muted loading-row">Loading counties and ZIP codes…</li>}
          </ul>
        )}
      </div>
      <button type="submit" className="btn-primary">Search</button>
    </form>
  );
}
