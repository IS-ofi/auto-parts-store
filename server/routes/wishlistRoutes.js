const { getWishlistByUserId, toggleWishlist } = require('../repositories/wishlistRepository');
const { getContext } = require('../context');

async function handleWishlistRoutes(req, res) {
  const { processId } = getContext();

  if (req.url.startsWith('/api/wishlist') && req.method === 'GET') {
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const userId = urlParams.searchParams.get('userId') || 'guest';

    const wishlist = await getWishlistByUserId(userId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: wishlist, processId }));
    return true;
  }

  if (req.url === '/api/wishlist' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const { userId = 'guest', productId } = JSON.parse(body || '{}');

    const updatedWishlist = await toggleWishlist(userId, productId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        message: 'Список бажаного оновлено',
        data: updatedWishlist,
        processId,
      })
    );
    return true;
  }

  return false;
}

module.exports = { handleWishlistRoutes };
