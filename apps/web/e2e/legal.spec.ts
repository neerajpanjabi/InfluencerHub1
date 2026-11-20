import { expect, test } from '@playwright/test';

test('business and creator terms are published in English and Arabic', async ({ page }) => {
  await page.goto('/en/terms/business');
  await expect(page.getByRole('heading', { level: 1, name: 'Business Terms' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Contact fees/ })).toBeVisible();
  await expect(page.getByText(/Version .*2026-11/)).toBeVisible();
  await page.goto('/en/terms/creators');
  await expect(page.getByRole('heading', { level: 1, name: 'Creator Terms' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Advertiser permit/ })).toBeVisible();
  await page.goto('/ar/terms/creators');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1, name: 'شروط صناع المحتوى' })).toBeVisible();
  await page.goto('/ar/terms/business');
  await expect(page.getByRole('heading', { level: 1, name: 'شروط الشركات' })).toBeVisible();
});

test('footer and registration link to the right terms', async ({ page }) => {
  await page.goto('/en');
  await expect(page.locator('footer').getByRole('link', { name: 'Business Terms' })).toHaveAttribute('href', '/en/terms/business');
  await expect(page.locator('footer').getByRole('link', { name: 'Creator Terms' })).toHaveAttribute('href', '/en/terms/creators');
  await page.goto('/en/register/business');
  await expect(page.getByRole('link', { name: 'Business Terms' })).toHaveAttribute('href', '/en/terms/business');
  await page.goto('/en/register/influencer');
  await expect(page.getByRole('link', { name: 'Creator Terms' })).toHaveAttribute('href', '/en/terms/creators');
});
