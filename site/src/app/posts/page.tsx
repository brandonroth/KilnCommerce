"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import { postRepo } from "@/data/post-repo";
import { Post } from "@/data/types";
import Link from "next/link";

const CARD_COLORS = [
  "from-[#2D4A3E] to-[#1A3028]",
  "from-[#4A3A2A] to-[#3A2A1A]",
  "from-[#2A2A26] to-[#1A1A18]",
  "from-[#3D6B56] to-[#2D4A3E]",
  "from-[#3A2A3A] to-[#2A1A2A]",
  "from-[#4A3A1A] to-[#3A2A10]",
];

const BATCH_SIZE = 6;

function PostCard({ post, colorClass }: { post: Post; colorClass: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Link
      href={`/posts/${post.slug}`}
      className="block break-inside-avoid mb-6 bg-cream rounded-lg overflow-hidden border border-[rgba(26,26,24,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(26,26,24,0.07)]"
    >
      <div className="aspect-[4/3] relative overflow-hidden">
        {post.image ? (
          <>
            {!loaded && <div className="absolute inset-0 bg-[#e8e3d9] animate-pulse" />}
            <Image
              src={post.image}
              alt={post.title}
              fill
              className={`object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setLoaded(true)}
            />
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${colorClass}`} />
        )}
      </div>
      <div className={`${post.excerpt ? "p-5" : "p-3"}`}>
        <p className="text-[0.62rem] tracking-widest uppercase text-orange font-medium mb-2">
          {post.type} · {post.date}
        </p>
        <p className="font-display text-lg font-semibold leading-snug lowercase mb-2">
          {post.title}
        </p>
        {post.excerpt && (
          <p className="text-sm text-text-light leading-relaxed">{post.excerpt}</p>
        )}
      </div>
    </Link>
  );
}

export default function Posts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    postRepo
      .getAll()
      .then(setPosts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const visible = posts.slice(0, visibleCount);
  const hasMore = visibleCount < posts.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((c) => c + BATCH_SIZE);
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <>
      <PageHeader
        tag="studio life"
        title="posts"
        subtitle="Process shots, kiln surprises, and the occasional rant about clay."
      />

      <div className="max-w-[1100px] mx-auto py-12 px-8">
        {loading ? (
          <p className="text-sm text-text-light">loading...</p>
        ) : (
          <>
            <div className="columns-1 md:columns-2 gap-6">
              {visible.map((post, i) => (
                <PostCard
                  key={post.slug}
                  post={post}
                  colorClass={CARD_COLORS[i % CARD_COLORS.length]}
                />
              ))}
            </div>
            {hasMore && <div ref={sentinelRef} />}
          </>
        )}
      </div>
    </>
  );
}
