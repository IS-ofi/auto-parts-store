const { test } = require('node:test');
const { defineOrderRepositorySuite } = require('../helpers/orderRepositorySuite');

// Standalone MongoDB: транзакцій немає → умовні списання + компенсація (adr5).
if (!process.env.TEST_MONGO_URI) {
  test('integration standalone пропущено: не задано TEST_MONGO_URI (запускайте npm test)', {
    skip: true,
  });
} else {
  defineOrderRepositorySuite('standalone', {
    uri: process.env.TEST_MONGO_URI,
    expectTransactions: false,
  });
}
