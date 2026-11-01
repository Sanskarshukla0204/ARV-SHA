# Prompt to paste into a new session (Claude Code, Cursor, or any coding AI)

You are a senior full stack engineer and UI/UX designer. Take over **Arvésha Clothing**, an Indian clothing eCommerce store, from the attached project folder `arvesha/`. All planned code is written. It has never been installed or built, because the environment that wrote it could not reach the npm registry. Your job is to make it build, verify it, and launch it. Read `HANDOFF.md` first, then `README.md`.

Stack: Next.js 15 App Router, React 19, TypeScript, Neon Postgres via `pg`, Argon2id (`@node-rs/argon2`), Resend, Cloudflare Turnstile, Razorpay, Truecaller web verify, Vercel Blob for images.

Work order:
1. `npm install`, `npm run typecheck`, `npm test`, `npm run build`. Fix every error. Expect small type and import mismatches, since nothing was compiled against real Next/React types. Do not rewrite working files, patch them.
2. Create a Neon database, run `npm run setup:secrets`, fill `.env.local` from `.env.example`, then `npm run db:migrate`, `npm run db:seed:starter`, `npm run admin:create`.
3. Walk the full flow with Razorpay test keys: register, verify email, log in, add to bag, checkout with PIN check, pay, webhook, see order in My orders, admin (at `/<ADMIN_PATH>`) ships it, admin refunds a test order. Also test payment failed and payment pending (close the tab mid payment) and confirm the maintenance job settles it.
4. Check responsive layout at 360, 768 and 1280 px, keyboard navigation, and contrast. Add the favicon check, `robots.txt`, `sitemap.xml`.
5. Compare the Truecaller flow with the current Truecaller developer docs and adjust `src/lib/truecaller.ts` if they differ.
6. `npm run launch:check`, fix every item, then have the legal pages (`/legal`) reviewed by a lawyer. Connect the custom domain.

Hard rules from the client (never break these): minimalist flat colours from the palette only (#50514F, #CBD4C2, #FFFCFF, #247BA0, #C3B299, logo cream #FFE7C2), glass and neumorphism, no gradients, no emoji, no em dashes or en dashes anywhere (copy or code comments), no fake reviews or metrics or customer counters, no vague hero text, no top announcement bar, no cursor animation, no heavy scroll animation, no AI generated photos or filler copy. Footer links are one or two words, the footer shows the copyright with the brand name, and "Arvisha Digitals" links to https://www.instagram.com/arvisha.digitals. Every page has the legal links in the footer. Server side validation everywhere, generic error messages for auth, passwords only as Argon2id hashes, temporary email domains rejected, admin panel reachable only at the secret path in `ADMIN_PATH` and never at `/admin`.
