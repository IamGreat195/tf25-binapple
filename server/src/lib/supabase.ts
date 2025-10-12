// lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../integration/supabase/types'

const supabaseAdmin = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // service key → admin privileges
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
)

export default supabaseAdmin
