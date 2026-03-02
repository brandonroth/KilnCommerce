# Setting Up Your Store

This is a complete e-commerce system for selling one-of-a-kind physical items. Each product has a
single unit — when it sells, it's gone. If you sell multi-quantity items you'll need a different system.

**Time estimate:** 2–4 hours for a first-time setup, mostly waiting on DNS and Stripe verification.

---

## Accounts you'll need

Sign up for these before you start. All have free tiers sufficient for a small store.

| Service | What it does | Cost |
|---|---|---|
| [AWS](https://aws.amazon.com) | Hosts everything (database, backend, site) | ~$1–5/mo at small scale |
| [Stripe](https://stripe.com) | Payment processing | Free + 2.9% + 30¢ per transaction |
| [Resend](https://resend.com) | Sends order confirmation and inquiry emails | Free up to 3,000/mo |
| Domain registrar | Your store's URL (e.g. Namecheap, Cloudflare) | ~$10–15/yr |
| Email provider | Your inbox for order notifications (e.g. Proton Mail) | Free–$4/mo |

> AWS requires a credit card. You won't be charged much, but charges aren't zero — CloudFront,
> DynamoDB, Lambda, and S3 all have generous free tiers that cover a low-traffic store.

---

## Step 1 — Install tools

You need Node.js 18+ and the AWS CLI. If you don't have them:

```bash
# macOS — install Homebrew first if needed (brew.sh), then:
brew install node awscli
```

Configure the AWS CLI with your account credentials:

```bash
aws configure
# Enter your Access Key ID, Secret Access Key, region (e.g. us-east-1), and output format (json)
```

---

## Step 2 — Clone and install

```bash
git clone <repo-url> my-store
cd my-store
npm install --prefix site
npm install --prefix service
```

---

## Step 3 — Customize your store

### Brand copy (required)

These are the files with store-specific content — replace everything with yours:

| File | What to change |
|---|---|
| `site/src/app/page.tsx` | Home page — hero bio, taglines, testimonial, newsletter copy |
| `site/src/components/Nav.tsx` | Store name in the top nav |
| `site/src/components/Footer.tsx` | Store name and copyright line in the footer |
| `site/src/app/layout.tsx` | Page `<title>` and meta description (shows in Google results) |
| `site/src/app/contact/page.tsx` | Contact page intro copy and inquiry form subject options |
| `site/src/app/posts/page.tsx` | Blog/posts page header and tagline |

### Settings you can change without touching code

After deploy, go to `/admin` → **settings** tab to set these from your browser:

- Store name, contact email, studio location
- Instagram / TikTok / Etsy links
- Sales tax rate
- Welcome email subject and body

### Products

Replace the sample products in `service/products/index.ts` with yours. Each product needs:
`slug`, `name`, `price`, `images`, `tagline`, `description`, and optionally `tags`, `details`,
`badge`, and shipping dimensions (`weight`, `length`, `width`, `height`).

Product images go in `site/public/images/`. Reference them as `/images/filename.webp`.

---

## Step 4 — Set environment variables

Create a `.env` file in the repo root (it's gitignored):

```bash
# Stripe — from your Stripe dashboard → Developers → API keys
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...   # set this up after deploy (see Step 8)

# Email — from Resend dashboard after verifying your domain (see Step 6)
RESEND_API_KEY=re_...
FROM_EMAIL=orders@yourdomain.com       # must be on your verified Resend domain
OWNER_EMAIL=you@yourdomain.com         # where YOU receive order notifications
SUPPORT_EMAIL=support@yourdomain.com   # reply-to address customers see

# Domain — your store's public URL (omit to use the auto-generated CloudFront URL)
SITE_DOMAIN=yourdomain.com
```

And a `site/.env.local` file (fill in after Step 7):

```bash
SITE_API_URL=             # from cdk-outputs.json after deploy
COGNITO_USER_POOL_ID=     # from cdk-outputs.json after deploy
COGNITO_CLIENT_ID=        # from cdk-outputs.json after deploy
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## Step 5 — Deploy everything

Bootstrap CDK once per AWS account (skip if you've done this before):

```bash
npx --prefix service cdk bootstrap
```

Write Stripe keys to AWS SSM (the Lambdas read secrets from here, not env files):

```bash
npm run put-secrets --prefix service
```

Deploy the backend, configure the site, and deploy it in one command:

```bash
npm run first-deploy
```

This deploys the backend, automatically writes `SITE_API_URL`, `COGNITO_USER_POOL_ID`, and
`COGNITO_CLIENT_ID` to `site/.env.local`, then builds and deploys the site. Takes ~5–10 minutes.

---

## Step 6 — Set up email

Transactional emails are sent via Resend from your store's address (e.g. `orders@yourdomain.com`).
That's what customers see as the sender — when they hit reply, it lands in your inbox like any normal
email. No special routing or mail server needed.

See **[docs/email-setup.md](docs/email-setup.md)** for full instructions. Summary:

1. Verify your domain in Resend (add DNS records they give you)
2. Set up your inbox with your custom domain (Proton Mail or any provider)
3. Set `FROM_EMAIL`, `OWNER_EMAIL`, `SUPPORT_EMAIL`, `RESEND_API_KEY` in `.env`

---

## Step 7 — Add products

Seed your products to the database (your site is live but empty until you do this):

```bash
npm run seed --prefix service -- default   # replace "default" with your AWS CLI profile name
```

---

## Step 8 — Set up Stripe webhooks

Stripe needs to notify your backend when payments complete.

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) → **Add endpoint**
2. Endpoint URL: `<ApiUrl>/webhook` (from `cdk-outputs.json`)
3. Events to listen for: `checkout.session.completed`, `checkout.session.expired`
4. Copy the **Signing secret** → add it to `.env` as `STRIPE_WEBHOOK_SECRET`
5. Re-run `npm run put-secrets --prefix service` to update SSM
6. Redeploy: `npm run deploy --prefix service`

---

## Step 9 — Create your admin account

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <AdminUserPoolId from cdk-outputs.json> \
  --username your@email.com
```

Cognito sends a temporary password to that email. Go to `yourdomain.com/admin`, sign in, and
set a permanent password. Then go to the **settings** tab to fill in your store details.

---

## Ongoing operations

| Task | How |
|---|---|
| Update a product | Edit `service/products/index.ts` → `npm run seed --prefix service` |
| Create/edit a product in browser | `/admin` → products tab → edit or + add product |
| Add a blog post | Upload a `.md` file to the `PostsBucket` S3 bucket → redeploy |
| Update store settings (name, email, tax, social) | `/admin` → settings tab |
| Update welcome email copy | `/admin` → settings tab → "Welcome Email" fields |
| Rotate Stripe keys | Update `.env` → `npm run put-secrets --prefix service` |
| Mark an order as shipped | `/admin` → orders tab → mark shipped |
| Deploy code changes | `npm run deploy` from repo root |

---

## Troubleshooting

**`npm run deploy` fails with auth error**
Your AWS credentials have expired. Re-run `aws configure` or paste fresh credentials from the AWS console.

**Products don't show up on the site**
The seed script hasn't been run yet, or ran against the wrong AWS profile. Check `service/cdk-outputs.json`
for the correct table names and verify the seed completed without errors.

**Emails aren't sending**
Check Resend dashboard → Emails for delivery status. Most common cause: domain not yet verified,
or `FROM_EMAIL` doesn't match the verified domain. Redeploy after fixing env vars.

**Admin page shows blank / can't log in**
`COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` in `site/.env.local` are missing or stale.
Copy fresh values from `cdk-outputs.json` and redeploy the site.

**Stripe webhook events aren't being processed**
`STRIPE_WEBHOOK_SECRET` in SSM is wrong or missing. Re-run `npm run put-secrets --prefix service`
after setting the correct value in `.env`.
