const {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../repositories/productRepository');
const { getContext } = require('../context');

async function handleProductRoutes(req, res) {
  const { processId } = getContext();

  // GET /api/products - Отримання каталогу запчастин з БД (Read)
  if (req.url === '/api/products' && req.method === 'GET') {
    console.log(`[${processId}] Отримано запит на каталог запчастин з БД`);
    const products = await getAllProducts();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: products.length, data: products, processId }));
    return true;
  }

  // POST /api/products - Додавання нового товару (Create)
  if (req.url === '/api/products' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const productData = JSON.parse(body || '{}');

    if (!productData.name || !productData.price) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Потрібно вказати name та price товару', processId }));
      return true;
    }

    console.log(`[${processId}] Створення нового товару в каталозі:`, productData.name);
    const newProduct = await createProduct(productData);

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        message: 'Товар успішно додано',
        data: newProduct,
        processId,
      })
    );
    return true;
  }

  // PUT /api/products/:id - Оновлення товару (Update)
  if (req.url.startsWith('/api/products/') && req.method === 'PUT') {
    const id = req.url.split('/')[3];
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const updateData = JSON.parse(body || '{}');

    console.log(`[${processId}] Оновлення товару ID: ${id}`);
    const success = await updateProduct(id, updateData);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success,
        message: success ? 'Товар успішно оновлено' : 'Товар не знайдено',
        processId,
      })
    );
    return true;
  }

  // DELETE /api/products/:id - Видалення товару (Delete)
  if (req.url.startsWith('/api/products/') && req.method === 'DELETE') {
    const id = req.url.split('/')[3];

    console.log(`[${processId}] Видалення товару ID: ${id}`);
    const success = await deleteProduct(id);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success,
        message: success ? 'Товар успішно видалено' : 'Товар не знайдено',
        processId,
      })
    );
    return true;
  }

  return false;
}

module.exports = { handleProductRoutes };
