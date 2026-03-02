"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { productRepo } from "@/data/product-repo";
import { Product, getProductImage } from "@/data/types";

export default function FeaturedProducts() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productRepo.getFeatured().then((data) => {
      setFeatured(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg overflow-hidden bg-[rgba(242,237,228,0.04)] border border-[rgba(242,237,228,0.06)] animate-pulse"
          >
            <div className="aspect-square bg-[rgba(242,237,228,0.07)]" />
            <div className="p-5 space-y-2">
              <div className="h-4 bg-[rgba(242,237,228,0.07)] rounded w-2/3" />
              <div className="h-3 bg-[rgba(242,237,228,0.04)] rounded w-1/2" />
              <div className="h-4 bg-[rgba(242,237,228,0.07)] rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {featured.map((item) => (
        <Link
          key={item.slug}
          href={`/shop/${item.slug}`}
          className="bg-[rgba(242,237,228,0.05)] rounded-lg overflow-hidden transition-all duration-400 cursor-pointer border border-[rgba(242,237,228,0.06)] hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:border-[rgba(212,102,58,0.2)] block"
        >
          <div className="aspect-square overflow-hidden">
            <Image
              src={getProductImage(item)}
              alt={item.name}
              width={500}
              height={500}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-5">
            <p className="font-display text-base font-semibold text-cream mb-1 lowercase">
              {item.name}
            </p>
            <p className="text-xs text-[rgba(242,237,228,0.4)] mb-3">{item.tagline}</p>
            <p className="font-medium text-orange text-[0.95rem]">
              ${item.price}
              {item.badge && (
                <span className="inline-block text-[0.58rem] tracking-wider uppercase px-2 py-0.5 bg-[rgba(212,102,58,0.12)] text-orange rounded ml-2 font-medium">
                  {item.badge}
                </span>
              )}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
