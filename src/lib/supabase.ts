import { createClient, SupabaseClient } from "@supabase/supabase-js"

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawAnonKey &&
  !rawUrl.includes("placeholder") &&
  !rawUrl.includes("your-project-ref") &&
  !rawAnonKey.includes("placeholder")
)

const supabaseUrl = isSupabaseConfigured ? rawUrl : "https://placeholder.supabase.co"
const supabaseAnonKey = isSupabaseConfigured ? rawAnonKey : "placeholder-anon-key"

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)
