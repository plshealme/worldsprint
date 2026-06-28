import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_ACCESS_COOKIE } from "@/lib/authCookies";
import { createSupabaseServerClient, createSupabaseServiceRoleClient, logSupabaseAuthDiagnostic } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET() {
  const accessToken = (await cookies()).get(AUTH_ACCESS_COOKIE)?.value;

  if (!accessToken) {
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 401 });
  }

  const supabase = createSupabaseServerClient(accessToken);
  const serviceClient = createSupabaseServiceRoleClient();

  if (!supabase || !serviceClient) {
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 503 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    logSupabaseAuthDiagnostic("admin-status:user-error", { phase: "admin-status", error: userError, status: 401 });
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 401 });
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    logSupabaseAuthDiagnostic("admin-status:profile-error", { phase: "admin-status", error: profileError, status: 500 });
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 500 });
  }

  const isAdmin = profile?.role === "admin";
  return NextResponse.json({ ok: true, isAdmin }, { status: isAdmin ? 200 : 403 });
}
