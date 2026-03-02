"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import type { StripeEmbeddedCheckoutShippingDetailsChangeEvent, ResultAction } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.STRIPE_PUBLISHABLE_KEY!);
const API_URL = process.env.SITE_API_URL ?? "";

export default function CheckoutPage() {
  const router = useRouter();
  const [clientSecret] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("checkout_client_secret") : null
  );
  const [sessionId] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("checkout_session_id") : null
  );
  const completingRef = useRef(false);

  useEffect(() => {
    if (!clientSecret) router.replace("/shop");
  }, [clientSecret, router]);

  // Cancel the session on unmount if payment didn't complete (back nav, tab close, etc.)
  useEffect(() => {
    return () => {
      if (completingRef.current) return;
      const id = sessionStorage.getItem("checkout_session_id");
      if (!id) return; // already handled by cancel button
      sessionStorage.removeItem("checkout_client_secret");
      sessionStorage.removeItem("checkout_session_id");
      fetch(`${API_URL}/checkout/${id}`, { method: "DELETE", keepalive: true }).catch(() => null);
    };
  }, []);

  async function handleCancel() {
    const id = sessionId;
    sessionStorage.removeItem("checkout_client_secret");
    sessionStorage.removeItem("checkout_session_id");

    if (id) {
      // fire-and-forget — releases the reservation; webhook handles cleanup if already expired
      fetch(`${API_URL}/checkout/${id}`, { method: "DELETE" }).catch(() => null);
    }

    router.push("/shop");
  }

  /**
   * Called by Stripe's embedded checkout when the customer enters or changes their shipping address.
   * We POST to our Lambda which calls Shippo and updates the session's shipping_options via Stripe API.
   * Return {type: "accept"} to let Stripe display the rates, or {type: "reject"} to show an error.
   */
  async function onShippingDetailsChange(event: StripeEmbeddedCheckoutShippingDetailsChangeEvent): Promise<ResultAction> {
    try {
      const res = await fetch(`${API_URL}/shipping/rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutSessionId: event.checkoutSessionId,
          shippingDetails: event.shippingDetails,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        return { type: "reject", errorMessage: data.error ?? "Shipping not available for this address" };
      }

      return { type: "accept" };
    } catch {
      return { type: "reject", errorMessage: "Unable to calculate shipping — please try again" };
    }
  }

  if (!clientSecret) return null;

  return (
    <section className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <EmbeddedCheckoutProvider
          stripe={stripePromise}
          options={{
            clientSecret,
            onComplete: () => { completingRef.current = true; },
            onShippingDetailsChange,
          }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>

        <div className="mt-6 text-center">
          <button
            onClick={handleCancel}
            className="text-sm text-text-light underline underline-offset-2 hover:text-text transition-colors"
          >
            cancel and return to shop
          </button>
        </div>
      </div>
    </section>
  );
}
