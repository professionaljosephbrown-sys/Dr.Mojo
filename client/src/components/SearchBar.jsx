import { useState } from 'react';

export default function SearchBar({ states, onSelect }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const term = q.trim().toLowerCase();
  const matches = term
    ? states.filter((s) => s.name.toLowerCase().includes(term) || s.code.toLowerCase() === term).slice(0, 6)
    : [];

  const pick = (s) => { onSelect(s.code); setQ(s.name); setOpen(false); };

  return (
    <form
      className="search"
      onSubmit={(e) => { e.preventDefault(); if (matches[0]) pick(matches[0]); }}
    >
      <div className="search-field">
        <label htmlFor="state-search">Location</label>
        <input
          id="state-search"
          placeholder="Search a state, e.g. Texas or TX"
          value={q}
          autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && matches.length > 0 && (
          <ul className="search-results">
            {matches.map((s) => (
              <li key={s.code} onMouseDown={() => pick(s)}>
                {s.name} <span className="muted">{s.code}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" className="btn-primary">Search</button>
    </form>
  );
}
