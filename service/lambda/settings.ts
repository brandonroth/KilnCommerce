import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ddb } from "./db/client";
import { SettingsRepository } from "./db/settings-repo";
import { corsHeaders } from "./cors";
import { STORE_NAME, STORE_SIGNATURE } from "./config";

/**
 * Hardcoded defaults used when a key has not been set in DynamoDB yet.
 * These match the values previously baked into the service and site code.
 */
export const SETTING_DEFAULTS: Record<string, string> = {
  "store.name":              STORE_NAME,
  "store.signature":         STORE_SIGNATURE,
  "store.email":             "hello@beesbowls.com",
  "store.location":          "Your City, State",
  "store.social.instagram":  "",
  "store.social.tiktok":     "",
  "store.social.etsy":       "",
  "tax.rate":                "",
  "email.welcome.subject":   "welcome to the hive 🐝",
  "email.welcome.body": [
    "hey, you're in!",
    "",
    "You'll get first dibs on new drops, behind-the-scenes studio chaos,",
    "and the occasional discount. No spam. Pinky promise.",
  ].join("\n"),
};

/**
 * Keys returned to the public-facing site (excludes internal-only settings
 * like email.signature and tax.rate which are not needed by the front-end).
 */
const PUBLIC_KEYS = [
  "store.name",
  "store.email",
  "store.location",
  "store.social.instagram",
  "store.social.tiktok",
  "store.social.etsy",
] as const;

export interface SettingsDeps {
  settingsRepo: SettingsRepository;
}

/**
 * Factory for the public settings handler.
 *
 * GET /settings — returns a safe subset of store configuration so the
 * statically-exported site can display live values without redeploying.
 * No authentication required.
 */
export function createHandler({ settingsRepo }: SettingsDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    if (event.requestContext.http.method === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders(event), body: "" };
    }

    const all = await settingsRepo.getAll();

    const result: Record<string, string> = {};
    for (const key of PUBLIC_KEYS) {
      result[key] = all[key] ?? SETTING_DEFAULTS[key] ?? "";
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders(event), "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  };
}

export const handler = createHandler({
  settingsRepo: new SettingsRepository(ddb, process.env.SETTINGS_TABLE!),
});
