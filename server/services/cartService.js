const { repos } = require('../resources');
const { setUser } = require('../context');
const { notFound } = require('../errors');
const v = require('../validation');

const userIdOf = (raw) => {
  const userId = raw === undefined || raw === null ? 'guest' : v.str(raw, 'userId');
  setUser(userId);
  return userId;
};

const get = (rawUserId) => repos().carts.getByUserId(userIdOf(rawUserId));

async function addItem(body) {
  v.object(body);
  const userId = userIdOf(body.userId);
  const productId = v.id(body.productId, 'productId');
  const quantity = body.quantity === undefined ? 1 : v.positiveInt(body.quantity, 'quantity');

  if (!(await repos().products.findById(productId))) throw notFound('Товар не знайдено');
  return repos().carts.addItem(userId, productId, quantity);
}

module.exports = { get, addItem };
