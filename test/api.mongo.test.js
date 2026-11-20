const { test } = require('node:test');

// Етап 2 завдання 2: ті самі сценарії на справжній MongoDB. Запуск:
//   TEST_MONGO_URI=mongodb://127.0.0.1:27018 npm test
// (окрема база на прогін, після прогону видаляється; без змінної тест пропускається).
if (!process.env.TEST_MONGO_URI) {
  test('mongo-сценарії пропущено: не задано TEST_MONGO_URI', { skip: true }, () => {});
} else {
  process.env.MONGO_URI = process.env.TEST_MONGO_URI; // до першого require('db.js')
  const { defineApiScenarios } = require('./helpers/scenarios');
  const { initResources, closeResources } = require('../server/resources');

  const dbName = `autoparts_test_${Date.now()}`;
  let ready = false;

  defineApiScenarios('mongo', {
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
