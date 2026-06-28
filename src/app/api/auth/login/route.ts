import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/authCookies";
import { profileFromSupabaseUser, type SupabaseProfileRow } from "@/lib/supabase";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
  isSupabaseNetworkError,
  supabaseNetworkErrorMessage,
} from "@/lib/supabaseServer";

export const runtime = "nodejs";

interface LoginPayload {
  email?: unknown;
  identifier?: unknown;
  password?: unknown;
}

const authConfigMissingMessage = "服务器登录配置缺失，请检查部署环境变量。";
const invalidCredentialsMessage = "用户名或密码错误";
const loginUnavailableMessage = "登录服务暂不可用，请稍后再试。";

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

function isEmailIdentifier(identifier: string) {
  return identifier.includes("@");
}

async function emailFromUsername(identifier: string) {
  const serviceClient = createSupabaseServiceRoleClient();
  if (!serviceClient) {
    return { email: "", configMissing: true };
  }

  const { data, error } = await serviceClient
    .from("profiles")
    .select("email")
    .eq("username_normalized", normalizeIdentifier(identifier))
    .maybeSingle();

  if (error) {
    return { email: "", lookupFailed: true };
  }

  return { email: typeof data?.email === "string" ? data.email.toLowerCase() : "" };
}

async function profileForUser(userId: string) {
  const serviceClient = createSupabaseServiceRoleClient();
  if (!serviceClient) {
    return null;
  }

  const { data, error } = await serviceClient
    .from("profiles")
    .select("username,email,role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as SupabaseProfileRow | null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginPayload | null;
  const identifier =
    typeof body?.identifier === "string"
      ? body.identifier.trim()
      : typeof body?.email === "string"
        ? body.email.trim()
        : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!identifier || !password) {
    return NextResponse.json({ ok: false, error: "请输入用户名和密码。" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 500 });
  }

  if (!supabase) {
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 503 });
  }

  let email = normalizeIdentifier(identifier);
  if (!isEmailIdentifier(identifier)) {
    try {
      const result = await emailFromUsername(identifier);
      if (result.configMissing) {
        return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 503 });
      }
      if (result.lookupFailed) {
        return NextResponse.json({ ok: false, error: loginUnavailableMessage }, { status: 500 });
      }
      if (!result.email) {
        return NextResponse.json({ ok: false, error: invalidCredentialsMessage }, { status: 401 });
      }
      email = result.email;
    } catch (error) {
      return NextResponse.json({ ok: false, error: loginUnavailableMessage }, { status: 500 });
    }
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const status = isSupabaseNetworkError(error) ? 502 : 401;
      return NextResponse.json(
        { ok: false, error: status === 502 ? supabaseNetworkErrorMessage : invalidCredentialsMessage },
        { status },
      );
    }

    if (!data.user || !data.session) {
      return NextResponse.json({ ok: false, error: loginUnavailableMessage }, { status: 502 });
    }

    const profileRow = await profileForUser(data.user.id);
    const response = NextResponse.json({
      ok: true,
      profile: profileFromSupabaseUser(data.user, profileRow),
      accessToken: data.session.access_token,
    });
    setAuthCookies(response, data.session);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: isSupabaseNetworkError(error) ? supabaseNetworkErrorMessage : loginUnavailableMessage,
      },
      { status: isSupabaseNetworkError(error) ? 502 : 500 },
    );
  }
}
