const { ObjectId } = require('mongodb');
const { getDb } = require('../../db');
const { withId, logged } = require('../shared');

const products = () => getDb().collection('products');

function createProductRepository() {
  return {
    list: () =>
      logged(
        'DB',
        'products.list',
        async () => (await products().find({}).toArray()).map(withId),
        (rows) => ({ count: rows.length })
      ),
    findById: (id) =>
      logged('DB', 'products.findById', async () =>
        withId(await products().findOne({ _id: new ObjectId(id) }))
      ),
    // Один запит на будь-яку кількість id (проти N+1 при оформленні замовлення).
    findByIds: (ids) =>
      logged(
        'DB',
        'products.findByIds',
        async () => {
          const rows = await products()
            .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } })
            .toArray();
          return rows.map(withId);
        },
        (rows) => ({ requested: ids.length, found: rows.length })
      ),
    create: ({ name, price, stock }) =>
      logged('DB', 'products.create', async () => {
        const doc = { name, price, stock, createdAt: new Date() };
        await products().insertOne(doc);
        return withId(doc);
      }),
    update: (id, patch) =>
      logged('DB', 'products.update', async () =>
        withId(
          await products().findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: { ...patch, updatedAt: new Date() } },
            { returnDocument: 'after' }
          )
        )
      ),
    remove: (id) =>
      logged(
        'DB',
        'products.remove',
        async () => (await products().deleteOne({ _id: new ObjectId(id) })).deletedCount > 0
      ),
  };
}

module.exports = { createProductRepository };
