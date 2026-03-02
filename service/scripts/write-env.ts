/**
 * Reads CDK stack outputs and writes the site's runtime env vars to site/.env.local.
 * Run after the first `cdk deploy` so the site knows where the API lives.
 */
import * as fs from "fs";
import * as path from "path";

const cdkOutputsPath = path.join(__dirname, "../cdk-outputs.json");
const envLocalPath = path.join(__dirname, "../../site/.env.local");

if (!fs.existsSync(cdkOutputsPath)) {
  console.error("cdk-outputs.json not found — run `npm run deploy --prefix service` first.");
  process.exit(1);
}

const outputs = JSON.parse(fs.readFileSync(cdkOutputsPath, "utf-8"));
const stack = outputs["SiteStack"];

const updates: Record<string, string> = {
  SITE_API_URL: stack["ApiUrl"],
  COGNITO_USER_POOL_ID: stack["AdminUserPoolId"],
  COGNITO_CLIENT_ID: stack["AdminUserPoolClientId"],
};

let content = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, "utf-8") : "";

for (const [key, value] of Object.entries(updates)) {
  const regex = new RegExp(`^${key}=.*`, "m");
  const line = `${key}=${value}`;
  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    if (content && !content.endsWith("\n")) content += "\n";
    content += `${line}\n`;
  }
  console.log(`  ${key}=${value}`);
}

fs.writeFileSync(envLocalPath, content);
console.log("\nWrote to site/.env.local");
