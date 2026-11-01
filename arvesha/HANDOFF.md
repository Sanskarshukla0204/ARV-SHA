# Arvésha Clothing: handoff

Brand name follows the logo: "Arvésha Clothing". Palette: charcoal #50514F, sage #CBD4C2, paper #FFFCFF, blue #247BA0, sand #C3B299. Logo background cream #FFE7C2 (used on 404 and brand pages). Fonts: Cormorant Garamond (display, matches the wordmark) and Instrument Sans (body).

## Why some decisions differ from the brief
- Auth uses Neon Postgres plus Argon2id instead of Firebase, Clerk or Auth0. Those cannot store Argon2 hashes in your own database or provide Truecaller login, and the brief asks for both.
- The sandbox that wrote this code had no npm access. Nothing has been built with `next build` and nothing has run against Neon, Razorpay, Resend, Turnstile or Truecaller yet. First job in a new session: `npm install`, `npm run typecheck`, `npm test`, `npm run build`.
- Truecaller web verify details were taken from a partner write-up. Compare `src/lib/truecaller.ts` with the current Truecaller developer docs before launch. You need your own app key and the callback `https://YOUR-DOMAIN/api/auth/truecaller/callback` registered with them.
- Subscriptions (Upgrade, Downgrade, Cancel Subscription) do not exist for a clothing store. Build those pages truthfully: state that no membership plans are sold, and point to order cancellation and refunds. The `subscriptions` table is an empty placeholder.

## Finished (do not rewrite)
- Brand assets in `public/` (logo.png, favicon.ico, icons, og.png, apple-touch-icon.png), cut from the supplied logo.
- `db/migrations/001_init.sql`: full schema (users, sessions, auth_tokens, truecaller_requests, rate_limits, addresses, categories, products, product_images, product_variants, carts, orders, order_items, payments, refunds, order_events, webhook_events, subscriptions, support_tickets, settings, admin_users, admin_sessions, admin_audit_log).
- `src/lib/`: env, crypto (AES-GCM, tokens, ids), db (pool, tx), validate (schema library), password (Argon2id + pepper + HIBP check + policy), ratelimit, session, turnstile, mail (Resend), emailcheck (disposable list + MX), phone, pincode (India Post check), totp, http (`route()` wrapper: origin check, rate limit, validation, Turnstile, auth), auth (register, login, reset, verify, phone code), truecaller, cart, catalog, orders (checkout, stock reservation, Razorpay settlement, refunds, cancel), razorpay client and signature checks, settings, site (nav and legal page list), seo, format, storage (sharp to WebP, Vercel Blob), sms (MSG91), email-templates, audit, admin-auth (path gate, password + TOTP, sessions), admin-route (`adminRoute()`), address.
- `src/middleware.ts`: per-request CSP nonce, secret admin path rewrite to `/admin-internal`, `/admin` and the internal path return the normal 404.
- `src/app/layout.tsx`, `src/app/(site)/layout.tsx`, `src/app/globals.css` (full design system), components (Header, HeaderTools with search, Footer, CartProvider and drawer, ProductCard, Pagination, Turnstile, ConsentNotice, forms, icons, JsonLd, Logo, useFocusTrap).
- `tests/core.test.ts` (unit tests for crypto, TOTP, validation, phone, password policy and more).
- API routes done: `api/auth/{register,login,logout,forgot-password,reset-password,verify-email,verify-email/resend,truecaller/{start,callback,poll},complete-profile,phone/{send,verify}}`, `api/cart`, `api/cart/items`, `api/search`, `api/pincode/[pin]`, `api/account/{profile,password,sessions,addresses,addresses/[id],delete}`.

## 
## Status (final)

All planned code is written: storefront, catalogue, bag, checkout, Razorpay (checkout signature, webhook, reconcile job), auth (password, Truecaller, email verification, reset), account (settings, security, sessions, addresses, orders, billing pages), support and help, 15 legal pages in one section plus cookie preferences, custom 404 and error pages, SEO files, admin panel (overview with revenue chart, orders with filters and ship/cancel/refund, products with multi image upload and variants, categories, support inbox, store settings, security, audit log, launch checklist), scripts and config (`scripts/`, `vercel.json`, `.env.example`, `README.md`).

Verified in the writing environment: the 18 unit tests pass (with stub modules for packages that could not be installed), `db/migrations/001_init.sql` applies cleanly on PostgreSQL 16 (27 tables), the main dashboard, order, payment, refund, audit and checklist SQL runs against that schema, and a scan of `src/` and `scripts/` found no em or en dashes, gradients or emoji.

Not verified: `npm install`, `tsc`, `next build`, any browser rendering, any real Razorpay, Resend, Turnstile, Truecaller or Neon call. Treat the first build as the first review pass.

Admin pages live in `src/app/admin-internal/` and are reached only through the secret `ADMIN_PATH` (middleware rewrite plus signed gate header).

(The old "Still to build" list was removed: everything in it is now built.)
