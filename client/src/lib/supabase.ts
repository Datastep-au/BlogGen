import { createClient } from '@supabase/supabase-js';

// Use DATABASE_URL and SUPABASE_ANON_KEY (with VITE_ prefix for frontend access)
const databaseUrl = import.meta.env.VITE_DATABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// Extract Supabase project URL from DATABASE_URL (remove connection details)
export let supabaseUrl = envSupabaseUrl || '';

if (!supabaseUrl && databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const hostname = url.hostname;
    
    // Check if it's a direct connection (db.project_id.supabase.co)
    if (hostname.includes('.supabase.co') && hostname.startsWith('db.')) {
      supabaseUrl = `https://${hostname.replace('db.', '').replace('.supabase.co', '')}.supabase.co`;
    } 
    // Check if we can extract project ID from the username (common in pooler connection strings)
    // Format: postgres.project_id or user.project_id
    else if (url.username && url.username.includes('.')) {
      const parts = url.username.split('.');
      // The project ID is usually the part after the dot
      if (parts.length >= 2) {
        const projectId = parts[1];
        supabaseUrl = `https://${projectId}.supabase.co`;
      }
    }
    
    // Fallback for other formats if needed, or keep empty to trigger error
  } catch (error) {
    console.error('Failed to parse DATABASE_URL:', error);
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', { 
    hasUrl: !!supabaseUrl, 
    hasKey: !!supabaseAnonKey,
    hasDbUrl: !!databaseUrl,
    envSupabaseUrl,
    databaseUrl 
  });
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

console.log('Initializing Supabase client with URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
