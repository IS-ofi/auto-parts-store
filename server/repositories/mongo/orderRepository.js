const { ObjectId } = require('mongodb');
const { getDb, getClient, supportsTransactions } = require('../../db');
const { conflict } = require('../../errors');
const logger = require('../../logger');
const { withId, logged } = require('../shared');

const orders = () => getDb().collection('orders');
const products = () => getDb().collection('products');
const carts = () => getDb().collection('carts');

const DUPLICATE_KEY = 11000;

const toOrder = (doc) => {
  const order = withId(doc);
  if (!order) return null;
  const items = doc.items.map((i) => ({ ...i, productId: String(i.productId) }));
  return { ...order, items };
};

const stockFilter = ({ productId, quantity }) => ({
  _id: new ObjectId(productId),
  stock: { $gte: quantity },
});

/** Пояснення причини відмови (лише на шляху помилки: один додатковий читальний запит). */
async function shortage(items) {
  const rows = await products()
    .find({ _id: { $in: items.map((i) => new ObjectId(i.productId)) } })
    .toArray();
  const byId = new Map(rows.map((p) => [String(p._id), p]));
  const stockOf = (i) => (byId.has(i.productId) ? byId.get(i.productId).stock : 0);
  const line = items.find((i) => stockOf(i) < i.quantity);
  const available = line ? stockOf(line) : 0;
  return conflict(
    'INSUFFICIENT_STOCK',
    `Недостатньо товару "${line ? line.name : '?'}" на складі (доступно: ${available})`
  );
}

const buildOrder = ({ userId, items, totalPrice, idempotencyKey }) => ({
  userId,
  items: items.map(({ productId, quantity, price }) => ({
    productId: new ObjectId(productId),
    quantity,
    price,
  })),
  totalPrice,
  status: 'CREATED',
  createdAt: new Date(),
  ...(idempotencyKey ? { idempotencyKey } : {}),
});

/**
 * Replica set / mongos: залишки + замовлення + кошик в одній транзакції (all-or-nothing);
 * transient-помилки withTransaction повторює сам. Один bulkWrite на всі позиції.
 */
async function placeInTransaction(input) {
  const session = getClient().startSession();
  try {
    let doc;
    await session.withTransaction(async () => {
      doc = buildOrder(input);
      const result = await products().bulkWrite(
        input.items.map((line) => ({
          updateOne: { filter: stockFilter(line), update: { $inc: { stock: -line.quantity } } },
        })),
        { session, ordered: true }
      );
      if (result.matchedCount !== input.items.length) throw await shortage(input.items);
      await orders().insertOne(doc, { session });
      await carts().deleteOne({ userId: input.userId }, { session });
    });
    return doc;
  } finally {
    await session.endSession();
  }
}

/**
 * Standalone MongoDB (транзакцій немає): кожне списання — умовний updateOne (stock >= quantity),
 * тож «мінус» неможливий навіть при гонці; якщо щось не вдалося — компенсація вже списаного.
 */
async function placeWithCompensation(input) {
  const applied = [];
  const doc = buildOrder(input);
  try {
    for (const line of input.items) {
      const result = await products().updateOne(stockFilter(line), {
        $inc: { stock: -line.quantity },
      });
      if (result.modifiedCount !== 1) throw await shortage(input.items);
      applied.push(line);
    }
    await orders().insertOne(doc);
  } catch (error) {
    await compensate(applied);
    throw error;
  }
  try {
    await carts().deleteOne({ userId: input.userId });
  } catch (error) {
    // Замовлення вже створене: збій очищення кошика не скасовує його, але не маскується.
    logger.warn(`Кошик користувача не очищено: ${error.message}`);
  }
  return doc;
}

async function compensate(applied) {
  if (applied.length === 0) return;
  try {
    await products().bulkWrite(
      applied.map((line) => ({
        updateOne: {
          filter: { _id: new ObjectId(line.productId) },
          update: { $inc: { stock: line.quantity } },
        },
      }))
    );
    logger.warn(`Компенсація: повернуто залишки для ${applied.length} поз.`);
  } catch (error) {
    const details = JSON.stringify(applied);
    logger.error(
      `Компенсація НЕ вдалась, потрібне ручне відновлення: ${details} (${error.message})`
    );
  }
}

async function place(input) {
  const { userId, idempotencyKey } = input;
  const find = () => orders().findOne({ userId, idempotencyKey });
  if (idempotencyKey) {
    const existing = await find();
    if (existing) return { order: toOrder(existing), replayed: true };
  }
  try {
    const doc = supportsTransactions()
      ? await placeInTransaction(input)
      : await placeWithCompensation(input);
    return { order: toOrder(doc), replayed: false };
  } catch (error) {
    // Паралельний запит із тим самим ключем виграв гонку: залишки вже повернуто, віддаємо його замовлення.
    if (error.code === DUPLICATE_KEY && idempotencyKey) {
      return { order: toOrder(await find()), replayed: true };
    }
    throw error;
  }
}

function createOrderRepository() {
  return {
    place: (input) =>
      logged(
        'DB',
        'orders.place',
        () => place(input),
        ({ order, replayed }) => ({
          orderId: order.id,
          replayed,
          transaction: supportsTransactions(),
        })
      ),
    listByUserId: (userId) =>
      logged(
        'DB',
        'orders.listByUserId',
        async () => {
          const rows = await orders().find({ userId }).sort({ createdAt: -1 }).toArray();
          return rows.map(toOrder);
        },
        (rows) => ({ count: rows.length })
      ),
    updateStatus: (id, status) =>
      logged('DB', 'orders.updateStatus', async () =>
        toOrder(
          await orders().findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: { status, updatedAt: new Date() } },
            { returnDocument: 'after' }
          )
        )
      ),
  };
}

module.exports = { createOrderRepository };
