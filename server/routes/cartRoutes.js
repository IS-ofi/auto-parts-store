const { getCartByUserId, addToCart } = require('../repositories/cartRepository');
const { getContext } = require('../context');

async function handleCartRoutes(req, res) {
  const { processId } = getContext();

  // GET /api/cart?userId=...
  if (req.url.startsWith('/api/cart') && req.method === 'GET') {
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const userId = urlParams.searchParams.get('userId') || 'guest';

    const cart = await getCartByUserId(userId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: cart, processId }));
    return true;
  }

  // POST /api/cart (Додати товар у кошик)
  if (req.url === '/api/cart' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const { userId = 'guest', productId, quantity } = JSON.parse(body || '{}');

    const updatedCart = await addToCart(userId, productId, Number(quantity || 1));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        message: 'Товар додано до кошика',
        data: updatedCart,
        processId,
      })
    );
    return true;
  }

  return false;
}

module.exports = { handleCartRoutes };
