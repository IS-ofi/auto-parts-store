const { test } = require('node:test');
const { defineE2eSuite } = require('../helpers/e2eSuite');

if (!process.env.TEST_MONGO_RS_URI) {
  test('e2e replica set пропущено: не задано TEST_MONGO_RS_URI (запускайте npm test)', {
    skip: true,
  });
} else {
  defineE2eSuite('replica set', { uri: process.env.TEST_MONGO_RS_URI, expectTransactions: true });
}
