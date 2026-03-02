"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/context/CartContext";

function ReturnEffect() {
  const cart = useCart();

  useEffect(() => {
    sessionStorage.removeItem("checkout_client_secret");
    sessionStorage.removeItem("checkout_session_id");
    cart.clear();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function CheckoutReturn() {
  return (
    <section className="min-h-[70vh] flex items-center justify-center px-8">
      <ReturnEffect />
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-[rgba(26,26,24,0.07)] flex items-center justify-center text-2xl mx-auto mb-6">
          ✓
        </div>
        <h1 className="font-display text-3xl font-bold lowercase mb-3">
          order received!
        </h1>
        <p className="text-text-light text-sm leading-relaxed">
          thank you — we&apos;ll send a confirmation to your email shortly.
        </p>
        <Link
          href="/shop"
          className="inline-block mt-8 py-3 px-8 bg-[#1A1A18] text-cream rounded font-body text-sm tracking-wider lowercase font-medium hover:bg-[#2A2A26] transition-colors"
        >
          back to shop
        </Link>
      </div>
    </section>
  );
}
