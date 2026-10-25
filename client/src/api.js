// In the static build (npm run build:static) all data is embedded in the page
// as window.__DRMOJO_DATA__, so no server is needed. Otherwise it calls the API.
const embedded = typeof window !== 'undefined' ? window.__DRMOJO_DATA__ : null;

const get = (path) => fetch(`/api${path}`).then((r) => {
  if (!r.ok) throw new Error(`Request failed: ${r.status}`);
  return r.json();
});

const local = (pick) => Promise.resolve(pick(embedded));

export const api = embedded
  ? {
      metrics: () => local((d) => d.metrics),
      states: () => local((d) => d.states.map(({ history, ...rest }) => rest)),
      state: (code) => local((d) => d.states.find((s) => s.code === code)),
      national: () => local((d) => d.national),
      meta: () => local((d) => d.meta),
    }
  : {
      metrics: () => get('/metrics'),
      states: () => get('/states'),
      state: (code) => get(`/states/${code}`),
      national: () => get('/national'),
      meta: () => get('/meta'),
    };
