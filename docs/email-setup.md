# Email Setup

The store sends transactional emails (order confirmations, shipping notifications, contact form
notifications) via [Resend](https://resend.com). Your inbox is handled separately by your email
provider. The two never need to talk to each other — Resend sends, you receive and reply like normal.

## How it works

```
Order placed / inquiry submitted
  └─ Resend sends owner notification ──────────────────► your inbox (e.g. Proton)
  └─ Resend sends customer email
       From:     orders@yourdomain.com
       Reply-To: support@yourdomain.com

Customer hits Reply ──────────────────────────────────► support@yourdomain.com ──► your inbox
You reply from your inbox ────────────────────────────► customer
```

No custom server code handles inbound email. Replies flow through your email provider directly.

---

## Step 1 — Resend: verify your domain

Resend needs permission to send email on behalf of your domain so messages don't land in spam
and the From address shows your domain instead of a Resend subdomain.

1. Go to [resend.com/domains](https://resend.com/domains) and click **Add Domain**.
2. Enter your domain (e.g. `yourdomain.com`).
3. Resend will give you a set of DNS records to add — typically a few TXT records for SPF/DKIM
   and a CNAME. Add them wherever your DNS is managed (Cloudflare, Route 53, Namecheap, etc.).
4. Click **Verify**. DNS can take a few minutes to propagate.

Once verified you can send from any address at that domain (e.g. `orders@yourdomain.com`).

---

## Step 2 — Email provider: set up your inbox

### Proton Mail (recommended)

Any paid Proton plan (Plus or Unlimited) supports custom domains.

1. Log in to [proton.me](https://proton.me) and go to **Settings → Custom domains**.
2. Add your domain and follow the wizard — it will give you MX records and a TXT verification record to add to your DNS.
3. Once verified, create the addresses you need:
   - `orders@yourdomain.com` — receives owner order/shipping notifications
   - `support@yourdomain.com` — the Reply-To address customers see

   Or enable **catch-all** (Settings → Custom domains → your domain → Catch-all) so every address
   at your domain lands in your inbox automatically — no need to create each one.

4. Both addresses appear in your Proton inbox. When a customer replies, you reply from whichever
   address makes sense and Proton sends it as that address.

### Other providers

Any provider that supports custom domains works the same way: add the domain, point MX records,
create the addresses. The store doesn't care what's on the receiving end.

---

## Step 3 — Set environment variables

These are passed at deploy time (`cdk deploy`). Set them in your shell or a `.env` file that
your deploy script sources.

| Variable | Description | Example |
|---|---|---|
| `FROM_EMAIL` | The address Resend sends from. Must be on your verified domain. | `orders@yourdomain.com` |
| `OWNER_EMAIL` | Where order and inquiry notifications are sent (your inbox). | `you@yourdomain.com` |
| `SUPPORT_EMAIL` | The Reply-To on customer emails. Customers reply here. | `support@yourdomain.com` |
| `RESEND_API_KEY` | Your Resend API key from the dashboard. | `re_abc123...` |

Example for a shell export before deploy:

```bash
export FROM_EMAIL=orders@yourdomain.com
export OWNER_EMAIL=you@yourdomain.com
export SUPPORT_EMAIL=support@yourdomain.com
export RESEND_API_KEY=re_abc123...

cd service && cdk deploy
```

---

## Step 4 — Verify it works

1. Place a test order on the store.
2. Check that you received an owner notification at `OWNER_EMAIL`.
3. Check that the customer confirmation was sent (Resend dashboard → Emails shows delivery status).
4. Reply to the customer confirmation from your inbox — confirm it arrives with your store address as the sender.

---

## Costs

| Service | Free tier | Paid |
|---|---|---|
| Resend | 3,000 emails/month, 100/day | $20/mo for 50k |
| Proton Mail | No custom domain | Plus $3.99/mo, Unlimited $7.99/mo |

At small store scale (tens of orders per month) you will not exceed the Resend free tier.
