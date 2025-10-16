# Overview

BlogGen Pro is an SEO-optimized blog article generator that leverages AI to create high-quality blog content. The application allows users to generate single or bulk articles based on topics, manage generated content through a dashboard, and track monthly usage limits. Built as a modern web application, it provides an intuitive interface for content creators to streamline their blog writing workflow.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast hot module replacement
- React Router DOM v6 for client-side routing and navigation
- TailwindCSS for utility-first styling with PostCSS processing

**Routing Structure**
- Public routes: Landing page (`/`) and authentication page (`/auth`)
- Protected routes: Application dashboard and generation interface under `/app/*`
- Auth guard component wraps protected routes to enforce authentication
- Automatic redirect logic for authenticated/unauthenticated users

**State Management**
- React Context API for authentication state (AuthContext)
- Local component state with React hooks for UI state
- No external state management library (Redux/MobX) used

**Component Architecture**
- Functional components with hooks throughout
- Reusable UI components: ArticleCard, ArticleModal, TopicForm, Layout
- Specialized components: AuthGuard for route protection, YouTubeModal for video playback
- Context providers wrap the application for global state access

## Backend Architecture

**Authentication & User Management**
- Supabase Auth handles user authentication with email/password and Google OAuth
- Session management through Supabase client with automatic token refresh
- Auth state synchronized between Supabase and React Context
- OAuth redirect handling processes access tokens from URL fragments

**Serverless Functions (Supabase Edge Functions)**
- `generate-article`: AI-powered article generation using OpenAI GPT-4 Turbo
  - Supports single topic and bulk topic generation
  - Returns structured JSON with title, content, meta description, and keywords
  - Robust JSON parsing to handle markdown code blocks in responses
- `schedule-publisher`: Cron-based function to publish scheduled articles
  - Checks for overdue scheduled articles periodically
  - Updates article status from 'scheduled' to 'published'
- Test functions for Notion integration (legacy, not actively used)

**API Integration**
- OpenAI API for content generation (via Edge Functions)
- Supabase REST API for database operations
- CORS configuration shared across all Edge Functions

## Data Storage

**Supabase (PostgreSQL)**
- `articles` table: Stores generated blog articles
  - Fields: id, user_id, topic, title, content, meta_description, keywords, status, scheduled_date, created_at, updated_at
  - Status values: 'draft', 'approved', 'scheduled', 'published'
  - User-specific article queries with user_id foreign key
- Row Level Security (RLS) expected for multi-tenant data isolation
- Real-time subscriptions not currently implemented but supported by Supabase

**Usage Tracking**
- Monthly article generation limits enforced client-side
- Usage calculated by counting articles per user per calendar month
- Default limit: 10 articles per month per user

## Authentication & Authorization

**Authentication Flows**
- Email/password authentication with email confirmation
- Google OAuth with redirect-based flow
- Session tokens stored in browser (httpOnly cookies via Supabase)
- Automatic session refresh handled by Supabase client

**Authorization Pattern**
- Route-level protection using AuthGuard component
- User ID passed with all database operations for data scoping
- Server-side user verification in Edge Functions via auth header
- No role-based access control (single user role)

## External Dependencies

**Core Infrastructure**
- **Supabase**: Backend-as-a-Service providing PostgreSQL database, authentication, and serverless functions
  - Environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
  - Service role key used in Edge Functions for admin operations

**AI & Content Generation**
- **OpenAI GPT-4 Turbo**: Article generation via API
  - Accessed through Supabase Edge Functions to secure API keys
  - Structured prompts for SEO-optimized content generation

**UI & Styling**
- **TailwindCSS**: Utility-first CSS framework
- **Lucide React**: Icon library for consistent iconography
- **date-fns**: Date formatting and manipulation utility

**Development Tools**
- **Vite**: Frontend build tool and dev server
- **TypeScript**: Static type checking (strict mode enabled)
- **ESLint**: Code linting with React-specific plugins

**Third-Party Services (Legacy/Unused)**
- Notion API integration present in backup files but not active in current version
- Test functions exist for Notion connections but aren't used in the main application flow

**Authentication Provider**
- Google OAuth for social authentication (configured through Supabase)
- Requires OAuth client ID/secret configuration in Supabase dashboard