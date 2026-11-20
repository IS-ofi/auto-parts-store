const { createUserRepository } = require('./userRepository');
const { createProductRepository } = require('./productRepository');
const { createCartRepository } = require('./cartRepository');
const { createWishlistRepository } = require('./wishlistRepository');
const { createOrderRepository } = require('./orderRepository');

/** Реалізація репозиторіїв на MongoDB: той самий інтерфейс, що й у repositories/memory. */
function createMongoRepositories() {
  return {
    source: 'mongo',
    users: createUserRepository(),
    products: createProductRepository(),
    carts: createCartRepository(),
    wishlists: createWishlistRepository(),
    orders: createOrderRepository(),
  };
}

module.exports = { createMongoRepositories };
