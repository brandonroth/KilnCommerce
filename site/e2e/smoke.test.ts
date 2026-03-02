import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads and shows hero content", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/bee.*bowls/i);
    await expect(page.getByRole("link", { name: /shop now/i })).toBeVisible();
  });

  test("shop now link navigates to shop", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /shop now/i }).click();
    await expect(page).toHaveURL(/\/shop/);
  });
});

test.describe("Shop page", () => {
  test("loads and displays products", async ({ page }) => {
    await page.goto("/shop");
    // Products render as .group cards — wait for at least one to appear
    await expect(page.locator(".group").first()).toBeVisible({ timeout: 15_000 });
  });

  test("product card opens drawer and can add to cart", async ({ page }) => {
    await page.goto("/shop");
    await page.locator(".group").first().waitFor({ timeout: 15_000 });
    await page.locator(".group").first().click();
    await expect(page.getByRole("button", { name: /add to cart/i })).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test("nav links are present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /shop/i }).first()).toBeVisible();
  });

  test("contact page loads with contact form", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("button", { name: /send it/i })).toBeVisible();
  });
});
