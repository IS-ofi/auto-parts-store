const { getAllProducts } = require('../repositories/productRepository');
const { getContext } = require('../context');

async function handleProductRoutes(req, res) {
  const { processId } = getContext();

  // GET /api/products - Отримання каталогу запчастин з БД
  if (req.url === '/api/products' && req.method === 'GET') {
    console.log(`[${processId}] Отримано запит на каталог запчастин з БД`);

    const products = await getAllProducts();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        count: products.length,
        data: products,
        processId,
      })
    );
    return true; // Маршрут оброблено успішно
  }

  return false; // Маршрут не знайдено в цьому модулі
}

module.exports = {
  handleProductRoutes,
};
