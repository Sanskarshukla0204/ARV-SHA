# Arvésha Clothing

Online clothing store: catalogue, bag, checkout with Razorpay, accounts, orders, legal pages and a private admin panel.
Next.js 15 (App Router), React 19, TypeScript, Neon Postgres, Argon2id, Resend, Cloudflare Turnstile, Razorpay, Vercel Blob.

## Set up

1. `npm install`
2. `npm run setup:secrets`, then copy the printed values and `.env.example` into `.env.local`. Add your `DATABASE_URL` (Neon).
3. `npm run db:migrate` then `npm run db:seed:starter` (empty categories only).
4. `npm run admin:create` and save the authenticator key and recovery codes it prints once.
5. `npm run dev`. The admin panel is at `/<ADMIN_PATH>`. `/admin` is a normal 404 on purpose.
6. Sign in to the admin panel, open Store settings and fill in the business details, then add categories, items and images.
7. `npm run launch:check` and the Launch checklist page in the admin panel list what is still missing.

## Razorpay

Create keys in the Razorpay dashboard. Add a webhook to `https://yourdomain/api/webhooks/razorpay` with events
`payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`,
and set `RAZORPAY_WEBHOOK_SECRET`. Orders stay reserved for 30 minutes; the maintenance job (`vercel.json`, every 15 minutes,
protected by `CRON_SECRET`) reconciles payments and expires unpaid orders, so a closed browser tab never loses a payment.

## Truecaller

One-tap login uses the Truecaller web verification flow. Create an app in the Truecaller developer portal, set the callback
to `https://yourdomain/api/auth/truecaller/callback`, then set the two `TRUECALLER_*` variables. Check the flow against the
current Truecaller documentation before launch. Password and email login work without it.

## Before launch

- Custom domain: set `NEXT_PUBLIC_SITE_URL`, add the domain in your host, verify the same domain in Resend.
- Have the legal pages (`/legal`) reviewed by a lawyer. They are written from this store's real behaviour and the settings you enter, and are not legal advice.
- Place a real test order with a small amount, then refund it from the admin order page.

## Commands

`npm run typecheck`, `npm test`, `npm run build`. Dependencies were not installed in the environment that wrote this code, so run
`npm install && npm run typecheck && npm test && npm run build` first and fix anything they report.
