const { server } = require('../../server/server');

/** Піднімає справжній HTTP-сервер на вільному порту; тести ходять у нього через fetch. */
async function startApp() {
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, { body, raw, headers } = {}) {
    const payload = raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body);
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: payload,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, json, text };
  }

  return { request, close: () => new Promise((resolve) => server.close(resolve)) };
}

module.exports = { startApp };
