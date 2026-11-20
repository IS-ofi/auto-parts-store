const { readJson, sendJson } = require('../http');
const cart = require('../services/cartService');

const cartRoutes = [
  {
    method: 'GET',
    path: '/api/cart',
    handler: async (_req, res, { query }) => {
      sendJson(res, 200, { success: true, data: await cart.get(query.get('userId') ?? undefined) });
    },
  },
  {
    method: 'POST',
    path: '/api/cart',
    handler: async (req, res) => {
      const data = await cart.addItem(await readJson(req));
      sendJson(res, 200, { success: true, message: 'Товар додано до кошика', data });
    },
  },
];

module.exports = { cartRoutes };
