# BlogGen Deployment Guide

## Environment Variables Required

### Database Configuration
```bash
DATABASE_URL=your_postgresql_connection_string
```
**Important**: This should be your PostgreSQL connection string from Supabase or Neon. Must include username, password, host, port, and database name.

Example format:
```
postgresql://username:password@host:port/database?sslmode=require
```

### Supabase Configuration (Required for Storage & Auth)
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```
**Note**: Use `SUPABASE_URL` (not `VITE_SUPABASE_URL`) for backend operations.
**Note**: Use `SUPABASE_SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_KEY`).

### OpenAI Configuration (Required for Article Generation)
```bash
OPENAI_API_KEY=sk-your_openai_api_key
AI_VISIBILITY_PROMPT=your_custom_writing_guidelines (optional)
```

### Mailgun Configuration (Required for Email Invitations)
```bash
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=bloggen.pro
MAILGUN_FROM_EMAIL=BlogGen <noreply@bloggen.pro>
```

### JWT Configuration (Required for API Authentication)
```bash
JWT_SECRET=your_secure_random_secret_min_32_chars
```
Generate a secure secret: `openssl rand -base64 32`

## Deployment Fixes Applied

### ✅ Fix #1: Correct Environment Variable Names
**Problem**: Backend was using `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_KEY` instead of correct names.

**Fix Applied**: Updated `server/services/auth.ts` to use:
- `SUPABASE_URL` (server-side only, no VITE_ prefix)
- `SUPABASE_SERVICE_ROLE_KEY` (correct secret name)

### ✅ Fix #2: Prevent Crash Loops on Database Failure
**Problem**: Application would exit immediately if database connection failed on startup.

**Fix Applied**: 
- Added try-catch error handling in `server/storage.ts`
- Server now starts even if database is unavailable
- Returns proper HTTP 500 errors instead of crashing
- Helpful error messages guide user to fix configuration

### ✅ Fix #3: Graceful Error Handling for Services
**Problem**: Storage bucket initialization and job processor failures would crash the app.

**Fix Applied**: Updated `server/index.ts` to:
- Wrap `initializeStorageBucket()` in try-catch
- Wrap `startJobProcessor()` in try-catch
- Log warnings instead of crashing
- Allow server to continue running with degraded functionality

### ✅ Fix #4: Better Error Messages
**Problem**: Generic errors made debugging difficult.

**Fix Applied**:
- Added descriptive error messages for missing environment variables
- Database connection errors now show specific details
- Suggestions provided for configuration fixes

## Pre-Deployment Checklist

- [ ] Set `DATABASE_URL` with correct PostgreSQL connection string
- [ ] Set `SUPABASE_URL` (without VITE_ prefix)
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` (not SUPABASE_SERVICE_KEY)
- [ ] Set `OPENAI_API_KEY` for article generation
- [ ] Set `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL`
- [ ] Set `JWT_SECRET` (minimum 32 characters)
- [ ] Run database migrations: `npm run db:push`
- [ ] Test deployment with: `npm run build && npm start`

## Deployment Commands

### Build for Production
```bash
npm run build
```

### Run in Production
```bash
npm start
```

### Apply Database Schema
```bash
npm run db:push
```

## Troubleshooting

### "password authentication failed for user postgres"
- Check your `DATABASE_URL` contains the correct password
- Verify the connection string format is correct
- Ensure SSL mode is set appropriately for your database

### "Database connection refused (ECONNREFUSED)"
- Verify the database host is accessible from your deployment environment
- Check firewall rules allow connections to your database
- Confirm the database is running

### "SUPABASE_URL is not defined" or "SUPABASE_SERVICE_ROLE_KEY is not defined"
- Ensure you're using the correct variable names (no VITE_ prefix for backend)
- Verify secrets are set in your deployment platform
- Check secrets are not being filtered or blocked

### "Failed to initialize storage bucket"
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Ensure your Supabase project has Storage enabled
- The app will still run, but file uploads will fail

### "Job processor failed to start"
- Check database connection is working
- Verify scheduled_jobs table exists in database
- The app will still run, but scheduled posts and webhooks won't be processed

## Architecture Notes

### Two Authentication Systems
1. **Admin Auth**: Supabase Auth for BlogGen UI users
2. **Client Auth**: API key authentication for CMS content delivery

### Two Main Systems
1. **Clients**: Internal team collaboration (requires Mailgun for invitations)
2. **Sites**: Headless CMS content delivery (uses API keys)

### Database Requirements
- PostgreSQL 12+
- Supabase (Neon-backed) recommended
- Automatic schema migrations via Drizzle ORM

---

## Production Deployment - Phase 2 Updates

### Critical Changes in Phase 2
This deployment includes major security and schema updates. Follow this guide carefully.

**What Changed**:
- Row Level Security (RLS) enabled on all tables
- New `site_members` table for many-to-many user-site relationships
- Usage tracking moved from `client_id` to `site_id`
- Authorization system uses site membership
- Monthly limits moved to `sites` table

### Pre-Deployment Checklist for Phase 2

- [ ] **BACKUP DATABASE** - This is critical!
  ```bash
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] Review [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- [ ] Review [MIGRATION_PLAN.md](MIGRATION_PLAN.md)
- [ ] Test on staging environment first
- [ ] Create git tag for rollback: `git tag pre-phase2`

### Step-by-Step Deployment

#### 1. Run Database Migration
```bash
# Connect to database
psql $DATABASE_URL

# Run migration file
psql $DATABASE_URL < migrations/0001_security_and_schema_fixes.sql
```

**Verify Migration**:
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('users', 'articles', 'sites');
-- Should show 't' for all

-- Check site_members exists
SELECT count(*) FROM site_members;

-- Check new columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'sites'
AND column_name IN ('monthly_article_limit', 'monthly_image_limit');
```

#### 2. Link Users to Supabase Auth

**CRITICAL**: Every user must have a `supabase_user_id` to log in.

```sql
-- Get Supabase user IDs from auth.users
SELECT id, email FROM auth.users;

-- Link each user (replace with actual values)
UPDATE users
SET supabase_user_id = 'SUPABASE-UUID-HERE'
WHERE email = 'user@example.com';

-- Verify all users are linked
SELECT email, supabase_user_id FROM users;
```

#### 3. Deploy Application Code
```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Restart (depends on your platform)
pm2 restart bloggen
# OR
docker-compose restart
# OR
systemctl restart bloggen
```

#### 4. Test Deployment

**Test Admin Access**:
1. Log in as admin
2. Go to `/admin`
3. Create a new client
4. Invite a user - verify site_members record created

**Test Editor Access**:
1. Log in as editor
2. Generate article - verify uses site_id
3. Check usage tracking updated for site

**Test Access Control**:
1. Try logging in with uninvited user - should get 403
2. Verify editors can only see their site's articles
3. Verify viewers cannot edit

#### 5. Verify RLS is Working
```sql
-- Test as regular user (replace UUID)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "USER-UUID"}';

SELECT * FROM articles;
-- Should only see user's site articles

RESET ROLE;
```

### Rollback Procedure

If issues occur:

```bash
# Quick rollback - disable RLS
psql $DATABASE_URL <<EOF
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE sites DISABLE ROW LEVEL SECURITY;
EOF

# Full rollback - restore database
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# Revert code
git checkout pre-phase2
npm install && npm run build
pm2 restart bloggen
```

### Common Issues

**Users Can't Log In (403)**:
```sql
-- Check user has supabase_user_id
SELECT email, supabase_user_id FROM users WHERE email = 'user@example.com';

-- Link if missing
UPDATE users SET supabase_user_id = 'UUID' WHERE email = 'user@example.com';
```

**No Articles Showing**:
```sql
-- Check site membership
SELECT * FROM site_members WHERE user_id = (SELECT id FROM users WHERE email = 'user@example.com');

-- Add if missing
INSERT INTO site_members (site_id, user_id, role)
VALUES ('SITE-UUID', USER_ID, 'editor');
```

**Usage Tracking Not Working**:
```sql
-- Check usage_tracking has site_id
SELECT * FROM usage_tracking WHERE site_id IS NULL;

-- Fix if needed
UPDATE usage_tracking SET site_id = (SELECT id FROM sites WHERE client_id = usage_tracking.old_client_id);
```

### Success Criteria

Deployment successful when:
- ✅ All users can log in
- ✅ Admin sees all sites
- ✅ Editors see only their sites
- ✅ Uninvited users get 403
- ✅ Usage tracking works
- ✅ Monthly limits enforced
- ✅ No errors in logs

---

## Support

For deployment issues:
1. Check server logs for specific error messages
2. Verify all environment variables are set correctly
3. Test database connection independently
4. Ensure all secrets use correct variable names
5. Review [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for Phase 2 details
6. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) if issues persist
