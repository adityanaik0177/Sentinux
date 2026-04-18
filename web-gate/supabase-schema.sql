  -- ================================================================
  -- Nexus-Sentinel Supabase Schema — Phase 2
  -- Run this in your Supabase SQL Editor before using the Web Gate.
  -- ================================================================

  -- ── PAT storage table ─────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS nexus_sentinel_pats (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pat         TEXT NOT NULL,
    mode        TEXT NOT NULL CHECK (mode IN ('guardian', 'autonomous')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- One PAT row per user
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pats_user_id ON nexus_sentinel_pats(user_id);

  -- ── Row-Level Security ────────────────────────────────────────────
  ALTER TABLE nexus_sentinel_pats ENABLE ROW LEVEL SECURITY;

  -- Users can only read/write their own PAT
  CREATE POLICY "Users manage own PAT"
    ON nexus_sentinel_pats
    FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  -- ── Auto-update timestamp ─────────────────────────────────────────
  CREATE OR REPLACE FUNCTION update_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trg_pats_updated_at
    BEFORE UPDATE ON nexus_sentinel_pats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

  -- ── GitHub Auth Config reminder ───────────────────────────────────
  -- In Supabase Dashboard → Authentication → Providers → GitHub:
  --   1. Enable GitHub provider
  --   2. Add your GitHub OAuth App Client ID + Secret
  --   3. Set Redirect URL to: https://your-project-id.supabase.co/auth/v1/callback
  --   4. (local dev) Add http://localhost:5173/auth/callback to GitHub OAuth allowed URLs
