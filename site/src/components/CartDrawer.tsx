"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { getProductImage } from "@/data/types";

const API_URL = process.env.SITE_API_URL ?? "";

export default function CartDrawer() {
  const { items, remove, count, subtotal, isOpen, close } = useCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) setError(null);
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [close]);

  if (!isOpen) return null;

  async function handleCheckout() {
    setError(null);
    setLoading(true);

    const slugs = items.map((i) => i.product.slug);
    console.debug("[checkout] submitting", { slugs, itemCount: slugs.length });

    try {
      const res = await fetch(`${API_URL}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("[checkout] request failed", { status: res.status, error: data.error, soldOut: data.soldOut, missing: data.missing });
        if (res.status === 409 && data.soldOut?.length) {
          console.warn("[checkout] removing sold-out items from cart", data.soldOut);
          data.soldOut.forEach((slug: string) => remove(slug));
        }
        setError(data.error ?? "Something went wrong");
        return;
      }

      sessionStorage.setItem("checkout_client_secret", data.clientSecret);
      sessionStorage.setItem("checkout_session_id", data.sessionId);
      close();

      console.debug("[checkout] navigating to embedded checkout");
      router.push("/checkout");
    } catch (err) {
      console.error("[checkout] network error", err);
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in cursor-pointer"
        onClick={close}
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 md:bottom-auto md:top-0 md:left-auto md:right-0 md:w-[420px] md:h-full">
        <div className="bg-cream rounded-t-2xl md:rounded-none md:h-full flex flex-col max-h-[85vh] md:max-h-full shadow-[0_-10px_60px_rgba(0,0,0,0.3)] md:shadow-[-10px_0_60px_rgba(0,0,0,0.3)] animate-slide-up md:animate-slide-left">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[rgba(26,26,24,0.08)]">
            <h2 className="font-display text-lg font-bold lowercase">
              cart {count > 0 && <span className="text-orange">({count})</span>}
            </h2>
            <button
              onClick={close}
              className="w-8 h-8 rounded-full bg-[rgba(26,26,24,0.07)] flex items-center justify-center text-sm hover:bg-[rgba(26,26,24,0.12)] transition-colors"
              aria-label="Close cart"
            >
              ✕
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-6">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
                <p className="text-text-light text-sm">your cart is empty</p>
                <button onClick={close} className="text-sm text-orange underline underline-offset-2">
                  keep browsing
                </button>
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {items.map(({ product }) => (
                  <li key={product.slug} className="flex gap-4 items-center">
                    <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-cream-dark">
                      <Image
                        src={getProductImage(product)}
                        alt={product.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-semibold lowercase truncate">
                        {product.name}
                      </p>
                      <p className="text-orange font-medium text-sm">${product.price}</p>
                    </div>
                    <button
                      onClick={() => remove(product.slug)}
                      className="text-text-light hover:text-text text-xs transition-colors flex-shrink-0 px-1"
                      aria-label={`Remove ${product.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Cart Footer */}
          {items.length > 0 && (
            <div className="p-6 border-t border-[rgba(26,26,24,0.08)]">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-text-light lowercase">subtotal</span>
                <span className="font-display font-bold text-lg">${subtotal.toFixed(2)}</span>
              </div>
              {error && (
                <p className="text-sm text-red-500 mb-3">{error}</p>
              )}
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full py-3.5 bg-orange text-cream rounded font-body text-sm tracking-wider lowercase font-medium hover:bg-orange/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "loading..." : "checkout →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
