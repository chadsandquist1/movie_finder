import { test, expect } from '@playwright/test';
import { setupMocks, loginViaUI } from './helpers';

test.beforeEach(async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:8080');
  await loginViaUI(page);
});

test('Import button opens modal', async ({ page }) => {
  await page.click('[data-testid="import-btn"]');
  await expect(page.locator('text=Import Movies')).toBeVisible();
  // Browse Catalog is the default tab
  await expect(page.locator('[data-testid="browse-tab"]')).toBeVisible();
});

test('Fetch button is disabled with empty input', async ({ page }) => {
  await page.click('[data-testid="import-btn"]');
  // Switch to IMDb IDs tab
  await page.click('[data-testid="manual-tab"]');
  const fetchBtn = page.locator('[data-testid="fetch-button"]');
  await expect(fetchBtn).toBeDisabled();
});

test('fetches and shows preview with duplicate detection', async ({ page }) => {
  await page.click('[data-testid="import-btn"]');

  // Switch to IMDb IDs tab
  await page.click('[data-testid="manual-tab"]');

  // Enter IMDb IDs
  await page.fill('[data-testid="imdb-input"]', 'tt0133093\ntt0111161\ntt0068646');

  // Fetch button should be enabled now
  const fetchBtn = page.locator('[data-testid="fetch-button"]');
  await expect(fetchBtn).toBeEnabled();

  await fetchBtn.click();

  // Wait for preview to appear
  await expect(page.locator('text=The Shawshank Redemption (1994)')).toBeVisible();
  await expect(page.locator('text=The Godfather Part II (1974)')).toBeVisible();

  // The Matrix (1999) should be flagged as duplicate since it exists in mock data
  await expect(page.locator('[data-testid="duplicate-badge"]')).toBeVisible();
  await expect(page.locator('text=Duplicate of The Matrix')).toBeVisible();

  // Import button should show count of selected (non-duplicate) movies
  await expect(page.locator('[data-testid="import-button"]')).toContainText('Import Selected (2)');
});

test('closes modal on Done after import', async ({ page }) => {
  await page.click('[data-testid="import-btn"]');

  // Switch to IMDb IDs tab
  await page.click('[data-testid="manual-tab"]');

  await page.fill('[data-testid="imdb-input"]', 'tt0111161');
  await page.click('[data-testid="fetch-button"]');

  // Wait for preview
  await expect(page.locator('text=The Shawshank Redemption (1994)')).toBeVisible();

  // Click import
  await page.click('[data-testid="import-button"]');

  // Wait for done step
  await expect(page.locator('[data-testid="import-success"]')).toBeVisible();

  // Click Done
  await page.click('[data-testid="done-button"]');

  // Modal should be closed
  await expect(page.locator('text=Import Movies')).not.toBeVisible();
});
