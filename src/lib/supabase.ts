import { createClient } from '@supabase/supabase-js'

const nodeEnv = (typeof globalThis !== 'undefined' && 'process' in globalThis)
  ? (globalThis as unknown as { process: { env?: Record<string, string | undefined> } }).process?.env || {}
  : {}

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : nodeEnv as Record<string, string | undefined>

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
