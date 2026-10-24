const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

async function getWishlistByUserId(userId) {
  const db = getDb();
  return (await db.collection('wishlists').findOne({ userId })) || { userId, items: [] };
}

async function toggleWishlist(userId, productId) {
  const db = getDb();
  let wishlist = await db.collection('wishlists').findOne({ userId });
  const prodObjId = new ObjectId(productId);

  if (!wishlist) {
    wishlist = { userId, items: [prodObjId] };
    await db.collection('wishlists').insertOne(wishlist);
  } else {
    const exists = wishlist.items.some((id) => id.toString() === productId);
    if (exists) {
      wishlist.items = wishlist.items.filter((id) => id.toString() !== productId);
    } else {
      wishlist.items.push(prodObjId);
    }
    await db.collection('wishlists').updateOne({ userId }, { $set: { items: wishlist.items } });
  }
  return wishlist;
}

module.exports = { getWishlistByUserId, toggleWishlist };
