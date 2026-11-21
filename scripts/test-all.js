// Одна команда: `npm test` -> піднімає реальні процеси mongod (standalone + replica set),
// проганяє unit + інтеграційні + E2E та зупиняє БД. Повторний прогін: `npm test -- --runs 2`.
// Якщо TEST_MONGO_URI і TEST_MONGO_RS_URI вже задані (наприклад, у CI з Docker) — використовує їх.
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { MongoMemoryServer, MongoMemoryReplSet } = require('mongodb-memory-server');

const ROOT = join(__dirname, '..');

function runsFromArgs() {
  const index = process.argv.indexOf('--runs');
  const runs = index === -1 ? 1 : Number(process.argv[index + 1]);
  return Number.isInteger(runs) && runs > 0 ? runs : 1;
}

function runTestProcess(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', 'test/**/*.test.js'], {
      cwd: ROOT,
      env,
      stdio: 'inherit',
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const external = process.env.TEST_MONGO_URI && process.env.TEST_MONGO_RS_URI;
  let standalone = null;
  let replSet = null;
  let exitCode = 0;

  const cleanup = async () => {
    if (replSet) {
      await replSet.stop().catch(() => {});
      replSet = null;
    }
    if (standalone) {
      await standalone.stop().catch(() => {});
      standalone = null;
    }
  };

  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(130);
  });

  try {
    let env = process.env;
    if (!external) {
      console.log('[test-all] Запуск локальних процесів mongod (standalone + replica set)...');
      standalone = await MongoMemoryServer.create();
      replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
      });
      env = {
        ...process.env,
        TEST_MONGO_URI: standalone.getUri(),
        TEST_MONGO_RS_URI: replSet.getUri(),
      };
    }

    for (let run = 1; run <= runsFromArgs(); run += 1) {
      console.log(`\n[test-all] Прогін ${run}`);
      const status = await runTestProcess(env);
      if (status !== 0) {
        exitCode = status;
        break;
      }
    }
  } catch (error) {
    console.error(`[test-all] ${error.message}`);
    exitCode = 1;
  } finally {
    await cleanup();
  }

  process.exit(exitCode);
}

main();
