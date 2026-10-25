// In the static build (npm run build:static) state data is embedded in the page
// as window.__DRMOJO_DATA__, and county/ZIP files sit next to it in areas/.
// Otherwise everything comes from the Node API.
const embedded = typeof window !== 'undefined' ? window.__DRMOJO_DATA__ : null;

const getJSON = (url) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`Request failed: ${r.status}`);
  return r.json();
});
const get = (path) => getJSON(`/api${path}`);
const local = (pick) => Promise.resolve(pick(embedded));

// Cache per-state county/ZIP downloads (they can be a few MB)
const areaCache = new Map();
const cached = (key, load) => {
  if (!areaCache.has(key)) areaCache.set(key, load().catch((e) => { areaCache.delete(key); throw e; }));
  return areaCache.get(key);
};

export const api = embedded
  ? {
      metrics: () => local((d) => d.metrics),
      states: () => local((d) => d.states.map(({ history, ...rest }) => rest)),
      state: (code) => local((d) => d.states.find((s) => s.code === code)),
      national: () => local((d) => d.national),
      meta: () => local((d) => d.meta),
      areas: (code) => cached(code, () => getJSON(`areas/${code}.json`)),
      searchIndex: () => cached('__search', () => getJSON('areas/search-index.json')),
    }
  : {
      metrics: () => get('/metrics'),
      states: () => get('/states'),
      state: (code) => get(`/states/${code}`),
      national: () => get('/national'),
      meta: () => get('/meta'),
      areas: (code) => cached(code, () => get(`/states/${code}/areas`)),
      searchIndex: () => cached('__search', () => get('/search-index')),
    };
