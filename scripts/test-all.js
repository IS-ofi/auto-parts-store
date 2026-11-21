// Одна команда: `npm test` → піднімає MongoDB (standalone + replica set) у Docker, проганяє
// unit + інтеграційні + E2E, завжди прибирає контейнери. Повторний прогін: `npm test -- --runs 2`.
// Якщо TEST_MONGO_URI і TEST_MONGO_RS_URI вже задані (CI із service-контейнерами) — Docker не чіпаємо.
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const COMPOSE = ['compose', '-p', 'autoparts-test', '-f', join(ROOT, 'docker-compose.test.yml')];
const docker = (args, options = {}) =>
  spawnSync('docker', [...COMPOSE, ...args], { encoding: 'utf8', ...options });

// Ctrl+C зупиняє дочірній node --test, а ми все одно встигаємо прибрати контейнери.
process.on('SIGINT', () => {});

function uriFor(service) {
  const result = docker(['port', service, '27017']);
  const match = /:(\d+)\s*$/.exec((result.stdout || '').trim().split('\n')[0]);
  if (result.status !== 0 || !match) {
    throw new Error(`Не вдалося отримати порт сервісу ${service}: ${result.stderr}`);
  }
  // directConnection: одновузловий replica set оголошує host `localhost:27017`, який недосяжний ззовні.
  return `mongodb://127.0.0.1:${match[1]}/?directConnection=true`;
}

function runsFromArgs() {
  const index = process.argv.indexOf('--runs');
  const runs = index === -1 ? 1 : Number(process.argv[index + 1]);
  return Number.isInteger(runs) && runs > 0 ? runs : 1;
}

function main() {
  const external = process.env.TEST_MONGO_URI && process.env.TEST_MONGO_RS_URI;
  let started = false;
  let exitCode = 0;
  try {
    let env = process.env;
    if (!external) {
      started = true;
      const up = docker(['up', '-d', '--wait'], { stdio: 'inherit' });
      if (up.status !== 0) throw new Error('docker compose up --wait завершився з помилкою');
      env = {
        ...process.env,
        TEST_MONGO_URI: uriFor('mongo'),
        TEST_MONGO_RS_URI: uriFor('mongo-rs'),
      };
    }
    for (let run = 1; run <= runsFromArgs(); run += 1) {
      console.log(`\n[test-all] прогін ${run}`);
      const result = spawnSync(process.execPath, ['--test', 'test/**/*.test.js'], {
        cwd: ROOT,
        env,
        stdio: 'inherit',
      });
      if (result.status !== 0) {
        exitCode = result.status || 1;
        break;
      }
    }
  } catch (error) {
    console.error(`[test-all] ${error.message}`);
    exitCode = 1;
  } finally {
    if (started) docker(['down', '-v', '--remove-orphans'], { stdio: 'inherit' });
  }
  process.exit(exitCode);
}

main();
