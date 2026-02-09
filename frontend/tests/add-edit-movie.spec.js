import { test, expect } from '@playwright/test';
import { setupMocks, loginViaUI } from './helpers.js';

test.describe('Add / Edit movie', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await loginViaUI(page);
  });

  test('Add Movie button toggles the form', async ({ page }) => {
    await expect(page.locator('text=Add Movie').first()).toBeVisible();
    await page.click('button:has-text("Add Movie")');
    await expect(page.locator('h2:has-text("Add Movie")')).toBeVisible();
    await expect(page.locator('input[placeholder="Title"]')).toBeVisible();
    // Cancel hides the form
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('h2:has-text("Add Movie")')).not.toBeVisible();
  });

  test('Save button is disabled when form is incomplete', async ({ page }) => {
    await page.click('button:has-text("Add Movie")');
    const saveBtn = page.locator('button:has-text("Save")');
    await expect(saveBtn).toBeDisabled();
  });

  test('filling all fields enables Save and submits', async ({ page }) => {
    const { writeCalls } = await setupMocks(page);
    await page.click('button:has-text("Add Movie")');
    await page.fill('input[placeholder="Title"]', 'New Movie');
    await page.fill('input[placeholder="Year"]', '2024');
    await page.fill('input[placeholder="Genre"]', 'Action');
    await page.fill('input[placeholder="Rating (0-10)"]', '7.5');
    await page.fill('input[placeholder="Director"]', 'Test Director');
    const saveBtn = page.locator('button:has-text("Save")');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    // Form should close after saving
    await expect(page.locator('h2:has-text("Add Movie")')).not.toBeVisible();
  });

  test('Edit opens form with movie data pre-filled', async ({ page }) => {
    // Open kebab menu on first movie
    const kebabButtons = page.locator('button[aria-label="More options"]');
    await kebabButtons.first().click();
    await page.click('button:has-text("Edit")');

    await expect(page.locator('h2:has-text("Edit Movie")')).toBeVisible();
    // Title field should be pre-filled
    const titleInput = page.locator('input[placeholder="Title"]');
    await expect(titleInput).toHaveValue('The Matrix');
    // Update button should be visible
    await expect(page.locator('button:has-text("Update")')).toBeVisible();
  });
});
