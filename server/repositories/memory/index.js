const { conflict, notFound } = require('../../errors');
const { newId, withId, logged } = require('../shared');

const SRC = 'MEM';

/**
 * Реалізація репозиторіїв на даних у пам'яті (прототип без БД).
 * Інтерфейс той самий, що й у repositories/mongo: роути й сервіси не знають, яка реалізація підключена.
 */
function createMemoryRepositories(seed = {}) {
  const products = new Map();
  const users = new Map();
  const carts = new Map();
  const wishlists = new Map();
  const orders = [];
  for (const product of seed.products || []) products.set(product._id, structuredClone(product));

  const op = (name, fn, summarize) => logged(SRC, name, async () => fn(), summarize);

  return {
    source: 'memory',

    users: {
      findByEmail: (email) =>
        op('users.findByEmail', () => {
          for (const user of users.values()) if (user.email === email) return withId(user);
          return null;
        }),
      create: ({ email, password, createdAt }) =>
        op('users.create', () => {
          const _id = newId();
          users.set(_id, { _id, email, password, createdAt });
          return withId(users.get(_id));
        }),
    },

    products: {
      list: () =>
        op(
          'products.list',
          () => [...products.values()].map(withId),
          (rows) => ({ count: rows.length })
        ),
      findById: (id) => op('products.findById', () => withId(products.get(id))),
      findByIds: (ids) =>
        op(
          'products.findByIds',
          () => ids.filter((id) => products.has(id)).map((id) => withId(products.get(id))),
          (rows) => ({ requested: ids.length, found: rows.length })
        ),
      create: ({ name, price, stock }) =>
        op('products.create', () => {
          const _id = newId();
          products.set(_id, { _id, name, price, stock, createdAt: new Date() });
          return withId(products.get(_id));
        }),
      update: (id, patch) =>
        op('products.update', () => {
          const product = products.get(id);
          if (!product) return null;
          Object.assign(product, patch, { updatedAt: new Date() });
          return withId(product);
        }),
      remove: (id) => op('products.remove', () => products.delete(id)),
    },

    carts: {
      getByUserId: (userId) =>
        op('carts.getByUserId', () => structuredClone(carts.get(userId) || { userId, items: [] })),
      addItem: (userId, productId, quantity) =>
        op('carts.addItem', () => {
          const cart = carts.get(userId) || { userId, items: [] };
          const item = cart.items.find((i) => i.productId === productId);
          if (item) item.quantity += quantity;
          else cart.items.push({ productId, quantity });
          carts.set(userId, cart);
          return structuredClone(cart);
        }),
    },

    wishlists: {
      getByUserId: (userId) =>
        op('wishlists.getByUserId', () =>
          structuredClone(wishlists.get(userId) || { userId, items: [] })
        ),
      toggle: (userId, productId) =>
        op('wishlists.toggle', () => {
          const wishlist = wishlists.get(userId) || { userId, items: [] };
          const index = wishlist.items.indexOf(productId);
          if (index >= 0) wishlist.items.splice(index, 1);
          else wishlist.items.push(productId);
          wishlists.set(userId, wishlist);
          return structuredClone(wishlist);
        }),
    },

    orders: {
      /**
       * Атомарно (JS однопотоковий): перевірка залишків → списання → замовлення → очищення кошика.
       * Повторний виклик із тим самим idempotencyKey повертає вже створене замовлення.
       */
      place: ({ userId, items, totalPrice, idempotencyKey }) =>
        op(
          'orders.place',
          () => {
            if (idempotencyKey) {
              const existing = orders.find(
                (o) => o.userId === userId && o.idempotencyKey === idempotencyKey
              );
              if (existing) return { order: withId(structuredClone(existing)), replayed: true };
            }
            for (const line of items) {
              const product = products.get(line.productId);
              if (!product) throw notFound(`Товар ${line.productId} не знайдено`);
              if (product.stock < line.quantity) {
                throw conflict(
                  'INSUFFICIENT_STOCK',
                  `Недостатньо товару "${line.name}" на складі (доступно: ${product.stock})`
                );
              }
            }
            for (const line of items) products.get(line.productId).stock -= line.quantity;
            const order = {
              _id: newId(),
              userId,
              items: items.map(({ productId, quantity, price }) => ({
                productId,
                quantity,
                price,
              })),
              totalPrice,
              status: 'CREATED',
              createdAt: new Date(),
            };
            if (idempotencyKey) order.idempotencyKey = idempotencyKey;
            orders.push(order);
            carts.delete(userId);
            return { order: withId(structuredClone(order)), replayed: false };
          },
          ({ order, replayed }) => ({ orderId: order.id, replayed })
        ),
      listByUserId: (userId) =>
        op(
          'orders.listByUserId',
          () => orders.filter((o) => o.userId === userId).map((o) => withId(structuredClone(o))),
          (rows) => ({ count: rows.length })
        ),
      updateStatus: (id, status) =>
        op('orders.updateStatus', () => {
          const order = orders.find((o) => o._id === id);
          if (!order) return null;
          Object.assign(order, { status, updatedAt: new Date() });
          return withId(structuredClone(order));
        }),
    },
  };
}

module.exports = { createMemoryRepositories };
