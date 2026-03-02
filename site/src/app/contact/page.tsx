"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import { STORE_EMAIL, STORE_LOCATION, STORE_SOCIAL } from "@/config";

interface StoreSettings {
  "store.email": string;
  "store.location": string;
  "store.social.instagram": string;
  "store.social.tiktok": string;
  "store.social.etsy": string;
}

const SOCIAL_LABELS: Record<string, string> = {
  "store.social.instagram": "IG",
  "store.social.tiktok":    "TT",
  "store.social.etsy":      "Et",
};

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("just saying hi");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch live store settings — falls back to compile-time config while loading.
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    const apiUrl = process.env.SITE_API_URL;
    if (!apiUrl) return;
    fetch(`${apiUrl}/settings`)
      .then((r) => r.ok ? r.json() as Promise<StoreSettings> : Promise.reject())
      .then(setSettings)
      .catch(() => { /* silently use compile-time fallbacks */ });
  }, []);

  const storeEmail    = settings?.["store.email"]    ?? STORE_EMAIL;
  const storeLocation = settings?.["store.location"] ?? STORE_LOCATION;

  // Build the social list from live settings, falling back to the static config.
  // A platform is hidden when its URL is empty.
  const storeSocial = settings
    ? (["store.social.instagram", "store.social.tiktok", "store.social.etsy"] as const)
        .map((key) => ({ label: SOCIAL_LABELS[key], href: settings[key] }))
        .filter(({ href }) => href)
    : STORE_SOCIAL.filter(({ href }) => href !== "#");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.SITE_API_URL}/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message, website }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setSuccess(true);
      setName("");
      setEmail("");
      setSubject("just saying hi");
      setMessage("");
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        tag="let's talk"
        title="say hey"
        subtitle="Custom orders, collabs, wholesale, or just wanna say what's up — I'm all ears."
      />

      <section className="py-16 px-8">
        <div className="max-w-[1000px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-16 items-start">
          <div>
            <h3 className="font-display text-2xl font-bold lowercase mb-4">
              let&apos;s make something cool
            </h3>
            <p className="text-[0.92rem] text-text-light leading-relaxed mb-6">
              I usually get back to people within a day or two. If you&apos;re thinking custom work,
              tell me what you&apos;ve got in mind — size, color, how weird you want it. No judgment
              here.
            </p>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[rgba(212,102,58,0.12)] flex items-center justify-center text-sm">
                ✉
              </div>
              <span className="text-sm">{storeEmail}</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[rgba(212,102,58,0.12)] flex items-center justify-center text-sm">
                📍
              </div>
              <span className="text-sm">
                Studio visits by appointment
                <br />
                {storeLocation}
              </span>
            </div>
            <div className="flex gap-3 mt-7">
              {storeSocial.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="w-10 h-10 rounded-full border border-[rgba(26,26,24,0.12)] flex items-center justify-center text-text-light text-xs font-medium transition-all hover:border-orange hover:text-orange hover:bg-[rgba(212,102,58,0.12)]"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {success ? (
            <div className="py-12 text-center">
              <p className="font-display text-2xl font-bold lowercase mb-2">message sent!</p>
              <p className="text-[0.92rem] text-text-light">
                Thanks for reaching out — I&apos;ll get back to you soon.
              </p>
              <button
                onClick={() => setSuccess(false)}
                className="mt-6 text-sm text-orange underline underline-offset-2"
              >
                send another
              </button>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
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
              <div className="flex gap-4 flex-col sm:flex-row">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[0.68rem] tracking-widest uppercase text-text-light font-medium">
                    name
                  </label>
                  <input
                    type="text"
                    placeholder="your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="py-3 px-4 border border-[rgba(26,26,24,0.1)] rounded font-body text-sm bg-cream outline-none focus:border-orange transition-colors"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[0.68rem] tracking-widest uppercase text-text-light font-medium">
                    email
                  </label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="py-3 px-4 border border-[rgba(26,26,24,0.1)] rounded font-body text-sm bg-cream outline-none focus:border-orange transition-colors"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.68rem] tracking-widest uppercase text-text-light font-medium">
                  what&apos;s up
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="py-3 px-4 border border-[rgba(26,26,24,0.1)] rounded font-body text-sm bg-cream outline-none focus:border-orange transition-colors"
                >
                  <option>just saying hi</option>
                  <option>custom order</option>
                  <option>wholesale / stockist</option>
                  <option>collab idea</option>
                  <option>press / media</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.68rem] tracking-widest uppercase text-text-light font-medium">
                  message
                </label>
                <textarea
                  placeholder="tell me everything..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  className="py-3 px-4 border border-[rgba(26,26,24,0.1)] rounded font-body text-sm bg-cream outline-none focus:border-orange transition-colors resize-y min-h-[110px]"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="self-start py-3.5 px-9 bg-[#1A1A18] text-cream rounded font-body text-[0.82rem] tracking-wider lowercase font-medium transition-all hover:bg-[#2A2A26] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "sending..." : "send it"}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
