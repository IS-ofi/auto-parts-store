const { readJson, sendJson } = require('../http');
const auth = require('../services/authService');

const authRoutes = [
  {
    method: 'POST',
    path: '/api/auth/register',
    handler: async (req, res) => {
      const result = await auth.register(await readJson(req));
      sendJson(res, 201, { success: true, message: 'Реєстрація успішна', ...result });
    },
  },
  {
    method: 'POST',
    path: '/api/auth/login',
    handler: async (req, res) => {
      const result = await auth.login(await readJson(req));
      sendJson(res, 200, { success: true, message: 'Вхід успішний', ...result });
    },
  },
];

module.exports = { authRoutes };
