const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runUntilExit } = require('../helpers/serverProcess');

// Критерій 9 spec: недоступна БД на старті → процес завершується з кодом 1 і не відкриває порт.
// Не потребує БД: порт 1 гарантовано нічого не слухає.
test('fail-fast: недоступна MongoDB → exit 1, без «Сервер запущено»', async () => {
  const { code, output } = await runUntilExit({
    MONGO_URI: 'mongodb://127.0.0.1:1/?directConnection=true',
    DATA_SOURCE: 'mongo',
  });
  assert.equal(code, 1);
  assert.ok(output.includes('Не вдалося запустити сервер'), output);
  assert.ok(!output.includes('Сервер запущено'), output);
});
