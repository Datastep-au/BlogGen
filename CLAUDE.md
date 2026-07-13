# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

BlogGen is a headless CMS with AI-powered article generation (OpenAI GPT-4o). Admins create client workspaces and sites, invite users, and users generate/edit/schedule blog posts that are delivered to external websites via a public read-only API and webhooks. See `bloggen_claude.md` for the product spec and `replit.md` for an architecture overview.

## Commands

```bash
npm run dev        # Start dev server (Express + Vite middleware) on http://127.0.0.1:5000
npm run check      # Typecheck (tsc) — there is no lint or test framework configured
npm run build      # vite build (client → dist/public) + esbuild (server → dist)
npm start          # Run production build
npm run db:push    # Push shared/schema.ts to the database (drizzle-kit)
```

A single Express server serves both the API and the client (Vite middleware in development, static files from `dist/public` in production). Port defaults to 5000 (`PORT`/`HOST` env vars).

Environment is loaded from `.env` by `server/env.ts` with `override: true` (`.env` wins over shell vars). Required: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`. Client-side (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (if `VITE_SUPABASE_URL` is missing, `client/src/lib/supabase.ts` derives it from `VITE_DATABASE_URL`). Others: `JWT_SECRET`/`JWT_ISSUER` (CMS API tokens), `MAILGUN_*` (invitation emails), `GITHUB_TOKEN`/`GITHUB_PAT` (repo sync), `APP_URL`.

The repo root contains many one-off migration/diagnostic scripts (`fix-*.js`, `check-*.js`, `test-*.ts`, `run-migration.js`, etc.) run directly with `node`/`tsx`. SQL migrations live in `migrations/`.

## Layout

- `client/` — React 18 SPA (Vite root). Wouter routing, TanStack Query for server state, shadcn/ui + Tailwind, auth via React Context (`client/src/contexts/AuthContext.tsx`).
- `server/` — Express API + startup orchestration.
- `shared/schema.ts` — single source of truth for the DB: Drizzle tables, pg enums, and drizzle-zod insert schemas. Imported by both sides.
- Path aliases (vite.config.ts + tsconfig): `@` → `client/src`, `@shared` → `shared`, `@assets` → `attached_assets`.

## Architecture

### Two separate APIs with different auth

1. **Admin API (`/api/*`)** — used by the React app. `authenticateRequest` (`server/services/auth.ts`) is mounted on all of `/api` in `server/index.ts`: it verifies the Supabase JWT from the `Authorization: Bearer` header, then looks up the user **by email in the local `users` table**. Users are never auto-created — an account must be provisioned via admin invitation first, otherwise the request gets a 403. Only `/api/invitations/validate/*` and `/api/invitations/accept` are public. Role gates: `requireAdmin` and `requireClientAccess` middlewares in `server/routes.ts`.
2. **Public CMS API (`/v1/*`)** — used by external client sites (`server/routes/cms.ts`). API-key based (`server/lib/apiAuth.ts`): keys are stored bcrypt/HMAC-hashed on the `sites` table and exchanged for short-lived JWTs with a `site_id` claim. Rate limited (60 req/min).

Admin routes live in the large `server/routes.ts` (~1800 lines, clients/users/invitations/articles/generation) plus modular routers in `server/routes/admin/{sites,webhooks,posts}.ts` mounted behind `requireAdmin`.

### Storage layer

All DB access goes through the `IStorage` interface (`server/storage.ts`), implemented by `DatabaseStorage` (`server/db/database.ts`, Drizzle over Postgres/Supabase). Use `await getStorage()` (async initialization; connection is tested at startup). `MemStorage` is deprecated — there is no in-memory fallback; `DATABASE_URL` is required.

### Data model (shared/schema.ts)

Two domains sharing one database:
- **Workspace/AI domain**: `clients` (tenant workspaces) → `users` (roles: admin/client_editor/client_viewer), `invitation_tokens`, `articles` (AI-generated drafts), `usage_tracking` (per-site monthly limits), `user_repos` (GitHub sync).
- **Headless CMS domain**: `sites` (UUID, API key hash, per-site Supabase storage bucket) → `site_members`, `posts` (status: draft/scheduled/published/archived, content hash), `post_slugs` (301 redirect history), `assets`, `webhooks` + `webhook_delivery_logs`, `scheduled_jobs`.

### Content pipeline

OpenAI generation (`server/lib/openai.ts`) produces Markdown articles → `server/lib/articlePublisher.ts` converts them into CMS posts (Markdown→HTML via `marked`, slug generation, content hashing) → publishing fires webhooks (`server/lib/webhooks.ts`, HMAC-SHA256 signed payloads with retry/backoff). A job processor (`server/lib/jobProcessor.ts`) polls every 60s to publish scheduled posts and drain the webhook queue.

### Startup side effects (server/index.ts)

On boot the server initializes the Supabase storage bucket, auto-creates a site (with its own storage bucket and API key) for any client that has none, and starts the job processor. Supabase admin operations use the service-role client from `server/lib/supabaseAdmin.ts` (null when credentials are missing — code must handle that).

### User provisioning (no self-service)

There is no signup or password-reset flow. Admins invite users (Mailgun email → `/accept-invite` page → `POST /api/invitations/accept`, which creates the Supabase auth user server-side with the chosen password). Frontend routes: `/` (landing), `/auth` (login), `/accept-invite`, `/app` (generate), `/app/dashboard`, `/app/admin`.

## Additional docs

- `CMS_API_DOCUMENTATION.md` and `docs/CMS_API_INTEGRATION.md` — public CMS API reference for client sites.
- `SECURITY_CHECKLIST.md`, `DEPLOYMENT_GUIDE.md`, `MIGRATION_PLAN.md` — operational references.
