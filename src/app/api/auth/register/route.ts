import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/authCookies";
import { profileFromSupabaseUser } from "@/lib/supabase";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
  isSupabaseNetworkError,
  logSupabaseAuthDiagnostic,
  supabaseNetworkErrorMessage,
} from "@/lib/supabaseServer";

export const runtime = "nodejs";

interface RegisterPayload {
  email?: unknown;
  username?: unknown;
  password?: unknown;
}

const authConfigMissingMessage = "服务器登录配置缺失，请检查部署环境变量。";
const registerUnavailableMessage = "注册服务暂不可用，请稍后再试。";
const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function validateUsername(username: string) {
  if (!usernamePattern.test(username)) {
    return "用户名需为 3–20 个字符，只能包含英文字母、数字和下划线。";
  }
  return "";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RegisterPayload | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const usernameNormalized = normalizeUsername(username);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "邮箱格式不正确。" }, { status: 400 });
  }

  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json({ ok: false, error: usernameError }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: "密码长度不足。" }, { status: 400 });
  }

  logSupabaseAuthDiagnostic("register:init", { phase: "create-client" });

  let supabase;
  let serviceClient;
  try {
    supabase = createSupabaseServerClient();
    serviceClient = createSupabaseServiceRoleClient();
  } catch (error) {
    logSupabaseAuthDiagnostic("register:create-client-error", { phase: "create-client", error });
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 500 });
  }

  if (!supabase || !serviceClient) {
    logSupabaseAuthDiagnostic("register:missing-env", { phase: "create-client", status: 503 });
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 503 });
  }

  try {
    const { data: existingUsername, error: usernameLookupError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("username_normalized", usernameNormalized)
      .maybeSingle();

    if (usernameLookupError) {
      logSupabaseAuthDiagnostic("register:profile-lookup-error", { phase: "profile-lookup", error: usernameLookupError, status: 500 });
      return NextResponse.json({ ok: false, error: registerUnavailableMessage }, { status: 500 });
    }

    if (existingUsername) {
      return NextResponse.json({ ok: false, error: "用户名已被占用。" }, { status: 409 });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          role: "user",
          firstLoginDone: false,
          xp: 0,
          badges: [],
        },
      },
    });

    if (error) {
      const status = isSupabaseNetworkError(error) ? 502 : 400;
      logSupabaseAuthDiagnostic("register:supabase-error", { phase: "sign-up", error, status });
      return NextResponse.json(
        { ok: false, error: status === 502 ? supabaseNetworkErrorMessage : "注册失败，请稍后重试。" },
        { status },
      );
    }

    if (!data.user) {
      logSupabaseAuthDiagnostic("register:missing-user", { phase: "sign-up", status: 502 });
      return NextResponse.json({ ok: false, error: registerUnavailableMessage }, { status: 502 });
    }

    const { error: profileError } = await serviceClient.from("profiles").upsert(
      {
        id: data.user.id,
        username,
        username_normalized: usernameNormalized,
        email,
        role: "user",
      },
      { onConflict: "id" },
    );

    if (profileError) {
      logSupabaseAuthDiagnostic("register:profile-upsert-error", { phase: "profile-upsert", error: profileError, status: 500 });
      return NextResponse.json({ ok: false, error: "注册失败，请稍后重试。" }, { status: 500 });
    }

    if (!data.session) {
      logSupabaseAuthDiagnostic("register:email-confirmation-required", { phase: "sign-up", status: 409 });
      return NextResponse.json(
        {
          ok: false,
          error: "注册成功，请前往邮箱完成确认后再登录。",
        },
        { status: 409 },
      );
    }

    logSupabaseAuthDiagnostic("register:success", { phase: "sign-up" });
    const response = NextResponse.json({
      ok: true,
      profile: profileFromSupabaseUser(data.user, { username, email, role: "user" }),
    });
    setAuthCookies(response, data.session);
    return response;
  } catch (error) {
    logSupabaseAuthDiagnostic("register:request-error", {
      phase: "register",
      error,
      status: isSupabaseNetworkError(error) ? 502 : 500,
    });
    return NextResponse.json(
      {
        ok: false,
        error: isSupabaseNetworkError(error) ? supabaseNetworkErrorMessage : registerUnavailableMessage,
      },
      { status: isSupabaseNetworkError(error) ? 502 : 500 },
    );
  }
}
