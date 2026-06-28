import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/authCookies";
import { profileFromSupabaseUser } from "@/lib/supabase";
import {
  createSupabaseServerClient,
  isSupabaseNetworkError,
  logSupabaseAuthDiagnostic,
  supabaseNetworkErrorMessage,
} from "@/lib/supabaseServer";

export const runtime = "nodejs";

interface LoginPayload {
  email?: unknown;
  password?: unknown;
}

const authConfigMissingMessage = "服务器登录配置缺失，请检查部署环境变量。";
const invalidCredentialsMessage = "邮箱或密码不正确。";
const loginUnavailableMessage = "登录服务暂不可用，请稍后再试。";

function isDevAuthBypassEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.AUTH_MODE === "dev" ||
      process.env.DEV_AUTH_BYPASS === "true" ||
      process.env.NEXT_PUBLIC_AUTH_MODE === "dev" ||
      process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true")
  );
}

function devProfileFor(email: string, password: string) {
  if (!isDevAuthBypassEnabled() || password !== "123456") {
    return null;
  }

  if (email === "demo@wordsprint.app") {
    return {
      id: "user-demo",
      email,
      username: "Demo Learner",
      isAdmin: false,
      firstLoginDone: true,
      xp: 260,
      badges: [],
      createdAt: new Date().toISOString(),
    };
  }

  if (email === "admin@wordsprint.app") {
    return {
      id: "user-admin",
      email,
      username: "Admin",
      isAdmin: true,
      firstLoginDone: true,
      xp: 760,
      badges: [],
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginPayload | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !email.includes("@") || !password) {
    return NextResponse.json({ ok: false, error: "请输入邮箱和密码。" }, { status: 400 });
  }

  const devProfile = devProfileFor(email, password);
  if (devProfile) {
    logSupabaseAuthDiagnostic("login:dev-bypass", { phase: "dev-bypass" });
    return NextResponse.json({ ok: true, profile: devProfile });
  }

  logSupabaseAuthDiagnostic("login:init", { phase: "create-client" });

  let supabase;
  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    logSupabaseAuthDiagnostic("login:create-client-error", { phase: "create-client", error });
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 500 });
  }

  if (!supabase) {
    logSupabaseAuthDiagnostic("login:missing-env", { phase: "create-client", status: 503 });
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 503 });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const status = isSupabaseNetworkError(error) ? 502 : 401;
      logSupabaseAuthDiagnostic("login:supabase-error", { phase: "sign-in", error, status });
      return NextResponse.json(
        { ok: false, error: status === 502 ? supabaseNetworkErrorMessage : invalidCredentialsMessage },
        { status },
      );
    }

    if (!data.user || !data.session) {
      logSupabaseAuthDiagnostic("login:missing-session", { phase: "sign-in", status: 502 });
      return NextResponse.json({ ok: false, error: loginUnavailableMessage }, { status: 502 });
    }

    logSupabaseAuthDiagnostic("login:success", { phase: "sign-in" });
    const response = NextResponse.json({ ok: true, profile: profileFromSupabaseUser(data.user) });
    setAuthCookies(response, data.session);
    return response;
  } catch (error) {
    logSupabaseAuthDiagnostic("login:request-error", {
      phase: "sign-in",
      error,
      status: isSupabaseNetworkError(error) ? 502 : 500,
    });
    return NextResponse.json(
      {
        ok: false,
        error: isSupabaseNetworkError(error) ? supabaseNetworkErrorMessage : loginUnavailableMessage,
      },
      { status: isSupabaseNetworkError(error) ? 502 : 500 },
    );
  }
}
