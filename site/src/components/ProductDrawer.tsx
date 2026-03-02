"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { Product, getProductImage } from "@/data/types";
import { useCart } from "@/context/CartContext";

interface Props {
  product: Product | null;
  onClose: () => void;
}

export default function ProductDrawer({ product, onClose }: Props) {
  // Lock body scroll when open
  useEffect(() => {
    if (product) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [product]);

  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const { add, items, open: openCart } = useCart();

  if (!product) return null;

  const heroImg = getProductImage(product);
  const inCart = items.some((i) => i.product.slug === product.slug);
  // Pick a few highlight details (first 3)
  const highlightDetails = Object.entries(product.details).slice(0, 4);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in cursor-pointer"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:bottom-auto md:top-0 md:left-auto md:right-0 md:w-[440px] md:h-full">
        <div className="bg-cream rounded-t-2xl md:rounded-none md:h-full max-h-[85vh] md:max-h-full overflow-y-auto shadow-[0_-10px_60px_rgba(0,0,0,0.3)] md:shadow-[-10px_0_60px_rgba(0,0,0,0.3)] animate-slide-up md:animate-slide-left">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[rgba(26,26,24,0.7)] text-cream flex items-center justify-center text-sm hover:bg-[rgba(26,26,24,0.9)] transition-colors"
            aria-label="Close"
          >
            ✕
          </button>

          {/* Hero image */}
          <div className="aspect-square overflow-hidden relative">
            <Image
              src={heroImg}
              alt={product.name}
              width={500}
              height={500}
              className="w-full h-full object-cover"
            />
            {product.badge && (
              <span className="absolute top-4 left-4 text-[0.6rem] tracking-wider uppercase px-3 py-1 bg-orange text-cream rounded-full font-medium">
                {product.badge}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Tags */}
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[0.6rem] tracking-wider uppercase px-2.5 py-1 border border-[rgba(26,26,24,0.1)] rounded-full text-text-light"
                >
                  {tag}
                </span>
              ))}
            </div>

            <h2 className="font-display text-2xl font-bold lowercase mb-1">{product.name}</h2>
            <p className="text-sm text-text-light mb-4">{product.tagline}</p>
            <p className="font-display text-xl font-bold text-orange mb-5">${product.price}</p>

            {/* Quick details */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-6">
              {highlightDetails.map(([key, value]) => (
                <div key={key}>
                  <p className="text-[0.6rem] tracking-wider uppercase text-text-light font-medium">
                    {key}
                  </p>
                  <p className="text-sm">{value}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { add(product); openCart(); }}
                className="flex-1 py-3.5 bg-orange text-cream rounded font-body text-sm tracking-wider lowercase font-medium transition-all hover:bg-orange-light disabled:opacity-60"
                disabled={inCart}
              >
                {inCart ? "in cart ✓" : "add to cart"}
              </button>
              <Link
                href={`/shop/${product.slug}`}
                onClick={onClose}
                className="py-3.5 px-6 border border-[rgba(26,26,24,0.15)] rounded text-sm tracking-wider lowercase font-medium transition-all hover:border-[#1A1A18] text-center"
              >
                full details
              </Link>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}
