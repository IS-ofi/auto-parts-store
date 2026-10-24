const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

async function getCartByUserId(userId) {
  const db = getDb();
  return (await db.collection('carts').findOne({ userId })) || { userId, items: [] };
}

async function addToCart(userId, productId, quantity = 1) {
  const db = getDb();
  let cart = await db.collection('carts').findOne({ userId });

  if (!cart) {
    cart = { userId, items: [{ productId: new ObjectId(productId), quantity }] };
    await db.collection('carts').insertOne(cart);
  } else {
    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ productId: new ObjectId(productId), quantity });
    }
    await db.collection('carts').updateOne({ userId }, { $set: { items: cart.items } });
  }
  return cart;
}

module.exports = { getCartByUserId, addToCart };
