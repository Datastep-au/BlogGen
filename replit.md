# BlogGen - Headless CMS with AI-Powered Article Generation

## Overview

BlogGen is a comprehensive headless CMS platform with multi-tenant support, combining AI-powered content generation using OpenAI's GPT-4o with a robust content delivery infrastructure. It features public read-only APIs, a webhook delivery system, and integrated asset management. The platform supports Supabase Auth for admin users and API key authentication for client sites, aiming to be a scalable, enterprise-grade solution for content management and publishing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query (server state), React Context (authentication)
- **UI Framework**: shadcn/ui on Radix UI
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

### Backend
- **Framework**: Express.js with TypeScript
- **API Design**: Dual structure (Admin API and Public CMS API)
- **Job Processing**: Scheduled processor for webhooks and post publishing
- **Database**: PostgreSQL with Drizzle ORM (via Supabase)

### Authentication
- **Admin**: Supabase Auth (JWT-based)
- **Client**: API key authentication (HMAC-SHA256, JWT with `site_id` claims)

### Core Systems
- **Clients System**: Manages internal workspaces for organizations, including GitHub repository creation, email invitations (Mailgun), and user roles.
- **CMS Sites System**: Provides headless CMS capabilities for external websites, offering API key authentication, public read-only APIs, webhooks for content changes, and scheduled publishing.

### Data Model
- **Multi-tenant Core**: `Sites` (UUID-based), `Posts` (content, SEO, scheduling, hashing), `Post Slugs` (301 redirects).
- **Asset Management**: `Assets` (Supabase Storage integration).
- **Webhook Infrastructure**: `Webhooks`, `Webhook Delivery Logs`, `Scheduled Jobs`.
- **Team Collaboration**: `Clients`, `Users`, `Articles` (AI drafts), `Usage Tracking`.

### Article Generation to CMS Pipeline
AI-generated markdown articles are processed (marked for HTML conversion, slug generation, content hashing) and published as posts (draft/scheduled/published). This triggers webhooks for `post_published`, `post_updated`, `post_deleted` events.

### Webhook Delivery
Supports `post_published`, `post_updated`, `post_deleted` events. Features HMAC-SHA256 signatures, HTTP POST delivery with JSON payloads, retry logic with exponential backoff, and a persistent queue.

### Job Processor
Runs every 60 seconds to publish scheduled posts and process queued webhook jobs, ensuring reliable delivery and task execution.

### Security
- **API Key Authentication**: HMAC-SHA256 hashing for storage, JWT generation for authenticated requests, rate limiting.
- **Webhook Security**: HMAC signatures for payload validation, timestamp-based replay protection.
- **Environment Variables**: Strict separation of backend-only secrets and client-exposed variables.

## External Dependencies

- **OpenAI API**: GPT-4o for AI-powered article generation.
- **Supabase**: Authentication, PostgreSQL database (Neon-backed), Storage for assets.
- **Neon Database**: PostgreSQL hosting.
- **Mailgun**: Email delivery service for user invitations.
- **Drizzle ORM**: Type-safe database queries.
- **Radix UI**: Accessible UI primitives.
- **Tailwind CSS**: Utility-first styling.
- **Lucide Icons**: Icon set.
- **date-fns**: Date manipulation.
- **marked**: Markdown to HTML conversion.