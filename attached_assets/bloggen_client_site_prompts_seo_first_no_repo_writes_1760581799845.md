# Prompt 1 — **Bloggen App: Multi‑tenant Headless CMS API + Webhooks**

> **Goal**: Extend the existing Bloggen app (which already generates articles) into a multi‑tenant, SEO‑first, headless CMS that serves posts to client sites **without writing to their repos**. Provide: DB schema, API (read‑only), webhooks, image handling, auth, and ops. Keep backward compatibility.

## Constraints & Non‑Goals
- **Do not break** existing article generation UI/flows.
- No writes to client repos. Client sites will **pull via API** and/or receive **webhooks** to revalidate pages.
- SEO is primary: posts must include full SEO metadata (title/description/canonicals/OG + JSON‑LD payload fields).
- Multi‑tenant: strong isolation per site.

---

## Step 1 — Database (Postgres / Supabase)
Create/alter tables. Enable RLS.

```sql
-- 1) Tenancy
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  domain text,                      -- e.g. example.com
  api_key_hash text not null,       -- bcrypt/argon2 of a per‑site API key
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists sites_client_id_idx on sites(client_id);

-- 2) Posts
create type post_status as enum ('draft','scheduled','published','archived');

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  title text not null,
  slug text not null,
  excerpt text,
  body_md text not null,
  body_html text,                   -- cached HTML render of body_md
  tags text[] default '{}',
  cover_image_url text,
  meta_title text,
  meta_description text,
  og_image_url text,
  canonical_url text,
  noindex boolean default false,
  status post_status not null default 'draft',
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  content_hash uuid not null,       -- deterministic hash of (frontmatter + body_md)
  unique (site_id, slug)
);
create index if not exists posts_site_id_status_idx on posts(site_id, status);
create index if not exists posts_site_id_updated_idx on posts(site_id, updated_at desc);

-- 3) Slug history for redirects
create table if not exists post_slugs (
  id bigserial primary key,
  post_id uuid not null references posts(id) on delete cascade,
  slug text not null,
  created_at timestamptz not null default now()
);
create index if not exists post_slugs_post_id_idx on post_slugs(post_id);

-- 4) Assets
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  post_id uuid references posts(id) on delete set null,
  url text not null,
  alt text,
  width int,
  height int,
  role text,     -- 'cover' | 'inline' | 'og' | etc.
  created_at timestamptz not null default now()
);
create index if not exists assets_site_id_idx on assets(site_id);

-- 5) Webhooks (per site)
create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  target_url text not null,
  secret text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists webhooks_site_id_idx on webhooks(site_id);

-- RLS (Supabase)
alter table sites enable row level security;
alter table posts enable row level security;
alter table post_slugs enable row level security;
alter table assets enable row level security;
alter table webhooks enable row level security;

-- Policies: assume requests authenticate as a specific site via API key/JWT → set request.claims.site_id
create policy "sites_read_own" on sites for select using ( id = auth.jwt() ->> 'site_id' ) ;
create policy "posts_read_own" on posts for select using ( site_id::text = auth.jwt() ->> 'site_id' );
create policy "assets_read_own" on assets for select using ( site_id::text = auth.jwt() ->> 'site_id' );
create policy "webhooks_read_own" on webhooks for select using ( site_id::text = auth.jwt() ->> 'site_id' );
```

**Notes**
- Compute `content_hash` server‑side: UUIDv5 of stable string (`site_id + slug + title + body_md + meta fields`).
- When saving a post, if `slug` changes, insert previous slug into `post_slugs`.

---

## Step 2 — Images / CDN
- Keep originals in object storage (e.g., Supabase Storage) under `sites/{site_id}/{post_id}/...`.
- On upload, generate variants: `hero-1600.webp`, `social-1200x630.jpg`, `thumb-400.webp`.
- Store public URLs in `assets` with roles (`cover`, `og`, `inline`).

---

## Step 3 — Read API (site‑scoped)
Implement read‑only endpoints. All responses include `ETag` and `Cache‑Control: public, max-age=60`.

```
GET /v1/sites/:site_id/health
→ 200 { ok: true, time: <iso> }

GET /v1/sites/:site_id/posts
  ?status=published|draft|...
  &updated_since=2025-10-01T00:00:00Z
  &limit=50
  &cursor=<opaque>
→ 200 {
  items: Post[],
  next_cursor: string|null,
  last_sync: string  // server ts
}

GET /v1/sites/:site_id/posts/:slug
→ 200 Post | 404
```

**`Post` JSON shape**
```json
{
  "id": "uuid",
  "site_id": "uuid",
  "title": "...",
  "slug": "spring-campaign",
  "excerpt": "...",
  "body_html": "<p>…</p>",
  "tags": ["news"],
  "cover_image_url": "https://cdn.../hero-1600.webp",
  "meta_title": "...",
  "meta_description": "...",
  "og_image_url": "https://cdn.../social-1200x630.jpg",
  "canonical_url": "https://example.com/blog/spring-campaign",
  "noindex": false,
  "status": "published",
  "published_at": "2025-10-16T02:20:00Z",
  "updated_at": "2025-10-16T03:30:00Z",
  "images": [
    {"url":"https://cdn.../hero-1600.webp","alt":"...","w":1600,"h":900,"role":"cover"}
  ],
  "previous_slugs": ["spring-2025-campaign"] ,
  "content_hash": "7f4b1a2c-..."
}
```

**Security**
- Auth via `Authorization: Bearer <site‑scoped JWT>`. On issue, embed `site_id` into JWT claims.
- Rate limit per site (e.g., 60 rpm).
- Support `If-None-Match` with `ETag` (hash of JSON body) for bandwidth savings.

**Pagination**
- Cursor = base64 of `(site_id, updated_at, id)` to ensure stable ordering.

---

## Step 4 — Webhooks (push)
- Events: `post.published`, `post.updated`, `post.deleted`.
- Deliver to each active `webhooks.target_url` for the post’s site.
- Headers: `X-Bloggen-Event`, `X-Bloggen-Signature: sha256=<hex>` (HMAC over raw body using the site’s `webhooks.secret`).
- Body:
```json
{
  "event": "post.updated",
  "site_id": "...",
  "post_id": "...",
  "slug": "spring-campaign",
  "previous_slug": "spring-2025-campaign",
  "updated_at": "2025-10-16T03:30:00Z",
  "content_hash": "7f4b1a2c-..."
}
```
- Retries with exponential backoff; stop after 24h. Store delivery logs.
- Idempotency key = `content_hash`.

---

## Step 5 — Publishing pipeline (augment existing generator)
1. User generates content (already exists).
2. On Save/Publish:
   - Normalize and **dedupe slug** per site.
   - Compute `content_hash`.
   - Render `body_md → body_html` (GitHub Markdown + basic sanitization).
   - Process & store images; assign `assets.role`.
   - Upsert `posts` row; if slug changed, insert into `post_slugs`.
   - If `status = published` and `published_at <= now()` → emit webhook.
   - If `status = scheduled` → schedule a job to flip to `published` at `published_at` and emit webhook then.

---

## Step 6 — Admin UI (MVP)
- Sites: list/create (name, domain), generate/show **once** a per‑site API key, allow **rotate**.
- Webhooks: list/add/edit (target_url, secret, is_active, last delivery status).
- Post list: filter by site/status/date, show `content_hash` & last webhook status.

---

## Step 7 — Env & Secrets
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=           # server only
JWT_ISSUER=
JWT_SIGNING_KEY=
RATE_LIMIT_RPM=60
ASSET_CDN_BASE=https://cdn.bloggen.app
WEBHOOK_TIMEOUT_MS=5000
```

---

## Step 8 — Acceptance Criteria
- [ ] API returns only tenant’s data when called with that tenant’s token.
- [ ] `updated_since` + `cursor` returns deterministic, complete deltas.
- [ ] `ETag`/`If-None-Match` works.
- [ ] Webhooks signed; verified sample succeeds; retries visible in logs.
- [ ] Slug change produces `post_slugs` entry; webhook includes `previous_slug`.
- [ ] Scheduled publish flips state and fires webhook at correct time.

---

## Step 9 — Test Plan (quick cURL)
```
# list
curl -H "Authorization: Bearer $SITE_TOKEN" \
  "$API/v1/sites/$SITE_ID/posts?status=published&limit=2"

# get one
curl -H "Authorization: Bearer $SITE_TOKEN" \
  "$API/v1/sites/$SITE_ID/posts/my-slug"
```