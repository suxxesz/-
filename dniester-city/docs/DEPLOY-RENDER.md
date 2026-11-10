# Хостинг на бесплатном Render (сайт + API + бот + база)

Итог: один бесплатный **Web Service** отдаёт фронтенд и API с одного адреса, бот работает внутри него в режиме **webhook**, данные — в бесплатной **Render Postgres**. Всё описано в `render.yaml` в корне репозитория.

## Что важно знать про бесплатный тариф

Условия Render меняются — перед запуском сверьтесь с https://render.com/pricing.

| Ограничение | Что это значит для «Моего города» | Как живём |
| --- | --- | --- |
| Web Service засыпает после ~15 минут без запросов, просыпается ~30–60 с | Первый заход после паузы долгий | Сообщение в Telegram (webhook) само будит сервис. Чтобы уведомления уходили без задержки, раз в 10 минут пингуйте `/api/health` внешним монитором (например, UptimeRobot). Одного сервиса 24/7 хватает в месячную квоту бесплатных часов |
| Background Worker — только платный | Отдельный процесс `npm run bot` на бесплатном тарифе не запустить | `BOT_MODE=webhook`: бот и очередь уведомлений работают в процессе API |
| Бесплатная Postgres ограничена по сроку жизни и объёму | Для пилота/защиты хватает, для продакшна — нет | Делайте `pg_dump` (ниже); для реального запуска — платный план или свой сервер |
| Файловая система эфемерна, дисков на free нет | Фото и видео жалоб (`UPLOAD_DIR`) пропадут при перезапуске | Для пилота допустимо; для продакшна — внешнее хранилище (S3-совместимое) |

## Шаг 1. Бот в Telegram

1. В @BotFather: `/newbot` → получить **токен**. Если токен где-то засветился — `/revoke` и выпустить новый.
2. Узнать свой числовой Telegram ID (например, у @userinfobot) — он станет `ADMIN_TELEGRAM_IDS`.

## Шаг 2. Развернуть Blueprint

1. Залить репозиторий на GitHub (в корне должен лежать `render.yaml`).
2. Render → **New → Blueprint** → выбрать репозиторий → **Apply**. Создадутся `dniester-city-db` (Postgres) и `dniester-city` (Web Service, `rootDir: dniester-city`).
3. Render спросит значения с `sync: false`:
   - `BOT_TOKEN` — токен из шага 1;
   - `MINI_APP_URL` — адрес сервиса, например `https://dniester-city.onrender.com` (его видно на странице сервиса; можно поставить после первого деплоя и нажать **Manual Deploy**);
   - `ADMIN_TELEGRAM_IDS` — ваш ID, несколько через запятую.
   `SESSION_SECRET` и `INTEGRATION_API_KEY` Render генерирует сам.
4. Сборка: `npm ci --include=dev && npm run build` (генерация Prisma Client, проверка типов, Vite, серверный бандл). Запуск: `npm start` = `prisma migrate deploy` + API. Миграции применяются при каждом старте, повторно — ничего не делают.
5. Готово, когда `https://…onrender.com/api/health` отвечает `{"ok":true}`, а в логах есть строка «Бот: webhook установлен».

## Шаг 3. Подключить Mini App к боту

1. @BotFather → `/mybots` → бот → **Bot Settings → Menu Button** → URL = `MINI_APP_URL`.
2. (По желанию) **Configure Mini App** → тот же URL.
3. Написать боту `/start` — придёт кнопка «Открыть «Мой город»». Вход работает только из Telegram: подписанные данные Telegram проверяются на сервере.

## Шаг 4. Организации и диспетчеры

Первый вход создаёт пользователя; ID из `ADMIN_TELEGRAM_IDS` получает роль администратора. Организации и зоны настраиваются в «Панели диспетчера». Для пакетной настройки — Render → сервис → **Shell**:

```bash
npm run provision -- provision.example.json
```

## Обслуживание

```bash
# резервная копия (External Database URL — на странице базы)
pg_dump "$EXTERNAL_DATABASE_URL" -Fc -f city-$(date +%F).dump
# восстановление в новую базу
pg_restore -d "$NEW_DATABASE_URL" --no-owner city-2026-11-10.dump
```

- Логи: Render → сервис → **Logs**.
- Переезд на платный план или VPS: тот же репозиторий; на VPS удобнее `docker compose --profile pilot` и отдельный процесс бота (`BOT_MODE` пустой) — см. README.
- Перешли с webhook на long polling? Процесс `npm run bot` сам снимает webhook при старте.

## Частые проблемы

| Симптом | Причина | Что сделать |
| --- | --- | --- |
| Бот молчит на `/start` | Нет `BOT_TOKEN`/`MINI_APP_URL` или `MINI_APP_URL` не https | Проверить переменные, в логах должно быть «webhook установлен» |
| «Требуется вход через Telegram» | Сайт открыт в браузере, а не из бота | Открывать кнопкой бота |
| Сборка падает на `prisma generate` | Устаревший кеш сборки | **Manual Deploy → Clear build cache & deploy** |
| `P3005 The database schema is not empty` | База создана старой версией (до Prisma) | Один раз `npm run db:baseline`, затем деплой — см. [MIGRATIONS.md](MIGRATIONS.md) |
| Уведомления приходят с задержкой | Сервис спал | Внешний пинг `/api/health` раз в 10 минут |
