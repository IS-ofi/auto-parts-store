const { createOrder } = require('../repositories/orderRepository');
const { getContext } = require('../context');
const { getOrdersByUserId, updateOrderStatus } = require('../repositories/orderRepository');

async function handleOrderRoutes(req, res) {
  const { processId } = getContext();
  // GET /api/orders?userId=... (Історія замовлень)
  if (req.url.startsWith('/api/orders') && req.method === 'GET') {
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const userId = urlParams.searchParams.get('userId');

    const orders = await getOrdersByUserId(userId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: orders, processId }));
    return true;
  }

  // PATCH /api/orders/:id/status (Адмін: зміна статусу)
  if (req.url.startsWith('/api/orders/') && req.url.includes('/status') && req.method === 'PATCH') {
    const id = req.url.split('/')[3];
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const { status } = JSON.parse(body || '{}');

    const success = await updateOrderStatus(id, status);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success,
        message: success ? 'Статус замовлення оновлено' : 'Замовлення не знайдено',
        processId,
      })
    );
    return true;
  }
  // POST /api/orders - Створення нового замовлення
  if (req.url === '/api/orders' && req.method === 'POST') {
    let body = '';

    for await (const chunk of req) {
      body += chunk;
    }

    const data = JSON.parse(body || '{}');
    const { userId, items } = data;

    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Некоректні дані замовлення (потрібні userId та масив items)',
          processId,
        })
      );
      return true;
    }

    console.log(`[${processId}] Створення замовлення для користувача: ${userId}`);
    const order = await createOrder(userId, items);

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        message: 'Замовлення успішно створено',
        data: order,
        processId,
      })
    );
    return true;
  }

  return false;
}

module.exports = {
  handleOrderRoutes,
};
