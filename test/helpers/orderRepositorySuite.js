const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { uniqueDbName, dropDatabase } = require('./mongo');

const MISSING_ID = 'ffffffffffffffffffffffff';
const unique = () => Math.random().toString(36).slice(2, 10);

/**
 * Інтеграційний рівень: ТОЧКА ВХОДУ — внутрішній API репозиторіїв (createMongoRepositories),
 * залежність — справжня MongoDB у Docker (без моків драйвера). Один і той самий набір проганяється
 * на standalone (компенсація) і на replica set (транзакція): `expectTransactions` фіксує, який шлях діє.
 * Ізоляція: окрема база на файл (процес), кожен тест створює власні товари/користувачів.
 */
function defineOrderRepositorySuite(label, { uri, expectTransactions }) {
  process.env.MONGO_URI = uri; // до першого require('db.js'): клієнт створюється при завантаженні
  const logger = require('../../server/logger');
  const { initDb, getDb, closeDb, supportsTransactions } = require('../../server/db');
  const { createMongoRepositories } = require('../../server/repositories/mongo');

  const dbName = uniqueDbName('ap_it');

  describe(`orderRepository ↔ справжня MongoDB [${label}]`, () => {
    let repos;
    before(async () => {
      logger.setSink(() => {});
      await initDb({ dbName });
      repos = createMongoRepositories();
    });
    after(async () => {
      await closeDb();
      await dropDatabase(uri, dbName);
    });
    beforeEach(async () => {
      await getDb().command({ collMod: 'orders', validator: {} }); // зняти валідатор попереднього тесту
    });

    const product = (price, stock) =>
      repos.products.create({ name: `P-${unique()}`, price, stock });
    const line = (p, quantity) => ({
      productId: p.id,
      quantity,
      name: p.name,
      price: p.price,
    });
    const place = (userId, items, extra = {}) =>
      repos.orders.place({
        userId,
        items,
        totalPrice: items.reduce((s, i) => s + i.price * i.quantity, 0),
        ...extra,
      });
    const stockOf = async (p) => (await repos.products.findById(p.id)).stock;

    it(`режим транзакцій визначено правильно: ${expectTransactions ? 'так' : 'ні'}`, () => {
      assert.equal(supportsTransactions(), expectTransactions);
    });

    it('place: списує залишки, створює замовлення, очищує кошик (тільки цього користувача)', async () => {
      const [userId, other] = [`u-${unique()}`, `u-${unique()}`];
      const a = await product(100, 5);
      const b = await product(50, 3);
      await repos.carts.addItem(userId, a.id, 2);
      await repos.carts.addItem(other, a.id, 1);

      const { order, replayed } = await place(userId, [line(a, 2), line(b, 1)]);
      assert.equal(replayed, false);
      assert.equal(order.status, 'CREATED');
      assert.equal(await stockOf(a), 3);
      assert.equal(await stockOf(b), 2);
      assert.deepEqual((await repos.carts.getByUserId(userId)).items, []);
      assert.equal((await repos.carts.getByUserId(other)).items.length, 1);
      assert.equal(typeof order.items[0].productId, 'string');
    });

    it('межа: замовити рівно весь залишок можна; наступне замовлення → INSUFFICIENT_STOCK', async () => {
      const p = await product(10, 3);
      await place(`u-${unique()}`, [line(p, 3)]);
      assert.equal(await stockOf(p), 0);
      await assert.rejects(place(`u-${unique()}`, [line(p, 1)]), { code: 'INSUFFICIENT_STOCK' });
      assert.equal(await stockOf(p), 0);
    });

    it('нестача на другій позиції: перша НЕ лишається списаною, замовлення немає', async () => {
      const userId = `u-${unique()}`;
      const a = await product(10, 5);
      const b = await product(10, 1);
      await assert.rejects(place(userId, [line(a, 2), line(b, 2)]), {
        code: 'INSUFFICIENT_STOCK',
      });
      assert.equal(await stockOf(a), 5);
      assert.equal(await stockOf(b), 1);
      assert.deepEqual(await repos.orders.listByUserId(userId), []);
    });

    it('збій ЗАПИСУ замовлення після списання (валідатор колекції) → залишки відновлено', async () => {
      // Саме цей шлях (компенсація / відкат транзакції) жоден API-сценарій не відтворює.
      await getDb().command({
        collMod: 'orders',
        validator: {
          $jsonSchema: { properties: { totalPrice: { bsonType: 'number', maximum: 1 } } },
        },
        validationAction: 'error',
      });
      const userId = `u-${unique()}`;
      const a = await product(500, 5);
      const b = await product(500, 5);
      await assert.rejects(place(userId, [line(a, 2), line(b, 1)]), { code: 121 });
      assert.equal(await stockOf(a), 5);
      assert.equal(await stockOf(b), 5);
      assert.deepEqual(await repos.orders.listByUserId(userId), []);
    });

    it('гонка за останні одиниці: 10 паралельних замовлень на 5 шт. → рівно 5 успішних, залишок 0', async () => {
      const p = await product(10, 5);
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => place(`u-${unique()}`, [line(p, 1)]))
      );
      const ok = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');
      assert.equal(ok.length, 5);
      assert.ok(failed.every((r) => r.reason.code === 'INSUFFICIENT_STOCK'));
      assert.equal(await stockOf(p), 0);
    });

    it('ідемпотентність: повтор із тим самим ключем → replayed, залишок списано один раз', async () => {
      const userId = `u-${unique()}`;
      const p = await product(10, 10);
      const first = await place(userId, [line(p, 2)], { idempotencyKey: 'k1' });
      const second = await place(userId, [line(p, 2)], { idempotencyKey: 'k1' });
      assert.equal(first.replayed, false);
      assert.equal(second.replayed, true);
      assert.equal(second.order.id, first.order.id);
      assert.equal(await stockOf(p), 8);
      assert.equal((await repos.orders.listByUserId(userId)).length, 1);
    });

    it('ідемпотентність: паралельні повтори одного ключа → одне замовлення, залишок списано раз', async () => {
      const userId = `u-${unique()}`;
      const p = await product(10, 10);
      const results = await Promise.all(
        Array.from({ length: 5 }, () => place(userId, [line(p, 2)], { idempotencyKey: 'race' }))
      );
      assert.equal(new Set(results.map((r) => r.order.id)).size, 1);
      assert.equal(results.filter((r) => !r.replayed).length, 1);
      assert.equal(await stockOf(p), 8);
      assert.equal((await repos.orders.listByUserId(userId)).length, 1);
    });

    it('ключ ідемпотентності діє в межах користувача', async () => {
      const p = await product(10, 10);
      const a = await place(`u-${unique()}`, [line(p, 1)], { idempotencyKey: 'same' });
      const b = await place(`u-${unique()}`, [line(p, 1)], { idempotencyKey: 'same' });
      assert.notEqual(a.order.id, b.order.id);
      assert.equal(b.replayed, false);
    });

    it('listByUserId: нові замовлення першими; updateStatus: зміна й null для неіснуючого id', async () => {
      const userId = `u-${unique()}`;
      const p = await product(10, 10);
      const first = (await place(userId, [line(p, 1)])).order;
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = (await place(userId, [line(p, 1)])).order;
      assert.deepEqual(
        (await repos.orders.listByUserId(userId)).map((o) => o.id),
        [second.id, first.id]
      );
      assert.equal((await repos.orders.updateStatus(first.id, 'SHIPPED')).status, 'SHIPPED');
      assert.equal(await repos.orders.updateStatus(MISSING_ID, 'SHIPPED'), null);
    });

    it('те, що мок не покаже: унікальний email у БД (E11000) і $inc у позиції кошика', async () => {
      const email = `${unique()}@example.com`;
      await repos.users.create({ email, password: 'x', createdAt: new Date() });
      await assert.rejects(repos.users.create({ email, password: 'y', createdAt: new Date() }), {
        code: 11000,
      });

      const userId = `u-${unique()}`;
      const p = await product(10, 10);
      await repos.carts.addItem(userId, p.id, 1);
      const cart = await repos.carts.addItem(userId, p.id, 2);
      assert.deepEqual(cart.items, [{ productId: p.id, quantity: 3 }]);
    });

    it('findByIds повертає лише наявні товари (один запит на будь-яку кількість id)', async () => {
      const p = await product(10, 1);
      const rows = await repos.products.findByIds([p.id, MISSING_ID]);
      assert.deepEqual(
        rows.map((r) => r.id),
        [p.id]
      );
    });
  });
}

module.exports = { defineOrderRepositorySuite };
