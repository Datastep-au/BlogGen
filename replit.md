# BlogGen - Headless CMS with AI-Powered Article Generation

## Overview

BlogGen has evolved from a simple blog article generator into a comprehensive headless CMS platform with multi-tenant support. The system combines AI-powered content generation using OpenAI's GPT-4o with a robust content delivery infrastructure including public read-only APIs, webhook delivery system, and asset management. It supports both Supabase Auth for admin users and API key authentication for client sites accessing content.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state, React Context for authentication
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite with custom configuration for development and production

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: Dual API structure - Admin API (protected) and Public CMS API (read-only)
- **Request Processing**: Built-in middleware for logging, JSON parsing, and error handling
- **Development Server**: Custom Vite integration for hot module replacement
- **Job Processing**: Scheduled job processor runs every 60 seconds for webhooks and post publishing

### Authentication System
- **Admin Auth**: Supabase Auth with JWT-based authentication and session management
- **Client Auth**: API key authentication with HMAC-SHA256 hashing and JWT tokens containing site_id claims
- **Dual Strategy**: Separate authentication flows for admin UI and public API access
- **Protected Routes**: Route guards for authenticated-only content

## Key Components

### Database Schema (Drizzle ORM)
**Multi-tenant Core Tables:**
- **Sites Table**: Multi-tenant site management with UUID-based site_id, domain tracking, and API key authentication
- **Posts Table**: Content storage with markdown/HTML conversion, slug management, SEO fields, scheduling, and content hash tracking
- **Post Slugs Table**: Historical slug tracking for 301 redirects when URLs change

**Asset Management:**
- **Assets Table**: Supabase Storage integration for images with role-based categorization (hero, cover, inline)

**Webhook Infrastructure:**
- **Webhooks Table**: Event subscription configuration with HMAC secret and target URLs
- **Webhook Delivery Logs**: Delivery tracking with status codes, retry attempts, and error logging
- **Scheduled Jobs Table**: Table-based job queue for webhook deliveries and scheduled post publishing

**Legacy Tables (Article Generation):**
- **Users Table**: Admin user profiles with Supabase Auth integration
- **Articles Table**: AI-generated draft articles before CMS publication
- **Usage Tracking Table**: Monthly article generation limits per user

### API Endpoints

**Admin API (Protected - Supabase Auth):**
- `POST /api/generate-article`: Generate single or bulk articles with AI
- `POST /api/admin/sites`: Create new site with API key generation
- `GET /api/admin/sites`: List all sites for current user
- `POST /api/admin/sites/:id/rotate-key`: Rotate API key for site
- `POST /api/admin/webhooks`: Create webhook subscription
- `GET /api/admin/webhooks/site/:siteId`: List webhooks for site
- `DELETE /api/admin/webhooks/:id`: Delete webhook
- `POST /api/admin/posts/publish`: Publish article to CMS
- `PUT /api/admin/posts/:postId`: Update published post
- `DELETE /api/admin/posts/:postId`: Delete post
- `GET /api/admin/posts/site/:siteId`: List posts for site

**Public CMS API (Read-only - API Key Auth):**
- `GET /v1/sites/:site_id/posts`: List published posts with pagination, filtering, ETags, and cache control
- `GET /v1/sites/:site_id/posts/:slug`: Get single post by slug with 301 redirect support for old slugs

### Storage Layer
- **Interface**: IStorage abstraction for data operations
- **Implementation**: PostgreSQL with Supabase (Neon-backed database)
- **Asset Storage**: Supabase Storage with automatic bucket creation (bloggen-assets)
- **Type Safety**: Full TypeScript integration with Drizzle ORM

### Article Generation to CMS Pipeline
1. **AI Generation**: OpenAI GPT-4o generates markdown articles with SEO metadata
2. **Content Processing**: Markdown converted to HTML using 'marked' library
3. **Slug Management**: URL-friendly slug generation with deduplication
4. **Content Hashing**: UUIDv5-based content hash for change detection
5. **Publishing**: Articles published to CMS as posts (draft/scheduled/published)
6. **Webhook Emission**: Events triggered for post_published, post_updated, post_deleted

### Webhook Delivery System
- **Event Types**: post_published, post_updated, post_deleted
- **Security**: HMAC-SHA256 signatures with webhook-specific secrets
- **Delivery**: HTTP POST with JSON payload and X-Webhook-Signature header
- **Retry Logic**: 3 attempts with exponential backoff (1min, 5min, 15min)
- **Job Queue**: Table-based persistent queue for reliable delivery
- **Logging**: Complete delivery tracking with attempt numbers and status codes

### Job Processor
- **Interval**: Runs every 60 seconds
- **Scheduled Posts**: Automatically publishes posts when scheduled_date is reached
- **Webhook Delivery**: Processes queued webhook jobs with retry logic
- **Status Tracking**: Updates job status (pending → running → completed/failed)
- **Error Handling**: Retry mechanism with max_attempts enforcement

### UI Components
- **TopicForm**: Single and bulk article generation interface
- **ArticleEditor**: Rich editing interface for generated content
- **Dashboard**: Article management and statistics
- **AuthGuard**: Route protection component
- **CMS Admin Pages**: Site management, webhook configuration, post publishing

## Data Flow

### Article Generation Flow
1. **User Authentication**: Supabase handles login/signup, stores JWT in session
2. **Article Generation**: User submits topics → API validates limits → OpenAI generates content → Database stores results
3. **Content Management**: Dashboard fetches user articles → Display with editing capabilities → Updates saved to database
4. **Usage Tracking**: Monitor monthly generation counts → Enforce 10-article limit → Reset monthly

### CMS Publishing Flow
1. **Site Creation**: Admin creates site → API key generated and hashed → Site stored with UUID
2. **Article Publishing**: Admin publishes article → Slug deduplication → Markdown to HTML conversion → Content hash generation → Post created
3. **Webhook Emission**: Post event emitted → Webhook job created → Job processor delivers to subscribers
4. **Content Delivery**: Client site authenticates with API key → JWT issued with site_id → Posts fetched from public API

### Scheduled Publishing Flow
1. **Schedule Creation**: Admin sets scheduled_date on post → Scheduled job created
2. **Job Processing**: Every 60s, processor checks for due jobs → Updates post status to published → Emits webhook event
3. **Delivery**: Webhook subscribers notified of new published content

## External Dependencies

### Core Services
- **OpenAI API**: GPT-4o model for article generation with custom AI_VISIBILITY_PROMPT guidelines
- **Supabase**: Authentication, user management, PostgreSQL database (Neon), Storage for assets
- **Neon Database**: PostgreSQL hosting via Supabase integration

### Development Tools
- **Replit Integration**: Hot reload, error overlay, development banner
- **TypeScript**: Full type safety across frontend and backend
- **ESM Modules**: Modern JavaScript module system
- **Drizzle ORM**: Type-safe database queries and schema management

### UI Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling
- **Lucide Icons**: Icon set for UI elements
- **date-fns**: Date manipulation utilities
- **marked**: Markdown to HTML conversion

## Security Architecture

### API Key Authentication
- **Storage**: API keys hashed with HMAC-SHA256 before storage
- **Distribution**: Plain-text key shown once on creation, then discarded
- **JWT Generation**: Authenticated requests receive JWT with site_id claim
- **Rate Limiting**: Built-in middleware to prevent abuse

### Webhook Security
- **HMAC Signatures**: Each webhook has unique secret for payload signing
- **Signature Verification**: X-Webhook-Signature header for payload validation
- **Replay Protection**: Timestamp-based payload to prevent replay attacks

### Environment Variables
- **Backend-only**: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (never VITE_ prefixed)
- **Secret Management**: Replit Secrets for sensitive credentials
- **Separation**: Admin auth (Supabase) vs Client auth (API keys)

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds React app to `dist/public`
- **Backend**: esbuild bundles Express server to `dist/index.js`
- **Assets**: Static files served from build directory

### Environment Configuration
**Required Environment Variables:**
- `DATABASE_URL`: Supabase PostgreSQL connection string
- `SUPABASE_URL`: Supabase project URL (for Storage)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for Storage operations
- `OPENAI_API_KEY`: OpenAI API key for article generation
- `AI_VISIBILITY_PROMPT`: (Optional) Custom writing guidelines for AI
- `JWT_SECRET`: Secret for API key JWT signing

### Database Management
- **Schema**: Defined in `shared/schema.ts` with Drizzle ORM
- **Migrations**: Run `npm run db:push` to apply schema changes
- **Location**: `./migrations` directory for migration files

### Deployment Commands
- `npm run dev`: Development server with hot reload and job processor
- `npm run build`: Production build
- `npm run start`: Production server with job processor
- `npm run db:push`: Apply database schema changes

## Multi-Tenant Architecture

### Site Isolation
- **UUID-based Site IDs**: Prevents enumeration and ensures uniqueness
- **API Key per Site**: Each site has dedicated authentication credentials
- **Data Segregation**: All queries filtered by site_id for tenant isolation

### Content Delivery
- **Public API**: Read-only endpoints for client sites to fetch content
- **ETag Support**: Efficient caching with content hash-based ETags
- **Cache-Control**: Browser and CDN caching headers for performance
- **Pagination**: Cursor-based pagination for large datasets

### Webhook System
- **Per-Site Subscriptions**: Webhooks scoped to individual sites
- **Event Filtering**: Only receive events for owned posts
- **Delivery Guarantees**: Persistent queue with retry logic

The application is designed for scalability as a true headless CMS platform with enterprise-grade features including multi-tenancy, webhook delivery, scheduled publishing, and robust authentication for both admin and client access.
