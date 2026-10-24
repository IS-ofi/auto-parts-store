const { getDb } = require('../db');
const { getContext } = require('../context');
const crypto = require('crypto');

async function handleAuthRoutes(req, res) {
  const { processId } = getContext();
  const db = getDb();
  const usersCollection = db.collection('users');

  // POST /api/auth/register - Реєстрація користувача
  if (req.url === '/api/auth/register' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const { email, password } = JSON.parse(body || '{}');

    if (!email || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Вкажіть email та password', processId }));
      return true;
    }

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Користувач із таким email вже існує', processId }));
      return true;
    }

    // Зберігаємо користувача (просте хешування або збереження для демонстрації)
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const newUser = { email, password: hashedPassword, createdAt: new Date() };
    const result = await usersCollection.insertOne(newUser);

    console.log(`[${processId}] Зареєстровано нового користувача: ${email}`);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        message: 'Реєстрація успішна',
        userId: result.insertedId,
        processId,
      })
    );
    return true;
  }

  // POST /api/auth/login - Авторизація
  if (req.url === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const { email, password } = JSON.parse(body || '{}');

    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const user = await usersCollection.findOne({ email, password: hashedPassword });

    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Невірний email або пароль', processId }));
      return true;
    }

    console.log(`[${processId}] Успішна авторизація користувача: ${email}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        message: 'Вхід успішний',
        token: 'mock-jwt-token-12345',
        processId,
      })
    );
    return true;
  }

  return false;
}

module.exports = { handleAuthRoutes };
