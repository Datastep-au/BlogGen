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

## Support

For deployment issues:
1. Check server logs for specific error messages
2. Verify all environment variables are set correctly
3. Test database connection independently
4. Ensure all secrets use correct variable names
