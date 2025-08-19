import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tactix/shared';

let _supabase: SupabaseClient<Database> | null = null;
let _supabaseAuth: SupabaseClient<Database> | null = null;

function initializeSupabase()
{
  if (_supabase && _supabaseAuth)
  {
    return { supabase: _supabase, supabaseAuth: _supabaseAuth };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey)
  {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
  }

  if (!supabaseAnonKey)
  {
    throw new Error('Missing Supabase anon key (SUPABASE_ANON_KEY)');
  }

  // Create Supabase client with service role key for backend operations
  _supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Create client for JWT verification (using anon key)
  _supabaseAuth = createClient<Database>(supabaseUrl, supabaseAnonKey);

  return { supabase: _supabase, supabaseAuth: _supabaseAuth };
}

// Export getter functions instead of direct instances
export const getSupabase = () =>
{
  const { supabase } = initializeSupabase();
  return supabase;
};

export const getSupabaseAuth = () =>
{
  const { supabaseAuth } = initializeSupabase();
  return supabaseAuth;
};

// For backward compatibility, export the instances
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(target, prop)
  {
    return getSupabase()[prop as keyof SupabaseClient<Database>];
  },
});

export const supabaseAuth = new Proxy({} as SupabaseClient<Database>, {
  get(target, prop)
  {
    return getSupabaseAuth()[prop as keyof SupabaseClient<Database>];
  },
});
