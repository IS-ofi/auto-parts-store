const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
/**
 * Отримати список усіх товарів (запчастин) з бази даних
 */
async function getAllProducts() {
  const db = getDb();
  // Використовуємо реальний виклик до MongoDB колекції products
  const products = await db.collection('products').find({}).toArray();
  return products;
}

async function createProduct(productData) {
  const db = getDb();
  const result = await db.collection('products').insertOne({
    name: productData.name,
    price: Number(productData.price),
    stock: Number(productData.stock || 0),
    createdAt: new Date(),
  });
  return { id: result.insertedId, ...productData };
}
/**
 * Оновлення товару за ID (Update)
 */
async function updateProduct(id, updateData) {
  const db = getDb();
  const result = await db
    .collection('products')
    .updateOne({ _id: new ObjectId(id) }, { $set: updateData });
  return result.modifiedCount > 0;
}

/**
 * Видалення товару за ID (Delete)
 */
async function deleteProduct(id) {
  const db = getDb();
  const result = await db.collection('products').deleteOne({
    _id: new ObjectId(id),
  });
  return result.deletedCount > 0;
}

module.exports = {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};
