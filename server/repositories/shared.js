const crypto = require('crypto');
const logger = require('../logger');

const newId = () => crypto.randomBytes(12).toString('hex');

/** Єдиний вигляд сутності назовні: _id і id — рядок із 24 hex (однаково для memory і mongo). */
function withId(doc) {
  if (!doc) return null;
  const { _id, id, ...rest } = doc;
  const hex = String(_id ?? id);
  return { _id: hex, id: hex, ...rest };
}

/**
 * Обгортка для кожної операції зі сховищем: пише в лог (із processId з контексту)
 * назву операції, результат і тривалість. Усі репозиторії викликають сховище лише через неї.
 */
async function logged(source, op, fn, summarize = () => undefined) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    logger.info(`${source} ${op} ok (${Date.now() - startedAt}ms)`, summarize(result));
    return result;
  } catch (error) {
    logger.error(`${source} ${op} failed (${Date.now() - startedAt}ms): ${error.message}`);
    throw error;
  }
}

module.exports = { newId, withId, logged };
