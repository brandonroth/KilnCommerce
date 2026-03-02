#!/usr/bin/env node
import * as dotenv from "dotenv";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { SiteStack } from "../lib/site-stack";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = new cdk.App();

new SiteStack(app, "SiteStack", {
  env: {
    account: process.env.CDK_ACCOUNT,
    region: process.env.AWS_DEFAULT_REGION ?? "us-east-1",
  },
});
