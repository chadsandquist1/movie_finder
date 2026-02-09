import { test, expect } from '@playwright/test';
import { setupMocks, loginViaUI, MOVIES } from './helpers.js';

test.describe('Reorder arrows', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await loginViaUI(page);
  });

  test('up arrow is disabled on first item', async ({ page }) => {
    const upButtons = page.locator('button[aria-label="Move up"]');
    await expect(upButtons.first()).toBeDisabled();
  });

  test('down arrow is disabled on last item', async ({ page }) => {
    const downButtons = page.locator('button[aria-label="Move down"]');
    await expect(downButtons.nth(2)).toBeDisabled(); // 3rd item is last
  });

  test('up arrow is enabled on non-first items', async ({ page }) => {
    const upButtons = page.locator('button[aria-label="Move up"]');
    await expect(upButtons.nth(1)).toBeEnabled();
  });

  test('down arrow is enabled on non-last items', async ({ page }) => {
    const downButtons = page.locator('button[aria-label="Move down"]');
    await expect(downButtons.first()).toBeEnabled();
  });

  test('clicking down arrow triggers write calls', async ({ page }) => {
    const writeCalls = [];
    // Unroute existing Lambda mock and re-register with tracking
    await page.unroute('https://lambda.us-east-1.amazonaws.com/**');
    await page.route('https://lambda.us-east-1.amazonaws.com/**', async (route) => {
      const url = route.request().url();
      if (url.includes('movieq-write')) {
        writeCalls.push(true);
      }
      // Always return list response for list calls, success for write
      const response = url.includes('movieq-list')
        ? { statusCode: 200, body: JSON.stringify({ movies: MOVIES }) }
        : { statusCode: 200, body: JSON.stringify({ success: true }) };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    const downButtons = page.locator('button[aria-label="Move down"]');
    await downButtons.first().click();
    // Wait for animation (350ms) + API calls
    await page.waitForTimeout(1000);
    expect(writeCalls.length).toBeGreaterThanOrEqual(2); // swap = 2 write calls
  });
});
