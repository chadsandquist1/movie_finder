import { test, expect } from '@playwright/test';
import { setupMocks, loginViaUI } from './helpers.js';

test.describe('Kebab menu', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await loginViaUI(page);
  });

  test('kebab menu opens with options', async ({ page }) => {
    const kebabButtons = page.locator('button[aria-label="More options"]');
    await kebabButtons.first().click();
    await expect(page.locator('button:has-text("Move to Top")')).toBeVisible();
    await expect(page.locator('button:has-text("Move to Bottom")')).toBeVisible();
    await expect(page.locator('button:has-text("Edit")')).toBeVisible();
  });

  test('Move to Top is disabled on last item', async ({ page }) => {
    const kebabButtons = page.locator('button[aria-label="More options"]');
    await kebabButtons.nth(2).click(); // 3rd item (last in active list)
    await expect(page.locator('button:has-text("Move to Top")')).toBeDisabled();
  });

  test('Move to Bottom is disabled on first item', async ({ page }) => {
    const kebabButtons = page.locator('button[aria-label="More options"]');
    await kebabButtons.first().click();
    await expect(page.locator('button:has-text("Move to Bottom")')).toBeDisabled();
  });

  test('menu closes when clicking outside', async ({ page }) => {
    const kebabButtons = page.locator('button[aria-label="More options"]');
    await kebabButtons.first().click();
    await expect(page.locator('button:has-text("Move to Top")')).toBeVisible();
    // Click outside
    await page.click('h1:has-text("MojoDojo MovieQ")');
    await expect(page.locator('button:has-text("Move to Top")')).not.toBeVisible();
  });
});
