const { setInterval, clearInterval } = require('node:timers');
const { spawn } = require('node:child_process');
const net = require('node:net');
const { join } = require('node:path');

const ROOT = join(__dirname, '..', '..');

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

function spawnServer(env) {
  return freePort().then((port) => {
    const child = spawn(process.execPath, ['server/server.js'], {
      cwd: ROOT,
      env: { ...process.env, ...env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const state = { output: '' };
    const collect = (chunk) => {
      state.output += chunk;
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
    return { child, port, state, exited };
  });
}

/** РЎРїСЂР°РІР¶РЅС–Р№ РїСЂРѕС†РµСЃ СЃРµСЂРІРµСЂР° (E2E): С‡РµРєР°С” РЅР° СЂСЏРґРѕРє В«РЎРµСЂРІРµСЂ Р·Р°РїСѓС‰РµРЅРѕВ» Р°Р±Рѕ РїР°РґР°С” Р· РІРёРІРѕРґРѕРј РїСЂРѕС†РµСЃСѓ. */
async function startServer(env, { timeoutMs = 20000 } = {}) {
  const { child, port, state, exited } = await spawnServer(env);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(poll);
      child.kill();
      reject(
        new Error(`СЃРµСЂРІРµСЂ РЅРµ СЃС‚Р°СЂС‚СѓРІР°РІ Р·Р° ${timeoutMs} РјСЃ:\n${state.output}`)
      );
    }, timeoutMs);
    const poll = setInterval(() => {
      if (!state.output.includes('РЎРµСЂРІРµСЂ Р·Р°РїСѓС‰РµРЅРѕ')) return;
      clearTimeout(timer);
      clearInterval(poll);
      resolve();
    }, 50);
    exited.then((code) => {
      clearTimeout(timer);
      clearInterval(poll);
      reject(
        new Error(`СЃРµСЂРІРµСЂ Р·Р°РІРµСЂС€РёРІСЃСЏ Р· РєРѕРґРѕРј ${code}:\n${state.output}`)
      );
    });
  });
  return {
    base: `http://127.0.0.1:${port}`,
    output: () => state.output,
    stop: async () => {
      child.kill('SIGTERM');
      await exited;
    },
  };
}

/** Р—Р°РїСѓСЃРєР°С” СЃРµСЂРІРµСЂ С– С‡РµРєР°С”, РїРѕРєРё РІС–РЅ Р·Р°РІРµСЂС€РёС‚СЊСЃСЏ СЃР°Рј (fail-fast). РџРѕРІРµСЂС‚Р°С” РєРѕРґ С– РІРёРІС–Рґ. */
async function runUntilExit(env, { timeoutMs = 30000 } = {}) {
  const { child, state, exited } = await spawnServer(env);
  const timer = setTimeout(() => child.kill(), timeoutMs);
  const code = await exited;
  clearTimeout(timer);
  return { code, output: state.output };
}

module.exports = { startServer, runUntilExit };
