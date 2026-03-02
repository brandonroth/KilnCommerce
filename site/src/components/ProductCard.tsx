"use client";

import Image from "next/image";
import { useState } from "react";
import { Product, getProductImage } from "@/data/types";

interface Props {
  product: Product;
  onClick: (product: Product) => void;
}

export default function ProductCard({ product, onClick }: Props) {
  const img = getProductImage(product);
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      onClick={() => onClick(product)}
      className="bg-cream rounded-lg overflow-hidden border border-[rgba(26,26,24,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(26,26,24,0.08)] cursor-pointer group"
    >
      <div className="aspect-square overflow-hidden relative">
        {!loaded && <div className="absolute inset-0 bg-[#e8e3d9] animate-pulse" />}
        <Image
          src={img}
          alt={product.name}
          width={500}
          height={500}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
        />
        {product.badge && (
          <span className="absolute top-3 left-3 text-[0.55rem] tracking-wider uppercase px-2.5 py-1 bg-orange text-cream rounded-full font-medium">
            {product.badge}
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="font-display text-[0.95rem] font-semibold lowercase mb-0.5">{product.name}</p>
        <p className="text-xs text-text-light mb-2">{product.tagline}</p>
        <div className="flex justify-between items-center">
          <span className="font-medium text-orange">${product.price}</span>
          <span className="w-7 h-7 rounded-full border border-[#1A1A18] flex items-center justify-center text-sm transition-all group-hover:bg-[#1A1A18] group-hover:text-cream">
            +
          </span>
        </div>
      </div>
    </div>
  );
}
