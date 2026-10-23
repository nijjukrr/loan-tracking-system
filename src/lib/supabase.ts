import { createClient } from '@supabase/supabase-js'

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>

const supabaseUrl = env.VITE_SUPABASE_URL?.trim()
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const localOnly = env.VITE_LOCAL_ONLY === 'true'

export const isSupabaseConfigured = Boolean(!localOnly && supabaseUrl && publishableKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
