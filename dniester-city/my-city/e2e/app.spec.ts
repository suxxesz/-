import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
test('resident submits reading and ticket, dispatcher processes request, data persists', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.getByRole('heading', { name: 'Ваш дом. Всё под контролем.' })).toBeVisible();
  await page.getByRole('button', { name: 'Передать показания Вода, свет и газ' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.locator('select[name=category]').selectOption('water');
  await dialog.locator('input[name=value]').fill('190');
  await dialog.getByRole('button', { name: 'Подтвердить и сохранить' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Показания счётчиков', exact: true }).click();
  await expect(page.getByRole('cell', { name: '190', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Передать показания', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('select[name=category]').selectOption('water');
  await dialog.locator('input[name=value]').fill('191');
  await dialog.getByRole('button', { name: 'Подтвердить и сохранить' }).click();
  await expect(dialog.getByRole('alert')).toContainText('уже сохранены');
  await dialog.getByRole('button', { name: 'Закрыть окно' }).click();
  await page.getByRole('button', { name: 'Мои заявки', exact: false }).first().click();
  await page.getByRole('button', { name: 'Новая заявка', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('select[name=category]').selectOption('waste');
  await dialog.locator('input[name=title]').fill('Контейнеры переполнены');
  await dialog.locator('textarea[name=description]').fill('Мусор не вывезен со двора.');
  await dialog.getByRole('button', { name: 'Подтвердить и сохранить' }).click();
  await expect(page.getByRole('heading', { name: 'Контейнеры переполнены' })).toBeVisible();
  await page.getByRole('button', { name: 'Панель диспетчера', exact: false }).click();
  const row = page.locator('.admin-event').filter({ hasText: 'Контейнеры переполнены' });
  await row.getByRole('button', { name: 'Обработать' }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('textarea').fill('Передали учебному исполнителю');
  await dialog.getByRole('button', { name: 'Подтвердить и сохранить' }).click();
  await expect(row).toContainText('Принята');
  await page.reload();
  await page.getByRole('button', { name: 'Мои заявки', exact: false }).first().click();
  await expect(
    page.locator('.ticket-row').filter({ hasText: 'Контейнеры переполнены' }),
  ).toContainText('Принята');
  expect(errors).toEqual([]);
});
test('mobile layout, addresses and organization information', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Ваш дом. Всё под контролем.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '.local/mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: 'Организации', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Коммунальные организации' })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Выбрать адрес' })
    .selectOption('Бендеры, ул. Советская, 12');
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: 'Графики обслуживания', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Графики ещё не опубликованы' })).toBeVisible();
});
test('dispatcher publishes event and subscriber sees notification', async ({ page }) => {
  await page.getByRole('button', { name: 'Панель диспетчера', exact: false }).click();
  await page.getByRole('button', { name: 'Создать событие' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[name=category]').selectOption('gas');
  await dialog.locator('[name=title]').fill('Проверка газовой сети');
  await dialog.locator('[name=description]').fill('Учебная проверка');
  await dialog.locator('[name=start]').fill('2026-10-29T10:00');
  await dialog.locator('[name=end]').fill('2026-10-29T12:00');
  await dialog.getByRole('button', { name: 'Проверить публикацию' }).click();
  await expect(dialog).toContainText('Проверьте перед публикацией');
  await dialog.getByRole('button', { name: 'Вернуться к форме' }).click();
  await expect(dialog.locator('[name=title]')).toHaveValue('Проверка газовой сети');
  await expect(dialog.locator('[name=start]')).toHaveValue('2026-10-29T10:00');
  await dialog.getByRole('button', { name: 'Проверить публикацию' }).click();
  await dialog.getByRole('button', { name: 'Опубликовать событие' }).click();
  await expect(page.getByRole('heading', { name: 'Проверка газовой сети' })).toBeVisible();
  await page.getByRole('button', { name: /Уведомления:/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Проверка газовой сети');
});
test('desktop overview screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: '.local/desktop.png', fullPage: true });
});
