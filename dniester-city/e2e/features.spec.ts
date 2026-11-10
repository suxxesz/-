import { test, expect } from '@playwright/test';
import { choose } from './select';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
test('separate meter can submit in a period already used by another meter', async ({ page }) => {
  await page.getByRole('button', { name: 'Показания счётчиков', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить счётчик', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await choose(dialog, { name: 'category' }, 'water');
  await dialog.locator('[name=name]').fill('Ванная');
  await dialog.locator('[name=serial]').fill('V-123');
  await dialog.locator('[name=initialValue]').fill('500');
  await dialog.getByRole('button', { name: 'Подтвердить и сохранить' }).click();
  await expect(page.getByRole('heading', { name: 'Ванная', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Передать показания', exact: true }).click();
  await choose(dialog, { name: 'category' }, 'water');
  await choose(dialog, { name: 'meterId' }, { label: 'Ванная · № V-123' });
  await dialog.locator('[name=period]').fill('2026-09');
  await dialog.locator('[name=value]').fill('505');
  await dialog.getByRole('button', { name: 'Подтвердить и сохранить' }).click();
  await expect(page.getByRole('cell', { name: '505', exact: true })).toBeVisible();
});
test('draft review, multiple houses and controlled publication', async ({ page }) => {
  await page.getByRole('button', { name: /Панель диспетчера/ }).click();
  await page.getByRole('button', { name: 'Создать событие' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[name=title]').fill('Проверка двух домов');
  await dialog.locator('[name=description]').fill('Учебная сводка, проверенная диспетчером');
  await dialog.locator('[name=start]').fill('2026-10-29T09:00');
  await dialog.getByLabel('Бендеры, ул. Советская, 12', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Сохранить черновик' }).click();
  const row = page.locator('.admin-event').filter({ hasText: 'Проверка двух домов' });
  await expect(row).toContainText('Черновик');
  await expect(row).toContainText('2 дома');
  await row.getByRole('button', { name: 'Проверить' }).click();
  await expect(dialog.getByRole('button', { name: 'Опубликовать для жителей' })).toBeDisabled();
  await dialog.getByLabel('Я проверил источник, адреса и время').check();
  await dialog.getByRole('button', { name: 'Опубликовать для жителей' }).click();
  await expect(row).toContainText('Запланировано');
  await choose(page, { label: 'Выбрать адрес' }, 'Бендеры, ул. Советская, 12');
  await expect(
    page.locator('.admin-event').filter({ hasText: 'Проверка двух домов' }),
  ).toBeVisible();
});
test('complete the four-step defense scenario and inspect actual records', async ({ page }) => {
  await page.getByRole('button', { name: /Режим защиты/ }).click();
  await expect(page.getByRole('heading', { name: 'Город, который слышит жителей' })).toBeVisible();
  await page.getByRole('button', { name: 'Включить учебную роль диспетчера' }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Выполнить шаг' }).click();
    await expect(
      page.getByText(i === 3 ? 'Сценарий завершён' : `Шаг ${i + 2} из 4`, { exact: true }),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: 'Открыть панель', exact: true }).click();
  await expect(page.locator('.admin-event').filter({ hasText: 'Учебное обращение' })).toContainText(
    'Принята',
  );
});
test('dispatcher edits service schedule and organization zone', async ({ page }) => {
  await page.getByRole('button', { name: /Панель диспетчера/ }).click();
  await page.getByRole('button', { name: 'Графики', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить график' }).click();
  const dialog = page.getByRole('dialog');
  await choose(dialog, { name: 'category' }, 'waste');
  await dialog.locator('[name=title]').fill('Утренний вывоз');
  await dialog.locator('[name=when]').fill('Понедельник · 08:00');
  await dialog.locator('[name=description]').fill('По учебному графику');
  await dialog.getByRole('button', { name: 'Подтвердить и сохранить' }).click();
  await expect(page.getByRole('heading', { name: 'Утренний вывоз' })).toBeVisible();
  await page.getByRole('button', { name: 'Графики обслуживания', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Утренний вывоз' })).toBeVisible();
  await page.getByRole('button', { name: /Панель диспетчера/ }).click();
  await page
    .locator('.admin-tabs')
    .getByRole('button', { name: 'Организации', exact: true })
    .click();
  await page
    .locator('.contact-card')
    .filter({ hasText: 'Электроснабжение' })
    .getByRole('button', { name: 'Настроить' })
    .click();
  await dialog.locator('[name=name]').fill('Пилот электроснабжения · демо');
  await dialog.getByLabel('Организация работает в кабинете').check();
  await dialog.getByRole('button', { name: 'Подтвердить и сохранить' }).click();
  await page.locator('aside nav').getByRole('button', { name: 'Организации', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Пилот электроснабжения · демо' })).toBeVisible();
});
test('keyboard dialog, enlarged text and browser navigation', async ({ page }) => {
  await page.getByRole('button', { name: 'Передать показания Вода, свет и газ' }).click();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Закрыть окно' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByLabel('Увеличенный текст').check();
  await expect(page.locator('html')).toHaveAttribute('data-large', 'true');
  await page.getByRole('button', { name: 'Обзор', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Настройки', exact: true })).toBeVisible();
});
test('accessibility on overview and meter dialog', async ({ page }) => {
  // axe мерит контраст в моменте — без анимации появления карточки не попадают в полупрозрачный кадр.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ваш дом. Всё под контролем.' })).toBeVisible();
  const overview = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    overview.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Передать показания Вода, свет и газ' }).click();
  await page.waitForTimeout(400); // дождаться конца появления окна
  const modal = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(modal.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
});
test('transport: route on map and taxi estimate', async ({ page }) => {
  await page.goto('/#transport');
  await expect(page.getByRole('heading', { name: 'Транспорт' })).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: 'Тирасполь → Бендеры' }).click();
  await expect(page.getByRole('heading', { name: 'Тирасполь → Бендеры' })).toBeVisible();
  await expect(page.locator('.route-map .leaflet-interactive').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Такси' }).click();
  await choose(page, { label: 'Куда' }, 'Бендеры, центр');
  await expect(page.locator('.taxi-km strong')).toContainText('км');
  await expect(page.locator('.taxi-card').first()).toBeVisible();
});
