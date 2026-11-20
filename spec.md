# Специфікація — AutoParts Hub

**Мета.** Бекенд інтернет-магазину автозапчастин: каталог товарів, кошик, обране, оформлення замовлень та адмін-керування. Стек: нативний Node.js (`http`) та офіційний драйвер `mongodb` без сторонніх фреймворків (`adr/adr1.md`).

## Модульна структура проєкту

- `server/server.js` — HTTP-сервер, маршрутизація верхнього рівня та глобальний обробник помилок.
- `server/db.js` — підключення до MongoDB (`fail-fast` при недоступності БД).
- `server/context.js` — збереження `processId` запиту через `AsyncLocalStorage` (`adr/adr4.md`).
- `server/routes/*Routes.js` — обробка HTTP-запитів (`authRoutes.js`, `productRoutes.js`, `cartRoutes.js`, `wishlistRoutes.js`, `orderRoutes.js`).
- `server/repositories/*Repository.js` — шар доступу до колекцій MongoDB (`productRepository.js`, `cartRepository.js`, `wishlistRepository.js`, `orderRepository.js`).

## Схема даних (MongoDB)

- `users`: `{ email, passwordHash, createdAt }`
- `products`: `{ name, price, stock, createdAt }`
- `cart`: `{ user_id, items: [{ productId, quantity }] }`
- `wishlists`: `{ user_id, items: [productId] }`
- `orders`: `{ user_id, items, totalAmount, status, createdAt }`

## Поза обсягом (Out of scope)

Окремий шар `controllers/` (логіки поки замало, валідація виконується в роутах), категорії з `$lookup`, повноцінні JWT-сесії та криптографічне хешування паролів (тимчасово використовується заглушка).

## Критерії прийняття

1. `npm run lint` завершується з 0 помилок та попереджень (`--max-warnings 0`).
2. `npm run format:check` підтверджує форматування всіх файлів за Prettier.
3. `npm run build` перевіряє синтаксис усіх `.js` файлів (`node --check`).
4. `npm test` запускає smoke-тест сервера (`GET /api/health` повертає статус `200`).
5. Хук `pre-commit` блокує коміти з помилками лінтера або форматування, а `pre-push` запускає `lint`, `build` і `test`.
