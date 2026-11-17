import { expect, Page, test } from '@playwright/test';

const uid = () => Math.random().toString(36).slice(2, 8);
const PASSWORD = 'E2ePassword2026';

async function payInSandbox(page: Page) {
  await expect(page.getByText('SANDBOX — no real money moves')).toBeVisible();
  await page.getByRole('button', { name: /Pay \(test card/ }).click();
}

test('business journey: register → paid contact → message → cart → checkout → paid order', async ({ page }) => {
  await page.goto('/en/register/business');
  await page.getByLabel('Business name').fill(`E2E Clinic ${uid()}`);
  await page.getByLabel('Contact person').fill('Test Person');
  await page.getByLabel('Email').fill(`e2e-biz-${uid()}@test.local`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByLabel('Mobile number').fill('0501234567');
  await page.getByLabel('City').fill('Dubai');
  await page.getByLabel('Business category').selectOption({ label: 'Medical and Healthcare' });
  await page.getByLabel(/I agree/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/business\/onboarding/);
  await page.getByLabel('Product launch').check();
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expect(page).toHaveURL(/\/en\/business$/);

  // Paid contact
  await page.goto('/en/creators/dr-layla-haddad');
  await page.getByRole('button', { name: 'Unlock contact' }).click();
  await payInSandbox(page);
  await expect(page).toHaveURL(/contact=success/);
  await page.getByRole('button', { name: 'Message creator' }).click();
  await expect(page).toHaveURL(/\/business\/messages\?c=/);
  await page.getByPlaceholder('Write a message…').fill('Hello Dr. Layla — we would love a Reel for our clinic launch.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('we would love a Reel')).toBeVisible();

  // Cart + checkout
  await page.goto('/en/creators/dr-layla-haddad');
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await expect(page.getByText('Added to cart')).toBeVisible();
  await page.goto('/en/business/cart');
  await expect(page.getByText(/VAT \(5%\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Proceed to secure payment' }).click();
  await payInSandbox(page);
  await expect(page).toHaveURL(/\/business\/orders\/.+payment=succeeded/);
  await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Confirmed').first()).toBeVisible();
});

test('creator journey: register → profile → sandbox Instagram connect → rate card with suggestion', async ({ page }) => {
  await page.goto('/en/register/influencer');
  await page.getByLabel('Full legal name').fill('E2E Creator');
  await page.getByLabel('Public display name').fill(`E2E Creator ${uid()}`);
  await page.getByLabel('Email').fill(`e2e-inf-${uid()}@test.local`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByLabel('Mobile number').fill('0559876543');
  await page.getByLabel('City').fill('Dubai');
  await page.getByLabel(/I agree/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/influencer\/onboarding/);
  await page.getByLabel('Biography', { exact: true }).fill('Dubai food and lifestyle creator. E2E test profile.');
  await page.getByLabel(/Categories/).selectOption({ label: 'Restaurants and Food' });
  await page.getByRole('switch', { name: /Public profile/ }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/influencer\/accounts/);

  await page.getByRole('button', { name: /Sandbox connect/ }).first().click();
  await expect(page.getByText('SANDBOX — simulated INSTAGRAM login')).toBeVisible();
  await page.getByLabel('Sandbox username').fill(`e2e.${uid()}`);
  await page.getByRole('button', { name: 'Allow access' }).click();
  await expect(page).toHaveURL(/connected=instagram/);
  await expect(page.getByText('API verified').first()).toBeVisible();

  await page.goto('/en/influencer/rate-cards');
  await page.getByRole('button', { name: 'Add service' }).click();
  await expect(page.getByText(/Suggested range AED/)).toBeVisible();
  await page.getByRole('button', { name: 'Use suggestion' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Reel').first()).toBeVisible();
});
