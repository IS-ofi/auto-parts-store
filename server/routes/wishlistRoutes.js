const { readJson, sendJson } = require('../http');
const wishlist = require('../services/wishlistService');

const wishlistRoutes = [
  {
    method: 'GET',
    path: '/api/wishlist',
    handler: async (_req, res, { query }) => {
      const data = await wishlist.get(query.get('userId') ?? undefined);
      sendJson(res, 200, { success: true, data });
    },
  },
  {
    method: 'POST',
    path: '/api/wishlist',
    handler: async (req, res) => {
      const data = await wishlist.toggle(await readJson(req));
      sendJson(res, 200, { success: true, message: 'Список бажаного оновлено', data });
    },
  },
];

module.exports = { wishlistRoutes };
