"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product } from "@/data/types";

interface CartItem {
  product: Product;
}

interface CartContextValue {
  items: CartItem[];
  add: (product: Product) => void;
  remove: (slug: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cart");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setItems(JSON.parse(stored));
    } catch (err) {
      console.error("[cart] failed to restore cart from localStorage", err);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const add = (product: Product) => {
    setItems((prev) => {
      if (prev.some((i) => i.product.slug === product.slug)) return prev;
      return [...prev, { product }];
    });
  };

  const remove = (slug: string) => {
    setItems((prev) => prev.filter((i) => i.product.slug !== slug));
  };

  const clear = () => setItems([]);

  const count = items.length;
  const subtotal = items.reduce((sum, i) => sum + i.product.price, 0);

  return (
    <CartContext.Provider
      value={{ items, add, remove, clear, count, subtotal, isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
