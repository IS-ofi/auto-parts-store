const { getDb } = require('../db');

async function findUserByEmail(email) {
  return getDb().collection('users').findOne({ email });
}

async function findUserByCredentials(email, passwordHash) {
  return getDb().collection('users').findOne({ email, password: passwordHash });
}

async function createUser(user) {
  const result = await getDb().collection('users').insertOne(user);
  return result.insertedId;
}

module.exports = { findUserByEmail, findUserByCredentials, createUser };
