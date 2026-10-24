const http = require('http');
const crypto = require('crypto');
const { initDb } = require('./db');
const { asyncLocalStorage } = require('./context');
const { handleProductRoutes } = require('./routes/productRoutes');
const { handleOrderRoutes } = require('./routes/orderRoutes');
const { handleAuthRoutes } = require('./routes/authRoutes');

const PORT = process.env.PORT || 3000;

// Глобальний обробник неперехоплених відхилень промісів
process.on('unhandledRejection', (reason) => {
  const store = asyncLocalStorage.getStore();
  const processId = store ? store.processId : 'GLOBAL-NO-CONTEXT';
  console.error(`[${processId}] ГЛОБАЛЬНА ПОМИЛКА (Unhandled Rejection):`, reason);
});

const server = http.createServer(async (req, res) => {
  const processId = crypto.randomUUID();

  // Запуск в ізольованому контексті AsyncLocalStorage
  await asyncLocalStorage.run({ processId }, async () => {
    try {
      console.log(`[${processId}] Вхідний запит: ${req.method} ${req.url}`);

      // 1. Перевірка здоров'я / health-check
      if (req.url === '/api/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', processId }));
        return;
      }

      // 2. Роути каталогу запчастин (працюють з MongoDB)
      const handledProducts = await handleProductRoutes(req, res);
      if (handledProducts) return;
      // 3. Роути замовлень (транзакційні операції з MongoDB)
      const handledOrders = await handleOrderRoutes(req, res);
      if (handledOrders) return;
      const handledAuth = await handleAuthRoutes(req, res);
      if (handledAuth) return;
      // 3. Симуляція помилки для перевірки глобального обробника
      if (req.url === '/api/error-test') {
        throw new Error('Симульована критична помилка в бізнес-логіці!');
      }

      // Якщо роут не знайдено
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', processId }));
    } catch (error) {
      // Єдиний глобальний обробник помилок всередині запиту
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

async function startServer() {
  await initDb(); // Fail-fast перевірка при старті

  server.listen(PORT, () => {
    console.log(`[Server] Сервер успішно запущено на порту ${PORT}`);
  });
}

startServer();
