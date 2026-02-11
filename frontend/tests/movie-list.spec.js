import { test, expect } from '@playwright/test';
import { setupMocks, loginViaUI, API_BASE_URL } from './helpers.js';

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

test.describe('Movie list pagination', () => {
  test('pagination controls appear when > 50 movies', async ({ page }) => {
    // Generate 60 active movies with lexicographically sorted ranks
    const manyMovies = [];
    for (let i = 0; i < 60; i++) {
      manyMovies.push({
        movie_id: `movie-${i}`,
        title: `Movie ${String(i + 1).padStart(3, '0')}`,
        year: 2000 + (i % 25),
        genre: 'Action',
        rating: 7.0,
        director: 'Director',
        status: 'active',
        rank: `r${String(i).padStart(4, '0')}`,
      });
    }

    // Set up standard mocks first, then override the queue route
    await setupMocks(page);
    await page.unroute(`${API_BASE_URL}/**`);
    await page.route(`${API_BASE_URL}/**`, async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const path = url.replace(API_BASE_URL, '');

      if (method === 'GET' && /^\/users\/[^/]+\/queue$/.test(path)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ movies: manyMovies }),
        });
      }
      return route.fulfill({ status: 200, body: '{}' });
    });

    await page.goto('/');
    // Can't use loginViaUI here since it waits for "The Matrix" which isn't in our dataset
    await page.fill('input[placeholder="Username"]', 'testuser');
    await page.fill('input[placeholder="Password"]', 'TestPass123!');
    await page.click('button:has-text("Sign in")');
    await page.waitForSelector('text=Movie 001', { timeout: 10000 });

    // Pagination should be visible
    const pagination = page.locator('[data-testid="list-pagination"]');
    await expect(pagination).toBeVisible();
    await expect(pagination.locator('text=Page 1 of 2')).toBeVisible();

    // First page should show movie 1 and movie 50
    await expect(page.locator('text=Movie 001')).toBeVisible();
    await expect(page.locator('text=Movie 050')).toBeVisible();
    // Movie 51 should not be visible on page 1
    await expect(page.locator('text=Movie 051')).not.toBeVisible();

    // Click Next
    await pagination.locator('button:has-text("Next")').click();
    await expect(pagination.locator('text=Page 2 of 2')).toBeVisible();

    // Page 2 should show movie 51 and display order should start from 51
    await expect(page.locator('text=Movie 051')).toBeVisible();
    await expect(page.locator('text=Movie 001')).not.toBeVisible();
  });
});
