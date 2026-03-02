"use client";

import { useState, useEffect, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import ProductCard from "@/components/ProductCard";
import ProductDrawer from "@/components/ProductDrawer";
import { productRepo } from "@/data/product-repo";
import { Product } from "@/data/types";

const BATCH_SIZE = 6;

export default function ShopClient() {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([productRepo.getAll(), productRepo.getAllTags()]).then(([p, t]) => {
      setProducts(p);
      setTags(t);
      setLoading(false);
    });
  }, []);

  const filtered = activeTag ? products.filter((p) => p.tags.includes(activeTag)) : products;
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Load next batch when sentinel scrolls into view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => c + BATCH_SIZE);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <>
      <PageHeader
        tag="the goods"
        title="shop"
        subtitle="Everything's one-of-a-kind. When it's gone, it's gone."
      >
        <div className="flex justify-center gap-2 mt-8 flex-wrap">
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-8 w-16 rounded-full bg-[rgba(242,237,228,0.08)] animate-pulse"
                />
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => { setActiveTag(null); setVisibleCount(BATCH_SIZE); }}
                className={`py-2 px-5 border rounded-full font-body text-xs lowercase tracking-wide transition-all cursor-pointer ${
                  activeTag === null
                    ? "border-orange text-cream bg-[rgba(212,102,58,0.1)]"
                    : "border-[rgba(242,237,228,0.12)] text-[rgba(242,237,228,0.45)] hover:border-orange hover:text-cream hover:bg-[rgba(212,102,58,0.1)]"
                }`}
              >
                all
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => { setActiveTag(tag); setVisibleCount(BATCH_SIZE); }}
                  className={`py-2 px-5 border rounded-full font-body text-xs lowercase tracking-wide transition-all cursor-pointer ${
                    activeTag === tag
                      ? "border-orange text-cream bg-[rgba(212,102,58,0.1)]"
                      : "border-[rgba(242,237,228,0.12)] text-[rgba(242,237,228,0.45)] hover:border-orange hover:text-cream hover:bg-[rgba(212,102,58,0.1)]"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </>
          )}
        </div>
      </PageHeader>

      <div className="max-w-[1100px] mx-auto py-12 px-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden bg-[rgba(242,237,228,0.03)] border border-[rgba(242,237,228,0.06)] animate-pulse"
              >
                <div className="aspect-square bg-[rgba(242,237,228,0.07)]" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-[rgba(242,237,228,0.07)] rounded w-3/4" />
                  <div className="h-3 bg-[rgba(242,237,228,0.04)] rounded w-1/2" />
                  <div className="h-4 bg-[rgba(242,237,228,0.07)] rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {visible.map((product) => (
                <ProductCard key={product.slug} product={product} onClick={setDrawerProduct} />
              ))}
            </div>
            {hasMore && <div ref={sentinelRef} />}
            {filtered.length === 0 && (
              <p className="text-center text-text-light py-20 text-sm lowercase">
                nothing here yet — check back soon
              </p>
            )}
          </>
        )}
      </div>

      <ProductDrawer product={drawerProduct} onClose={() => setDrawerProduct(null)} />
    </>
  );
}
