const crypto = require('crypto');
const { repos } = require('../resources');
const { setUser } = require('../context');
const { conflict, unauthorized } = require('../errors');
const logger = require('../logger');
const v = require('../validation');

// Тимчасово (out of scope у spec): sha256 без солі й токен-заглушка.
const hash = (password) => crypto.createHash('sha256').update(password).digest('hex');
const MOCK_TOKEN = 'mock-jwt-token-12345';

async function register(body) {
  v.object(body);
  const email = v.email(body.email);
  const password = v.str(body.password, 'password');

  if (await repos().users.findByEmail(email)) {
    throw conflict('EMAIL_TAKEN', 'Користувач із таким email вже існує');
  }
  const user = await repos().users.create({
    email,
    password: hash(password),
    createdAt: new Date(),
  });
  setUser(user.id);
  logger.info('Зареєстровано нового користувача');
  return { userId: user.id };
}

async function login(body) {
  v.object(body);
  const email = v.str(body.email, 'email');
  const password = v.str(body.password, 'password');

  const user = await repos().users.findByEmail(email);
  const expected = Buffer.from(user ? user.password : hash(crypto.randomUUID()));
  const actual = Buffer.from(hash(password));
  if (!user || !crypto.timingSafeEqual(expected, actual)) {
    throw unauthorized('Невірний email або пароль');
  }
  setUser(user.id);
  logger.info('Успішна авторизація');
  return { token: MOCK_TOKEN, userId: user.id };
}

module.exports = { register, login };
