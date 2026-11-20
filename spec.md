# Spec — AutoParts Hub

> Чернетка для завдання 2: перепишіть власноруч своїми словами (DoD §4). Рішення нижче — ваші, якщо ви з ними згодні; інакше змініть тут, а не в коді.

**Намір.** Бекенд інтернет-магазину автозапчастин: каталог, кошик, обране, замовлення, адмін-CRUD. Стек: нативний Node.js (`http`) і драйвер `mongodb`, без фреймворків (`adr/adr1.md`). Спершу всі сценарії працюють через HTTP API на статичних даних у пам'яті, потім реалізацію репозиторіїв замінено на MongoDB без змін у роутах і сервісах (`adr/adr6.md`).

## Шари та залежності

`routes` (лише HTTP: розбір запиту, статус, JSON) → `services` (бізнес-правила, валідація, що робити при збої) → `repositories` (єдине місце, що знає про сховище; дві реалізації: `memory/` і `mongo/`) → `db.js`.
Заборонено: `routes` → `repositories`/`db.js`/`mongodb`; `services` → `mongodb`/`db.js`; запити й транзакції поза `repositories/mongo`.
Наскрізне без протягування параметрів (`adr/adr4.md`): `context.js` (AsyncLocalStorage: `processId`, `userId`), `logger.js` (кожен рядок містить `processId`), `resources.js` (реєстр: репозиторії обраного джерела даних).

## Сценарії та очікувана поведінка (HTTP)

- `POST /api/auth/register` `{email,password}` → 201 `{userId}`; 400 без полів чи з не-рядками; 409 email зайнятий.
- `POST /api/auth/login` → 200 `{token,userId}`; 400 без email чи password; 401 невірні дані.
- `GET|POST /api/products`, `PUT|DELETE /api/products/:id` → 200/201; 400 (`name` непорожній, `price` > 0, `stock` ціле ≥ 0, `:id` — 24 hex); 404 немає товару.
- `GET /api/cart?userId`, `POST /api/cart` `{userId,productId,quantity ≥ 1}` → 200; 404 товару немає.
- `GET /api/wishlist?userId`, `POST /api/wishlist` `{userId,productId}` (toggle) → 200; 404 товару немає.
- `POST /api/orders` `{userId,items[{productId,quantity}]}`, заголовок `Idempotency-Key` (необов'язковий) → 201; повтор з тим самим ключем → 200 і те саме замовлення (залишки не змінюються вдруге); 404 товару немає; 409 `INSUFFICIENT_STOCK`; 400 порожній `items`/дубль `productId`.
- `GET /api/orders?userId` (обов'язковий → 400), `PATCH /api/orders/:id/status` `{status}` ∈ `CREATED|PROCESSING|SHIPPED|DONE|CANCELLED` → 200; 400; 404.

## Дані та запити (MongoDB, camelCase)

`users{email(unique),password,createdAt}` · `products{name,price,stock,createdAt}` · `carts{userId(unique),items[{productId,quantity}]}` · `wishlists{userId(unique),items[productId]}` · `orders{userId,items[{productId,quantity,price}],totalPrice,status,idempotencyKey?,createdAt}`; унікальний частковий індекс `orders(userId,idempotencyKey)`.
Замовлення — **читання товарів не залежить від числа позицій**: один `find({_id:{$in}})` (N+1 заборонено); списання залишків — умовне (`stock >= quantity`): один `bulkWrite` у транзакції або (standalone) один умовний `updateOne` на позицію без додаткових читань; далі `insertOne` замовлення й `deleteOne` кошика в `carts`.
Консистентність: на replica set — `withTransaction` (залишки + замовлення + кошик атомарно). На standalone — умовні списання й **компенсація** (повернення списаного, якщо щось пішло не так); ідемпотентність — унікальний індекс (`adr/adr5.md`).

## Помилки

- Один глобальний обробник у `server.js`; `try/catch` у роутах/сервісах/репозиторіях немає (виняток — компенсація в `repositories/mongo/orderRepository.js`).
- Доменні помилки (`AppError`: 400/401/404/409) віддають `{error,code,processId}`; некоректний JSON, невірний ObjectId, вхід без пароля → 400, не 500.
- Недоступність БД під час роботи (`MongoNetworkError`, `MongoServerSelectionError`) → 503 `DATA_SOURCE_UNAVAILABLE`; на старті — `exit 1` (fail-fast, `ping`).
- Невідома помилка → 500 `Internal Server Error` без тексту внутрішньої помилки (текст і стек — лише в лог із `processId`).

## Out of scope

Шар `controllers/` (роль виконують `services/`), JWT/сесії (токен-заглушка; `userId` береться із запиту й лише додається в контекст логів), надійне хешування паролів (sha256 тимчасово), перевірка ролей, категорії/`$lookup`.

## Критерії прийняття

1. `npm run lint`, `npm run format:check`, `npm run build` — без помилок.
2. `npm test` проходить усі сценарії вище через HTTP на `memory`-репозиторіях; ті самі сценарії проходять на MongoDB (`TEST_MONGO_URI`, окрема база на прогін).
3. `POST /api/orders` з N позиціями робить рівно 1 читання товарів (тест рахує виклики `products.findByIds`, `findById` — 0).
4. Після замовлення кошик користувача порожній (колекція `carts`); при нестачі залишку 409 і залишки не змінені.
5. Повтор `POST /api/orders` з тим самим `Idempotency-Key` не створює другого замовлення.
6. Некоректний JSON, `:id` не 24 hex, вхід без пароля → 400; тіло 500 не містить тексту внутрішньої помилки.
7. Кожен рядок логу має `processId` (у т.ч. `DB …` та компенсація); тест перехоплює лог і перевіряє це.
8. `routes/` та `services/` не імпортують `db.js`/`mongodb` (`grep -rnE "require\('(\.\./)+db'\)|require\('mongodb'\)" server/routes server/services` → порожньо).
9. Сервер падає на старті (`exit 1`), якщо MongoDB недоступна (`DATA_SOURCE=mongo`).
