"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound, usePathname } from "next/navigation";
import { productRepo } from "@/data/product-repo";
import { Product, getProductImage } from "@/data/types";
import { useCart } from "@/context/CartContext";

export default function ProductPageClient() {
  const pathname = usePathname();
  const slug = pathname.split("/").pop() ?? "";
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [related, setRelated] = useState<Product[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { add, items, open: openCart } = useCart();

  useEffect(() => {
    Promise.all([productRepo.getBySlug(slug), productRepo.getAll()]).then(([p, all]) => {
      setProduct(p);
      setSelectedImage(null); // reset on product change
      if (p) {
        setRelated(
          all.filter((a) => a.slug !== p.slug && a.tags.some((t) => p.tags.includes(t))).slice(0, 3)
        );
      }
    });
  }, [slug]);

  if (product === undefined) {
    return (
      <div className="min-h-screen">
        <div className="bg-[#1A1A18] pt-24 pb-6 px-8">
          <div className="max-w-[1100px] mx-auto">
            <div className="h-4 w-24 bg-[rgba(242,237,228,0.07)] rounded animate-pulse" />
          </div>
        </div>
        <div className="bg-[#1A1A18] pb-16 px-8">
          <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="aspect-square rounded-lg bg-[rgba(242,237,228,0.07)] animate-pulse" />
            <div className="space-y-4 pt-4">
              <div className="h-3 w-1/4 bg-[rgba(242,237,228,0.05)] rounded animate-pulse" />
              <div className="h-10 w-3/4 bg-[rgba(242,237,228,0.07)] rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-[rgba(242,237,228,0.05)] rounded animate-pulse" />
              <div className="h-8 w-1/4 bg-[rgba(242,237,228,0.07)] rounded animate-pulse" />
              <div className="h-14 w-full bg-[rgba(212,102,58,0.15)] rounded-lg animate-pulse mt-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (product === null) notFound();

  const allDetails = Object.entries(product.details);

  return (
    <div className="min-h-screen">
      {/* Back nav */}
      <div className="bg-[#1A1A18] pt-24 pb-6 px-8">
        <div className="max-w-[1100px] mx-auto">
          <Link
            href="/shop"
            className="text-[rgba(242,237,228,0.45)] text-sm hover:text-cream transition-colors lowercase"
          >
            ← back to shop
          </Link>
        </div>
      </div>

      {/* Product hero section */}
      <div className="bg-[#1A1A18] pb-16 px-8">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          <div className="flex flex-col gap-3">
            <div className="aspect-square rounded-lg overflow-hidden relative">
              <Image
                src={selectedImage ?? getProductImage(product)}
                alt={product.name}
                width={600}
                height={600}
                className="w-full h-full object-cover"
                priority
              />
              {product.badge && (
                <span className="absolute top-4 left-4 text-[0.6rem] tracking-wider uppercase px-3 py-1.5 bg-orange text-cream rounded-full font-medium">
                  {product.badge}
                </span>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img, i) => {
                  const active = (selectedImage ?? getProductImage(product)) === img;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(img)}
                      className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${active ? "border-orange" : "border-[rgba(242,237,228,0.1)] hover:border-orange"}`}
                    >
                      <Image
                        src={img}
                        alt={`${product.name} ${i + 1}`}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="md:sticky md:top-28">
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[0.6rem] tracking-wider uppercase px-2.5 py-1 border border-[rgba(242,237,228,0.12)] rounded-full text-[rgba(242,237,228,0.4)]"
                >
                  {tag}
                </span>
              ))}
            </div>

            <h1 className="font-display text-4xl font-extrabold text-cream lowercase mb-2 tracking-tight">
              {product.name}
            </h1>
            <p className="text-[rgba(242,237,228,0.5)] mb-6">{product.tagline}</p>

            <p className="font-display text-3xl font-bold text-orange mb-8">${product.price}</p>

            {product.description && (
              <p className="text-[rgba(242,237,228,0.5)] leading-relaxed text-[0.92rem] mb-8">
                {product.description}
              </p>
            )}

            {product.orderId ? (
              <div className="w-full py-4 border border-[rgba(242,237,228,0.1)] rounded-lg text-center text-[rgba(242,237,228,0.35)] text-sm lowercase tracking-wider mb-8">
                this piece has found its home
              </div>
            ) : (
              <button
                onClick={() => { add(product); openCart(); }}
                disabled={items.some((i) => i.product.slug === product.slug)}
                className="w-full py-4 bg-orange text-cream rounded-lg font-body text-sm tracking-wider lowercase font-medium transition-all hover:bg-orange-light hover:shadow-[0_8px_30px_rgba(212,102,58,0.3)] mb-8 disabled:opacity-60"
              >
                {items.some((i) => i.product.slug === product.slug)
                  ? "in cart ✓"
                  : `add to cart — $${product.price}`}
              </button>
            )}

            <div className="border-t border-[rgba(242,237,228,0.08)] pt-6">
              <p className="text-[0.65rem] tracking-widest uppercase text-orange font-medium mb-4">
                details
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {allDetails.map(([key, value]) => (
                  <div key={key}>
                    <p className="text-[0.6rem] tracking-wider uppercase text-[rgba(242,237,228,0.35)] font-medium mb-0.5">
                      {key}
                    </p>
                    <p className="text-sm text-[rgba(242,237,228,0.7)]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {(product.weight || product.length || product.width || product.height) && (
              <div className="border-t border-[rgba(242,237,228,0.08)] pt-6 mt-2">
                <p className="text-[0.65rem] tracking-widest uppercase text-orange font-medium mb-4">
                  size &amp; weight
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {!!product.weight && (
                    <div>
                      <p className="text-[0.6rem] tracking-wider uppercase text-[rgba(242,237,228,0.35)] font-medium mb-0.5">weight</p>
                      <p className="text-sm text-[rgba(242,237,228,0.7)]">{product.weight} oz</p>
                    </div>
                  )}
                  {!!(product.length && product.width && product.height) && (
                    <div>
                      <p className="text-[0.6rem] tracking-wider uppercase text-[rgba(242,237,228,0.35)] font-medium mb-0.5">dimensions</p>
                      <p className="text-sm text-[rgba(242,237,228,0.7)]">{product.length}&Prime; &times; {product.width}&Prime; &times; {product.height}&Prime;</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="bg-cream py-16 px-8">
          <div className="max-w-[1100px] mx-auto">
            <p className="tag">you might also like</p>
            <p className="section-title mb-8">more good stuff</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/shop/${item.slug}`}
                  className="bg-cream rounded-lg overflow-hidden border border-[rgba(26,26,24,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(26,26,24,0.08)] block"
                >
                  <div className="aspect-square overflow-hidden">
                    <Image
                      src={getProductImage(item)}
                      alt={item.name}
                      width={400}
                      height={400}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-display text-[0.95rem] font-semibold lowercase mb-0.5">
                      {item.name}
                    </p>
                    <p className="text-xs text-text-light mb-2">{item.tagline}</p>
                    <span className="font-medium text-orange">${item.price}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
