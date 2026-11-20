const { readJson, sendJson } = require('../http');
const orders = require('../services/orderService');

const orderRoutes = [
  {
    method: 'GET',
    path: '/api/orders',
    handler: async (_req, res, { query }) => {
      sendJson(res, 200, { success: true, data: await orders.listByUser(query.get('userId')) });
    },
  },
  {
    method: 'POST',
    path: '/api/orders',
    handler: async (req, res) => {
      const { order, replayed } = await orders.placeOrder(
        await readJson(req),
        req.headers['idempotency-key']
      );
      sendJson(res, replayed ? 200 : 201, {
        success: true,
        message: replayed ? 'Замовлення вже було створено раніше' : 'Замовлення успішно створено',
        replayed,
        data: order,
      });
    },
  },
  {
    method: 'PATCH',
    path: '/api/orders/:id/status',
    handler: async (req, res, { params }) => {
      const data = await orders.updateStatus(params.id, await readJson(req));
      sendJson(res, 200, { success: true, message: 'Статус замовлення оновлено', data });
    },
  },
];

module.exports = { orderRoutes };
