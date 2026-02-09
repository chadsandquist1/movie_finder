import { test, expect } from '@playwright/test';
import { setupMocks, loginViaUI } from './helpers.js';

test.describe('Movie list', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await loginViaUI(page);
  });

  test('shows active list by default with correct movies', async ({ page }) => {
    // Active list movies (The Matrix, Inception, Interstellar)
    await expect(page.locator('text=The Matrix')).toBeVisible();
    await expect(page.locator('text=Inception')).toBeVisible();
    await expect(page.locator('text=Interstellar')).toBeVisible();
    // Movies from other lists should not be visible
    await expect(page.locator('text=The Godfather')).not.toBeVisible();
    await expect(page.locator('text=Pulp Fiction')).not.toBeVisible();
  });

  test('switches to Recently Watched list via dropdown', async ({ page }) => {
    await page.click('text=My List');
    await page.click('text=Recently Watched');
    await expect(page.locator('text=The Godfather')).toBeVisible();
    await expect(page.locator('text=The Matrix')).not.toBeVisible();
  });

  test('switches to Not Interested list via dropdown', async ({ page }) => {
    await page.click('text=My List');
    await page.click('text=Not Interested');
    await expect(page.locator('text=Pulp Fiction')).toBeVisible();
    await expect(page.locator('text=The Matrix')).not.toBeVisible();
  });

  test('displays movie details: genre, director, rating', async ({ page }) => {
    await expect(page.locator('text=Sci-Fi').first()).toBeVisible();
    await expect(page.locator('text=Wachowskis')).toBeVisible();
    await expect(page.locator('text=8.7')).toBeVisible();
  });

  test('shows display order numbers', async ({ page }) => {
    const rows = page.locator('text=/^[123]$/');
    await expect(rows).toHaveCount(3);
  });
});
