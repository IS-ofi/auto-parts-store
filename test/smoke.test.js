const test = require('node:test');
const assert = require('node:assert/strict');
const { server } = require('../server/server');

test('smoke: сервер піднімається, /api/health -> 200 і унікальний processId', async (t) => {
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const { port } = server.address();

  const get = async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 200);
    return res.json();
  };
  const a = await get();
  const b = await get();

  assert.equal(a.status, 'ok');
  assert.ok(a.processId && b.processId);
  assert.notEqual(a.processId, b.processId); // AsyncLocalStorage: окремий контекст на запит
});
