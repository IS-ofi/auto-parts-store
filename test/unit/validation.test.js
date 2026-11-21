const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../../server/validation');
const { AppError } = require('../../server/errors');

// Чисті функції: вхід → вихід або AppError(400). Без мережі, часу, випадковості.
const rejects = (fn, field) => {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof AppError, `очікувався AppError, отримано ${error}`);
    assert.equal(error.status, 400);
    assert.equal(error.code, 'VALIDATION_ERROR');
    if (field) assert.ok(error.message.includes(field), error.message);
    return;
  }
  assert.fail('очікувалась помилка валідації');
};

describe('validation.str', () => {
  it('повертає рядок як є (без trim)', () => {
    assert.equal(v.str(' a ', 'name'), ' a ');
  });
  it('відхиляє не-рядки', () => {
    for (const bad of [undefined, null, 1, true, {}, []]) rejects(() => v.str(bad, 'name'), 'name');
  });
  it('відхиляє порожній і суто пробільний рядок', () => {
    rejects(() => v.str('', 'name'));
    rejects(() => v.str('   ', 'name'));
  });
  it('межа довжини: рівно max проходить, max+1 — ні (дефолт 200)', () => {
    assert.equal(v.str('a'.repeat(200), 'f').length, 200);
    rejects(() => v.str('a'.repeat(201), 'f'));
  });
  it('власний max і його значення в повідомленні', () => {
    assert.equal(v.str('abc', 'f', { max: 3 }), 'abc');
    rejects(() => v.str('abcd', 'f', { max: 3 }), '3');
  });
});

describe('validation.email', () => {
  it('приймає коректний email', () => {
    assert.equal(v.email('a@b.co'), 'a@b.co');
  });
  it('відхиляє: без @, без домену після @, без крапки, з пробілом, не рядок', () => {
    for (const bad of [
      'abc',
      'a@',
      '@b.co',
      'a@b',
      'a b@c.de',
      'a@b .de',
      'a@b.co x',
      'a@@b.co',
      '',
      null,
      5,
    ]) {
      rejects(() => v.email(bad), 'email');
    }
  });
});

describe('validation.id', () => {
  const HEX = 'abcdef0123456789abcdef01';
  it('приймає 24 hex і нормалізує до нижнього регістру', () => {
    assert.equal(v.id(HEX, 'id'), HEX);
    assert.equal(v.id(HEX.toUpperCase(), 'id'), HEX);
  });
  it('відхиляє: 23/25 символів, не-hex, з пробілами навколо, не рядок', () => {
    for (const bad of [
      HEX.slice(1),
      HEX + '0',
      'g' + HEX.slice(1),
      ` ${HEX}`,
      `${HEX}\n`,
      12,
      null,
    ]) {
      rejects(() => v.id(bad, 'productId'), 'productId');
    }
  });
});

describe('validation.positiveNumber', () => {
  it('приймає додатні числа, у т.ч. дробові', () => {
    assert.equal(v.positiveNumber(0.01, 'price'), 0.01);
    assert.equal(v.positiveNumber(100, 'price'), 100);
  });
  it('форми клієнта: числовий рядок перетворюється на число', () => {
    assert.equal(v.positiveNumber('100', 'price'), 100);
    assert.equal(v.positiveNumber(' 2.5 ', 'price'), 2.5);
  });
  it('відхиляє 0, від’ємні, NaN, Infinity, нечислові рядки, порожній рядок, null, boolean', () => {
    for (const bad of [0, -1, NaN, Infinity, 'abc', '', '  ', '0', '-5', null, undefined, true]) {
      rejects(() => v.positiveNumber(bad, 'price'), 'price');
    }
  });
});

describe('validation.nonNegativeInt', () => {
  it('приймає 0 і цілі додатні, також числові рядки', () => {
    assert.equal(v.nonNegativeInt(0, 'stock'), 0);
    assert.equal(v.nonNegativeInt(7, 'stock'), 7);
    assert.equal(v.nonNegativeInt('5', 'stock'), 5);
  });
  it('відхиляє від’ємні, дробові, нечислові, порожній рядок', () => {
    for (const bad of [-1, 1.5, '1.5', 'x', '', undefined, null, NaN]) {
      rejects(() => v.nonNegativeInt(bad, 'stock'), 'stock');
    }
  });
});

describe('validation.positiveInt', () => {
  it('приймає 1 і більше, також числові рядки', () => {
    assert.equal(v.positiveInt(1, 'quantity'), 1);
    assert.equal(v.positiveInt('3', 'quantity'), 3);
  });
  it('відхиляє 0, від’ємні, дробові, нечислові', () => {
    for (const bad of [0, -2, 0.5, 1.5, 'a', '', undefined, null]) {
      rejects(() => v.positiveInt(bad, 'quantity'), 'quantity');
    }
  });
});

describe('validation.object', () => {
  it('приймає звичайний об’єкт (також порожній) і повертає той самий', () => {
    const body = {};
    assert.equal(v.object(body), body);
  });
  it('відхиляє null, масив, рядок, число, undefined', () => {
    for (const bad of [null, [], 'x', 1, undefined]) rejects(() => v.object(bad));
  });
  it('назва поля потрапляє в повідомлення; дефолт — «тіло запиту»', () => {
    rejects(() => v.object(null), 'тіло запиту');
    rejects(() => v.object(null, 'позиція'), 'позиція');
  });
});
