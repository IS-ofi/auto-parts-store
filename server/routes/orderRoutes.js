const { createOrder } = require('../repositories/orderRepository');
const { getContext } = require('../context');

async function handleOrderRoutes(req, res) {
  const { processId } = getContext();

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
