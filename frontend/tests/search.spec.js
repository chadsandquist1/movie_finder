import { test, expect } from '@playwright/test';
import { setupMocks, loginViaUI } from './helpers.js';

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await loginViaUI(page);
  });

  test('search box is visible in header', async ({ page }) => {
    await expect(page.locator('input[placeholder="Search movies..."]')).toBeVisible();
  });

  test('search by title filters across all lists', async ({ page }) => {
    await page.fill('input[placeholder="Search movies..."]', 'Godfather');
    // Godfather is in recentlyWatched — should appear with group header
    await expect(page.locator('text=The Godfather')).toBeVisible();
    await expect(page.locator('text=Recently Watched')).toBeVisible();
    // Others should not appear
    await expect(page.locator('text=The Matrix')).not.toBeVisible();
  });

  test('search by director', async ({ page }) => {
    await page.fill('input[placeholder="Search movies..."]', 'Nolan');
    await expect(page.locator('text=Inception')).toBeVisible();
    await expect(page.locator('text=Interstellar')).toBeVisible();
    await expect(page.locator('text=The Matrix')).not.toBeVisible();
  });

  test('search by genre', async ({ page }) => {
    await page.fill('input[placeholder="Search movies..."]', 'Crime');
    await expect(page.locator('text=The Godfather')).toBeVisible();
    await expect(page.locator('text=Pulp Fiction')).toBeVisible();
    await expect(page.locator('text=The Matrix')).not.toBeVisible();
  });

  test('no results shows empty state', async ({ page }) => {
    await page.fill('input[placeholder="Search movies..."]', 'xyznotfound');
    await expect(page.locator('text=/No movies match/')).toBeVisible();
  });

  test('clearing search returns to normal list view', async ({ page }) => {
    await page.fill('input[placeholder="Search movies..."]', 'Godfather');
    await expect(page.locator('text=The Godfather')).toBeVisible();
    await page.fill('input[placeholder="Search movies..."]', '');
    // Back to active list (My List)
    await expect(page.locator('text=The Matrix')).toBeVisible();
    await expect(page.locator('text=The Godfather')).not.toBeVisible();
  });
});
