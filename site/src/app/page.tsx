import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import FeaturedProducts from "@/components/FeaturedProducts";
import NewsletterForm from "@/components/NewsletterForm";

export default function Home() {
  return (
    <>
      {/* ─── ABOUT LANDING ─── */}
      <section className="min-h-screen bg-[#1A1A18] flex items-center py-28 px-8 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_600px_at_15%_40%,rgba(45,74,62,0.4),transparent),radial-gradient(ellipse_400px_400px_at_85%_70%,rgba(212,102,58,0.1),transparent)]" />

        <div className="max-w-[1100px] mx-auto relative z-10 grid grid-cols-1 md:grid-cols-[0.85fr_1.15fr] gap-10 md:gap-16 items-center w-full animate-fade-up">
          {/* Photo grid */}
          <div className="grid grid-cols-[1.2fr_1fr] gap-2 max-w-[400px] md:max-w-none">
            <div className="rounded-lg overflow-hidden aspect-[3/4]">
              <Image
                src="/images/about-hero.webp"
                alt="B's pottery"
                width={500}
                height={667}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="rounded-lg overflow-hidden aspect-square">
                <Image
                  src="/images/about-studio.webp"
                  alt="Studio"
                  width={500}
                  height={500}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
              <div className="rounded-lg overflow-hidden aspect-square">
                <Image
                  src="/images/about-work.webp"
                  alt="Pottery"
                  width={500}
                  height={500}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Text */}
          <div>
            <p className="tag">handmade pottery · no rules</p>
            <h1 className="font-display text-[clamp(2.8rem,6vw,4.5rem)] font-extrabold leading-none text-cream mb-5 tracking-tight lowercase">
              hey, i&apos;m Brandon<span className="text-orange">.</span>
            </h1>
            <h3 className="font-display text-lg font-semibold text-[rgba(242,237,228,0.75)] mb-5 leading-snug lowercase">
              i make things out of dirt and fire and some of them are kinda inappropriate
            </h3>
            <p className="text-[rgba(242,237,228,0.45)] leading-relaxed mb-3 text-[0.92rem]">
              My friends call me B, and I&apos;ve been getting my hands dirty on the wheel for over
              a decade. What started as a way to make my own cereal bowls turned into a full-blown
              obsession with clay, glazes, and seeing what I can get away with.
            </p>
            <p className="text-[rgba(242,237,228,0.45)] leading-relaxed mb-3 text-[0.92rem]">
              I mostly make{" "}
              <strong className="text-[rgba(242,237,228,0.7)] font-medium">functional stuff</strong>{" "}
              — bowls you&apos;ll actually eat out of, mugs that feel perfect in your hand, and
              yeah, some pieces that are a little more...{" "}
              <strong className="text-[rgba(242,237,228,0.7)] font-medium">adventurous</strong>. If
              you want a beautiful bong or a mug with boobs, I got you.
            </p>
            <p className="text-[rgba(242,237,228,0.45)] leading-relaxed text-[0.92rem]">
              Everything is wheel-thrown, food-safe (where applicable), and made with a lot of love
              and probably too much coffee.
            </p>

            <div className="flex gap-4 mt-7 flex-wrap">
              <Link
                href="/shop"
                className="inline-block py-3.5 px-9 bg-orange text-cream rounded font-body text-[0.82rem] tracking-wider lowercase font-medium transition-all hover:bg-orange-light hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(212,102,58,0.3)]"
              >
                shop now
              </Link>
              <Link
                href="/posts"
                className="inline-block py-3.5 px-9 border border-[rgba(242,237,228,0.2)] text-[rgba(242,237,228,0.5)] rounded text-[0.82rem] tracking-wider lowercase font-medium transition-all hover:text-cream hover:border-[rgba(242,237,228,0.5)]"
              >
                see the process
              </Link>
            </div>

            <p className="font-display font-semibold text-lg text-orange mt-6">— b ✌️</p>
          </div>
        </div>
      </section>

      {/* ─── FEATURED ─── */}
      <Reveal>
        <section className="bg-[#1A3028] py-24 px-8 relative">
          <div className="max-w-[1100px] mx-auto">
            <div className="flex justify-between items-end mb-10 flex-wrap gap-4">
              <div>
                <p className="tag">fresh out the kiln</p>
                <p className="section-title text-cream">new drops</p>
              </div>
              <Link
                href="/shop"
                className="inline-block py-3.5 px-9 border border-[rgba(242,237,228,0.25)] text-cream rounded text-[0.82rem] tracking-wider lowercase font-medium transition-all hover:border-cream hover:bg-[rgba(242,237,228,0.06)]"
              >
                view all
              </Link>
            </div>

            <FeaturedProducts />
          </div>
        </section>
      </Reveal>

      {/* ─── TESTIMONIAL ─── */}
      <Reveal>
        <section className="bg-[#1A1A18] py-20 px-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_500px_300px_at_50%_50%,rgba(45,74,62,0.25),transparent)]" />
          <p className="font-display text-[clamp(1.1rem,2.5vw,1.5rem)] text-cream font-normal max-w-[650px] mx-auto mb-5 leading-relaxed relative z-10">
            &ldquo;bought the booby mug as a joke gift. it&apos;s now my favorite mug. no regrets.
            the craftsmanship is genuinely incredible.&rdquo;
          </p>
          <p className="text-xs text-orange tracking-widest uppercase relative z-10">
            — Jake T., one-time joker, lifetime customer
          </p>
        </section>
      </Reveal>

      {/* ─── NEWSLETTER ─── */}
      <Reveal>
        <section className="text-center py-20 px-8 bg-[#1A3028]">
          <p className="tag">stay in the loop</p>
          <p className="section-title text-cream">join the hive</p>
          <p className="text-base text-[rgba(242,237,228,0.55)] max-w-[500px] mx-auto leading-relaxed">
            First dibs on new drops, studio chaos, and the occasional discount. No spam. Pinky
            promise.
          </p>
          <NewsletterForm />
        </section>
      </Reveal>
    </>
  );
}
