const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

/**
 * Допоміжна функція для отримання поточного business-process ID або ресурсів з контексту
 */
function getContext() {
  return asyncLocalStorage.getStore() || {};
}

module.exports = {
  asyncLocalStorage,
  getContext,
};
