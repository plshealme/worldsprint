import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_ACCESS_COOKIE, clearAuthCookies } from "@/lib/authCookies";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_ACCESS_COOKIE)?.value;

  if (accessToken) {
    try {
      const supabase = createSupabaseServerClient(accessToken);
      await supabase?.auth.signOut();
    } catch {
      // Local sign-out should still complete when Supabase is unreachable.
    }
  }

  clearAuthCookies(response);
  return response;
}
