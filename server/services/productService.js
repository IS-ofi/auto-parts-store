const { repos } = require('../resources');
const { notFound, validation } = require('../errors');
const v = require('../validation');

const list = () => repos().products.list();

async function create(body) {
  v.object(body);
  return repos().products.create({
    name: v.str(body.name, 'name'),
    price: v.positiveNumber(body.price, 'price'),
    stock: body.stock === undefined ? 0 : v.nonNegativeInt(body.stock, 'stock'),
  });
}

async function update(rawId, body) {
  const id = v.id(rawId, 'id');
  v.object(body);
  const patch = {};
  if (body.name !== undefined) patch.name = v.str(body.name, 'name');
  if (body.price !== undefined) patch.price = v.positiveNumber(body.price, 'price');
  if (body.stock !== undefined) patch.stock = v.nonNegativeInt(body.stock, 'stock');
  if (Object.keys(patch).length === 0) {
    throw validation('Вкажіть хоча б одне з полів: name, price, stock');
  }

  const product = await repos().products.update(id, patch);
  if (!product) throw notFound('Товар не знайдено');
  return product;
}

async function remove(rawId) {
  const id = v.id(rawId, 'id');
  if (!(await repos().products.remove(id))) throw notFound('Товар не знайдено');
}

module.exports = { list, create, update, remove };
