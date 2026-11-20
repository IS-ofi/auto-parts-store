const { createRouter, sendJson } = require('../http');
const { authRoutes } = require('./authRoutes');
const { productRoutes } = require('./productRoutes');
const { cartRoutes } = require('./cartRoutes');
const { wishlistRoutes } = require('./wishlistRoutes');
const { orderRoutes } = require('./orderRoutes');
const { getContext } = require('../context');

const systemRoutes = [
  {
    method: 'GET',
    path: '/api/health',
    handler: async (_req, res) => sendJson(res, 200, { status: 'ok' }),
  },
  {
    // Навмисна помилка, щоб перевіряти глобальний обробник (відповідь 500 без внутрішнього тексту).
    method: 'GET',
    path: '/api/error-test',
    handler: async () => {
      throw new Error(`Симульована критична помилка (${getContext().processId})`);
    },
  },
];

const handle = createRouter([
  ...systemRoutes,
  ...productRoutes,
  ...orderRoutes,
  ...authRoutes,
  ...cartRoutes,
  ...wishlistRoutes,
]);

module.exports = { handle };
