const get = (path) => fetch(`/api${path}`).then((r) => {
  if (!r.ok) throw new Error(`Request failed: ${r.status}`);
  return r.json();
});

export const api = {
  metrics: () => get('/metrics'),
  states: () => get('/states'),
  state: (code) => get(`/states/${code}`),
  national: () => get('/national'),
  meta: () => get('/meta'),
};
