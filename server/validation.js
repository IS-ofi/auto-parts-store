const { validation } = require('./errors');

const ID_RE = /^[0-9a-f]{24}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value, field, { max = 200 } = {}) {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw validation(`Поле ${field} має бути непорожнім рядком (до ${max} символів)`);
  }
  return value;
}

function email(value) {
  if (typeof value !== 'string' || !EMAIL_RE.test(value)) {
    throw validation('Вкажіть коректний email');
  }
  return value;
}

function id(value, field) {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    throw validation(`Поле ${field} має бути ідентифікатором із 24 hex-символів`);
  }
  return value.toLowerCase();
}

// Форми клієнта можуть надсилати числа рядками ("100") — приймаємо їх, решту відхиляємо.
const num = (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value);

function positiveNumber(raw, field) {
  const value = num(raw);
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw validation(`Поле ${field} має бути числом більше 0`);
  }
  return value;
}

function nonNegativeInt(raw, field) {
  const value = num(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw validation(`Поле ${field} має бути цілим числом, не меншим за 0`);
  }
  return value;
}

function positiveInt(raw, field) {
  const value = num(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw validation(`Поле ${field} має бути цілим числом, не меншим за 1`);
  }
  return value;
}

function object(value, field = 'тіло запиту') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw validation(`${field} має бути JSON-об'єктом`);
  }
  return value;
}

module.exports = { str, email, id, positiveNumber, nonNegativeInt, positiveInt, object };
