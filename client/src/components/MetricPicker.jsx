export default function MetricPicker({ metrics, value, onChange }) {
  return (
    <ul className="metric-list">
      {metrics.map((m) => (
        <li key={m.key}>
          <label className={m.key === value ? 'active' : ''} title={m.description}>
            <input type="radio" name="metric" checked={m.key === value} onChange={() => onChange(m.key)} />
            <span>{m.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
