import { expect, test } from '@playwright/test';

test('homepage renders in English and Arabic (RTL)', async ({ page }) => {
  await page.goto('/en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Where brands meet influence');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.getByRole('button', { name: /التبديل إلى العربية/ }).click();
  await expect(page).toHaveURL(/\/ar/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('حيث تلتقي العلامات التجارية');
});

test('browse and filter creators, open a public profile without paying', async ({ page }) => {
  await page.goto('/en/creators?category=dermatology');
  const card = page.locator('a[href*="/creators/"]').first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByText('Verified statistics')).toBeVisible();
  await expect(page.getByText('Services & rates')).toBeVisible();
  await expect(page.getByText(/Log in as a business/)).toBeVisible();
});

test('AI discovery returns explained matches from real records', async ({ page }) => {
  await page.goto('/en/discover');
  await page.getByRole('textbox').fill('Find 10 Dubai-based dermatologists for a clinic promotion');
  await page.getByRole('button', { name: 'Find creators' }).click();
  await expect(page.getByText("Here's what I understood")).toBeVisible();
  await expect(page.getByText(/Specialises in dermatology/).first()).toBeVisible();
});
