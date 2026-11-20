const { ObjectId } = require('mongodb');
const { getDb } = require('../../db');
const { logged } = require('../shared');

const carts = () => getDb().collection('carts');

const toCart = (userId, doc) => ({
  userId,
  items: ((doc && doc.items) || []).map((i) => ({
    productId: String(i.productId),
    quantity: i.quantity,
  })),
});

function createCartRepository() {
  const getByUserId = async (userId) => toCart(userId, await carts().findOne({ userId }));

  return {
    getByUserId: (userId) => logged('DB', 'carts.getByUserId', () => getByUserId(userId)),
    // Без читання-модифікації-запису: інкремент наявної позиції або додавання нової.
    addItem: (userId, productId, quantity) =>
      logged('DB', 'carts.addItem', async () => {
        const oid = new ObjectId(productId);
        const bumped = await carts().updateOne(
          { userId, 'items.productId': oid },
          { $inc: { 'items.$.quantity': quantity } }
        );
        if (bumped.matchedCount === 0) {
          await carts().updateOne(
            { userId },
            { $push: { items: { productId: oid, quantity } } },
            { upsert: true }
          );
        }
        return getByUserId(userId);
      }),
  };
}

module.exports = { createCartRepository };
