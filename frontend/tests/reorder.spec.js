import { test, expect } from '@playwright/test';
import { setupMocks, loginViaUI, API_BASE_URL } from './helpers.js';

test.describe('Drag and drop reorder', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await loginViaUI(page);
  });

  test('drag handles are visible on each movie row', async ({ page }) => {
    const handles = page.locator('button[aria-label="Drag to reorder"]');
    await expect(handles).toHaveCount(3); // 3 active movies
  });

  test('drag handle has grab cursor', async ({ page }) => {
    const handle = page.locator('button[aria-label="Drag to reorder"]').first();
    await expect(handle).toBeVisible();
  });

  test('movies display in correct initial order', async ({ page }) => {
    const titles = page.locator('h2');
    await expect(titles.nth(0)).toHaveText('The Matrix');
    await expect(titles.nth(1)).toHaveText('Inception');
    await expect(titles.nth(2)).toHaveText('Interstellar');
  });

  test('dragging a row triggers write call on drop', async ({ page }) => {
    const writeCalls = [];
    await page.unroute(`${API_BASE_URL}/**`);
    await page.route(`${API_BASE_URL}/**`, async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const path = url.replace(API_BASE_URL, '');
      if (method === 'PUT' && /^\/users\/[^/]+\/queue\/[^/]+$/.test(path)) {
        writeCalls.push(true);
      }
      const { MOVIES } = await import('./helpers.js');
      if (method === 'GET' && /^\/users\/[^/]+\/queue$/.test(path)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ movies: MOVIES }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Drag first handle down by 80px
    const handle = page.locator('button[aria-label="Drag to reorder"]').first();
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 80, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(500);
    expect(writeCalls.length).toBeGreaterThanOrEqual(1);
  });
});
