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
    // Empty form — disabled
    await expect(saveBtn).toBeDisabled();
    // Only title — still disabled
    await page.fill('input[placeholder="Title"]', 'Some Movie');
    await expect(saveBtn).toBeDisabled();
    // Title + year — enabled (genre, rating, director are optional)
    await page.fill('input[placeholder="Year"]', '2024');
    await expect(saveBtn).toBeEnabled();
  });

  test('filling required fields enables Save and submits', async ({ page }) => {
    const { writeCalls } = await setupMocks(page);
    await page.click('button:has-text("Add Movie")');
    await page.fill('input[placeholder="Title"]', 'New Movie');
    await page.fill('input[placeholder="Year"]', '2024');
    const saveBtn = page.locator('button:has-text("Save")');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    // Form should close after saving
    await expect(page.locator('h2:has-text("Add Movie")')).not.toBeVisible();
  });

  test('shows duplicate error when adding movie with similar title and same year', async ({ page }) => {
    await page.click('button:has-text("Add Movie")');
    // "The Matrix" (1999) already exists in mock data
    await page.fill('input[placeholder="Title"]', 'The Matrix');
    await page.fill('input[placeholder="Year"]', '1999');
    const saveBtn = page.locator('button:has-text("Save")');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    // Should show duplicate error, form stays open
    await expect(page.locator('text=A similar movie already exists')).toBeVisible();
    await expect(page.locator('h2:has-text("Add Movie")')).toBeVisible();
  });

  test('Edit opens form with movie data pre-filled from catalog', async ({ page }) => {
    // Switch to All Movies view
    await page.click('text=My List');
    await page.click('text=All Movies');
    await expect(page.locator('text=The Dark Knight')).toBeVisible({ timeout: 10000 });

    // Open kebab menu on The Dark Knight
    const darkKnightRow = page.locator('h2:has-text("The Dark Knight")').locator('xpath=ancestor::div[contains(@class,"flex items-center")]');
    await darkKnightRow.locator('[data-testid="catalog-kebab"]').click();
    await page.locator('[data-testid="catalog-edit-btn"]').click();

    await expect(page.locator('h2:has-text("Edit Movie")')).toBeVisible();
    // Title field should be pre-filled
    const titleInput = page.locator('input[placeholder="Title"]');
    await expect(titleInput).toHaveValue('The Dark Knight');
    // Update button should be visible
    await expect(page.locator('button:has-text("Update")')).toBeVisible();
    // Status dropdown should be hidden in catalog edit mode (form area only)
    const formArea = page.locator('h2:has-text("Edit Movie")').locator('xpath=ancestor::div[contains(@class,"bg-white rounded-2xl shadow-2xl p-6")]');
    await expect(formArea.locator('select')).toHaveCount(0);
  });
});
