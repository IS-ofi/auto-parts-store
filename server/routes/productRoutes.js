const { readJson, sendJson } = require('../http');
const products = require('../services/productService');

const productRoutes = [
  {
    method: 'GET',
    path: '/api/products',
    handler: async (_req, res) => {
      const data = await products.list();
      sendJson(res, 200, { success: true, count: data.length, data });
    },
  },
  {
    method: 'POST',
    path: '/api/products',
    handler: async (req, res) => {
      const data = await products.create(await readJson(req));
      sendJson(res, 201, { success: true, message: 'Товар успішно додано', data });
    },
  },
  {
    method: 'PUT',
    path: '/api/products/:id',
    handler: async (req, res, { params }) => {
      const data = await products.update(params.id, await readJson(req));
      sendJson(res, 200, { success: true, message: 'Товар успішно оновлено', data });
    },
  },
  {
    method: 'DELETE',
    path: '/api/products/:id',
    handler: async (_req, res, { params }) => {
      await products.remove(params.id);
      sendJson(res, 200, { success: true, message: 'Товар успішно видалено' });
    },
  },
];

module.exports = { productRoutes };
