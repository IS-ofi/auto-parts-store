const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const logger = require('../../server/logger');
const { repos } = require('../../server/resources');
const { startApp } = require('./app');

const MISSING_ID = 'ffffffffffffffffffffffff';
const unique = () => Math.random().toString(36).slice(2, 10);

/**
 * Один набір сценаріїв для будь-якого джерела даних: memory (прототип) і mongo (інтеграція).
 * Це і є доказ, що реалізації репозиторіїв взаємозамінні (spec, критерій 2).
 * setup() підключає репозиторії обраного джерела; teardown() прибирає за собою.
 */
function defineApiScenarios(label, { setup, teardown }) {
  describe(`API-сценарії [${label}]`, () => {
    let app;
    const lines = [];
    const api = (...args) => app.request(...args);

    before(async () => {
      app = await startApp();
    });
    after(async () => {
      await app.close();
      if (teardown) await teardown();
    });
    beforeEach(async () => {
      lines.length = 0;
      await setup();
      logger.setSink((level, line) => lines.push(line));
    });

    const createProduct = async (name, price, stock) => {
      const res = await api('POST', '/api/products', { body: { name, price, stock } });
      assert.equal(res.status, 201);
      return res.json.data;
    };
    const stockOf = async (id) => {
      const res = await api('GET', '/api/products');
      return res.json.data.find((p) => p._id === id).stock;
    };

    it('health і невідомий маршрут', async () => {
      assert.equal((await api('GET', '/api/health')).status, 200);
      const res = await api('GET', '/api/nope');
      assert.equal(res.status, 404);
    });

    it('реєстрація та вхід, включно з крайовими випадками', async () => {
      const email = `${unique()}@example.com`;
      const reg = await api('POST', '/api/auth/register', { body: { email, password: 'secret1' } });
      assert.equal(reg.status, 201);
      assert.ok(reg.json.userId);

      const dup = await api('POST', '/api/auth/register', { body: { email, password: 'secret1' } });
      assert.equal(dup.status, 409);

      const ok = await api('POST', '/api/auth/login', { body: { email, password: 'secret1' } });
      assert.equal(ok.status, 200);
      assert.equal(ok.json.userId, reg.json.userId);

      const bad = await api('POST', '/api/auth/login', { body: { email, password: 'wrong' } });
      assert.equal(bad.status, 401);

      const noPassword = await api('POST', '/api/auth/login', { body: { email } });
      assert.equal(noPassword.status, 400);

      const badEmail = await api('POST', '/api/auth/register', {
        body: { email: 'not-an-email', password: 'x' },
      });
      assert.equal(badEmail.status, 400);
    });

    it('некоректний JSON, невірний id, внутрішня помилка: без 500 з текстом збою', async () => {
      const badJson = await api('POST', '/api/products', { raw: '{"name": ' });
      assert.equal(badJson.status, 400);

      const badId = await api('PUT', '/api/products/not-an-object-id', { body: { price: 1 } });
      assert.equal(badId.status, 400);

      const unknown = await api('DELETE', `/api/products/${MISSING_ID}`);
      assert.equal(unknown.status, 404);

      const boom = await api('GET', '/api/error-test');
      assert.equal(boom.status, 500);
      assert.equal(boom.json.error, 'Internal Server Error');
      assert.ok(!boom.text.includes('Симульована'));
    });

    it('CRUD товарів', async () => {
      const created = await createProduct('Фільтр повітряний', 250, 7);
      assert.equal(created.stock, 7);

      const invalid = await api('POST', '/api/products', { body: { name: '', price: -1 } });
      assert.equal(invalid.status, 400);

      const upd = await api('PUT', `/api/products/${created._id}`, { body: { price: 300 } });
      assert.equal(upd.status, 200);
      assert.equal(upd.json.data.price, 300);

      const list = await api('GET', '/api/products');
      assert.ok(list.json.data.some((p) => p._id === created._id && p.price === 300));

      assert.equal((await api('DELETE', `/api/products/${created._id}`)).status, 200);
      assert.equal((await api('DELETE', `/api/products/${created._id}`)).status, 404);
    });

    it('кошик і обране', async () => {
      const userId = `u-${unique()}`;
      const product = await createProduct('Щітки склоочисника', 150, 5);

      const missing = await api('POST', '/api/cart', {
        body: { userId, productId: MISSING_ID, quantity: 1 },
      });
      assert.equal(missing.status, 404);

      await api('POST', '/api/cart', { body: { userId, productId: product._id, quantity: 1 } });
      const cart = await api('POST', '/api/cart', {
        body: { userId, productId: product._id, quantity: 2 },
      });
      assert.equal(cart.json.data.items.length, 1);
      assert.equal(cart.json.data.items[0].quantity, 3);
      assert.equal((await api('GET', `/api/cart?userId=${userId}`)).json.data.items.length, 1);

      const on = await api('POST', '/api/wishlist', { body: { userId, productId: product._id } });
      assert.deepEqual(on.json.data.items, [product._id]);
      const off = await api('POST', '/api/wishlist', { body: { userId, productId: product._id } });
      assert.deepEqual(off.json.data.items, []);
    });

    it('замовлення: списання залишків, сума, очищення кошика, статуси', async () => {
      const userId = `u-${unique()}`;
      const a = await createProduct('A', 100, 5);
      const b = await createProduct('B', 50, 3);
      await api('POST', '/api/cart', { body: { userId, productId: a._id, quantity: 2 } });

      const res = await api('POST', '/api/orders', {
        body: {
          userId,
          items: [
            { productId: a._id, quantity: 2 },
            { productId: b._id, quantity: 1 },
          ],
        },
      });
      assert.equal(res.status, 201);
      assert.equal(res.json.data.totalPrice, 250);
      assert.equal(res.json.data.status, 'CREATED');
      assert.equal(await stockOf(a._id), 3);
      assert.equal(await stockOf(b._id), 2);

      const cart = await api('GET', `/api/cart?userId=${userId}`);
      assert.deepEqual(cart.json.data.items, []); // колекція carts, а не cart

      const history = await api('GET', `/api/orders?userId=${userId}`);
      assert.equal(history.json.data.length, 1);

      const status = await api('PATCH', `/api/orders/${res.json.data._id}/status`, {
        body: { status: 'SHIPPED' },
      });
      assert.equal(status.status, 200);
      assert.equal(status.json.data.status, 'SHIPPED');
      const wrong = await api('PATCH', `/api/orders/${res.json.data._id}/status`, {
        body: { status: 'WHATEVER' },
      });
      assert.equal(wrong.status, 400);
      assert.equal((await api('GET', '/api/orders')).status, 400);
    });

    it('замовлення: нестача залишку → 409, жодних часткових списань', async () => {
      const userId = `u-${unique()}`;
      const a = await createProduct('A', 10, 5);
      const b = await createProduct('B', 10, 1);
      await api('POST', '/api/cart', { body: { userId, productId: a._id, quantity: 1 } });

      const res = await api('POST', '/api/orders', {
        body: {
          userId,
          items: [
            { productId: a._id, quantity: 2 },
            { productId: b._id, quantity: 2 },
          ],
        },
      });
      assert.equal(res.status, 409);
      assert.equal(res.json.code, 'INSUFFICIENT_STOCK');
      assert.equal(await stockOf(a._id), 5);
      assert.equal(await stockOf(b._id), 1);
      assert.equal((await api('GET', `/api/cart?userId=${userId}`)).json.data.items.length, 1);
      assert.equal((await api('GET', `/api/orders?userId=${userId}`)).json.data.length, 0);

      const unknown = await api('POST', '/api/orders', {
        body: { userId, items: [{ productId: MISSING_ID, quantity: 1 }] },
      });
      assert.equal(unknown.status, 404);
      const empty = await api('POST', '/api/orders', { body: { userId, items: [] } });
      assert.equal(empty.status, 400);
      const dupLine = await api('POST', '/api/orders', {
        body: {
          userId,
          items: [
            { productId: a._id, quantity: 1 },
            { productId: a._id, quantity: 1 },
          ],
        },
      });
      assert.equal(dupLine.status, 400);
    });

    it('ідемпотентність: повтор із тим самим Idempotency-Key не дублює замовлення', async () => {
      const userId = `u-${unique()}`;
      const a = await createProduct('A', 10, 5);
      const send = () =>
        api('POST', '/api/orders', {
          body: { userId, items: [{ productId: a._id, quantity: 2 }] },
          headers: { 'Idempotency-Key': 'key-1' },
        });

      const first = await send();
      const second = await send();
      assert.equal(first.status, 201);
      assert.equal(second.status, 200);
      assert.equal(second.json.replayed, true);
      assert.equal(second.json.data._id, first.json.data._id);
      assert.equal(await stockOf(a._id), 3);
      assert.equal((await api('GET', `/api/orders?userId=${userId}`)).json.data.length, 1);

      const parallel = await Promise.all([1, 2, 3].map(() => send()));
      assert.ok(parallel.every((r) => r.json.data._id === first.json.data._id));
      assert.equal(await stockOf(a._id), 3);
    });

    it('N+1: замовлення з 5 позицій читає товари одним запитом', async () => {
      const userId = `u-${unique()}`;
      const items = [];
      for (let i = 0; i < 5; i += 1) {
        items.push({ productId: (await createProduct(`P${i}`, 10, 5))._id, quantity: 1 });
      }
      const calls = { findByIds: 0, findById: 0 };
      const { products } = repos();
      for (const name of Object.keys(calls)) {
        const original = products[name];
        products[name] = (...args) => {
          calls[name] += 1;
          return original(...args);
        };
      }
      const res = await api('POST', '/api/orders', { body: { userId, items } });
      assert.equal(res.status, 201);
      assert.deepEqual(calls, { findByIds: 1, findById: 0 });
    });

    it('кожен рядок логу містить processId; є операції сховища і користувач', async () => {
      const userId = `u-${unique()}`;
      const a = await createProduct('A', 10, 5);
      lines.length = 0;
      const res = await api('POST', '/api/orders', {
        body: { userId, items: [{ productId: a._id, quantity: 1 }] },
      });
      const { processId } = res.json;
      assert.ok(processId);
      assert.ok(lines.length >= 4, `мало рядків логу: ${lines.length}`);
      for (const line of lines) assert.ok(line.startsWith(`[${processId}]`), line);
      assert.ok(lines.some((l) => /(MEM|DB) orders\.place ok/.test(l)));
      assert.ok(lines.some((l) => l.includes(`user=${userId}`)));
    });
  });
}

module.exports = { defineApiScenarios };
