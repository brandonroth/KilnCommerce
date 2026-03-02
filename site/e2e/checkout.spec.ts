import { test, expect } from "@playwright/test";

test("starting checkout removes item from store, canceling returns it", async ({ page, browser }) => {
  await page.goto("/shop");
  await page.locator(".group").first().waitFor();

  // Record the name of the first product — we'll track this specific item
  const productName = await page.locator(".group").first().locator("p").first().textContent() ?? "";
  expect(productName).toBeTruthy();

  // Start checkout — reserves the item and navigates to the embedded checkout page
  await page.locator(".group").first().click();
  await page.getByRole("button", { name: "add to cart" }).click();
  await page.getByRole("button", { name: "checkout →" }).click();
  await page.waitForURL(/\/checkout$/, { timeout: 20_000 });

  // Open a private (incognito) tab and verify the specific item is gone
  const incognito = await browser.newContext({ baseURL: "https://d3634e7fhq4fj6.cloudfront.net" });
  const checkPage = await incognito.newPage();
  await checkPage.goto("/shop");
  await checkPage.locator(".group").first().waitFor({ timeout: 10_000 });
  await expect(checkPage.getByText(productName, { exact: true })).not.toBeVisible();
  await incognito.close();

  // Cancel via our cancel button — fires DELETE to release reservation, navigates to /shop
  await page.getByRole("button", { name: "cancel and return to shop" }).click();
  await page.waitForURL(/\/shop/, { timeout: 10_000 });

  // Poll until the specific item reappears (reservation released)
  await expect(async () => {
    await page.goto("/shop");
    await page.locator(".group").first().waitFor({ timeout: 5_000 });
    await expect(page.getByText(productName, { exact: true })).toBeVisible();
  }).toPass({ timeout: 30_000, intervals: [2_000] });
});

/**
 * End-to-end checkout flow:
 * 1. Browse the shop
 * 2. Add a product to cart via the product drawer
 * 3. Click checkout → — navigates to /checkout with embedded Stripe form
 * 4. Complete payment inside the Stripe iframe using a test card
 *
 * Stripe test card: 5555 5555 5555 4444 (Mastercard) | 10/30 | 444
 */
test("add item to cart and complete checkout", async ({ page }) => {
  test.setTimeout(120_000);

  // Navigate to the shop and wait for products to render
  await page.goto("/shop");
  await page.locator(".group").first().waitFor();

  // Click the first product card to open the product drawer
  await page.locator(".group").first().click();

  // Add to cart — the cart drawer opens automatically afterwards
  await page.getByRole("button", { name: "add to cart" }).click();

  // Cart drawer: checkout → stores clientSecret in sessionStorage and navigates to /checkout
  await page.getByRole("button", { name: "checkout →" }).click();

  // Wait for our embedded checkout page
  await page.waitForURL(/\/checkout$/, { timeout: 20_000 });

  // Stripe's EmbeddedCheckout renders the form inside an iframe that lives inside
  // a shadow DOM host — standard document.querySelectorAll and page.frames() won't
  // find it. Use Playwright's pierce locator (`>>`) to cross shadow boundaries,
  // then promote it to a FrameLocator via .contentFrame().
  const stripeFrame = page.locator(">> iframe").contentFrame();

  // Wait for the form to render inside the iframe
  await stripeFrame.getByPlaceholder("email@example.com").waitFor({ state: "attached", timeout: 90_000 });

  // If Stripe Link remembers us, dismiss it to reach the standard input form
  const payWithoutLink = stripeFrame.locator(".LinkCancelPartialLoginButton");
  await payWithoutLink.waitFor({ state: "visible", timeout: 8_000 }).catch(() => null);
  if (await payWithoutLink.isVisible()) {
    await payWithoutLink.click();
  }

  // Email (required by Stripe's current checkout flow)
  await stripeFrame.getByPlaceholder("email@example.com").fill("test@example.com");

  // Full name
  await stripeFrame.getByRole("textbox", { name: "Full name" }).fill("Test User");

  // Phone number
  await stripeFrame.getByRole("textbox", { name: "Phone number" }).fill("5635056381");

  // Shipping address — click "Enter address manually" to bypass autocomplete
  const enterManually = stripeFrame.getByRole("button", { name: /enter address manually/i });
  await enterManually.waitFor({ state: "visible", timeout: 5_000 }).catch(() => null);
  if (await enterManually.isVisible()) {
    await enterManually.click();
  }

  // Address fields (visible after entering manually or via autocomplete)
  const addressCombo = stripeFrame.getByRole("combobox", { name: "Address" });
  const addressComboVisible = await addressCombo.isVisible().catch(() => false);
  if (addressComboVisible) {
    await addressCombo.fill("241 W 380 S");
    await stripeFrame.locator("div").nth(2).click();
  } else {
    await stripeFrame.getByPlaceholder(/address line 1/i).fill("241 W 380 S");
  }

  // City / ZIP
  await stripeFrame.getByRole("textbox", { name: "City" }).fill("American Fork");
  await stripeFrame.getByRole("textbox", { name: "ZIP" }).fill("84003");

  // Continue to payment step (Stripe's two-step form)
  await stripeFrame.getByRole("button", { name: /continue/i }).click();

  // Select card payment method
  await stripeFrame.locator("#payment-method-accordion-item-title-card").waitFor({ timeout: 10_000 }).catch(() => null);
  await stripeFrame.locator("#payment-method-accordion-item-title-card").click({ force: true }).catch(() => null);

  // Wait for card fields to expand
  await stripeFrame.getByRole("textbox", { name: "Card number" }).waitFor({ state: "visible", timeout: 10_000 });
  await stripeFrame.getByRole("textbox", { name: "Card number" }).fill("5555 5555 5555 4444");
  await stripeFrame.getByRole("textbox", { name: "Expiration" }).fill("10 / 30");
  await stripeFrame.getByRole("textbox", { name: "CVC" }).fill("444");

  // Submit payment
  await stripeFrame.getByTestId("hosted-payment-submit-button").click();

  // After a successful payment Stripe navigates to our return_url (/checkout/return)
  await page.waitForURL(/checkout\/return/, { timeout: 30_000 });
  await expect(page).toHaveURL(/checkout\/return/);
  await expect(page.getByRole("heading", { name: /order received/i })).toBeVisible();
});
