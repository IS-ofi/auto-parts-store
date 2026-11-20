// Статичні дані прототипу (етап «без БД»). Ідентифікатори фіксовані, щоб сценарії були відтворюваними.
const createdAt = new Date('2026-01-01T00:00:00.000Z');

const products = [
  { _id: '000000000000000000000001', name: 'Гальмівні колодки Bosch', price: 1200, stock: 10 },
  { _id: '000000000000000000000002', name: 'Масляний фільтр Mann', price: 350, stock: 25 },
  { _id: '000000000000000000000003', name: 'Свічки запалювання NGK', price: 480, stock: 40 },
  { _id: '000000000000000000000004', name: 'Амортизатор Sachs', price: 2300, stock: 4 },
  { _id: '000000000000000000000005', name: 'Акумулятор Varta 60Ah', price: 3900, stock: 0 },
].map((product) => ({ ...product, createdAt }));

module.exports = { products };
