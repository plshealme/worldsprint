import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/authCookies";
import { profileFromSupabaseUser, type SupabaseProfileRow } from "@/lib/supabase";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
  isSupabaseNetworkError,
  logSupabaseAuthDiagnostic,
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
    logSupabaseAuthDiagnostic("login:profile-lookup-error", { phase: "profile-lookup", error, status: 500 });
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
    logSupabaseAuthDiagnostic("login:role-lookup-error", { phase: "role-lookup", error, status: 500 });
    return null;
  }

  return data as SupabaseProfileRow | null;
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  let usernameLookupMs = 0;
  let signInMs = 0;
  let profileLookupMs = 0;
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

  const identifierType = isEmailIdentifier(identifier) ? "email" : "username";
  const logLoginPerf = (result: string) => {
    console.info("[auth-perf] login api", {
      result,
      totalMs: Date.now() - requestStartedAt,
      usernameLookupMs,
      signInMs,
      profileLookupMs,
      identifierType,
    });
  };

  logSupabaseAuthDiagnostic("login:init", { phase: "create-client" });

  let supabase;
  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    logSupabaseAuthDiagnostic("login:create-client-error", { phase: "create-client", error });
    logLoginPerf("create-client-error");
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 500 });
  }

  if (!supabase) {
    logSupabaseAuthDiagnostic("login:missing-env", { phase: "create-client", status: 503 });
    logLoginPerf("missing-env");
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 503 });
  }

  let email = normalizeIdentifier(identifier);
  if (!isEmailIdentifier(identifier)) {
    try {
      const lookupStartedAt = Date.now();
      const result = await emailFromUsername(identifier);
      usernameLookupMs = Date.now() - lookupStartedAt;
      if (result.configMissing) {
        logSupabaseAuthDiagnostic("login:missing-service-role", { phase: "profile-lookup", status: 503 });
        logLoginPerf("missing-service-role");
        return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 503 });
      }
      if (result.lookupFailed) {
        logLoginPerf("username-lookup-failed");
        return NextResponse.json({ ok: false, error: loginUnavailableMessage }, { status: 500 });
      }
      if (!result.email) {
        logLoginPerf("invalid-credentials");
        return NextResponse.json({ ok: false, error: invalidCredentialsMessage }, { status: 401 });
      }
      email = result.email;
    } catch (error) {
      logSupabaseAuthDiagnostic("login:profile-lookup-exception", { phase: "profile-lookup", error, status: 500 });
      logLoginPerf("username-lookup-exception");
      return NextResponse.json({ ok: false, error: loginUnavailableMessage }, { status: 500 });
    }
  }

  try {
    const signInStartedAt = Date.now();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    signInMs = Date.now() - signInStartedAt;

    if (error) {
      const status = isSupabaseNetworkError(error) ? 502 : 401;
      logSupabaseAuthDiagnostic("login:supabase-error", { phase: "sign-in", error, status });
      logLoginPerf(status === 502 ? "supabase-network-error" : "invalid-credentials");
      return NextResponse.json(
        { ok: false, error: status === 502 ? supabaseNetworkErrorMessage : invalidCredentialsMessage },
        { status },
      );
    }

    if (!data.user || !data.session) {
      logSupabaseAuthDiagnostic("login:missing-session", { phase: "sign-in", status: 502 });
      logLoginPerf("missing-session");
      return NextResponse.json({ ok: false, error: loginUnavailableMessage }, { status: 502 });
    }

    logSupabaseAuthDiagnostic("login:success", { phase: "sign-in" });
    const profileStartedAt = Date.now();
    const profileRow = await profileForUser(data.user.id);
    profileLookupMs = Date.now() - profileStartedAt;
    const response = NextResponse.json({ ok: true, profile: profileFromSupabaseUser(data.user, profileRow) });
    setAuthCookies(response, data.session);
    logLoginPerf("success");
    return response;
  } catch (error) {
    logSupabaseAuthDiagnostic("login:request-error", {
      phase: "sign-in",
      error,
      status: isSupabaseNetworkError(error) ? 502 : 500,
    });
    logLoginPerf(isSupabaseNetworkError(error) ? "request-network-error" : "request-error");
    return NextResponse.json(
      {
        ok: false,
        error: isSupabaseNetworkError(error) ? supabaseNetworkErrorMessage : loginUnavailableMessage,
      },
      { status: isSupabaseNetworkError(error) ? 502 : 500 },
    );
  }
}
