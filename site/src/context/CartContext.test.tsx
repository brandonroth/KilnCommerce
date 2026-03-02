import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, renderHook, act } from "@testing-library/react";
import { CartProvider, useCart } from "./CartContext";
import { Product } from "@/data/types";
import React from "react";

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  slug: "test-bowl",
  name: "Test Bowl",
  price: 120,
  images: ["img.jpg"],
  tagline: "A bowl",
  tags: [],
  details: {},
  ...overrides,
});

// Helper to capture context value from a rendered tree
function captureCart() {
  const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
  return { getCart: () => result.current };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("CartContext - add", () => {
  it("adds a product to the cart", () => {
    const { getCart } = captureCart();
    act(() => getCart().add(makeProduct()));
    expect(getCart().items).toHaveLength(1);
    expect(getCart().items[0].product.slug).toBe("test-bowl");
  });

  it("does not add duplicate products", () => {
    const { getCart } = captureCart();
    act(() => {
      getCart().add(makeProduct());
      getCart().add(makeProduct());
    });
    expect(getCart().items).toHaveLength(1);
  });
});

describe("CartContext - remove", () => {
  it("removes a product by slug", () => {
    const { getCart } = captureCart();
    act(() => getCart().add(makeProduct()));
    act(() => getCart().remove("test-bowl"));
    expect(getCart().items).toHaveLength(0);
  });

  it("does not affect other items when removing", () => {
    const { getCart } = captureCart();
    act(() => {
      getCart().add(makeProduct({ slug: "a" }));
      getCart().add(makeProduct({ slug: "b" }));
    });
    act(() => getCart().remove("a"));
    expect(getCart().items).toHaveLength(1);
    expect(getCart().items[0].product.slug).toBe("b");
  });
});

describe("CartContext - clear", () => {
  it("removes all items", () => {
    const { getCart } = captureCart();
    act(() => {
      getCart().add(makeProduct({ slug: "a" }));
      getCart().add(makeProduct({ slug: "b" }));
    });
    act(() => getCart().clear());
    expect(getCart().items).toHaveLength(0);
  });
});

describe("CartContext - count and subtotal", () => {
  it("tracks count correctly", () => {
    const { getCart } = captureCart();
    act(() => {
      getCart().add(makeProduct({ slug: "a", price: 100 }));
      getCart().add(makeProduct({ slug: "b", price: 200 }));
    });
    expect(getCart().count).toBe(2);
  });

  it("calculates subtotal as sum of item prices", () => {
    const { getCart } = captureCart();
    act(() => {
      getCart().add(makeProduct({ slug: "a", price: 100 }));
      getCart().add(makeProduct({ slug: "b", price: 200 }));
    });
    expect(getCart().subtotal).toBe(300);
  });

  it("returns 0 for empty cart", () => {
    const { getCart } = captureCart();
    expect(getCart().count).toBe(0);
    expect(getCart().subtotal).toBe(0);
  });
});

describe("CartContext - drawer open/close", () => {
  it("starts closed", () => {
    const { getCart } = captureCart();
    expect(getCart().isOpen).toBe(false);
  });

  it("opens and closes", () => {
    const { getCart } = captureCart();
    act(() => getCart().open());
    expect(getCart().isOpen).toBe(true);
    act(() => getCart().close());
    expect(getCart().isOpen).toBe(false);
  });
});

describe("CartContext - localStorage persistence", () => {
  it("persists items to localStorage on add", () => {
    const { getCart } = captureCart();
    act(() => getCart().add(makeProduct()));
    const stored = JSON.parse(localStorage.getItem("cart")!);
    expect(stored).toHaveLength(1);
    expect(stored[0].product.slug).toBe("test-bowl");
  });

  it("restores items from localStorage on mount", () => {
    const product = makeProduct();
    localStorage.setItem("cart", JSON.stringify([{ product }]));

    const { getCart } = captureCart();
    // After mount effect runs
    expect(getCart().items[0]?.product.slug).toBe("test-bowl");
  });

  it("clears localStorage when cart is cleared", () => {
    const { getCart } = captureCart();
    act(() => getCart().add(makeProduct()));
    act(() => getCart().clear());
    const stored = JSON.parse(localStorage.getItem("cart")!);
    expect(stored).toHaveLength(0);
  });
});

describe("CartContext - error boundary", () => {
  it("throws when useCart is used outside CartProvider", () => {
    function Bad() {
      useCart();
      return null;
    }
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(
      "useCart must be used within CartProvider"
    );
    consoleSpy.mockRestore();
  });
});
