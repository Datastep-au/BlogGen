# Security Checklist & API Key Rotation Guide

## Critical Security Issue: Exposed API Keys

**Status**: `.env.local` file is properly in `.gitignore` and has NO git history (verified).

However, as a security best practice, you should still rotate all API keys as a precautionary measure, especially if this repository was ever:
- Shared via screen sharing
- Copied to another location
- Accessed by unauthorized users
- Stored on a cloud service

---

## API Key Rotation Checklist

### 1. OpenAI API Key

**Current Key (PARTIALLY EXPOSED)**: `sk-svcacct-5lawvge...`

**Steps to Rotate**:
1. Log in to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Navigate to API Keys section
3. Click "Create new secret key"
   - Name it: "BlogGen Production Key"
   - Set permissions: Appropriate for your use case
4. Copy the new key immediately (you won't see it again)
5. Update `.env.local`:
   ```bash
   OPENAI_API_KEY=sk-...new-key...
   ```
6. **IMPORTANT**: Delete/revoke the old key from OpenAI dashboard
7. Test the application to ensure AI generation still works

**Verification**:
```bash
# Test article generation endpoint
curl -X POST http://localhost:3000/api/articles/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topic": "test", "site_id": "..."}'
```

---

### 2. GitHub Personal Access Token

**Current Token (PARTIALLY EXPOSED)**: `ghp_62kzFzf4A6WQ4...`

**Steps to Rotate**:
1. Log in to [GitHub Settings](https://github.com/settings/tokens)
2. Navigate to "Developer settings" → "Personal access tokens" → "Tokens (classic)"
3. Find the old token and click "Delete" (or regenerate if it's a fine-grained token)
4. Click "Generate new token" (classic or fine-grained)
5. Set required scopes:
   - `repo` - Full control of private repositories
   - `workflow` - Update GitHub Action workflows
   - (Add others as needed for your use case)
6. Copy the new token
7. Update `.env.local`:
   ```bash
   GITHUB_TOKEN=ghp_...new-token...
   ```
8. Test GitHub integration (if applicable)

**Verification**:
```bash
# Test if token works
curl -H "Authorization: Bearer ghp_...new-token..." \
  https://api.github.com/user
```

---

### 3. Mailgun API Key

**Current Key**: Check `.env.local` for `MAILGUN_API_KEY`

**Steps to Rotate**:
1. Log in to [Mailgun Dashboard](https://app.mailgun.com/)
2. Navigate to Settings → API Keys
3. Click "Add New Key" or regenerate existing
4. Copy the new API key
5. Update `.env.local`:
   ```bash
   MAILGUN_API_KEY=...new-key...
   MAILGUN_DOMAIN=...your-domain...
   ```
6. Test email sending functionality

**Verification**:
```bash
# Test invite endpoint
curl -X POST http://localhost:3000/api/admin/users/invite \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "role": "editor", "site_id": "..."}'
```

---

### 4. Supabase Credentials

**Current Keys**: Check `.env.local` for:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Steps to Rotate**:

#### Supabase Service Role Key (Most Critical):
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to Settings → API
4. Under "Project API keys", find "service_role" key
5. **Note**: Service role keys typically can't be regenerated easily
6. **Alternative**: Create a new Supabase project and migrate data (if severely compromised)

#### Supabase Anon Key:
- This key is meant to be public-facing, but should still be rotated periodically
- Follow similar steps as service role key

**If Severely Compromised**:
1. Create a new Supabase project
2. Enable RLS on all tables (see migration 0001)
3. Migrate data from old project
4. Update `.env.local` with new credentials
5. Delete old project

**Verification**:
```bash
# Test auth endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email", "password": "your-password"}'
```

---

### 5. Database Connection String

**Current**: Check `.env.local` for `DATABASE_URL`

**Steps to Rotate**:

#### If using Neon/Supabase Postgres:
1. Log in to your database provider dashboard
2. Navigate to database settings
3. Reset/rotate the database password
4. Get the new connection string
5. Update `.env.local`:
   ```bash
   DATABASE_URL=postgresql://user:NEW_PASSWORD@host:5432/dbname?sslmode=require
   ```

#### Best Practice:
- Use connection pooling (Neon already does this)
- Enable SSL mode
- Restrict database access by IP if possible

**Verification**:
```bash
# Test database connection
npm run db:migrate
# or
npx drizzle-kit push:pg
```

---

## Post-Rotation Verification Checklist

After rotating all keys, verify the following functionality:

### Authentication & Authorization
- [ ] User can log in via Supabase Auth
- [ ] JWT tokens are issued correctly
- [ ] RLS policies are enforced (after migration)
- [ ] Invitation emails are sent

### Content Generation
- [ ] AI article generation works (OpenAI GPT-4)
- [ ] AI image generation works (DALL-E 3)
- [ ] Images upload to Supabase Storage
- [ ] Usage tracking is recorded

### Headless CMS API
- [ ] Public API endpoints are accessible with API keys
- [ ] Webhook delivery works
- [ ] Content fetching with ETags works

### Admin Dashboard
- [ ] Site creation works
- [ ] User invitation works
- [ ] Article CRUD operations work
- [ ] Usage statistics display correctly

### GitHub Integration (if applicable)
- [ ] Repository connection works
- [ ] Webhook delivery to GitHub works

---

## Additional Security Hardening

### Immediate Actions (After Migration):

1. **Enable RLS on Database**
   ```bash
   # Run migration 0001
   psql $DATABASE_URL < migrations/0001_security_and_schema_fixes.sql
   ```

2. **Audit User Access**
   ```sql
   -- Check all users and their roles
   SELECT id, email, role, supabase_user_id, client_id FROM users;

   -- Verify site_members assignments
   SELECT sm.*, u.email, s.name as site_name
   FROM site_members sm
   JOIN users u ON u.id = sm.user_id
   JOIN sites s ON s.id = sm.site_id;
   ```

3. **Review Supabase Storage Bucket Policies**
   - Ensure buckets have proper access controls
   - Verify public vs private bucket settings
   - Set up bucket-level RLS if needed

4. **Enable Rate Limiting on All Endpoints**
   - Currently only CMS API has rate limiting
   - Add to admin endpoints as well

5. **Set up Monitoring & Alerts**
   - Failed login attempts
   - API key usage anomalies
   - Database query failures
   - Webhook delivery failures

### Long-Term Security Practices:

1. **Regular Key Rotation Schedule**
   - OpenAI API key: Every 90 days
   - GitHub token: Every 90 days
   - Database passwords: Every 180 days
   - Supabase keys: As needed (or on project migration)

2. **Access Auditing**
   - Log all admin actions
   - Track API usage by site
   - Monitor unusual access patterns

3. **Dependency Security**
   ```bash
   # Run regularly
   npm audit
   npm audit fix

   # Use tools like Snyk or Dependabot
   ```

4. **Environment Variable Management**
   - Never commit `.env.local` or `.env.production`
   - Use secret management tools (AWS Secrets Manager, HashiCorp Vault, etc.)
   - Separate dev/staging/production environments

5. **Database Backups**
   - Enable automatic daily backups
   - Test restore procedures
   - Store backups in separate location

---

## Incident Response Plan

If API keys are compromised:

### Immediate Actions (Within 1 Hour):
1. Rotate all exposed API keys immediately
2. Check database logs for unauthorized access
3. Review recent API calls for suspicious activity
4. Lock affected user accounts if necessary
5. Change database passwords

### Short-Term Actions (Within 24 Hours):
1. Audit all sites and content for unauthorized changes
2. Review Supabase Storage for uploaded malicious files
3. Check webhook logs for suspicious deliveries
4. Notify affected users if data was accessed

### Long-Term Actions:
1. Implement additional security measures (2FA, IP whitelisting, etc.)
2. Conduct security audit of entire application
3. Update security documentation
4. Train team on security best practices

---

## Contact Information for Support

- **OpenAI Support**: https://help.openai.com/
- **GitHub Support**: https://support.github.com/
- **Mailgun Support**: https://www.mailgun.com/support/
- **Supabase Support**: https://supabase.com/docs/guides/platform/going-into-prod

---

## Last Updated

**Date**: 2025-10-29
**Updated By**: Security Audit
**Next Review Date**: 2026-01-29 (every 90 days)
