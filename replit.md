# BlogGen - AI-Powered Blog Article Generator

## Overview

BlogGen is a full-stack web application that helps users generate SEO-optimized blog articles using OpenAI's GPT-4o model. The application features a React frontend with modern UI components, an Express.js backend, and uses PostgreSQL with Drizzle ORM for data persistence. Users can generate single articles or bulk generate multiple articles at once, with built-in usage tracking and monthly limits.

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
- **API Design**: RESTful API with JSON responses
- **Request Processing**: Built-in middleware for logging, JSON parsing, and error handling
- **Development Server**: Custom Vite integration for hot module replacement

### Authentication System
- **Provider**: Supabase Auth
- **Strategy**: JWT-based authentication with session management
- **Integration**: Custom React context provider with persistent state
- **Protected Routes**: Route guards for authenticated-only content

## Key Components

### Database Schema (Drizzle ORM)
- **Users Table**: Stores user profiles with email, name, and avatar
- **Articles Table**: Stores generated articles with content, metadata, and SEO fields
- **Usage Tracking Table**: Monitors monthly article generation limits per user

### API Endpoints
- `POST /api/generate-article`: Generate single or bulk articles
- Built-in usage validation and limit enforcement
- Error handling with structured JSON responses

### Storage Layer
- **Interface**: IStorage abstraction for data operations
- **Implementation**: In-memory storage (MemStorage) for development
- **Database Ready**: Configured for PostgreSQL with Neon serverless

### Article Generation
- **AI Model**: OpenAI GPT-4o for content generation
- **Features**: SEO optimization, keyword integration, structured content
- **Custom Guidelines**: AI_VISIBILITY_PROMPT environment variable for custom writing guidelines
- **Output**: Title, content, meta description, keywords, and word count

### UI Components
- **TopicForm**: Single and bulk article generation interface
- **ArticleEditor**: Rich editing interface for generated content
- **Dashboard**: Article management and statistics
- **AuthGuard**: Route protection component

## Data Flow

1. **User Authentication**: Supabase handles login/signup, stores JWT in session
2. **Article Generation**: User submits topics → API validates limits → OpenAI generates content → Database stores results
3. **Content Management**: Dashboard fetches user articles → Display with editing capabilities → Updates saved to database
4. **Usage Tracking**: Monitor monthly generation counts → Enforce 10-article limit → Reset monthly

## External Dependencies

### Core Services
- **OpenAI API**: GPT-4o model for article generation with custom AI_VISIBILITY_PROMPT guidelines
- **Supabase**: Authentication, user management
- **Neon Database**: PostgreSQL hosting (configured but not required for development)

### Development Tools
- **Replit Integration**: Hot reload, error overlay, development banner
- **TypeScript**: Full type safety across frontend and backend
- **ESM Modules**: Modern JavaScript module system

### UI Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling
- **Lucide Icons**: Icon set for UI elements
- **date-fns**: Date manipulation utilities

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds React app to `dist/public`
- **Backend**: esbuild bundles Express server to `dist/index.js`
- **Assets**: Static files served from build directory

### Environment Configuration
- **Development**: Uses memory storage, Vite dev server
- **Production**: Requires DATABASE_URL, OPENAI_API_KEY, AI_VISIBILITY_PROMPT, Supabase credentials
- **Database**: Drizzle migrations in `./migrations` directory

### Deployment Commands
- `npm run dev`: Development server with hot reload
- `npm run build`: Production build
- `npm run start`: Production server
- `npm run db:push`: Apply database schema changes

The application is designed for scalability with a clean separation between frontend and backend, making it easy to deploy to various hosting platforms while maintaining development efficiency.