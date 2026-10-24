const http = require('http');
const crypto = require('crypto');
const { initDb } = require('./db');
const { asyncLocalStorage } = require('./context');

const PORT = process.env.PORT || 3000;

// Глобальний обробник неперехоплених відхилень промісів (щоб сервер не падав від асинхронних помилок)
process.on('unhandledRejection', (reason) => {
  const store = asyncLocalStorage.getStore();
  const processId = store ? store.processId : 'GLOBAL-NO-CONTEXT';
  console.error(`[${processId}] ГЛАБАЛЬНА ПОМИЛКА (Unhandled Rejection):`, reason);
});

const server = http.createServer((req, res) => {
  // 1. Генерація унікального business-process ID для цього запиту
  const processId = crypto.randomUUID();

  // 2. Запуск в ізольованому контексті AsyncLocalStorage
  asyncLocalStorage.run({ processId }, () => {
    try {
      console.log(`[${processId}] Вхідний запит: ${req.method} ${req.url}`);

      // Приклад простого роутингу
      if (req.url === '/api/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', processId }));
        return;
      }

      // Приклад симуляції помилки для перевірки глобального обробника
      if (req.url === '/api/error-test') {
        throw new Error('Симульована критична помилка в бізнес-логіці!');
      }

      // Якщо роут не знайдено
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', processId }));
    } catch (error) {
      // 3. Єдиний глобальний обробник помилок всередині запиту
      const store = asyncLocalStorage.getStore();
      const currentProcessId = store ? store.processId : 'UNKNOWN';

      console.error(`[${currentProcessId}] ПОМИЛКА ЗАПИТУ:`, error.message);

      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Internal Server Error',
            message: error.message,
            processId: currentProcessId,
          })
        );
      }
    }
  });
});

// Стартуємо сервер лише після успішної перевірки джерела (Fail-fast)
async function startServer() {
  await initDb(); // Якщо БД "лежить", процес одразу завершиться через process.exit(1)

  server.listen(PORT, () => {
    console.log(`[Server] Сервер успішно запущено на порту ${PORT}`);
  });
}

startServer();
