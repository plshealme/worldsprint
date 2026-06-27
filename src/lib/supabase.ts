import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/types/user";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function profileFromSupabaseUser(user: User): UserProfile {
  const metadata = user.user_metadata ?? {};
  const username = typeof metadata.username === "string" && metadata.username.trim() ? metadata.username : user.email?.split("@")[0];
  const isAdmin = metadata.role === "admin" || metadata.isAdmin === true;

  return {
    id: user.id,
    email: user.email ?? "",
    username: username ?? "WordSprint User",
    isAdmin,
    firstLoginDone: metadata.firstLoginDone === true,
    xp: typeof metadata.xp === "number" ? metadata.xp : 0,
    badges: Array.isArray(metadata.badges) ? metadata.badges : [],
    createdAt: user.created_at ?? new Date().toISOString(),
  };
}
