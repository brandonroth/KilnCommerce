import dotenv from "dotenv";
import * as path from "path";
import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const PARAMS: { envVar: string; name: string }[] = [
  { envVar: "STRIPE_SECRET_KEY", name: "/stripe-secret-key" },
  { envVar: "STRIPE_WEBHOOK_SECRET", name: "/stripe-webhook-secret" },
];

async function main() {
  for (const { envVar, name } of PARAMS) {
    const value = process.env[envVar];
    if (!value) {
      console.error(`ERROR: ${envVar} is not set. Export it or add it to .env before running this script.`);
      process.exit(1);
    }
  }

  const ssm = new SSMClient({});

  for (const { envVar, name } of PARAMS) {
    const value = process.env[envVar]!;
    await ssm.send(
      new PutParameterCommand({
        Name: name,
        Value: value,
        Type: "SecureString",
        Overwrite: true,
      })
    );
    console.log(`  wrote ${name}`);
  }

  console.log("Secrets written to SSM.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
