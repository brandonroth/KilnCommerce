"use client";

import { useState } from "react";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.SITE_API_URL}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      if (!res.ok) throw new Error("Subscription failed");
      setSuccess(true);
      setEmail("");
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <p className="text-cream font-body text-sm mt-7">
        you&apos;re in the hive. talk soon 🐝
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2.5 max-w-[420px] mx-auto mt-7">
      {/* Honeypot: visually hidden, bots fill it, humans never see it */}
      <input
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-5000px]"
      />
      <input
        type="email"
        placeholder="your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={loading}
        className="flex-1 py-3 px-4 border border-[rgba(242,237,228,0.15)] rounded font-body text-sm bg-[rgba(242,237,228,0.06)] text-cream outline-none placeholder:text-[rgba(242,237,228,0.3)] focus:border-orange transition-colors disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={loading}
        className="py-3 px-8 bg-orange text-cream rounded font-body text-[0.82rem] tracking-wider lowercase font-medium transition-all hover:bg-orange-light hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(212,102,58,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
      >
        {loading ? "joining..." : "join"}
      </button>
      {error && (
        <p className="text-sm text-red-400 mt-2 absolute">{error}</p>
      )}
    </form>
  );
}
