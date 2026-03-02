"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { postRepo } from "@/data/post-repo";
import { Post } from "@/data/types";

export default function PostPageClient() {
  const pathname = usePathname();
  const slug = pathname.split("/").pop() ?? "";
  const [post, setPost] = useState<Post | null | undefined>(undefined);

  useEffect(() => {
    postRepo.getBySlug(slug).then(setPost).catch(() => setPost(null));
  }, [slug]);

  if (post === undefined) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="max-w-[720px] mx-auto py-24 px-8">
          <div className="h-3 w-20 bg-[rgba(26,26,24,0.06)] rounded animate-pulse mb-6" />
          <div className="h-10 w-3/4 bg-[rgba(26,26,24,0.06)] rounded animate-pulse mb-4" />
          <div className="space-y-3 mt-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-[rgba(26,26,24,0.04)] rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (post === null) notFound();

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[720px] mx-auto py-24 px-8">
        <Link
          href="/posts"
          className="text-text-light text-sm hover:text-text transition-colors lowercase"
        >
          ← all posts
        </Link>

        <div className="mt-8 mb-12">
          <p className="text-[0.62rem] tracking-widest uppercase text-orange font-medium mb-3">
            {post.type} · {post.date}
          </p>
          <h1 className="font-display text-4xl font-extrabold lowercase leading-tight tracking-tight mb-4">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="text-text-light text-lg leading-relaxed">{post.excerpt}</p>
          )}
          <div className="flex gap-2 mt-4 flex-wrap">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-[0.6rem] tracking-wider uppercase px-2.5 py-1 border border-[rgba(26,26,24,0.1)] rounded-full text-text-light"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {post.body && (
          <div
            className="prose prose-stone max-w-none prose-headings:font-display prose-headings:lowercase prose-headings:font-semibold"
            dangerouslySetInnerHTML={{ __html: post.body }}
          />
        )}
      </div>
    </div>
  );
}
