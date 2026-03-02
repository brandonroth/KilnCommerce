import { Decimal } from "decimal.js";

/**
 * Sales tax for American Fork, UT 84003.
 * Source: https://www.salestaxhandbook.com/utah/rates/american-fork
 */

export interface TaxLine {
  /** Human-readable label for the taxing entity. */
  label: string;
  /** Rate as a decimal string (e.g. "0.0485"). Stored per-transaction for accurate year-end reconciliation. */
  rate: string;
  /** Amount in dollars, rounded to the nearest cent. */
  amount: number;
}

export interface TaxBreakdown {
  /** Per-entity breakdown for accounting/remittance. */
  lines: TaxLine[];
  /** Human-readable label for the Stripe line item (e.g. "Sales Tax (7.45%)"). */
  label: string;
  /**
   * Total tax charged, derived from the combined rate — this is what appears on the Stripe line item.
   * Note: may differ from sum(lines) by ±$0.01 due to per-entity rounding.
   */
  total: number;
}

/** Component rates that make up the combined 7.45% rate. */
const TAX_COMPONENTS: { label: string; rate: string }[] = [
  { label: "Utah state tax",         rate: "0.0485" },
  { label: "Utah County tax",        rate: "0.0100" },
  { label: "American Fork city tax", rate: "0.0110" },
  { label: "Special district tax",   rate: "0.0050" },
];

/** Combined rate — used for the single Stripe line item total. */
const COMBINED_RATE = TAX_COMPONENTS.reduce(
  (sum, c) => sum.plus(c.rate),
  new Decimal(0)
);

/** Default label used when no flat rate override is provided. */
const DEFAULT_TAX_LABEL = "Sales Tax (American Fork, UT – 7.45%)";

/** Converts a dollar amount to Stripe-compatible integer cents. */
export function toCents(dollars: number): number {
  return new Decimal(dollars).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Calculates the full tax breakdown for a given subtotal (in dollars).
 *
 * @param subtotal - Pre-tax total in dollars.
 * @param flatRatePercent - Optional override (e.g. `8.25` for 8.25%). When omitted,
 *   uses the hardcoded Utah component rates. Set `TAX_RATE` in the Lambda environment
 *   to pass a flat rate without changing code.
 */
export function calculateTax(subtotal: number, flatRatePercent?: number): TaxBreakdown {
  const d = new Decimal(subtotal);

  if (flatRatePercent != null) {
    const rate = new Decimal(flatRatePercent).div(100);
    const pct = new Decimal(flatRatePercent).toDecimalPlaces(2).toString();
    const label = `Sales Tax (${pct}%)`;
    const total = d.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    return {
      lines: [{ label, rate: rate.toFixed(4), amount: total }],
      label,
      total,
    };
  }

  const lines: TaxLine[] = TAX_COMPONENTS.map(({ label, rate }) => ({
    label,
    rate,
    amount: d.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
  }));

  const total = d
    .times(COMBINED_RATE)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();

  return { lines, label: DEFAULT_TAX_LABEL, total };
}
