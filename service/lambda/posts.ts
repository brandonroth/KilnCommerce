import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import matter from "gray-matter";
import { marked } from "marked";
import { logger } from "./logger";

const s3 = new S3Client({});

interface Deps {
  s3: S3Client;
  bucket: string;
}

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function readPost(deps: Deps, key: string): Promise<string> {
  const res = await deps.s3.send(new GetObjectCommand({ Bucket: deps.bucket, Key: key }));
  return res.Body!.transformToString();
}

export function createHandler(deps: Deps) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const slug = event.pathParameters?.slug;

    try {
      if (slug) {
        // GET /posts/{slug} — full post with rendered body
        if (!/^[a-z0-9-]+$/.test(slug)) {
          return json(404, { error: "Post not found" });
        }
        let raw: string;
        try {
          raw = await readPost(deps, `${slug}.md`);
        } catch {
          return json(404, { error: "Post not found" });
        }

        const { data, content } = matter(raw);
        const body = await marked(content);
        return json(200, { slug, ...data, body });
      }

      // GET /posts — list all, frontmatter only, sorted newest first
      const list = await deps.s3.send(new ListObjectsV2Command({ Bucket: deps.bucket }));

      const keys = (list.Contents ?? [])
        .map((o) => o.Key!)
        .filter((k) => k.endsWith(".md"));

      const posts = await Promise.all(
        keys.map(async (key) => {
          const raw = await readPost(deps, key);
          const { data } = matter(raw);
          return { slug: key.replace(/\.md$/, ""), ...data };
        })
      );

      posts.sort((a, b) => {
        const da = (a as { published?: string }).published ?? "";
        const db = (b as { published?: string }).published ?? "";
        return db.localeCompare(da);
      });

      return json(200, posts);
    } catch (err) {
      logger.error({ event: "posts_unhandled_error", error: String(err) });
      return json(500, { error: "Internal server error" });
    }
  };
}

export const handler = createHandler({ s3, bucket: process.env.POSTS_BUCKET! });
