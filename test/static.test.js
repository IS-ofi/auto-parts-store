const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { initResources, setRepositories } = require('../server/resources');
const logger = require('../server/logger');
const { startApp } = require('./helpers/app');

describe('прототип на статичних даних і збої сховища', () => {
  let app;
  before(async () => {
    logger.setSink(() => {});
    await initResources({ dataSource: 'memory' });
    app = await startApp();
  });
  after(() => app.close());

  it('seed: каталог доступний одразу, замовлення на seed-товар працює', async () => {
    const list = await app.request('GET', '/api/products');
    assert.equal(list.json.count, 5);
    const first = list.json.data[0];
    const order = await app.request('POST', '/api/orders', {
      body: { userId: 'seed-user', items: [{ productId: first._id, quantity: 1 }] },
    });
    assert.equal(order.status, 201);
    assert.equal(order.json.data.totalPrice, first.price);
  });

  it('недоступність сховища → 503 без внутрішнього тексту', async () => {
    const failing = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:27017'), {
      name: 'MongoNetworkError',
    });
    setRepositories({
      products: {
        list: async () => {
          throw failing;
        },
      },
    });
    const res = await app.request('GET', '/api/products');
    assert.equal(res.status, 503);
    assert.equal(res.json.code, 'DATA_SOURCE_UNAVAILABLE');
    assert.ok(!res.text.includes('ECONNREFUSED'));
  });
});
