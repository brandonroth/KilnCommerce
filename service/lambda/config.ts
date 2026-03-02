/**
 * Service-wide constants. Change CURRENCY here to support non-USD stores.
 * Stripe requires the 3-letter ISO 4217 code in lowercase (e.g. "usd", "eur", "gbp").
 */
export const CURRENCY = "usd";

/** Displayed in outbound emails (welcome, order confirmation, shipping). */
export const STORE_NAME = "bees & bowls";

/** Sign-off line used in customer-facing emails. */
export const STORE_SIGNATURE = "— b ✌️";
