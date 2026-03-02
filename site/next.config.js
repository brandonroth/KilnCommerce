require("dotenv").config({ path: "../.env" });
const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  images: { unoptimized: true },
  outputFileTracingRoot: path.join(__dirname, "../"),
  env: {
    SITE_API_URL: process.env.SITE_API_URL,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
  },
};
module.exports = nextConfig;
