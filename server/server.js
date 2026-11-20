const http = require('http');
const crypto = require('crypto');
const { runWithContext } = require('./context');
const { initResources } = require('./resources');
const { handle } = require('./routes');
const { sendJson } = require('./http');
const { toHttpError } = require('./errors');
const logger = require('./logger');

const PORT = process.env.PORT || 3000;

// Збій поза запитом (контексту немає — processId у логу буде «-»).
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason && reason.stack ? reason.stack : reason}`);
});

const server = http.createServer((req, res) => {
  const processId = crypto.randomUUID();

  // Єдина точка створення контексту: далі processId/userId бачать усі шари й логер.
  return runWithContext({ processId }, async () => {
    logger.info(`Вхідний запит: ${req.method} ${req.url}`);
    try {
      if (!(await handle(req, res))) {
        sendJson(res, 404, { error: 'Not Found', code: 'NOT_FOUND' });
      }
    } catch (error) {
      // Єдиний глобальний обробник помилок: доменні помилки → 4xx, збої сховища → 503, решта → 500.
      const { status, code, message } = toHttpError(error);
      if (status >= 500) logger.error(`Помилка запиту: ${error.stack || error}`);
      else logger.warn(`Запит відхилено (${status} ${code}): ${message}`);
      sendJson(res, status, { error: message, code });
    }
  });
});

function dataSourceFromArgs() {
  return process.argv.includes('--static') ? 'memory' : undefined;
}

async function startServer() {
  await initResources({ dataSource: dataSourceFromArgs() }); // Fail-fast для mongo

  server.listen(PORT, () => {
    logger.info(`[Server] Сервер запущено на порту ${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.error(`Не вдалося запустити сервер: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { server };
