const { getContext } = require('./context');
const { validation } = require('./errors');

const MAX_BODY_BYTES = 1024 * 1024;

/** Читає й парсить JSON-тіло; порожнє тіло = {}. Некоректний JSON → 400, а не 500. */
async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY_BYTES) throw validation('Тіло запиту завелике');
  }
  if (raw.trim() === '') return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw validation('Некоректний JSON у тілі запиту');
  }
}

function sendJson(res, status, body) {
  if (res.headersSent) return;
  const { processId } = getContext();
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ...body, processId }));
}

function compile(path) {
  const names = [];
  const pattern = path.replace(/:([a-zA-Z]+)/g, (_, name) => {
    names.push(name);
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${pattern}$`), names };
}

/**
 * Мінімальний роутер: routes = [{ method, path: '/api/x/:id', handler(req, res, { params, query }) }].
 * Повертає true, якщо маршрут знайдено й оброблено.
 */
function createRouter(routes) {
  const table = routes.map((route) => ({ ...route, ...compile(route.path) }));
  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    for (const route of table) {
      if (route.method !== req.method) continue;
      const match = route.regex.exec(url.pathname);
      if (!match) continue;
      const params = {};
      route.names.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });
      await route.handler(req, res, { params, query: url.searchParams });
      return true;
    }
    return false;
  };
}

module.exports = { readJson, sendJson, createRouter };
