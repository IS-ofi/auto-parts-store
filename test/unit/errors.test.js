const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const errors = require('../../server/errors');

describe('errors: конструктори доменних помилок', () => {
  const cases = [
    ['validation', errors.validation('m'), 400, 'VALIDATION_ERROR'],
    ['unauthorized', errors.unauthorized('m'), 401, 'UNAUTHORIZED'],
    ['notFound', errors.notFound('m'), 404, 'NOT_FOUND'],
    ['conflict', errors.conflict('EMAIL_TAKEN', 'm'), 409, 'EMAIL_TAKEN'],
  ];
  for (const [name, error, status, code] of cases) {
    it(`${name}: ${status} ${code}`, () => {
      assert.ok(error instanceof errors.AppError);
      assert.ok(error instanceof Error);
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      assert.equal(error.message, 'm');
    });
  }
});

describe('errors.toHttpError', () => {
  it('AppError → його статус, код і повідомлення', () => {
    assert.deepEqual(errors.toHttpError(errors.conflict('X', 'текст')), {
      status: 409,
      code: 'X',
      message: 'текст',
    });
  });

  for (const name of [
    'MongoNetworkError',
    'MongoNetworkTimeoutError',
    'MongoServerSelectionError',
    'MongoTopologyClosedError',
  ]) {
    it(`${name} → 503 без внутрішнього тексту`, () => {
      const error = Object.assign(new Error('connect ECONNREFUSED 10.0.0.5'), { name });
      const out = errors.toHttpError(error);
      assert.equal(out.status, 503);
      assert.equal(out.code, 'DATA_SOURCE_UNAVAILABLE');
      assert.ok(!out.message.includes('ECONNREFUSED'));
    });
  }

  it('інша Mongo-помилка (напр. MongoServerError) НЕ вважається недоступністю → 500', () => {
    const error = Object.assign(new Error('E11000 duplicate key'), { name: 'MongoServerError' });
    assert.equal(errors.toHttpError(error).status, 500);
  });

  it('невідома помилка → 500 і загальний текст, без витоку message', () => {
    const out = errors.toHttpError(new Error('секрет: пароль БД'));
    assert.deepEqual(out, {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal Server Error',
    });
  });

  it('null / undefined / рядок кинуті як throw → 500, без TypeError', () => {
    for (const thrown of [null, undefined, 'boom']) {
      assert.equal(errors.toHttpError(thrown).status, 500);
    }
  });
});
