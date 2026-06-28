import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_ACCESS_COOKIE } from "@/lib/authCookies";
import { createSupabaseServerClient, createSupabaseServiceRoleClient, logSupabaseAuthDiagnostic } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  let getUserMs = 0;
  let roleLookupMs = 0;
  const logAdminStatusPerf = (result: string) => {
    console.info("[auth-perf] admin-status api", {
      result,
      totalMs: Date.now() - startedAt,
      getUserMs,
      roleLookupMs,
    });
  };
  const accessToken = (await cookies()).get(AUTH_ACCESS_COOKIE)?.value;

  if (!accessToken) {
    logAdminStatusPerf("missing-token");
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 401 });
  }

  const supabase = createSupabaseServerClient(accessToken);
  const serviceClient = createSupabaseServiceRoleClient();

  if (!supabase || !serviceClient) {
    logAdminStatusPerf("missing-config");
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 503 });
  }

  const getUserStartedAt = Date.now();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  getUserMs = Date.now() - getUserStartedAt;
  if (userError || !userData.user) {
    logSupabaseAuthDiagnostic("admin-status:user-error", { phase: "admin-status", error: userError, status: 401 });
    logAdminStatusPerf("user-error");
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 401 });
  }

  const roleLookupStartedAt = Date.now();
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  roleLookupMs = Date.now() - roleLookupStartedAt;

  if (profileError) {
    logSupabaseAuthDiagnostic("admin-status:profile-error", { phase: "admin-status", error: profileError, status: 500 });
    logAdminStatusPerf("profile-error");
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 500 });
  }

  const isAdmin = profile?.role === "admin";
  logAdminStatusPerf(isAdmin ? "admin" : "not-admin");
  return NextResponse.json({ ok: true, isAdmin }, { status: isAdmin ? 200 : 403 });
}
