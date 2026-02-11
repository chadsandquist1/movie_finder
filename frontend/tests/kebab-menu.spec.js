import { test, expect } from '@playwright/test';
import { setupMocks, loginViaUI, API_BASE_URL, MOVIES } from './helpers.js';

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

  test('Move to Top is disabled on first item', async ({ page }) => {
    const kebabButtons = page.locator('button[aria-label="More options"]');
    await kebabButtons.first().click();
    await expect(page.locator('button:has-text("Move to Top")')).toBeDisabled();
  });

  test('Move to Bottom is disabled on last item', async ({ page }) => {
    const kebabButtons = page.locator('button[aria-label="More options"]');
    await kebabButtons.nth(2).click(); // 3rd item (last in active list)
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

  test('Move to Top changes display order to 1', async ({ page }) => {
    let putBody = null;
    let putDone = false;

    // Unroute the beforeEach mocks, then set up custom route
    await page.unroute(`${API_BASE_URL}/**`);
    await page.route(`${API_BASE_URL}/**`, async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const path = url.replace(API_BASE_URL, '');

      if (method === 'PUT' && /^\/users\/[^/]+\/queue\/[^/]+$/.test(path)) {
        putBody = JSON.parse(route.request().postData());
        putDone = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }

      if (method === 'GET' && /^\/users\/[^/]+\/queue$/.test(path)) {
        if (putDone) {
          // Return updated list with Inception ranked before The Matrix
          // Use a rank that localeCompare sorts before 'a0'
          const updatedMovies = [
            { ...MOVIES[1], rank: 'a0' },   // Inception now first
            { ...MOVIES[0], rank: 'a1' },   // The Matrix now second
            MOVIES[2],                       // Interstellar stays
            MOVIES[3],
            MOVIES[4],
          ];
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ movies: updatedMovies }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ movies: MOVIES }),
        });
      }

      return route.fulfill({ status: 200, body: '{}' });
    });

    // Click kebab on the 2nd movie (Inception, display order 2)
    const kebabButtons = page.locator('button[aria-label="More options"]');
    await kebabButtons.nth(1).click();

    // Click "Move to Top"
    await page.locator('button:has-text("Move to Top")').click();

    // Wait for Inception to appear as the first movie (after PUT + refresh)
    const firstTitle = page.locator('.bg-white h2').first();
    await expect(firstTitle).toHaveText('Inception', { timeout: 5000 });

    // Verify the PUT body has a rank and old_sk for Inception
    expect(putBody).not.toBeNull();
    expect(putBody.old_sk).toBe('active#a1');
  });
});
