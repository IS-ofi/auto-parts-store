const { getDb } = require('../../db');
const { withId, logged } = require('../shared');

const users = () => getDb().collection('users');

function createUserRepository() {
  return {
    findByEmail: (email) =>
      logged('DB', 'users.findByEmail', async () => withId(await users().findOne({ email }))),
    create: (user) =>
      logged('DB', 'users.create', async () => {
        const doc = { ...user };
        await users().insertOne(doc);
        return withId(doc);
      }),
  };
}

module.exports = { createUserRepository };
