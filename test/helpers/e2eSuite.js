const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const { uniqueDbName, openDb, dropDatabase } = require('./mongo');
const { startServer } = require('./serverProcess');

const unique = () => Math.random().toString(36).slice(2, 10);

/**
 * E2E рівень: межа системи = сервер + БД. ТОЧКА ВХОДУ — зовнішній HTTP до окремого процесу
 * `node server/server.js` зі справжньою MongoDB; результат перевіряється НЕ лише у відповіді,
 * а й напряму в колекціях (окреме з'єднання). Ізоляція: окрема база на файл, власні дані в кожному тесті.
 */
function defineE2eSuite(label, { uri, expectTransactions }) {
  const dbName = uniqueDbName('ap_e2e');

  describe(`E2E: HTTP → процес сервера → MongoDB [${label}]`, () => {
    let server;
    let side; // збоку: пряме читання БД
    before(async () => {
      server = await startServer({ MONGO_URI: uri, DB_NAME: dbName, DATA_SOURCE: 'mongo' });
      side = await openDb(uri, dbName);
    });
    after(async () => {
      if (server) await server.stop();
      if (side) await side.close();
      await dropDatabase(uri, dbName);
    });

    async function api(method, path, { body, headers } = {}) {
      const res = await fetch(server.base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, json: JSON.parse(text), text };
    }
    const createProduct = async (price, stock) => {
      const res = await api('POST', '/api/products', {
        body: { name: `P-${unique()}`, price, stock },
      });
      assert.equal(res.status, 201);
      return res.json.data;
    };
    const stockInDb = async (id) =>
      (await side.db.collection('products').findOne({ _id: new ObjectId(id) })).stock;

    it(`старт: /api/health 200, лог підтверджує режим транзакцій (${expectTransactions ? 'так' : 'ні'})`, async () => {
      assert.equal((await api('GET', '/api/health')).status, 200);
      assert.ok(
        server.output().includes(`транзакції: ${expectTransactions ? 'так' : 'ні'}`),
        server.output()
      );
    });

    it('повний шлях покупця: реєстрація → вхід → товар → кошик → обране → замовлення → статус; стан у БД', async () => {
      const email = `${unique()}@example.com`;
      const reg = await api('POST', '/api/auth/register', { body: { email, password: 'secret1' } });
      assert.equal(reg.status, 201);
      const userId = reg.json.userId;
      const login = await api('POST', '/api/auth/login', { body: { email, password: 'secret1' } });
      assert.equal(login.json.userId, userId);
      assert.ok(await side.db.collection('users').findOne({ email })); // пароль — хеш, не відкритий текст
      assert.notEqual((await side.db.collection('users').findOne({ email })).password, 'secret1');

      const product = await createProduct(0.1, 3);
      await api('POST', '/api/cart', { body: { userId, productId: product._id, quantity: 3 } });
      assert.equal(await side.db.collection('carts').countDocuments({ userId }), 1);
      const wish = await api('POST', '/api/wishlist', { body: { userId, productId: product._id } });
      assert.deepEqual(wish.json.data.items, [product._id]);

      const order = await api('POST', '/api/orders', {
        body: { userId, items: [{ productId: product._id, quantity: 3 }] },
      });
      assert.equal(order.status, 201);
      assert.equal(order.json.data.totalPrice, 0.3);

      // Стан у БД (а не лише відповідь API):
      assert.equal(await stockInDb(product._id), 0);
      assert.equal(await side.db.collection('carts').countDocuments({ userId }), 0);
      const saved = await side.db.collection('orders').findOne({ userId });
      assert.equal(saved.status, 'CREATED');
      assert.equal(saved.totalPrice, 0.3);
      assert.ok(saved.items[0].productId instanceof ObjectId);

      const patched = await api('PATCH', `/api/orders/${order.json.data._id}/status`, {
        body: { status: 'SHIPPED' },
      });
      assert.equal(patched.status, 200);
      assert.equal((await side.db.collection('orders').findOne({ userId })).status, 'SHIPPED');
      assert.equal((await api('GET', `/api/orders?userId=${userId}`)).json.data.length, 1);
    });

    it('повтор POST /api/orders з Idempotency-Key: 200 replayed, у БД одне замовлення, залишок списано раз', async () => {
      const userId = `u-${unique()}`;
      const product = await createProduct(10, 5);
      const send = () =>
        api('POST', '/api/orders', {
          body: { userId, items: [{ productId: product._id, quantity: 2 }] },
          headers: { 'Idempotency-Key': 'retry-1' },
        });
      const first = await send();
      const second = await send();
      assert.equal(first.status, 201);
      assert.equal(second.status, 200);
      assert.equal(second.json.replayed, true);
      assert.equal(second.json.data._id, first.json.data._id);
      assert.equal(await side.db.collection('orders').countDocuments({ userId }), 1);
      assert.equal(await stockInDb(product._id), 3);
    });

    it('нестача залишку: 409 INSUFFICIENT_STOCK, у БД залишок і кошик не змінені', async () => {
      const userId = `u-${unique()}`;
      const product = await createProduct(10, 1);
      await api('POST', '/api/cart', { body: { userId, productId: product._id, quantity: 1 } });
      const res = await api('POST', '/api/orders', {
        body: { userId, items: [{ productId: product._id, quantity: 2 }] },
      });
      assert.equal(res.status, 409);
      assert.equal(res.json.code, 'INSUFFICIENT_STOCK');
      assert.equal(await stockInDb(product._id), 1);
      assert.equal(await side.db.collection('carts').countDocuments({ userId }), 1);
      assert.equal(await side.db.collection('orders').countDocuments({ userId }), 0);
    });

    it('6 паралельних замовлень на останню одиницю: рівно одне 201, решта 409, у БД залишок 0', async () => {
      const product = await createProduct(10, 1);
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          api('POST', '/api/orders', {
            body: { userId: `u-${unique()}`, items: [{ productId: product._id, quantity: 1 }] },
          })
        )
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409, 409, 409, 409]);
      assert.equal(await stockInDb(product._id), 0);
      assert.equal(
        await side.db
          .collection('orders')
          .countDocuments({ 'items.productId': new ObjectId(product._id) }),
        1
      );
    });

    it('кожен рядок логу запиту має його processId; 500 не віддає внутрішній текст', async () => {
      const res = await api('GET', '/api/error-test');
      assert.equal(res.status, 500);
      assert.ok(res.json.processId);
      assert.ok(!res.text.includes('Симульована'));
      const mine = server
        .output()
        .split('\n')
        .filter((l) => l.includes(res.json.processId));
      assert.ok(mine.length >= 2, `рядків логу з processId: ${mine.length}`);
      assert.ok(mine.some((l) => l.includes('ERROR')));
    });
  });
}

module.exports = { defineE2eSuite };
