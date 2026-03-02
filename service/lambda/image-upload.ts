import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { createImageStore, type ImageStore } from "./image-store";
import { logger } from "./logger";

const JSON_HEADERS = { "Content-Type": "application/json" };

export interface ImageUploadDeps {
  imageStore: ImageStore;
}

/**
 * Stores a pre-processed image in S3 and returns the key.
 * The browser is responsible for resizing and WebP conversion before upload,
 * so this handler is intentionally thin — it just writes bytes to S3.
 *
 * Auth is enforced at the API Gateway layer via Cognito JWT authorizer.
 */
export function createHandler({ imageStore }: ImageUploadDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const rawBody = event.body ?? "";

    if (!rawBody) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "No image body" }) };
    }

    // API Gateway v2 base64-encodes binary bodies and sets isBase64Encoded = true
    const body = event.isBase64Encoded
      ? Buffer.from(rawBody, "base64")
      : Buffer.from(rawBody, "utf-8");

    const key = imageStore.generateKey();
    logger.info({ event: "admin_image_upload", bytes: body.byteLength, key });

    try {
      await imageStore.put(key, body, "image/webp");
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ key }) };
    } catch (err) {
      logger.error({ event: "admin_image_upload_error", error: String(err) });
      return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Upload failed" }) };
    }
  };
}

export const handler = createHandler({
  imageStore: createImageStore(new S3Client({}), process.env.SITE_BUCKET!),
});
