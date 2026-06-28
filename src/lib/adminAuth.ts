import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_ACCESS_COOKIE } from "@/lib/authCookies";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabaseServer";

export interface AdminProfile {
  id: string;
  username: string | null;
  email: string | null;
  role: "user" | "admin" | string | null;
  created_at?: string | null;
}

export interface AdminContext {
  currentUser: User;
  currentProfile: AdminProfile | null;
  serviceClient: SupabaseClient;
}

export type AdminGuardResult =
  | {
      ok: true;
      context: AdminContext;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireAdmin(request: Request): Promise<AdminGuardResult> {
  const accessToken = await readAccessToken(request);
  if (!accessToken) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "请先登录。" }, { status: 401 }),
    };
  }

  const supabase = createSupabaseServerClient(accessToken);
  const serviceClient = createSupabaseServiceRoleClient();

  if (!supabase || !serviceClient) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "管理员服务配置缺失。" }, { status: 503 }),
    };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "登录状态已失效，请重新登录。" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id,username,email,role,created_at")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "无法验证管理员权限。" }, { status: 500 }),
    };
  }

  if (profile?.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "无权限访问管理员接口。" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    context: {
      currentUser: userData.user,
      currentProfile: profile as AdminProfile,
      serviceClient,
    },
  };
}

async function readAccessToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authorization);
  if (bearerMatch?.[1]) {
    return bearerMatch[1];
  }

  const cookieStore = await cookies();
  return cookieStore.get(AUTH_ACCESS_COOKIE)?.value ?? "";
}
