/**
 * pat.js — Personal Access Token utilities
 *
 * A PAT is a cryptographically random token the user pastes into the
 * VS Code extension setting `nexusSentinel.pat`. It is stored in
 * Supabase (hashed) and validated server-side in production.
 *
 * In this prototype, the PAT is generated client-side and stored in
 * the user's Supabase profile row for retrieval.
 */

import { supabase } from './supabase'

/** Generate a cryptographically random PAT in the format NST-<48 hex chars> */
export function generatePAT() {
  const array = new Uint8Array(24)
  crypto.getRandomValues(array)
  const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
  return `NST-${hex}`
}

/**
 * Upsert the PAT for the current user into Supabase.
 * Table: nexus_sentinel_pats (id uuid, user_id uuid, pat text, mode text, created_at timestamptz)
 */
export async function savePAT(pat, mode) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No authenticated user')

  const { data, error } = await supabase
    .from('nexus_sentinel_pats')
    .upsert(
      { user_id: user.id, pat, mode, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

/** Retrieve the PAT for the current user */
export async function getPAT() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('nexus_sentinel_pats')
    .select('pat, mode, updated_at')
    .eq('user_id', user.id)
    .single()

  if (error) return null
  return data
}
