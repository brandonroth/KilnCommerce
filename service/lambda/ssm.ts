import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { logger } from "./logger";

const ssm = new SSMClient({});

/**
 * Resolves a secret value: returns the env var directly (local dev / test),
 * or fetches from SSM Parameter Store (production).
 *
 * @param envVar     Direct env var name, e.g. "STRIPE_SECRET_KEY"
 * @param pathEnvVar Env var holding the SSM path, e.g. "STRIPE_SECRET_KEY_PATH"
 */
export async function getParam(envVar: string, pathEnvVar: string): Promise<string> {
  if (process.env[envVar]) return process.env[envVar]!;
  const path = process.env[pathEnvVar];
  logger.info({ event: "ssm_fetch", param: path });
  try {
    const { Parameter } = await ssm.send(
      new GetParameterCommand({ Name: path!, WithDecryption: true })
    );
    return Parameter!.Value!;
  } catch (err) {
    logger.error({ event: "ssm_fetch_failed", param: path, error: String(err) });
    throw err;
  }
}
