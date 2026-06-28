import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  isSupabaseNetworkError,
  logSupabaseAuthDiagnostic,
  supabaseNetworkErrorMessage,
} from "@/lib/supabaseServer";

export const runtime = "nodejs";

interface ForgotPasswordPayload {
  email?: unknown;
}

const authConfigMissingMessage = "服务器登录配置缺失，请检查部署环境变量。";
const successMessage = "如果该邮箱已注册，我们会发送密码重置邮件，请前往邮箱查看。";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ForgotPasswordPayload | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "请输入有效邮箱。" }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  let supabase;
  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    logSupabaseAuthDiagnostic("forgot-password:create-client-error", { phase: "create-client", error });
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 500 });
  }

  if (!supabase) {
    logSupabaseAuthDiagnostic("forgot-password:missing-env", { phase: "create-client", status: 503 });
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 503 });
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });

    if (error) {
      const status = isSupabaseNetworkError(error) ? 502 : 200;
      logSupabaseAuthDiagnostic("forgot-password:supabase-error", { phase: "reset-password", error, status });
      if (status === 502) {
        return NextResponse.json({ ok: false, error: supabaseNetworkErrorMessage }, { status });
      }
    }

    return NextResponse.json({ ok: true, message: successMessage });
  } catch (error) {
    logSupabaseAuthDiagnostic("forgot-password:request-error", {
      phase: "reset-password",
      error,
      status: isSupabaseNetworkError(error) ? 502 : 500,
    });
    return NextResponse.json(
      {
        ok: false,
        error: isSupabaseNetworkError(error) ? supabaseNetworkErrorMessage : "暂时无法发送重置邮件，请稍后再试。",
      },
      { status: isSupabaseNetworkError(error) ? 502 : 500 },
    );
  }
}
