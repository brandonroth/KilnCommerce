"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";

const links = [
  { href: "/", label: "home" },
  { href: "/shop", label: "shop" },
  { href: "/posts", label: "posts" },
  { href: "/contact", label: "contact" },
];

export default function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { count, open: openCart } = useCart();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 flex justify-between items-center transition-all duration-400 ${
        scrolled
          ? "bg-[rgba(26,26,24,0.92)] backdrop-blur-[18px] py-3 px-8"
          : "bg-[rgba(26,26,24,0.5)] backdrop-blur-[10px] py-5 px-8"
      }`}
    >
      <Link
        href="/"
        className="font-display text-2xl font-extrabold text-cream lowercase tracking-tight"
        onClick={() => setMenuOpen(false)}
      >
        bee&apos;s <span className="text-orange">bowls</span>
      </Link>

      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-8">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-[0.82rem] lowercase tracking-wide transition-colors duration-300 ${
              pathname === link.href
                ? "text-cream border-b border-orange pb-0.5"
                : "text-[rgba(242,237,228,0.5)] hover:text-cream"
            }`}
          >
            {link.label}
          </Link>
        ))}
        <CartButton count={count} onClick={openCart} />
      </div>

      {/* Mobile right side */}
      <div className="flex md:hidden items-center gap-4">
        <CartButton count={count} onClick={openCart} />
        <button
          className="flex flex-col gap-[5px] bg-transparent border-none cursor-pointer p-1"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className="w-6 h-[1.5px] bg-cream block" />
          <span className="w-6 h-[1.5px] bg-cream block" />
          <span className="w-6 h-[1.5px] bg-cream block" />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-[rgba(26,26,24,0.97)] backdrop-blur-2xl p-6 flex flex-col gap-5 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`text-sm lowercase tracking-wide ${
                pathname === link.href ? "text-cream" : "text-[rgba(242,237,228,0.5)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

function CartButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open cart"
      className="relative text-[rgba(242,237,228,0.7)] hover:text-cream transition-colors"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange text-cream text-[0.6rem] font-bold rounded-full flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  );
}
