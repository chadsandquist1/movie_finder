import { test, expect } from '@playwright/test';
import { setupMocks, loginViaUI } from './helpers.js';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('renders the login page with title and form', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=MojoDojo')).toBeVisible();
    await expect(page.locator('text=MovieQ')).toBeVisible();
    await expect(page.locator('input[placeholder="Username"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible();
  });

  test('logs in and shows movie list', async ({ page }) => {
    await page.goto('/');
    await loginViaUI(page);
    await expect(page.locator('text=The Matrix')).toBeVisible();
    await expect(page.locator('text=Inception')).toBeVisible();
    await expect(page.locator('text=Interstellar')).toBeVisible();
  });

  test('shows logout button after login', async ({ page }) => {
    await page.goto('/');
    await loginViaUI(page);
    await expect(page.locator('button:has-text("Logout")')).toBeVisible();
  });

  test('logout returns to login page', async ({ page }) => {
    await page.goto('/');
    await loginViaUI(page);
    await page.click('button:has-text("Logout")');
    await expect(page.locator('input[placeholder="Username"]')).toBeVisible();
  });
});
