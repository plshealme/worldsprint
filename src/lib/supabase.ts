import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/types/user";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export interface SupabaseProfileRow {
  username?: string | null;
  email?: string | null;
  role?: string | null;
}

export function profileFromSupabaseUser(user: User, profile?: SupabaseProfileRow | null): UserProfile {
  const metadata = user.user_metadata ?? {};
  const username =
    typeof profile?.username === "string" && profile.username.trim()
      ? profile.username
      : typeof metadata.username === "string" && metadata.username.trim()
        ? metadata.username
        : user.email?.split("@")[0];
  const isAdmin = profile?.role === "admin";

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    username: username ?? "WordSprint User",
    isAdmin,
    firstLoginDone: metadata.firstLoginDone === true,
    xp: typeof metadata.xp === "number" ? metadata.xp : 0,
    badges: Array.isArray(metadata.badges) ? metadata.badges : [],
    createdAt: user.created_at ?? new Date().toISOString(),
  };
}
