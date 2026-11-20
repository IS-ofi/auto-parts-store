const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

/**
 * Запускає fn в ізольованому контексті запиту (processId, userId).
 * Єдине місце, де контекст створюється: server.js на вході HTTP-запиту.
 */
function runWithContext(initial, fn) {
  return asyncLocalStorage.run({ ...initial }, fn);
}

/** Поточний контекст: { processId, userId? } або {} поза запитом. */
function getContext() {
  return asyncLocalStorage.getStore() || {};
}

/** Фіксує користувача-ініціатора, щойно він відомий із запиту. */
function setUser(userId) {
  const store = asyncLocalStorage.getStore();
  if (store && userId) store.userId = String(userId);
}

module.exports = {
  asyncLocalStorage,
  runWithContext,
  getContext,
  setUser,
};
