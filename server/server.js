const http = require('http');
const { initDb } = require('./db');
// Тут будуть твої роути та контекст...

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // Логіка обробки запитів...
  res.writeHead(200);
  res.end('AutoParts Hub API');
});

// Спершу підключаємо БД, потім стартуємо сервер
async function startServer() {
  await initDb(); // Якщо тут буде помилка, db.js виконає process.exit(1)

  server.listen(PORT, () => {
    console.log(`[Server] Сервер успішно запущено на порту ${PORT}`);
  });
}

startServer();
