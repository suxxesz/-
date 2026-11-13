-- Профиль жителя (возраст, город, контакты…). Формат проверяет zod-схема
-- src/entities/profile/model/schema.ts, поэтому в базе — одна jsonb-колонка.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile" JSONB NOT NULL DEFAULT '{}';
