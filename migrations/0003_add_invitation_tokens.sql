-- Migration: Add invitation_tokens table for user invitations
-- This enables a proper invite flow where users can set their password via a secure token link

-- Create enum if it doesn't exist (should already exist from initial migration)
DO $$ BEGIN
  CREATE TYPE "public"."user_role" AS ENUM('admin', 'client_editor', 'client_viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "invitation_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "full_name" text,
  "role" "user_role" NOT NULL,
  "client_id" integer REFERENCES "clients"("id"),
  "site_id" uuid REFERENCES "sites"("id"),
  "invited_by" integer REFERENCES "users"("id"),
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS "idx_invitation_tokens_email" ON "invitation_tokens"("email");

-- Create index on token_hash for faster verification
CREATE INDEX IF NOT EXISTS "idx_invitation_tokens_token_hash" ON "invitation_tokens"("token_hash");

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS "idx_invitation_tokens_expires_at" ON "invitation_tokens"("expires_at");

-- Create index on used_at to filter unused tokens
CREATE INDEX IF NOT EXISTS "idx_invitation_tokens_used_at" ON "invitation_tokens"("used_at");
