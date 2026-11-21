const { test } = require('node:test');
const { defineOrderRepositorySuite } = require('../helpers/orderRepositorySuite');

// Replica set: withTransaction (all-or-nothing, adr5).
if (!process.env.TEST_MONGO_RS_URI) {
  test('integration replica set пропущено: не задано TEST_MONGO_RS_URI (запускайте npm test)', {
    skip: true,
  });
} else {
  defineOrderRepositorySuite('replica set', {
    uri: process.env.TEST_MONGO_RS_URI,
    expectTransactions: true,
  });
}
