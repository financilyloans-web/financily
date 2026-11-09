// ============================================================================
// Supabase client setup
// ============================================================================
// Reads keys from frontend/.env.local via Vite's import.meta.env.
//   VITE_SUPABASE_URL        — your Supabase project URL
//   VITE_SUPABASE_ANON_KEY   — your publishable/anon key (public client key)
//
// NOTE: these two values are public by design (they identify your project for
// client-side use). Real security is enforced server-side by RLS policies and
// your Supabase project settings — never rely on the anon key as a secret.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Create frontend/.env.local (see .env.local.example).'
  );
}

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export default supabase;
