# Bloggen – AI Content & Publishing Platform
Version: draft-2025-10-29  
Owner: Omri  
Purpose of this doc:  
This file is persistent context for Claude Code.  
Claude should read and follow this spec when generating code, refactoring, or adding features to the Bloggen app.

---

## 1. High-level Concept

Bloggen is an AI-assisted content engine + lightweight CMS.

The app lets an Admin spin up “sites,” invite users into those sites, and let those users generate, edit, schedule, and export blog posts (Markdown + images). Each site maps to a real website (e.g. grabbix.com, clientsite.com) and can eventually publish directly via API or via repo sync.

Core idea:
- Centralised AI content production workflow per site.
- Strong access control: users only see the site(s) they were invited to.
- Clean export path: either scheduled auto-publish via API/webhook, or manual export as `.md + image`.

The app is backed by Supabase only (auth, row-level data, file storage buckets).

---

## 2. Primary Goals / What “Done” Looks Like

### 2.1 For Admin
- Create a new Site.
- When a Site is created:
  - A Supabase storage bucket is created for that site’s assets (images, etc.).
  - A DB record for the site is created.
- Invite users to that Site (email-based invite or direct add).
- Assign roles (admin vs editor/viewer).
- Manage access: add/remove users from specific sites.
- Configure the Site:
  - Site name, domain/base URL.
  - Preferred tone of voice, audience, CTA style.
  - Connected repo / deployment target (future).
  - Connected API publishing credentials (future).

### 2.2 For Regular Users (Editors / Writers)
- Log in and immediately see only the Sites they have access to (most users will have exactly one).
- Pick a Site → see that Site’s Articles dashboard.
- Create a new draft article using AI assistance:
  - Provide topic / target keyword / angle.
  - App generates outline, then full draft (Markdown).
  - App generates a hero image prompt and image.
- Edit and refine:
  - Title, slug, summary/description.
  - Body (Markdown).
  - SEO fields (meta title, meta description, tags/categories).
  - Hero image (regenerate / upload / replace).
- Set status:
  - Draft
  - Ready for Review
  - Approved
  - Scheduled (has a publish_at timestamp)
  - Published
- Download export bundle:
  - Single ZIP containing:
    - `post.md` (final article body in Markdown frontmatter-ready format if possible)
    - hero image file
- Optional future path: Trigger “Publish via API” (calls the site’s configured webhook or git sync).

---

## 3. Roles & Access Model

### Roles
- `admin` (platform-level)
  - Can create Sites.
  - Can invite/manage users per Site.
  - Can configure integrations for each Site.
  - Can see all Sites.
- `editor` / `writer` (site-level user)
  - Can only see Sites they’re explicitly assigned to.
  - Can view/create/edit/schedule articles for that Site.
  - Cannot see other Sites.
  - Cannot invite users.

### Access control rules
- Every user in Supabase has a unique user ID.
- We maintain a **Site Membership table** to link users to Sites with a role (`site_role`: "editor", "viewer", etc.).
- Row Level Security (RLS) in Supabase must enforce:
  - You can only read/write articles for Sites where you’re a member.
  - You can only read/write files in buckets for Sites where you’re a member.
- Only global `admin` can create new Sites or assign memberships.

---

## 4. Key Entities / Schema Guidance

Bloggen is Supabase-only. Tables and rough purpose:

1. `sites`
   - `id`
   - `name`
   - `slug` (used for routing / bucket naming / repo folder)
   - `domain` (e.g. "grabbix.com" or client site domain)
   - `tone_of_voice` / `brand_notes` / `audience_notes` (JSON or text; used to steer AI generation)
   - `created_at`

2. `site_members`
   - `id`
   - `site_id` (FK → sites.id)
   - `user_id` (FK → auth.users / profiles table)
   - `site_role` (e.g. "editor", "viewer", "owner")
   - This table is used for permissions.

3. `articles`
   - `id`
   - `site_id` (FK → sites.id)
   - `title`
   - `slug`
   - `summary` (short description / meta desc)
   - `body_markdown` (main content in Markdown)
   - `seo_meta_title`
   - `seo_meta_description`
   - `status` (enum: draft / review / approved / scheduled / published)
   - `publish_at` (timestamp for scheduling)
   - `published_at` (timestamp of actual publish)
   - `hero_image_path` (path in Supabase storage for this article’s hero image)
   - `created_by` (FK → user_id)
   - `created_at`
   - `updated_at`

4. `article_revisions` (optional / future)
   - Keeps snapshots of body_markdown at key edit points.
   - Helpful for audit trail + rollback.

5. `scheduled_jobs` (future)
   - For posts that should be auto-published via webhook or git push at `publish_at`.

6. `integrations` (future)
   - One row per Site describing how publishing works.
   - Could include:
     - `type` = "github", "webhook", "none"
     - `repo_url` or `webhook_url`
     - `auth_token` or key reference
   - This is how we eventually let Bloggen push the article directly live (headless mode).

7. Storage buckets
   - Each Site should have its own Supabase storage bucket named like `site_{site_id}` or `site_{slug}`.
   - Store hero images and any assets used in articles.
   - RLS on storage: only members of that Site can access that bucket.

---

## 5. Core User Flows

### 5.1 Admin creates a Site
1. Admin clicks “New Site”.
2. Form asks:
   - Site Name
   - Optional domain / brand voice / target audience
3. App:
   - Creates row in `sites`.
   - Creates Supabase storage bucket specifically for that site.
   - (Future) Creates default config row in `integrations`.
4. Admin can now invite users to that Site by email.

### 5.2 Admin invites a user
1. Admin selects a Site → “Invite User”.
2. Admin enters email + role.
3. If user doesn’t exist:
   - We create a placeholder user record / pending invite token flow.
4. Add row in `site_members`.
5. That user will now see that Site in their dashboard once they log in.

### 5.3 User logs in and writes content
1. User signs in with Supabase Auth.
2. Dashboard shows cards for each Site they’re a member of.
3. They choose a Site → land on Articles list.
4. They click “Create Article”.
5. They enter:
   - Topic / keywords / intent
   - Target audience
   - Desired CTA
6. System assists:
   - Generate outline → approve
   - Generate full draft Markdown
   - Generate hero image (store in site bucket, store path in `hero_image_path`)
   - Pre-fill SEO metadata
7. User edits until happy.

### 5.4 Scheduling / Publishing
- User sets `status = scheduled` and chooses `publish_at`.
- On/after `publish_at`, the post can be:
  - auto-marked `published` and exported to target destination via integration, OR
  - left for manual export if automation not ready.

### 5.5 Export
User can click “Export Article”:
- Backend returns a ZIP:
  - `/post.md` with YAML frontmatter or structured metadata.
  - `/hero-image.ext` which is the hero image.
This ZIP is meant to drop into a static site repo / Next.js blog / etc.

---

## 6. App Structure (target shape / guiding conventions)

The codebase should generally aim for:

- `/src/`
  - `/components/` – UI components (forms, editors, tables, layout, etc.)
  - `/pages/` or `/routes/` – depends on framework (e.g. Next.js routes, Remix routes, etc.)
  - `/lib/`
    - `supabase.ts` – Supabase client init using env vars.
    - `auth.ts` – helper for getting current user / role.
    - `rbac.ts` – role / permission helpers.
    - `storage.ts` – helper for bucket upload/download paths.
    - `ai/` – helpers that call OpenAI (or other LLM) with brand voice context.
    - `export.ts` – logic to generate ZIP bundles.
  - `/features/`
    - `sites/` – create site, configure site, invite users.
    - `articles/` – CRUD, generate draft, edit, schedule.
    - `publishing/` – webhook / repo sync (future).

Environment setup:
- Everything secrets-related is provided via `.env.local` in dev.
- No secrets are committed to Git.

---

## 7. UI / UX Guidelines

### General feel
- Clean dashboard SaaS vibe.
- Neutral / pro / not overly playful.
- Plenty of whitespace.
- Light mode first.
- We’ll later theme using brand colours (for ReaLynx it’s Slate Teal / Amber Orange, etc.) but Bloggen itself should stay generic to work for any client brand.

### Dashboard pages
**Global Admin dashboard**
- Section: All Sites
  - Table/list of Sites with quick links: “Manage Users”, “Configure Publishing”, “Open Articles”.
- Section: Invitations / pending.

**Site dashboard (what editors see)**
- Site name / branding info.
- Articles table:
  - Title
  - Status
  - Scheduled Publish Date
  - Last Updated
  - Actions (Edit / Export / Preview)

**Article editor page**
- Left: Article metadata panel
  - Title
  - Slug
  - Summary / Meta description
  - Status dropdown
  - Publish date/time picker
- Main: Markdown editor with live preview
- Right: Hero image preview
  - Button: “Regenerate Image”
  - Button: “Upload Custom Image”
- Bottom: SEO helper suggestions

### Export / Publish modal
- Option A: “Download ZIP”
- Option B (future): “Publish to Site” (uses `integrations` config)

---

## 8. AI Generation Behaviour

When Claude (or any LLM) generates content inside Bloggen:
- Use the Site’s configured tone-of-voice, target audience, product positioning, etc.
- Output must be valid Markdown. Avoid extra system text like “Sure, here’s your article”.
- Include logical headings (`##`, `###`) and short paragraphs for readability.
- Avoid very long intro fluff. Get to the value quickly.
- Suggest CTA at the end that fits that site’s vibe.

When generating images:
- Store prompt used.
- Save resulting image file path into `hero_image_path`.
- Each article should have exactly one canonical hero image.

---

## 9. Security / RLS / Permissions (Supabase rules to respect in code)

High-level expectations for RLS (Row Level Security):
- A user can only `select` from `sites` where they are:
  - in `site_members`, OR
  - they are a global `admin`.
- A user can only `select/insert/update/delete` from `articles` where:
  - `articles.site_id` is in a Site they have access to.
- Only global admins can create new rows in `sites`.
- Only global admins can insert rows into `site_members` for arbitrary users.
- Editors can update `articles` in their Site but cannot change `site_id` or assign themselves to other sites.

Claude should assume those policies need to exist and code accordingly (never trust frontend-only checks).

---

## 10. Deployment / Environments

### Dev (Claude Code / local)
- Run using `.env.local`.
- Supabase URL/keys point to the dev project.
- User auth: standard Supabase auth.
- Storage: dev buckets per Site.

### Prod
- Production Supabase project.
- Real domain(s).
- Real storage buckets.
- RLS is stricter but structurally the same.

### GitHub / CI
- Code is synced via GitHub.
- Secrets are NOT pushed.
- Eventually we may support:
  - GitHub Actions that export approved/scheduled articles into a static site repo and open a Pull Request automatically.

---

## 11. How Claude Code should behave when editing this repo

When adding or changing code, Claude should:
1. Respect this document as the source of truth for:
   - Data model
   - Access control
   - User flows
   - Feature scope
2. Assume multi-tenant model:
   - One platform Admin can create many Sites.
   - Editors only see their assigned Site(s).
3. Avoid hardcoding site-specific logic (no "grabbix.com" etc.). Everything must work for any site.
4. Keep secrets out of committed code. Use environment variables from `.env.local`.
5. Prefer clean modular code (helpers in `/lib`, feature folders).

When building new features, Claude should:
- Create migrations / SQL for Supabase tables if missing.
- Add any new API routes / server functions needed to:
  - list Sites visible to current user
  - list/create/update Articles for a specific Site
  - generate/export ZIP for an Article
  - admin-only create Site + invite user

When unsure about implementation detail, Claude should align with:
- “Does this help Admin create/manage sites & users?”
- “Does this help an editor create/schedule/export content for their site?”
- If yes → build.
- If not → leave for future.

---

## 12. Summary for future AI/devs

Bloggen is:
- A multi-site AI blog/content generator.
- Each site is owned/configured by an Admin.
- Admin can invite editors to a site.
- Editors can only work inside their assigned site, mainly to generate/edit/schedule/export posts.
- Supabase is the single source of truth for:
  - Auth
  - RBAC (via `site_members`)
  - Content storage (`articles`)
  - Assets (per-site buckets)
- The UI is a dashboard + editor workflow.
- Publishing is either manual (download ZIP with `.md` + hero image) or, later, automated via API/webhook/repo sync.


## 13. Public API for Publishing

Bloggen exposes a **read-only REST API** that external websites use to fetch their site’s approved and published content.  
Each site has its own endpoint and API key.

---

### 13.1 Purpose & Behaviour

This API is designed for **automated publishing pipelines**.  
Each site can call its Bloggen API to pull new articles that meet the following conditions:

- Article `status = 'approved'`
- `publish_at` ≤ current UTC time (i.e. already due)
- `is_bot_published = true` (indicates the article is intended for automatic publishing)
- `published_at IS NULL` (not yet picked up)

When an article is successfully fetched by the client site:
- Bloggen marks its `status` as `'published'`.
- Sets `published_at = now()`.
- The article is **not returned again** in future API calls.

This guarantees *each article is picked up once* — similar to a message queue for blog content.

---

### 13.2 Authentication

Each Site has a unique `public_api_key` stored in Supabase (`sites.public_api_key`).  
Requests must include it via query param or header:

```
GET /api/sites/{site_slug}/articles/next?key={public_api_key}
```

or  
```
Authorization: Bearer {public_api_key}
```

Requests without a valid key will return `401 Unauthorized`.

---

### 13.3 API Structure

**Base Path:**
```
https://api.bloggen.app/sites/{site_slug}/
```

| Method | Path | Description |
|--------|------|--------------|
| `GET` | `/articles/next` | Returns all “approved & ready” articles eligible for publishing. Automatically marks them as `published`. |
| `GET` | `/articles` | Returns all articles with `status = 'published'`. |
| `GET` | `/articles/{slug}` | Returns one published article by slug. |
| `GET` | `/meta` | Returns site metadata (branding, tone, etc.). |

---

### 13.4 Example Logic (Supabase / SQL)

```sql
-- Fetch next articles for publishing
select *
from articles
where site_id = (select id from sites where slug = :slug)
  and status = 'approved'
  and is_bot_published = true
  and publish_at <= now()
  and published_at is null;
```

Then, for each returned article:

```sql
update articles
set status = 'published',
    published_at = now()
where id in (:fetched_article_ids);
```

This ensures those articles won’t be returned again.

---

### 13.5 Example Response (`GET /articles/next`)

```json
{
  "site": "grabbix",
  "picked_up_at": "2025-10-29T02:00:00Z",
  "articles": [
    {
      "id": "bafc-2323-1e",
      "title": "The Future of Smart Vending in 2025",
      "slug": "smart-vending-2025",
      "summary": "Key trends shaping automated retail this year.",
      "hero_image_url": "https://xyz.supabase.co/storage/v1/object/public/site_grabbix/hero-smart.jpg",
      "body_markdown": "# The Future of Smart Vending in 2025\n\nAI is transforming how...",
      "seo_meta_title": "Smart Vending Trends 2025",
      "seo_meta_description": "AI vending and micro market trends in Australia.",
      "publish_at": "2025-10-29T00:00:00Z"
    }
  ]
}
```

Response includes all articles that meet eligibility criteria and are automatically marked `published`.

---

### 13.6 How Client Sites Use It

**Example flow (e.g., Grabbix site build pipeline):**
1. At deployment or cron time, call:
   ```
   GET https://api.bloggen.app/sites/grabbix/articles/next?key=XYZ
   ```
2. Receive all approved and due “bot-publish” articles.
3. Write each to the site’s `content/posts/` folder as Markdown + hero image.
4. Trigger rebuild (if static) or render dynamically.
5. Bloggen automatically marks those posts as published, ensuring idempotency.

---

### 13.7 Additional Controls

Each article has these key booleans / timestamps:

| Field | Type | Description |
|--------|------|-------------|
| `is_bot_published` | boolean | Indicates this article is part of automated publishing workflow. |
| `publish_at` | timestamptz | Scheduled datetime for auto-publish. |
| `published_at` | timestamptz | Set automatically when picked up by API. |
| `status` | enum | Transitions from `'approved'` → `'published'`. |

---

### 13.8 Manual vs Bot Publishing

| Type | Condition | Trigger |
|------|------------|----------|
| Manual export | `is_bot_published = false` | User clicks “Export ZIP”. |
| Bot publish | `is_bot_published = true` + `publish_at <= now()` | API pull by site. |

This gives each article an independent control path.

---

### 13.9 Future Extension Ideas
- **Retry window:** If a client fails mid-publish, we can reattempt pickup for any article with `status = 'approved'` but `published_at` still null after X minutes.
- **Webhook feedback:** Bloggen can optionally notify the Admin that content was successfully published to the client site.
- **RSS/Feed endpoint:** Auto-generates `/feed.xml` for public consumption of published posts.

---

### 13.10 Example Cron Integration (Pseudo-code)

```bash
# Every hour, the client site runs:
curl "https://api.bloggen.app/sites/grabbix/articles/next?key=$BLOGGEN_KEY"   -o new_posts.json

# Then a build script writes new markdowns to content folder
node scripts/writePosts.js new_posts.json
npm run build
```

### ✅ Summary

This design ensures:
- Articles are **only published once**.
- Only *approved*, *bot-enabled*, and *due* content is returned.
- Bloggen keeps full traceability via `published_at`.
- Client sites can stay in sync without duplication or race conditions.

This file (`claude.md`) should be kept up to date as features are added so Claude Code can continue development in the right direction.

---
