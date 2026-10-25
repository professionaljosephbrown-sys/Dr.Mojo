#!/usr/bin/env node
// Builds a single self-contained HTML file with the app and all data embedded:
//   client/dist-static/index.html
// It needs no server, so it can be hosted anywhere (GitHub Pages, Netlify, etc.).
// Run from the project root:  npm run build:static

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { states, METRICS, meta, national } from '../data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'client/dist');
const outDir = path.join(root, 'client/dist-static');

let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');

// Inline built CSS and JS
html = html.replace(/<link rel="stylesheet"[^>]*href="\/?([^"]+\.css)"[^>]*>/g, (_m, file) =>
  `<style>${safe(fs.readFileSync(path.join(dist, file), 'utf8'))}</style>`);
html = html.replace(/<script type="module"[^>]*src="\/?([^"]+\.js)"[^>]*><\/script>/g, (_m, file) =>
  `<script type="module">${safe(fs.readFileSync(path.join(dist, file), 'utf8'))}</script>`);

// Embed data before the app script runs
const data = { metrics: METRICS, states, national, meta };
html = html.replace('</head>', `<script>window.__DRMOJO_DATA__ = ${safe(JSON.stringify(data))};</script>\n</head>`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log(`Wrote ${path.relative(root, path.join(outDir, 'index.html'))} (${Math.round(html.length / 1024)} KB)`);
