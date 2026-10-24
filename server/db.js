const { MongoClient } = require('mongodb');

// URL для локальної БД. У реальному проєкті краще брати з process.env.MONGO_URI
const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'autoparts_store';

// Створюємо єдиний екземпляр клієнта (Connection Pool за замовчуванням вбудований у нативний драйвер)
const client = new MongoClient(uri);
let dbInstance;

/**
 * Ініціалізація підключення до БД.
 * Має викликатися один раз при старті сервера.
 */
async function initDb() {
  try {
    console.log(`[DB] Спроба підключення до MongoDB за адресою: ${uri}`);

    // Підключаємося до сервера бази даних
    await client.connect();
    dbInstance = client.db(dbName);

    // Вимога Fail-fast: перевіряємо, чи база реально відповідає
    await dbInstance.command({ ping: 1 });

    console.log(`[DB] Успішно підключено до бази даних: ${dbName} (Ping OK)`);
  } catch (error) {
    console.error('[DB] КРИТИЧНА ПОМИЛКА: Збій підключення до бази даних.', error.message);
    // Якщо база недоступна — падаємо одразу (відповідно до вимог Завдання 2)
    process.exit(1);
  }
}

/**
 * Отримання екземпляра бази даних для використання в репозиторіях (DAO).
 */
function getDb() {
  if (!dbInstance) {
    throw new Error('[DB] Базу даних не ініціалізовано! Спочатку викличте initDb().');
  }
  return dbInstance;
}

module.exports = {
  initDb,
  getDb,
  client, // Експортуємо клієнта для коректного закриття з'єднання (graceful shutdown), якщо знадобиться
};
