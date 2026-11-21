const { repos } = require('../resources');
const { setUser } = require('../context');
const { notFound, validation } = require('../errors');
const logger = require('../logger');
const v = require('../validation');

const STATUSES = ['CREATED', 'PROCESSING', 'SHIPPED', 'DONE', 'CANCELLED'];
const MAX_ITEMS = 100;

function parseItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    throw validation(`items має бути непорожнім масивом (до ${MAX_ITEMS} позицій)`);
  }
  const seen = new Set();
  return items.map((raw) => {
    v.object(raw, 'позиція замовлення');
    const productId = v.id(raw.productId, 'productId');
    if (seen.has(productId)) throw validation(`Товар ${productId} вказано кілька разів`);
    seen.add(productId);
    return { productId, quantity: v.positiveInt(raw.quantity, 'quantity') };
  });
}

/** Сума замовлення в грошах: округлення до копійок прибирає похибку float (0.1 * 3). */
const calcTotal = (lines) =>
  Math.round(lines.reduce((sum, line) => sum + line.price * line.quantity, 0) * 100) / 100;

/**
 * Бізнес-операція «оформити замовлення»: валідація → ОДНЕ читання товарів → сума →
 * атомарне оформлення в репозиторії (списання залишків, замовлення, очищення кошика).
 */
async function placeOrder(body, idempotencyKey) {
  v.object(body);
  const userId = v.str(body.userId, 'userId');
  setUser(userId);
  const items = parseItems(body.items);
  const key =
    idempotencyKey === undefined
      ? undefined
      : v.str(idempotencyKey, 'Idempotency-Key', { max: 128 });

  const products = await repos().products.findByIds(items.map((i) => i.productId));
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = items.map(({ productId, quantity }) => {
    const product = byId.get(productId);
    if (!product) throw notFound(`Товар ${productId} не знайдено`);
    return { productId, quantity, name: product.name, price: product.price };
  });
  const totalPrice = calcTotal(lines);

  const result = await repos().orders.place({
    userId,
    items: lines,
    totalPrice,
    idempotencyKey: key,
  });
  logger.info(result.replayed ? 'Повтор: повернуто наявне замовлення' : 'Замовлення оформлено', {
    orderId: result.order.id,
    totalPrice,
  });
  return result;
}

function listByUser(rawUserId) {
  const userId = v.str(rawUserId ?? '', 'userId');
  setUser(userId);
  return repos().orders.listByUserId(userId);
}

async function updateStatus(rawId, body) {
  const id = v.id(rawId, 'id');
  v.object(body);
  if (!STATUSES.includes(body.status)) {
    throw validation(`status має бути одним із: ${STATUSES.join(', ')}`);
  }
  const order = await repos().orders.updateStatus(id, body.status);
  if (!order) throw notFound('Замовлення не знайдено');
  return order;
}

module.exports = { placeOrder, listByUser, updateStatus, calcTotal, parseItems, STATUSES };
