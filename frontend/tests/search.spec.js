import { test, expect } from '@playwright/test';
import { setupMocks, loginViaUI } from './helpers.js';

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await loginViaUI(page);
  });

  test('search box is visible in header', async ({ page }) => {
    await expect(page.locator('input[placeholder="Search..."]')).toBeVisible();
  });

  test('search by title filters across all lists', async ({ page }) => {
    await page.fill('input[placeholder="Search..."]', 'Godfather');
    // Godfather is in recentlyWatched — should appear with group header
    await expect(page.locator('text=The Godfather')).toBeVisible();
    await expect(page.locator('text=Recently Watched')).toBeVisible();
    // Others should not appear
    await expect(page.locator('text=The Matrix')).not.toBeVisible();
  });

  test('search by director', async ({ page }) => {
    await page.fill('input[placeholder="Search..."]', 'Nolan');
    await expect(page.locator('text=Inception')).toBeVisible();
    await expect(page.locator('text=Interstellar')).toBeVisible();
    await expect(page.locator('text=The Matrix')).not.toBeVisible();
  });

  test('search by genre', async ({ page }) => {
    await page.fill('input[placeholder="Search..."]', 'Crime');
    await expect(page.locator('text=The Godfather')).toBeVisible();
    await expect(page.locator('text=Pulp Fiction')).toBeVisible();
    await expect(page.locator('text=The Matrix')).not.toBeVisible();
  });

  test('no results shows empty state', async ({ page }) => {
    await page.fill('input[placeholder="Search..."]', 'xyznotfound');
    await expect(page.locator('text=/No movies match/')).toBeVisible();
  });

  test('clearing search returns to normal list view', async ({ page }) => {
    await page.fill('input[placeholder="Search..."]', 'Godfather');
    await expect(page.locator('text=The Godfather')).toBeVisible();
    await page.fill('input[placeholder="Search..."]', '');
    // Back to active list (My List)
    await expect(page.locator('text=The Matrix')).toBeVisible();
    await expect(page.locator('text=The Godfather')).not.toBeVisible();
  });
});
