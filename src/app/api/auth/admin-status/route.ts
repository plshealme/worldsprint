import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_ACCESS_COOKIE } from "@/lib/authCookies";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const startedAt = Date.now();
  console.info("[perf] admin-status start");
  const accessToken = await readAccessToken(request);

  if (!accessToken) {
    console.info("[perf] admin-status end", { ms: Date.now() - startedAt, ok: false, status: 401 });
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const serviceClient = createSupabaseServiceRoleClient();

  if (!supabase || !serviceClient) {
    console.info("[perf] admin-status end", { ms: Date.now() - startedAt, ok: false, status: 503 });
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 503 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    console.info("[perf] admin-status end", { ms: Date.now() - startedAt, ok: false, status: 401 });
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 401 });
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    console.info("[perf] admin-status end", { ms: Date.now() - startedAt, ok: false, status: 500 });
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 500 });
  }

  const isAdmin = profile?.role === "admin";
  console.info("[perf] admin-status end", { ms: Date.now() - startedAt, ok: true, status: isAdmin ? 200 : 403 });
  return NextResponse.json({ ok: true, isAdmin }, { status: isAdmin ? 200 : 403 });
}

async function readAccessToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authorization);
  if (bearerMatch?.[1]) {
    return bearerMatch[1];
  }

  return (await cookies()).get(AUTH_ACCESS_COOKIE)?.value ?? "";
}
