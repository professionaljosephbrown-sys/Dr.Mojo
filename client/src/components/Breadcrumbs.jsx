export default function Breadcrumbs({ items }) {
  return (
    <nav className="crumbs" aria-label="Location">
      {items.map((it, i) => (
        <span key={it.label} className="crumb">
          {i > 0 && <span className="crumb-sep" aria-hidden="true">›</span>}
          {it.onClick && i < items.length - 1 ? (
            <button onClick={it.onClick}>{it.label}</button>
          ) : (
            <span aria-current={i === items.length - 1 ? 'page' : undefined}>{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
