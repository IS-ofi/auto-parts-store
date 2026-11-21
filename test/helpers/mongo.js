const { MongoClient } = require('mongodb');

/** Унікальна база на файл/прогін: тести не залежать від порядку й від попередніх прогонів. */
const uniqueDbName = (prefix) => `${prefix}_${process.pid}_${Date.now()}`;

/** Окреме з'єднання «збоку» — щоб перевіряти стан БД напряму, поза кодом, що тестується. */
async function openDb(uri, dbName) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  return { db: client.db(dbName), close: () => client.close() };
}

async function dropDatabase(uri, dbName) {
  const { db, close } = await openDb(uri, dbName);
  try {
    await db.dropDatabase();
  } finally {
    await close();
  }
}

module.exports = { uniqueDbName, openDb, dropDatabase };
