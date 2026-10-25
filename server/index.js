import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { states, METRICS, meta, national } from './data.js';

const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors());

const summary = (s) => ({ code: s.code, name: s.name, grid: s.grid, metrics: s.metrics });

app.get('/api/metrics', (_req, res) => res.json(METRICS));

// Where the data came from and how fresh it is
app.get('/api/meta', (_req, res) => res.json(meta));

app.get('/api/states', (_req, res) => res.json(states.map(summary)));

app.get('/api/states/:code', (req, res) => {
  const s = states.find((x) => x.code === req.params.code.toUpperCase());
  if (!s) return res.status(404).json({ error: 'State not found' });
  res.json(s);
});

// Ranked list for a metric: /api/rankings?metric=yoy&order=desc&limit=10
app.get('/api/rankings', (req, res) => {
  const metric = req.query.metric || 'homeValue';
  if (!METRICS.some((m) => m.key === metric)) return res.status(400).json({ error: 'Unknown metric' });
  const dir = req.query.order === 'asc' ? 1 : -1;
  const limit = Math.min(Number(req.query.limit) || 10, 51);
  const ranked = states
    .filter((s) => s.metrics[metric] != null)
    .sort((a, b) => dir * (a.metrics[metric] - b.metrics[metric]))
    .slice(0, limit)
    .map((s) => ({ code: s.code, name: s.name, value: s.metrics[metric] }));
  res.json(ranked);
});

// National averages (simple mean across states)
app.get('/api/national', (_req, res) => res.json(national));

// In production, serve the built React app
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
