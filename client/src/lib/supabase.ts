import { createClient } from '@supabase/supabase-js';

// Use DATABASE_URL and SUPABASE_ANON_KEY (with VITE_ prefix for frontend access)
const databaseUrl = import.meta.env.VITE_DATABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Extract Supabase project URL from DATABASE_URL (remove connection details)
let supabaseUrl = '';
if (databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    supabaseUrl = `https://${url.hostname.replace('db.', '').replace('.supabase.co', '')}.supabase.co`;
  } catch (error) {
    console.error('Failed to parse DATABASE_URL:', error);
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
