const { defineApiScenarios } = require('./helpers/scenarios');
const { setRepositories } = require('../server/resources');
const { createMemoryRepositories } = require('../server/repositories/memory');

// Етап 1 завдання 2: усі сценарії через HTTP на даних у пам'яті, без БД.
defineApiScenarios('memory', {
  setup: async () => setRepositories(createMemoryRepositories()),
});
