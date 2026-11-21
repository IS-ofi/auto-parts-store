const { test } = require('node:test');
const { defineE2eSuite } = require('../helpers/e2eSuite');

if (!process.env.TEST_MONGO_URI) {
  test('e2e standalone пропущено: не задано TEST_MONGO_URI (запускайте npm test)', { skip: true });
} else {
  defineE2eSuite('standalone', { uri: process.env.TEST_MONGO_URI, expectTransactions: false });
}
