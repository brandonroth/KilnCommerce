import Link from "next/link";

const footerLinks = [
  { href: "/", label: "home" },
  { href: "/shop", label: "shop" },
  { href: "/posts", label: "posts" },
  { href: "/contact", label: "contact" },
];

export default function Footer() {
  return (
    <footer className="bg-[#1A1A18] py-10 px-8 text-cream">
      <div className="max-w-[1100px] mx-auto flex justify-between items-center flex-wrap gap-5">
        <div className="font-display text-xl font-extrabold lowercase">
          bee&apos;s <span className="text-orange">bowls</span>
        </div>
        <div className="flex gap-6">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[rgba(242,237,228,0.35)] text-xs tracking-wide lowercase hover:text-orange transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <p className="text-center text-[0.68rem] text-[rgba(242,237,228,0.2)] mt-6 pt-5 border-t border-[rgba(242,237,228,0.05)]">
        © 2026 bee&apos;s bowls · handmade with dirt, fire, and questionable taste
      </p>
    </footer>
  );
}
