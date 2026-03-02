# Bees & Bowls

Pottery e-commerce site built with Next.js 15, hosted on AWS (CloudFront + S3 + DynamoDB + Lambda).

## Architecture

- **Site**: Next.js static export, hosted on S3 + CloudFront
- **API**: Lambda + API Gateway, reads/writes to DynamoDB
- **Products**: Defined in `service/products/index.ts`, seeded to DynamoDB
- **Settings**: Runtime store configuration (name, email, tax rate, social links, email copy) stored in DynamoDB and editable from the admin console — no redeploy needed

## Requirements

- Node.js 18+
- AWS CLI configured with a `personal` profile

## Local development

```bash
npm install --prefix site
npm run dev --prefix site
```

> Requires `SITE_API_URL` in `site/.env.local` (see first-time setup below).

## First-time setup

1. Install dependencies:

   ```bash
   npm install --prefix site
   npm install --prefix service
   ```

2. Bootstrap CDK (once per AWS account/region):

   ```bash
   npx --prefix service cdk bootstrap
   ```

3. Add Stripe keys to `.env` in the repo root (never committed):

   ```bash
   cat >> .env <<'EOF'
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   EOF
   ```

4. Write the secrets to SSM (must be done before the first deploy so the Lambdas can read them):

   ```bash
   npm run put-secrets --prefix service
   ```

   This writes `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from `.env` to SSM SecureString at
   `/stripe-secret-key` and `/stripe-webhook-secret`. Re-run any time keys rotate.

5. Deploy everything:

   ```bash
   npm run first-deploy
   ```

   This deploys the backend, reads the API URL and Cognito IDs from `service/cdk-outputs.json` into
   `site/.env.local`, then builds and deploys the site. Takes ~5–10 minutes on first run.

6. Seed the products table:

   ```bash
   npm run seed --prefix service -- personal
   ```

   The site will show no products until this is run. The default catalog includes sample items with
   placeholder images — replace them with your own before going live (see [Managing products](#managing-products)
   for how to configure products, images, and the different seed modes).

7. Create your admin account:

   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id <AdminUserPoolId from cdk-outputs.json> \
     --username admin@youremail.com \
     --profile personal
   ```

   Cognito sends a temporary password to that email. Go to `/admin`, sign in, and set a permanent password.

## Deploying

```bash
npm run deploy
```

This runs `site` build then `cdk deploy` from the root. The API URL never changes so `.env.local` only needs to be set once (automatic via first deploy step)

## Managing products

Products are defined in `service/products/index.ts` and stored in DynamoDB. The site reads them from the API at runtime.

The seed script has two modes:

| Command | When to use |
|---|---|
| `npm run seed` | **Default — prod safe.** Updates catalog fields only (`name`, `price`, `images`, `tagline`, `tags`, `details`, `description`, `badge`, `hero`). Never touches `orderId` or `pendingSessionId`, so sold/reserved state is preserved. Creates new products if their slug doesn't exist yet. |
| `npm run seed:reset` | **Destructive — dev/re-launch only.** Clears the orders and checkouts tables, then fully re-seeds products (overwrites all fields including sale state). Use this to start fresh. |

### Adding or updating products (prod-safe)

1. Edit `service/products/index.ts`
2. Push the changes:
   ```bash
   npm run seed --prefix service -- personal
   ```

### Full reset (dev / re-launch)

Wipes all orders, checkouts, and product sale state, then re-seeds from the catalog:

```bash
npm run seed:reset --prefix service -- personal
```

## Managing posts

Posts are markdown files stored in the `PostsBucket` S3 bucket. The `service/posts/` directory contains the seed/test posts and is deployed to that bucket on every `cdk deploy`.

### Frontmatter

Every post needs this block at the top:

```markdown
---
title: "your post title"
type: journal          # journal | gallery
published: "2026-03-01"  # ISO date, used for sort order (newest first)
date: mar 2026         # display string shown on the site
tags: [process, mugs]
excerpt: "Optional short summary shown on the listing page."
---

Your post content here. Standard markdown — headings, bold, lists, etc.
```

### Adding a post

**For test/seed content** — add a `.md` file to `service/posts/`, then redeploy. CDK's `BucketDeployment` will upload it automatically:

```bash
npm run deploy --prefix service
```

**In production** — upload the `.md` file directly to `PostsBucket`, then redeploy the site so `generateStaticParams` picks up the new slug and pre-renders the page:

```bash
# Get the bucket name from CDK outputs
aws s3 cp my-new-post.md s3://<PostsBucketName>/my-new-post.md --profile personal
npm run deploy --prefix service
```

### Editing a post

Re-upload the `.md` file to S3. Content edits are live immediately — no site rebuild needed, the Lambda reads from S3 on every request.

### Deleting a post

Delete the file from S3, then redeploy to remove the pre-generated static page.

```bash
aws s3 rm s3://<PostsBucketName>/my-post.md --profile personal
npm run deploy --prefix service
```

## Email

Transactional emails (order confirmations, shipping notifications, contact form notifications) are sent via [Resend](https://resend.com) from your store's email address — that's what customers see in their inbox. When a customer hits reply, it goes directly to you. No custom mail server, no forwarding rules, just normal email.

See **[docs/email-setup.md](docs/email-setup.md)** for full setup instructions (domain verification, inbox setup, env vars).

## Admin console

The admin console at `/admin` uses Cognito for authentication — each user has their own account with a real password. It provides:

- **Table views** — browse products, orders, checkouts, inquiries, and subscriptions
- **Product management** — create new products, edit existing fields, upload images
- **Order management** — mark orders as shipped, provide shipping data, add internal notes
- **Settings** — update store name, contact email, location, social links, tax rate, and welcome email copy without redeploying

### Adding an admin user

```bash
# Create the user (Cognito sends a temp password to their email)
aws cognito-idp admin-create-user \
  --user-pool-id <AdminUserPoolId from cdk-outputs.json> \
  --username admin@youremail.com \
  --profile personal

# The user visits /admin, signs in with the temp password,
# and is prompted to set a permanent password (min 12 chars).
```

### Removing an admin user

```bash
aws cognito-idp admin-delete-user \
  --user-pool-id <AdminUserPoolId> \
  --username admin@youremail.com \
  --profile personal
```

## Deploying as a new store

This project is designed to be repurposeable. Here's what to swap when handing it to someone else:

### After deploy — configure from the admin console (no code changes needed)

Go to `/admin` → **settings** tab to set:

- Store name, contact email, studio location, social links
- Sales tax rate
- Welcome email subject and body copy

### Code changes (required)

| File | What to change |
|---|---|
| `service/products/index.ts` | Replace all products with yours |
| `service/posts/` | Replace sample posts with yours |
| `site/src/app/**` | Replace page copy and branding specific to Bees & Bowls (hero text, nav/footer store name, metadata) |

### Environment variables (at deploy time)

| Variable | Description |
|---|---|
| `OWNER_EMAIL` | Where order notifications are sent |
| `FROM_EMAIL` | The "from" address on outbound emails (must be verified in Resend) |
| `SUPPORT_EMAIL` | Reply-to address shown in customer emails |
| `SITE_DOMAIN` | Custom domain (e.g. `mystore.com`). Omit to use the CloudFront URL. |
| `RESEND_API_KEY` | Your Resend API key |
| `SHIPPO_FROM_*` | Your pickup address for shipping rate calculation |

### One-of-a-kind assumption

The system is built for unique, one-of-a-kind items — each product has a single unit and transitions from available → reserved → sold. If you sell multi-quantity items you'll need to rethink the reservation and inventory model.

## Testing

### Service unit tests

Cover Lambda handlers and DynamoDB repositories. No AWS credentials or live infrastructure needed — all external dependencies are mocked.

```bash
cd service
npm test                                  # run all tests
npm run test:watch                        # watch mode
npm test -- --testPathPattern=checkout    # single file
npm test -- --verbose                     # show individual test names
```

### Site unit tests

Cover data utilities and React components. Run with Vitest + happy-dom.

```bash
cd site
npm test
```

### E2E tests (Playwright)

End-to-end tests run against the **deployed** CloudFront URL configured in `site/playwright.config.ts`. Requires a live stack.

```bash
cd site
npm run test:e2e          # run headless in Chromium
npm run test:e2e:ui       # open Playwright UI for interactive debugging
```

The checkout E2E test uses a Stripe test card (`5555 5555 5555 4444`) and exercises the full reservation → payment → return flow.

## Testing the email Lambda

To invoke the email Lambda against the deployed stack and send a real test email:

```bash
bash service/scripts/invoke-email.sh
```

This looks up the deployed function name from CloudFormation and invokes it with the test payload in `service/scripts/email-test-event.json`. Edit that file to change the recipient address or order details before running.

Requires AWS credentials with access to the `SiteStack` stack.

## Other CDK commands

```bash
npm run cdk --prefix service -- diff     # preview changes
npm run cdk --prefix service -- synth    # preview CloudFormation template
npm run cdk --prefix service -- destroy  # tear down all AWS resources
```
