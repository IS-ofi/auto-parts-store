const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

/**
 * Створення замовлення з перевіркою залишків та очищенням кошика (послідовне виконання для standalone MongoDB)
 */
async function getOrdersByUserId(userId) {
  const db = getDb();
  return await db.collection('orders').find({ userId }).toArray();
}

async function updateOrderStatus(orderId, status) {
  const db = getDb();
  const result = await db
    .collection('orders')
    .updateOne({ _id: new ObjectId(orderId) }, { $set: { status, updatedAt: new Date() } });
  return result.modifiedCount > 0;
}
async function createOrder(userId, items) {
  const db = getDb();
  const ordersCollection = db.collection('orders');
  const productsCollection = db.collection('products');
  const cartCollection = db.collection('cart');

  let totalPrice = 0;

  // 1. Перевірка залишків та підрахунок суми
  for (const item of items) {
    const product = await productsCollection.findOne({
      _id: new ObjectId(item.productId),
    });

    if (!product) {
      throw new Error(`Товар з ID ${item.productId} не знайдено`);
    }

    if (product.stock < item.quantity) {
      throw new Error(
        `Недостатньо товару "${product.name}" на складі (доступно: ${product.stock})`
      );
    }

    totalPrice += product.price * item.quantity;
  }

  // 2. Зменшення залишків товарів на складі
  for (const item of items) {
    const updateResult = await productsCollection.updateOne(
      { _id: new ObjectId(item.productId) },
      { $inc: { stock: -item.quantity } }
    );
    console.log(
      `[DB Update] Товар ${item.productId}: змінено документів ->`,
      updateResult.modifiedCount
    );
  }

  // 3. Створення документа замовлення
  const newOrder = {
    userId,
    items,
    totalPrice,
    status: 'CREATED',
    createdAt: new Date(),
  };

  const insertResult = await ordersCollection.insertOne(newOrder);
  const resultOrder = { id: insertResult.insertedId, ...newOrder };

  // 4. Очищення кошика користувача
  await cartCollection.deleteMany({ userId });

  return resultOrder;
}

module.exports = {
  createOrder,
  getOrdersByUserId,
  updateOrderStatus,
};
