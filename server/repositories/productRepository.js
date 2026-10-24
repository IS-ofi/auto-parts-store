const { getDb } = require('../db');

/**
 * Отримати список усіх товарів (запчастин) з бази даних
 */
async function getAllProducts() {
  const db = getDb();
  // Використовуємо реальний виклик до MongoDB колекції products
  const products = await db.collection('products').find({}).toArray();
  return products;
}

module.exports = {
  getAllProducts,
};
