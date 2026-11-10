import type { Locator, Page } from '@playwright/test';
// Выбор в своём списке (shared/ui/Select): по name поля или по aria-label, по value или подписи.
export async function choose(
  scope: Page | Locator,
  field: { name?: string; label?: string },
  option: string | { label: string },
) {
  const root = scope
    .locator(
      field.name
        ? `.dc-select[data-name="${field.name}"]`
        : `.dc-select:has(> button[aria-label="${field.label}"])`,
    )
    .first();
  await root.locator('.dc-select-trigger').click();
  const menu = root.getByRole('listbox');
  if (typeof option === 'string') {
    const byValue = menu.locator(`[data-value="${option}"]`);
    await (
      (await byValue.count()) ? byValue : menu.getByRole('option', { name: option, exact: true })
    ).click();
  } else await menu.getByRole('option', { name: option.label, exact: true }).click();
}
