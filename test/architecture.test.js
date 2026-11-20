const { it } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const SERVER = join(__dirname, '..', 'server');

const jsFiles = (dir) => readdirSync(join(SERVER, dir)).filter((f) => f.endsWith('.js'));
const requires = (dir, file) =>
  [...readFileSync(join(SERVER, dir, file), 'utf8').matchAll(/require\('([^']+)'\)/g)].map(
    (m) => m[1]
  );

// Критерій 8 spec: межі шарів перевіряються тестом, а не словами в DEFENSE.
it('routes не знають про сервіси нижче й сховище; services — про БД і драйвер', () => {
  for (const file of jsFiles('routes')) {
    for (const dep of requires('routes', file)) {
      assert.ok(
        !/(^|\/)(db|repositories|resources)(\/|$)|^mongodb$/.test(dep),
        `routes/${file} імпортує ${dep}`
      );
    }
  }
  for (const file of jsFiles('services')) {
    for (const dep of requires('services', file)) {
      assert.ok(!/(^|\/)db$|^mongodb$|repositories/.test(dep), `services/${file} імпортує ${dep}`);
    }
  }
});
