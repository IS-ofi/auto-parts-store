// "Збірка" для нативного Node.js без транспіляції = перевірка синтаксису всіх JS-файлів.
const { readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOTS = ['server', 'scripts', 'test'];

function collect(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? collect(full) : full.endsWith('.js') ? [full] : [];
  });
}

const files = ROOTS.flatMap(collect);
let failed = 0;
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) {
    failed += 1;
    console.error(`[build] FAIL ${file}\n${r.stderr}`);
  }
}
console.log(`[build] перевірено файлів: ${files.length}, помилок: ${failed}`);
process.exit(failed ? 1 : 0);
