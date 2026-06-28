import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_ACCESS_COOKIE } from "@/lib/authCookies";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const accessToken = await readAccessToken(request);

  if (!accessToken) {
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const serviceClient = createSupabaseServiceRoleClient();

  if (!supabase || !serviceClient) {
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 503 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 401 });
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ ok: false, isAdmin: false }, { status: 500 });
  }

  const isAdmin = profile?.role === "admin";
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
