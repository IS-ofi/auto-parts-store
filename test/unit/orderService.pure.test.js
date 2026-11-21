const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calcTotal, parseItems } = require('../../server/services/orderService');

const ID_A = 'a'.repeat(24);
const ID_B = 'b'.repeat(24);

describe('orderService.calcTotal', () => {
  it('сума price × quantity по позиціях', () => {
    assert.equal(
      calcTotal([
        { price: 100, quantity: 2 },
        { price: 50, quantity: 1 },
      ]),
      250
    );
  });
  it('порожній список → 0', () => {
    assert.equal(calcTotal([]), 0);
  });
  it('похибка float прибирається округленням до копійок (0.1 × 3)', () => {
    assert.equal(calcTotal([{ price: 0.1, quantity: 3 }]), 0.3);
    assert.equal(calcTotal([{ price: 1.005, quantity: 1 }]), 1);
    // 0.29 × 100 = 28.999999999999996: floor дав би 0.28, round — 0.29 (убиває мутант round → floor)
    assert.equal(calcTotal([{ price: 0.29, quantity: 1 }]), 0.29);
  });
  it('множення, а не додавання: 3 × 4 = 12, а не 7', () => {
    assert.equal(calcTotal([{ price: 3, quantity: 4 }]), 12);
  });
});

describe('orderService.parseItems', () => {
  it('нормалізує позиції (id → нижній регістр, quantity-рядок → число)', () => {
    assert.deepEqual(parseItems([{ productId: ID_A.toUpperCase(), quantity: '2' }]), [
      { productId: ID_A, quantity: 2 },
    ]);
  });
  it('не масив / порожній масив → 400', () => {
    for (const bad of [undefined, null, 'x', {}, []]) {
      assert.throws(() => parseItems(bad), { status: 400 });
    }
  });
  it('межа 100 позицій: 100 проходить, 101 — ні', () => {
    const make = (n) =>
      Array.from({ length: n }, (_, i) => ({
        productId: i.toString(16).padStart(24, '0'),
        quantity: 1,
      }));
    assert.equal(parseItems(make(100)).length, 100);
    assert.throws(() => parseItems(make(101)), { status: 400 });
  });
  it('дубль productId (навіть у різному регістрі) → 400', () => {
    assert.throws(
      () =>
        parseItems([
          { productId: ID_A, quantity: 1 },
          { productId: ID_A.toUpperCase(), quantity: 1 },
        ]),
      { status: 400 }
    );
    assert.equal(
      parseItems([
        { productId: ID_A, quantity: 1 },
        { productId: ID_B, quantity: 1 },
      ]).length,
      2
    );
  });
  it('позиція не об’єкт або з quantity < 1 → 400', () => {
    assert.throws(() => parseItems([null]), { status: 400 });
    assert.throws(() => parseItems([{ productId: ID_A, quantity: 0 }]), { status: 400 });
  });
});
