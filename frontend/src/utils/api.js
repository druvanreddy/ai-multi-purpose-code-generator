const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || err.error || 'Request failed');
  }
  return res;
}

async function json(path, options) {
  const res = await request(path, options);
  return res.json();
}

function post(path, body) {
  return json(path, { method: 'POST', body: JSON.stringify(body) });
}

export const api = {
  getStatus: () => json('/status'),
  getModels: () => json('/models'),

  chat: (body) =>
    fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  codeGenerate: (body) => post('/code/generate', body),
  codeDebug: (body) => post('/code/debug', body),
  codeExplain: (body) => post('/code/explain', body),
  codeOptimize: (body) => post('/code/optimize', body),
  codeReview: (body) => post('/code/review', body),
  codeSecurity: (body) => post('/code/security', body),
  codeDocument: (body) => post('/code/document', body),
  codeCommit: (body) => post('/code/commit', body),

  projectGenerate: (body) => post('/project/generate', body),
  projectSql: (body) => post('/project/sql', body),
  projectReadme: (body) => post('/project/readme', body),
  projectDocs: (body) => post('/project/docs', body),
  projectTests: (body) => post('/project/tests', body),
  projectApi: (body) => post('/project/api', body),
  projectDatabase: (body) => post('/project/database', body),
  projectArchitecture: (body) => post('/project/architecture', body),
  projectDocker: (body) => post('/project/docker', body),
  projectZip: (body) =>
    request('/project/zip', { method: 'POST', body: JSON.stringify(body) }),

  fileAnalyze: (formData) =>
    request('/file/analyze', { method: 'POST', body: formData, headers: {} }),

  getHistory: () => json('/history'),
  clearHistory: () => json('/history', { method: 'DELETE' }),
  exportHistory: () => request('/history/export'),

  getAnalytics: () => json('/analytics'),
  resetAnalytics: () => json('/analytics', { method: 'DELETE' }),

  reportToc: (body) => post('/report/toc', body),
  reportChapter: (body) => post('/report/chapter', body),
  reportEdit: (body) => post('/report/edit', body),
  reportReferences: (body) => post('/report/references', body),
  reportReadability: (body) => post('/report/readability', body),
  reportExport: (format, body) =>
    request(`/report/export/${format}`, { method: 'POST', body: JSON.stringify(body) }),

  detectAnalyzeText: (body) => post('/detect/analyze/text', body),
  detectAnalyzeFile: (formData) =>
    request('/detect/analyze/file', { method: 'POST', body: formData, headers: {} }),
  detectInsights: (body) => post('/detect/insights', body),
  detectHumanize: (body) => post('/detect/humanize', body),
  detectExport: (format, body) =>
    request(`/detect/export/${format}`, { method: 'POST', body: JSON.stringify(body) }),

  getDetectorHistory: () => json('/detect/history'),
  getDetectorEntry: (id) => json(`/detect/history/${id}`),
  deleteDetectorEntry: (id) => json(`/detect/history/${id}`, { method: 'DELETE' }),
  clearDetectorHistory: () => json('/detect/history', { method: 'DELETE' }),
};
