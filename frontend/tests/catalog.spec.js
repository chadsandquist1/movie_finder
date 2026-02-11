import { test, expect } from '@playwright/test';
import { setupMocks, loginViaUI, CATALOG_QUEUED, CONFIG, MOVIES } from './helpers.js';

test.describe('Catalog view', () => {
  let writeCalls;

  test.beforeEach(async ({ page }) => {
    const mocks = await setupMocks(page);
    writeCalls = mocks.writeCalls;
    await page.goto('/');
    await loginViaUI(page);
  });

  async function openCatalog(page) {
    await page.click('text=My List');
    await page.click('text=All Movies');
    await expect(page.locator('text=The Dark Knight')).toBeVisible({ timeout: 10000 });
  }

  test('switches to All Movies view via dropdown', async ({ page }) => {
    await openCatalog(page);
    // Catalog-only movies should appear (not in user's queue)
    await expect(page.locator('text=Fight Club')).toBeVisible();
    await expect(page.locator('text=Parasite')).toBeVisible();
    // Movies that are also in user queue should still appear
    await expect(page.locator('text=The Matrix')).toBeVisible();
  });

  test('shows badge for movies already in user queue', async ({ page }) => {
    await openCatalog(page);
    const badges = page.locator('[data-testid="queue-badge"]');
    await expect(badges).toHaveCount(Object.keys(CATALOG_QUEUED).length);
  });

  test('catalog is sorted by year descending', async ({ page }) => {
    await openCatalog(page);
    // Get all movie titles in order
    const titles = await page.locator('h2').allTextContents();
    // Parasite (2019) should come before The Godfather (1972)
    const parasiteIdx = titles.indexOf('Parasite');
    const godfatherIdx = titles.indexOf('The Godfather');
    expect(parasiteIdx).toBeLessThan(godfatherIdx);
  });

  test('Add to dropdown adds movie to queue', async ({ page }) => {
    await openCatalog(page);
    // Find The Dark Knight row — it's rendered in a CatalogRow div
    const darkKnightRow = page.locator('h2:has-text("The Dark Knight")').locator('xpath=ancestor::div[contains(@class,"flex items-center")]');
    const addSelect = darkKnightRow.locator('[data-testid="add-to-select"]');
    await addSelect.selectOption('active');
    // Verify toast appears
    await expect(page.locator('[data-testid="add-toast"]')).toContainText('Added to My List');
    // Verify write was called
    await expect(async () => {
      expect(writeCalls.length).toBeGreaterThan(0);
      const lastCall = writeCalls[writeCalls.length - 1];
      expect(lastCall.movie_id).toBe('id-6');
      expect(lastCall.status).toBe('active');
    }).toPass({ timeout: 5000 });
  });

  test('hides Add Movie and Import buttons in catalog view', async ({ page }) => {
    // Verify buttons are visible in default view
    await expect(page.locator('text=Add Movie')).toBeVisible();
    await expect(page.locator('[data-testid="import-btn"]')).toBeVisible();
    // Switch to catalog
    await openCatalog(page);
    // Buttons should be hidden
    await expect(page.locator('text=Add Movie')).not.toBeVisible();
    await expect(page.locator('[data-testid="import-btn"]')).not.toBeVisible();
  });
});

test.describe('Catalog pagination', () => {
  test('pagination controls appear when > 50 movies', async ({ page }) => {
    // Build 60 movies
    const bigCatalog = [];
    for (let i = 1; i <= 60; i++) {
      bigCatalog.push({
        movie_id: `big-${i}`,
        title: `Movie ${String(i).padStart(2, '0')}`,
        year: 1960 + i,
        genre: 'Drama',
        rating: 7.0,
        director: 'Director',
      });
    }

    // Use setupMocks for base routes, then override Lambda for custom catalog
    await setupMocks(page);
    // Unroute existing lambda handler so we can override it
    await page.unroute('https://lambda.us-east-1.amazonaws.com/**');
    await page.route('https://lambda.us-east-1.amazonaws.com/**', async (route) => {
      const url = route.request().url();
      if (url.includes('movieq-catalog')) {
        const response = { statusCode: 200, body: JSON.stringify({ movies: bigCatalog, queued: {} }) };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      }
      if (url.includes('movieq-list')) {
        const response = { statusCode: 200, body: JSON.stringify({ movies: MOVIES }) };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      }
      if (url.includes('movieq-write')) {
        const response = { statusCode: 200, body: JSON.stringify({ success: true }) };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      }
      return route.fulfill({ status: 200, body: '{}' });
    });

    await page.goto('/');
    await loginViaUI(page);

    await page.click('text=My List');
    await page.click('text=All Movies');
    const pagination = page.locator('[data-testid="catalog-pagination"]');
    await expect(pagination).toBeVisible({ timeout: 10000 });
    await expect(pagination.locator('text=Page 1 of 2')).toBeVisible();
    await pagination.locator('text=Next').click();
    await expect(pagination.locator('text=Page 2 of 2')).toBeVisible();
  });
});
