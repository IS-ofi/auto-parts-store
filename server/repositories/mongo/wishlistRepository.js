const { ObjectId } = require('mongodb');
const { getDb } = require('../../db');
const { logged } = require('../shared');

const wishlists = () => getDb().collection('wishlists');

const toWishlist = (userId, doc) => ({
  userId,
  items: ((doc && doc.items) || []).map(String),
});

function createWishlistRepository() {
  const getByUserId = async (userId) => toWishlist(userId, await wishlists().findOne({ userId }));

  return {
    getByUserId: (userId) => logged('DB', 'wishlists.getByUserId', () => getByUserId(userId)),
    toggle: (userId, productId) =>
      logged('DB', 'wishlists.toggle', async () => {
        const oid = new ObjectId(productId);
        const removed = await wishlists().updateOne(
          { userId, items: oid },
          { $pull: { items: oid } }
        );
        if (removed.matchedCount === 0) {
          await wishlists().updateOne({ userId }, { $addToSet: { items: oid } }, { upsert: true });
        }
        return getByUserId(userId);
      }),
  };
}

module.exports = { createWishlistRepository };
