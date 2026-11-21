const { test } = require('node:test');

// Ті самі API-сценарії, що й для memory і standalone, але на replica set (шлях withTransaction).
if (!process.env.TEST_MONGO_RS_URI) {
  test('mongo-rs-сценарії пропущено: не задано TEST_MONGO_RS_URI', { skip: true }, () => {});
} else {
  process.env.MONGO_URI = process.env.TEST_MONGO_RS_URI; // до першого require('db.js')
  const { defineApiScenarios } = require('./helpers/scenarios');
  const { initResources, closeResources } = require('../server/resources');

  const dbName = `autoparts_test_rs_${process.pid}_${Date.now()}`;
  let ready = false;

  defineApiScenarios('mongo replica set', {
    setup: async () => {
      if (ready) return;
      await initResources({ dataSource: 'mongo', dbName });
      ready = true;
    },
    teardown: async () => {
      await require('../server/db').getDb().dropDatabase();
      await closeResources();
    },
  });
}
