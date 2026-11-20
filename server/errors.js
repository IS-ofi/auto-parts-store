/** Очікувана (доменна) помилка з HTTP-статусом; усе інше вважається збоєм сервера. */
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

const validation = (message) => new AppError(400, 'VALIDATION_ERROR', message);
const unauthorized = (message) => new AppError(401, 'UNAUTHORIZED', message);
const notFound = (message) => new AppError(404, 'NOT_FOUND', message);
const conflict = (code, message) => new AppError(409, code, message);

const UNAVAILABLE = new Set([
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoServerSelectionError',
  'MongoTopologyClosedError',
]);

/** Єдине місце, що перетворює помилку на HTTP-відповідь (використовує глобальний обробник). */
function toHttpError(error) {
  if (error instanceof AppError) {
    return { status: error.status, code: error.code, message: error.message };
  }
  if (error && UNAVAILABLE.has(error.name)) {
    return { status: 503, code: 'DATA_SOURCE_UNAVAILABLE', message: 'Сховище даних недоступне' };
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: 'Internal Server Error' };
}

module.exports = { AppError, validation, unauthorized, notFound, conflict, toHttpError };
