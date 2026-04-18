import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Nexus-Sentinel] Missing Supabase env vars. Copy .env.example to .env and fill in your credentials.'
  )
}

export const supabase = createClient(
  supabaseUrl ?? 'https://pjtabfhbkkeqdtmijqfi.supabase.co',
  supabaseAnonKey ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqdGFiZmhia2tlcWR0bWlqcWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTU0MjQsImV4cCI6MjA5MjA3MTQyNH0.KhMNIKrKuwRT4lno0lRB1lAyxdzVkHSp42OdmrZhsBo'
)

/** Sign in via GitHub OAuth */
export async function signInWithGitHub() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'read:user user:email',
    },
  })
  if (error) throw error
  return data
}

/** Sign out the current user */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** Get the currently authenticated user (or null) */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/** Subscribe to auth state changes */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
}
