const { repos } = require('../resources');
const { setUser } = require('../context');
const { notFound } = require('../errors');
const v = require('../validation');

const userIdOf = (raw) => {
  const userId = raw === undefined || raw === null ? 'guest' : v.str(raw, 'userId');
  setUser(userId);
  return userId;
};

const get = (rawUserId) => repos().wishlists.getByUserId(userIdOf(rawUserId));

async function toggle(body) {
  v.object(body);
  const userId = userIdOf(body.userId);
  const productId = v.id(body.productId, 'productId');

  // Прибрати зі списку можна й видалений товар; додати — лише наявний.
  const current = await repos().wishlists.getByUserId(userId);
  if (!current.items.includes(productId) && !(await repos().products.findById(productId))) {
    throw notFound('Товар не знайдено');
  }
  return repos().wishlists.toggle(userId, productId);
}

module.exports = { get, toggle };
