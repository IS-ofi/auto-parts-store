const logger = require('./logger');

let current = null;

/** Реєстр ресурсів: сервіси беруть репозиторії звідси, а не через параметри функцій (adr4). */
function repos() {
  if (!current) throw new Error('Ресурси не ініціалізовано: спершу викличте initResources()');
  return current;
}

function setRepositories(repositories) {
  current = repositories;
}

/**
 * Явна ініціалізація на старті. dataSource: 'memory' (статичний прототип) або 'mongo'.
 * Для mongo — fail-fast: якщо БД недоступна, процес падає ще до відкриття порту.
 */
async function initResources({ dataSource = process.env.DATA_SOURCE || 'mongo', dbName } = {}) {
  if (dataSource === 'mongo') {
    const { initDb } = require('./db');
    const { createMongoRepositories } = require('./repositories/mongo');
    await initDb({ dbName }); // кидає помилку, якщо БД недоступна (server.js завершує процес)
    current = createMongoRepositories();
  } else if (dataSource === 'memory') {
    const { createMemoryRepositories } = require('./repositories/memory');
    const seed = require('./repositories/memory/seed');
    current = createMemoryRepositories(seed);
  } else {
    throw new Error(`Невідоме джерело даних: ${dataSource}`);
  }
  logger.info(`Ресурси ініціалізовано, джерело даних: ${current.source}`);
  return current;
}

async function closeResources() {
  if (current && current.source === 'mongo') await require('./db').closeDb();
  current = null;
}

module.exports = { repos, setRepositories, initResources, closeResources };
