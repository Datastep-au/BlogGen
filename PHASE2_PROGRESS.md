# Phase 2: Code Migration - Progress Report

## Status: IN PROGRESS - Part 1 Complete

**Started**: 2025-10-29
**Current Status**: Foundation laid, critical endpoints updated

---

## ✅ Completed (Part 1)

### 1. Storage Interface Updates
**File**: [server/storage.ts](server/storage.ts)

**Changes**:
- Added `site_members` import and types
- Updated `IStorage` interface with site_members methods:
  - `getSiteMember()`
  - `getSiteMembersBySiteId()`
  - `getSiteMembersByUserId()`
  - `getSiteMemberBySiteAndUser()`
  - `createSiteMember()`
  - `updateSiteMember()`
  - `deleteSiteMember()`
- Updated `getUsageTracking()` signature: `clientId: number` → `siteId: string`
- Updated `updateUsageTracking()` signature: Added `articlesIncrement` and `imagesIncrement` parameters

**Impact**: Storage layer now fully supports site-based access control

---

### 2. Authorization Helper Module
**File**: [server/lib/authorization.ts](server/lib/authorization.ts) (NEW)

**Features**:
- `isAdmin()` - Check if user is admin
- `hasSiteAccess()` - Check if user can view a site
- `canEditSite()` - Check if user can edit site content (owner/editor)
- `getSiteIdForClient()` - Get site from client (1:1 mapping)
- `getUserSites()` - Get all sites user has access to
- `canAccessArticle()` - Check article access via site membership
- `canEditArticle()` - Check article edit permissions

**Middleware**:
- `requireAdmin` - Require admin role
- `requireSiteAccess` - Require site membership
- `requireSiteEdit` - Require editor/owner role

**Benefits**:
- Reusable authorization logic
- Centralized permission checks
- Type-safe request handling
- Easier to test and maintain

---

### 3. User Invitation Endpoint Update
**File**: [server/routes.ts](server/routes.ts:270-366)

**Endpoint**: `POST /api/admin/clients/:clientId/invite`

**Changes**:
- Added `site_role` parameter (owner/editor/viewer)
- Gets site from client (1:1 relationship)
- Creates `site_members` record instead of just setting `client_id`
- Handles existing users (updates membership)
- Handles new users (creates user + membership)
- Backwards compatible (still sets `client_id` for transition period)

**New Request Body**:
```typescript
{
  email: string;
  role: "admin" | "client_editor" | "client_viewer"; // User role
  site_role: "owner" | "editor" | "viewer"; // Site-specific role
}
```

**New Response**:
```typescript
{
  success: true;
  user: User;
  site: { id: string, name: string };
  site_role: string;
  emailSent: boolean;
  message: string;
}
```

**Impact**: Users are now properly invited to sites with role-based access

---

## ⏳ Remaining Work (Part 2)

### 4. Article Generation Endpoints
**Files to Update**: [server/routes.ts](server/routes.ts)

**Required Changes**:
- `POST /api/articles/generate` (bulk generation)
  - Use `site_id` instead of `client_id`
  - Update usage tracking: `storage.updateUsageTracking(siteId, month, articlesCount, imagesCount)`
  - Get site from user's memberships
  - Check monthly limits from `sites` table
  - Add error handling for usage limits

- `POST /api/articles/:id/publish`
  - Check site access via authorization helper
  - Update to use `site_id`

**Estimated Time**: 2-3 hours

---

### 5. Article CRUD Endpoints Authorization
**Files to Update**: [server/routes.ts](server/routes.ts)

**Endpoints to Fix**:
- `GET /api/articles` - Filter by user's sites
- `GET /api/articles/:id` - Check `canAccessArticle()`
- `PATCH /api/articles/:id` - Check `canEditArticle()`
- `DELETE /api/articles/:id` - Check `canEditArticle()`
- `POST /api/articles/:id/export` - Check `canAccessArticle()`

**Pattern**:
```typescript
// Old:
if (user.role !== "admin" && article.client_id !== user.client_id) {
  return res.status(403).json({ error: "Access denied" });
}

// New:
import { canEditArticle } from './lib/authorization';
if (!(await canEditArticle(user.id, articleId))) {
  return res.status(403).json({ error: "Access denied" });
}
```

**Estimated Time**: 1-2 hours

---

### 6. Middleware Updates
**File**: [server/routes.ts](server/routes.ts:34-53)

**Current `requireClientAccess` Middleware**:
```typescript
const requireClientAccess = async (req: any, res: any, next: any) => {
  const user = await storage.getUser(req.user.id);
  if (user.role === "admin") {
    next();
    return;
  }
  req.clientId = user.client_id; // DEPRECATED
  next();
};
```

**Needs to Become**:
```typescript
const requireSiteAccess = async (req: any, res: any, next: any) => {
  const user = await storage.getUser(req.user.id);
  if (user.role === "admin") {
    req.userSites = await storage.getAllSites();
    next();
    return;
  }
  const memberships = await storage.getSiteMembersByUserId(user.id);
  req.userSites = memberships.map(m => m.site_id);
  next();
};
```

**Estimated Time**: 30 minutes

---

### 7. Frontend Updates
**Files to Update**:
- [client/src/pages/Dashboard.tsx](client/src/pages/Dashboard.tsx)
- [client/src/pages/Admin.tsx](client/src/pages/Admin.tsx)
- [client/src/pages/Generate.tsx](client/src/pages/Generate.tsx)
- [client/src/components/ArticleEditor.tsx](client/src/components/ArticleEditor.tsx)

**Changes Needed**:
- Replace all `client_id` references with `site_id`
- Update API calls to use new response format
- Handle multi-site user access (site selector)
- Update dashboard to show site memberships
- Update usage tracking display (per-site limits)

**Estimated Time**: 3-4 hours

---

## 🚧 Known Issues to Address

### 1. Usage Tracking in Article Generation
**Location**: [server/routes.ts](server/routes.ts:745-746)

**Current**:
```typescript
if (generatedCount > 0 && clientId) {
  await storage.updateUsageTracking(clientId, currentMonth, generatedCount);
}
```

**Needs**:
```typescript
if (generatedCount > 0 && siteId) {
  await storage.updateUsageTracking(siteId, currentMonth, generatedCount, imagesGenerated);
}
```

---

### 2. Article Creation site_id
**Location**: Multiple places in [server/routes.ts](server/routes.ts)

**Current**:
```typescript
const article = await storage.createArticle({
  client_id: clientId,
  // ...
});
```

**Needs**:
```typescript
const article = await storage.createArticle({
  site_id: siteId,
  client_id: clientId, // Keep for backwards compat during migration
  // ...
});
```

---

### 3. Article Listing Filters
**Location**: [server/routes.ts](server/routes.ts:786-795)

**Current**:
```typescript
const clientId = req.query.client_id ? parseInt(req.query.client_id as string) : null;
if (clientId) {
  articles = await storage.getArticlesByClientId(clientId);
}
```

**Needs**:
```typescript
// Get all sites user has access to
const userSites = await getUserSites(user.id);
const siteIds = userSites.map(s => s.id);

// Filter articles by sites
articles = await storage.getArticlesBySiteIds(siteIds); // NEW METHOD NEEDED
```

---

## 📊 Progress Summary

| Category | Status | Progress |
|----------|--------|----------|
| Storage Layer | ✅ Complete | 100% |
| Authorization Helpers | ✅ Complete | 100% |
| User Invitation | ✅ Complete | 100% |
| Article Generation | ⏳ Pending | 0% |
| Article CRUD | ⏳ Pending | 0% |
| Middleware | ⏳ Pending | 0% |
| Frontend | ⏳ Pending | 0% |
| **Overall** | **🟡 In Progress** | **~30%** |

---

## 🎯 Next Steps (Priority Order)

1. **Update article generation endpoint** (HIGH PRIORITY)
   - Most commonly used endpoint
   - Critical for usage tracking

2. **Update article CRUD authorization** (HIGH PRIORITY)
   - Security-critical
   - Affects all article operations

3. **Update middleware** (MEDIUM PRIORITY)
   - Affects multiple endpoints
   - Needed for proper filtering

4. **Add helper method `getArticlesBySiteIds()`** (MEDIUM PRIORITY)
   - Needed for article listing
   - Performance consideration

5. **Update frontend** (MEDIUM PRIORITY)
   - User-facing changes
   - Can be done in parallel with backend

6. **Testing** (HIGH PRIORITY)
   - End-to-end testing
   - Admin vs editor access
   - Multi-site users

---

## 🔧 Database Methods Still Needed

Add to `server/db/database.ts`:

```typescript
async getArticlesBySiteIds(siteIds: string[]): Promise<Article[]> {
  return await db.select().from(articles)
    .where(inArray(articles.site_id, siteIds))
    .orderBy(desc(articles.created_at));
}
```

Import needed: `import { inArray } from 'drizzle-orm';`

---

## ⏱️ Time Estimate

- **Part 1 (Completed)**: 2 hours
- **Part 2 (Remaining)**: 6-8 hours
- **Total Phase 2**: 8-10 hours

**Est. Completion**: End of day if working full-time, or 1-2 more days part-time

---

## 🧪 Testing Checklist (After Completion)

- [ ] Admin can create clients/sites
- [ ] Admin can invite users to sites
- [ ] Invited users can log in (403 if not invited)
- [ ] Users can generate articles in their sites
- [ ] Usage limits enforced per-site
- [ ] Users can only see their sites' articles
- [ ] Editors can edit articles in their sites
- [ ] Viewers can only read articles
- [ ] Multi-site users see all their sites
- [ ] RLS policies work correctly
- [ ] Frontend displays correct data

---

**Last Updated**: 2025-10-29
**Next Review**: After completing article generation endpoint
