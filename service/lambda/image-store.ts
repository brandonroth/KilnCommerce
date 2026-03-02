import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

/** Abstraction over S3 for storing processed images. */
export interface ImageStore {
  /**
   * Generates a unique image path in the form `/images/<uuid>.webp`.
   * The leading slash matches the convention used by the product catalog so
   * image src values resolve correctly as absolute URLs in the browser.
   */
  generateKey(): string;
  /** Writes a buffer to S3 at the given path (leading slash is stripped for the S3 key). */
  put(path: string, body: Buffer, contentType: string): Promise<void>;
}

/**
 * Creates an ImageStore backed by S3.
 * All uploads are scoped to the `images/` prefix and stored as WebP.
 */
export function createImageStore(s3: S3Client, bucket: string): ImageStore {
  return {
    generateKey() {
      return `/images/${randomUUID()}.webp`;
    },

    async put(path, body, contentType) {
      // S3 keys must not have a leading slash; strip it if present.
      const key = path.startsWith("/") ? path.slice(1) : path;
      await s3.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
      );
    },
  };
}
