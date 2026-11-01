-- Arvésha Clothing: initial schema (PostgreSQL 15+, runs on Neon).
-- All money is stored as integer paise (INR). All timestamps are timestamptz.
-- Passwords are only ever stored as Argon2id hashes. Raw tokens are never stored, only SHA-256 hashes.

-- ---------------------------------------------------------------- customers

CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id          text NOT NULL UNIQUE,                 -- individual customer ID, e.g. ARV-7K3QM2XP
  name               text NOT NULL,
  dob                date,
  email              text UNIQUE,                          -- always stored lower-case
  email_verified_at  timestamptz,
  phone              text UNIQUE,                          -- E.164, e.g. +919876543210
  phone_verified_at  timestamptz,
  password_hash      text,                                 -- Argon2id PHC string; NULL for Truecaller-only accounts
  signup_method      text NOT NULL DEFAULT 'email' CHECK (signup_method IN ('email', 'truecaller')),
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deleted')),
  profile_complete   boolean NOT NULL DEFAULT true,        -- false until a Truecaller signup adds DOB and email
  marketing_opt_in   boolean NOT NULL DEFAULT false,
  terms_accepted_at  timestamptz,
  failed_logins      integer NOT NULL DEFAULT 0,
  locked_until       timestamptz,
  signup_ip          text,
  last_login_ip      text,
  last_login_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_contact_present CHECK (email IS NOT NULL OR phone IS NOT NULL OR status = 'deleted')
);

CREATE TABLE login_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  method      text NOT NULL,                               -- password, truecaller, register, reset
  success     boolean NOT NULL,
  reason      text,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_events_user_idx ON login_events (user_id, created_at DESC);
CREATE INDEX login_events_ip_idx ON login_events (ip, created_at DESC);

CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  ip            text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE auth_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password', 'verify_phone')),
  token_hash  text NOT NULL,                               -- sha256 of the link token, or of userId:code for phone codes
  target      text,                                        -- the email or phone this token proves
  attempts    integer NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_hash_idx ON auth_tokens (token_hash);
CREATE INDEX auth_tokens_user_idx ON auth_tokens (user_id, purpose, created_at DESC);

CREATE TABLE truecaller_requests (
  nonce_hash    text PRIMARY KEY,                          -- sha256 of the request nonce
  browser_hash  text NOT NULL,                             -- sha256 of a secret held only by the initiating browser
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'consumed')),
  phone         text,
  full_name     text,
  email         text,
  ip            text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
);

CREATE TABLE rate_limits (
  key           text NOT NULL,
  window_start  timestamptz NOT NULL,
  count         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

CREATE TABLE addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       text NOT NULL DEFAULT 'Home',
  full_name   text NOT NULL,
  phone       text NOT NULL,
  line1       text NOT NULL,
  line2       text,
  landmark    text,
  city        text NOT NULL,
  state       text NOT NULL,
  pincode     text NOT NULL,
  pincode_verified boolean NOT NULL DEFAULT false,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX addresses_user_idx ON addresses (user_id);

CREATE TABLE pincode_cache (
  pincode     text PRIMARY KEY,
  found       boolean NOT NULL,
  state       text,
  district    text,
  places      text[],
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ catalog

CREATE TABLE categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id    uuid REFERENCES categories(id) ON DELETE RESTRICT,
  slug         text NOT NULL UNIQUE,
  name         text NOT NULL,
  description  text,
  image_url    text,
  sort_order   integer NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX categories_parent_idx ON categories (parent_id, sort_order);

CREATE TABLE products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  short_desc       text,
  description      text,
  fabric           text,
  fit              text,
  care             text,
  origin           text,
  details          jsonb NOT NULL DEFAULT '[]'::jsonb,      -- extra [{label, value}] rows
  price_paise      integer NOT NULL CHECK (price_paise >= 0),
  compare_at_paise integer CHECK (compare_at_paise IS NULL OR compare_at_paise >= 0),
  category_id      uuid REFERENCES categories(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  tags             text[] NOT NULL DEFAULT '{}',
  seo_title        text,
  seo_description  text,
  published_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_status_idx ON products (status, published_at DESC);
CREATE INDEX products_category_idx ON products (category_id);

CREATE TABLE product_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         text NOT NULL,                               -- 1600px wide
  url_md      text NOT NULL,                               -- 800px wide
  url_sm      text NOT NULL,                               -- 400px wide
  width       integer NOT NULL,
  height      integer NOT NULL,
  alt         text NOT NULL DEFAULT '',
  color       text,                                        -- optional: shown when this colour is selected
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_images_product_idx ON product_images (product_id, sort_order);

CREATE TABLE product_variants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku          text NOT NULL UNIQUE,
  size         text NOT NULL,
  color        text NOT NULL DEFAULT '',
  color_hex    text,
  price_paise  integer CHECK (price_paise IS NULL OR price_paise >= 0),  -- NULL uses the product price
  stock        integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active       boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, size, color)
);
CREATE INDEX product_variants_product_idx ON product_variants (product_id, sort_order);

-- --------------------------------------------------------- cart and wishlist

CREATE TABLE carts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text UNIQUE,                                 -- guest carts are found through an httpOnly cookie
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE TABLE cart_items (
  cart_id     uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id  uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  qty         integer NOT NULL CHECK (qty BETWEEN 1 AND 10),
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cart_id, variant_id)
);

CREATE TABLE wishlist_items (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- ---------------------------------------------------------- orders, payments

CREATE TABLE orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number              text NOT NULL UNIQUE,                -- ARV-261011-K7QM
  user_id             uuid REFERENCES users(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'pending_payment'
                      CHECK (status IN ('pending_payment', 'new', 'processing', 'shipped', 'delivered', 'cancelled', 'expired')),
  payment_status      text NOT NULL DEFAULT 'unpaid'
                      CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'partially_refunded', 'refunded')),
  currency            text NOT NULL DEFAULT 'INR',
  subtotal_paise      integer NOT NULL CHECK (subtotal_paise >= 0),
  shipping_paise      integer NOT NULL DEFAULT 0 CHECK (shipping_paise >= 0),
  discount_paise      integer NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  total_paise         integer NOT NULL CHECK (total_paise >= 0),
  contact_name        text NOT NULL,
  contact_email       text,
  contact_phone       text NOT NULL,
  shipping_address    jsonb NOT NULL,                      -- snapshot at order time
  razorpay_order_id   text UNIQUE,
  razorpay_payment_id text,
  stock_reserved      boolean NOT NULL DEFAULT false,      -- true while this order holds inventory
  cart_signature      text,                                -- hash of items and address, stops double-click duplicate orders
  expires_at          timestamptz,                         -- unpaid orders release stock after this time
  carrier             text,
  tracking_number     text,
  tracking_url        text,
  customer_note       text,
  placed_ip           text,
  placed_at           timestamptz NOT NULL DEFAULT now(),
  paid_at             timestamptz,
  processing_at       timestamptz,
  shipped_at          timestamptz,
  delivered_at        timestamptz,
  cancelled_at        timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON orders (user_id, placed_at DESC);
CREATE INDEX orders_status_idx ON orders (status, placed_at DESC);
CREATE INDEX orders_pending_idx ON orders (expires_at) WHERE status = 'pending_payment';

CREATE TABLE order_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        uuid REFERENCES products(id) ON DELETE SET NULL,
  variant_id        uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  category_id       uuid REFERENCES categories(id) ON DELETE SET NULL,
  name              text NOT NULL,
  sku               text NOT NULL,
  size              text NOT NULL,
  color             text NOT NULL DEFAULT '',
  image_url         text,
  unit_price_paise  integer NOT NULL CHECK (unit_price_paise >= 0),
  qty               integer NOT NULL CHECK (qty > 0),
  line_total_paise  integer NOT NULL CHECK (line_total_paise >= 0)
);
CREATE INDEX order_items_order_idx ON order_items (order_id);
CREATE INDEX order_items_product_idx ON order_items (product_id);

CREATE TABLE payments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  razorpay_order_id    text NOT NULL,
  razorpay_payment_id  text UNIQUE,
  amount_paise         integer NOT NULL,
  status               text NOT NULL,                      -- created, authorized, captured, failed, refunded
  method               text,
  error_code           text,
  error_description    text,
  raw                  jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_idx ON payments (order_id);

CREATE TABLE refunds (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  razorpay_payment_id text NOT NULL,
  razorpay_refund_id  text UNIQUE,
  amount_paise        integer NOT NULL CHECK (amount_paise > 0),
  status              text NOT NULL DEFAULT 'pending',     -- pending, processed, failed
  reason              text,
  created_by_admin    uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refunds_order_idx ON refunds (order_id);

CREATE TABLE order_events (
  id          bigserial PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type        text NOT NULL,
  note        text,
  actor       text NOT NULL DEFAULT 'system',              -- system, customer, admin:<email>
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON order_events (order_id, created_at);

CREATE TABLE webhook_events (
  id            text PRIMARY KEY,                          -- Razorpay x-razorpay-event-id
  type          text NOT NULL,
  payload       jsonb NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz,
  error         text
);

-- Placeholder for memberships. Empty until a plan is offered, so billing pages stay truthful.
CREATE TABLE subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code                text NOT NULL,
  status                   text NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled')),
  razorpay_subscription_id text UNIQUE,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_idx ON subscriptions (user_id);

-- ------------------------------------------------------------------ support

CREATE TABLE support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference   text NOT NULL UNIQUE,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  name        text NOT NULL,
  email       text NOT NULL,
  phone       text,
  order_number text,
  topic       text NOT NULL,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_status_idx ON support_tickets (status, created_at DESC);

-- ----------------------------------------------------------- settings, admin

CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL UNIQUE,
  name                text NOT NULL,
  password_hash       text NOT NULL,
  totp_secret_enc     text NOT NULL,                       -- AES-256-GCM encrypted base32 secret
  recovery_hashes     text[] NOT NULL DEFAULT '{}',        -- sha256 of unused single-use recovery codes
  failed_attempts     integer NOT NULL DEFAULT 0,
  locked_until        timestamptz,
  last_totp_step      bigint,                              -- blocks replay of an already used code
  disabled            boolean NOT NULL DEFAULT false,
  last_login_at       timestamptz,
  last_login_ip       text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  ip            text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz
);

CREATE TABLE admin_audit_log (
  id          bigserial PRIMARY KEY,
  admin_id    uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  admin_email text,
  action      text NOT NULL,
  entity      text,
  entity_id   text,
  meta        jsonb,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
