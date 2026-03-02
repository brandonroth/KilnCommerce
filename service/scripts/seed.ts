import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { products } from "../products/index";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

// CLI: ts-node seed.ts [update|reset] [--force] [profile]
// update (default) — prod-safe: updates catalog fields only, never touches orderId / pendingSessionId
// reset            — destructive: clears orders + checkouts tables, full re-seed; requires --force
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const mode = positional[0] === "reset" ? "reset" : "update";
const profile = positional.find((a) => a !== "reset" && a !== "update");
const force = flags.has("--force");

if (profile) process.env.AWS_PROFILE = profile;

if (mode === "reset" && !force) {
  console.error("ERROR: reset mode requires --force. This will delete all orders, checkouts, and product sale state.");
  console.error("  Usage: npm run seed:reset -- [profile]");
  process.exit(1);
}

function getOutputs(): { tableName: string; bucketName: string; ordersTableName: string; checkoutsTableName: string } {
  if (process.env.TABLE_NAME && process.env.BUCKET_NAME) {
    return {
      tableName: process.env.TABLE_NAME,
      bucketName: process.env.BUCKET_NAME,
      ordersTableName: process.env.ORDERS_TABLE ?? "",
      checkoutsTableName: process.env.CHECKOUTS_TABLE ?? "",
    };
  }
  const outputsPath = path.join(__dirname, "../cdk-outputs.json");
  const outputs = JSON.parse(fs.readFileSync(outputsPath, "utf-8"))["SiteStack"];
  const tableKey = Object.keys(outputs).find((k) => k.startsWith("ProductsTable"));
  const bucketKey = Object.keys(outputs).find((k) => k.startsWith("BucketName"));
  const ordersKey = Object.keys(outputs).find((k) => k.startsWith("OrdersTable"));
  const checkoutsKey = Object.keys(outputs).find((k) => k.startsWith("CheckoutsTable"));
  if (!tableKey || !bucketKey || !ordersKey || !checkoutsKey) throw new Error("Missing outputs in cdk-outputs.json");
  return {
    tableName: outputs[tableKey],
    bucketName: outputs[bucketKey],
    ordersTableName: outputs[ordersKey],
    checkoutsTableName: outputs[checkoutsKey],
  };
}

const { tableName, bucketName, ordersTableName, checkoutsTableName } = getOutputs();
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const imagesDir = path.join(__dirname, "../../site/public/images");

/** Resize to max 800px on either dimension, convert to WebP at quality 80. */
async function optimizeImage(inputPath: string): Promise<Buffer> {
  return sharp(inputPath)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

async function uploadImages() {
  const files = fs.readdirSync(imagesDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  console.log(`Optimizing and uploading ${files.length} images to s3://${bucketName}/images/`);

  for (const file of files) {
    const inputPath = path.join(imagesDir, file);
    const baseName = path.basename(file, path.extname(file));
    const outputKey = `images/${baseName}.webp`;
    const localOutputPath = path.join(imagesDir, `${baseName}.webp`);

    const optimized = await optimizeImage(inputPath);

    // Write optimized WebP back locally so dev server stays in sync
    fs.writeFileSync(localOutputPath, optimized);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: outputKey,
        Body: optimized,
        ContentType: "image/webp",
      })
    );
    console.log(`  uploaded: ${outputKey}`);
  }
}

/**
 * Prod-safe update: writes only catalog fields to each product.
 * Never touches orderId or pendingSessionId, so sold/reserved state is preserved.
 * Creates the item if it doesn't exist yet (new products).
 */
async function updateProducts() {
  console.log(`Updating ${products.length} products in ${tableName} (catalog fields only)`);

  const required = ["name", "price", "images", "tagline", "tags", "details", "description"] as const;
  const optional = ["hero", "badge"] as const;

  for (const product of products) {
    const p = product as unknown as Record<string, unknown>;
    const setFields = [...required, ...optional.filter((f) => p[f] !== undefined)];
    const removeFields = optional.filter((f) => p[f] === undefined);
    const usedFields = [...setFields, ...removeFields];

    const setExpression = setFields.map((f) => `#${f} = :${f}`).join(", ");
    const removeExpression = removeFields.length ? ` REMOVE ${removeFields.map((f) => `#${f}`).join(", ")}` : "";

    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { slug: product.slug },
        UpdateExpression: `SET ${setExpression}${removeExpression}`,
        ExpressionAttributeNames: Object.fromEntries(usedFields.map((f) => [`#${f}`, f])),
        ExpressionAttributeValues: Object.fromEntries(setFields.map((f) => [`:${f}`, p[f]])),
      })
    );
    console.log(`  updated: ${product.slug}`);
  }
}

/**
 * Full re-seed: replaces each product item entirely (clears orderId, pendingSessionId).
 * Only safe to call after clearing the orders and checkouts tables.
 */
async function seedProducts() {
  console.log(`Seeding ${products.length} products to ${tableName}`);
  for (const product of products) {
    await ddb.send(new PutCommand({ TableName: tableName, Item: product }));
    console.log(`  seeded: ${product.slug}`);
  }
}

async function clearTable(name: string, partitionKey: string) {
  console.log(`Clearing table ${name}`);
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await ddb.send(new ScanCommand({ TableName: name, ProjectionExpression: partitionKey, ExclusiveStartKey: lastKey }));
    for (const item of result.Items ?? []) {
      await ddb.send(new DeleteCommand({ TableName: name, Key: { [partitionKey]: item[partitionKey] } }));
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  console.log(`  cleared ${name}`);
}

async function main() {
  console.log(`Mode: ${mode}`);

  if (mode === "reset") {
    await clearTable(ordersTableName, "orderId");
    await clearTable(checkoutsTableName, "sessionId");
    await uploadImages();
    await seedProducts();
  } else {
    await uploadImages();
    await updateProducts();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
