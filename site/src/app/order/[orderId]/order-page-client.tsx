"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface ShippingInfo {
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  shippedAt: string;
}

interface OrderData {
  orderId: string;
  createdAt: string;
  items: { name: string }[];
  shipping: ShippingInfo | null;
}

const API_URL = process.env.SITE_API_URL ?? "";

export default function OrderPageClient() {
  const pathname = usePathname();
  const orderId = pathname.split("/").pop() ?? "";
  const [order, setOrder] = useState<OrderData | null | undefined>(undefined);

  useEffect(() => {
    if (!orderId || orderId === "_shell") return;
    fetch(`${API_URL}/orders/${orderId}`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json() as Promise<OrderData>;
      })
      .then(setOrder)
      .catch(() => setOrder(null));
  }, [orderId]);

  if (order === undefined) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-8">
        <div className="max-w-md w-full space-y-4">
          <div className="h-4 w-32 bg-[rgba(26,26,24,0.06)] rounded animate-pulse" />
          <div className="h-8 w-3/4 bg-[rgba(26,26,24,0.06)] rounded animate-pulse" />
          <div className="h-4 w-full bg-[rgba(26,26,24,0.04)] rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-[rgba(26,26,24,0.04)] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-8">
        <div className="max-w-md text-center">
          <p className="text-text-light text-sm">Order not found.</p>
          <Link href="/shop" className="inline-block mt-6 text-sm text-orange underline underline-offset-2">
            back to shop
          </Link>
        </div>
      </div>
    );
  }

  const orderDate = new Date(order.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="min-h-[70vh] px-8 py-24">
      <div className="max-w-md mx-auto">
        <p className="text-[0.62rem] tracking-widest uppercase text-text-light font-medium mb-2">
          order · {orderDate}
        </p>
        <h1 className="font-display text-3xl font-bold lowercase mb-1">
          {order.orderId}
        </h1>

        {/* Items */}
        <div className="mt-8 border-t border-[rgba(26,26,24,0.1)] pt-6">
          <p className="text-[0.68rem] tracking-widest uppercase text-text-light font-medium mb-3">items</p>
          <ul className="space-y-2">
            {order.items.map((item, i) => (
              <li key={i} className="text-sm font-body">
                {item.name}
              </li>
            ))}
          </ul>
        </div>

        {/* Shipping */}
        <div className="mt-8 border-t border-[rgba(26,26,24,0.1)] pt-6">
          <p className="text-[0.68rem] tracking-widest uppercase text-text-light font-medium mb-3">shipping</p>
          {order.shipping ? (
            <div className="space-y-2 text-sm font-body">
              <p>
                <span className="text-text-light">carrier: </span>
                {order.shipping.carrier.toUpperCase()}
              </p>
              <p>
                <span className="text-text-light">tracking: </span>
                {order.shipping.trackingNumber}
              </p>
              <a
                href={order.shipping.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 py-2.5 px-6 bg-[#1A1A18] text-cream rounded font-body text-[0.82rem] tracking-wider lowercase font-medium hover:bg-[#2A2A26] transition-colors"
              >
                track package →
              </a>
            </div>
          ) : (
            <p className="text-sm text-text-light">not yet shipped — we&apos;ll email you when it&apos;s on its way.</p>
          )}
        </div>

        <Link href="/shop" className="inline-block mt-10 text-sm text-text-light hover:text-orange transition-colors">
          ← back to shop
        </Link>
      </div>
    </section>
  );
}
