const { MongoClient } = require('mongodb');
const logger = require('./logger');

// URL для локальної БД; у реальному проєкті — із process.env.MONGO_URI.
const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const defaultDbName = process.env.DB_NAME || 'autoparts_store';

// Єдиний клієнт (пул з'єднань вбудований у драйвер). Короткий таймаут вибору сервера:
// недоступна БД має давати помилку за секунди, а не підвішувати запит на 30 с.
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
let dbInstance = null;
let transactions = false;

// Без credentials у логах.
const safeUri = () => uri.replace(/\/\/[^@/]*@/, '//***@');

async function ensureIndexes(db) {
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('carts').createIndex({ userId: 1 }, { unique: true });
  await db.collection('wishlists').createIndex({ userId: 1 }, { unique: true });
  await db.collection('orders').createIndex({ userId: 1, createdAt: -1 });
  // Ідемпотентність: один ключ — одне замовлення користувача (лише для замовлень із ключем).
  await db
    .collection('orders')
    .createIndex(
      { userId: 1, idempotencyKey: 1 },
      { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
    );
}

/**
 * Явна ініціалізація на старті (fail-fast): підключення + ping + визначення, чи підтримуються
 * транзакції (replica set / mongos). Кидає помилку — процес завершує server.js з кодом 1.
 */
async function initDb({ dbName = defaultDbName } = {}) {
  logger.info(`DB підключення до ${safeUri()}`);
  await client.connect();
  dbInstance = client.db(dbName);
  await dbInstance.command({ ping: 1 });
  const hello = await dbInstance.command({ hello: 1 });
  transactions = Boolean(hello.setName) || hello.msg === 'isdbgrid';
  await ensureIndexes(dbInstance);
  logger.info(`DB готова: ${dbName} (ping OK, транзакції: ${transactions ? 'так' : 'ні'})`);
}

/** Екземпляр БД — лише для репозиторіїв (mongo). */
function getDb() {
  if (!dbInstance) {
    throw new Error('[DB] Базу даних не ініціалізовано! Спочатку викличте initDb().');
  }
  return dbInstance;
}

const getClient = () => client;
const supportsTransactions = () => transactions;

async function closeDb() {
  dbInstance = null;
  await client.close();
}

module.exports = { initDb, getDb, getClient, supportsTransactions, closeDb };
