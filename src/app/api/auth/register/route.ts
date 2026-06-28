import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/authCookies";
import { profileFromSupabaseUser } from "@/lib/supabase";
import { createSupabaseServerClient, isSupabaseNetworkError, supabaseNetworkErrorMessage } from "@/lib/supabaseServer";

export const runtime = "nodejs";

interface RegisterPayload {
  email?: unknown;
  username?: unknown;
  password?: unknown;
}

const authConfigMissingMessage = "服务器登录配置缺失，请检查部署环境变量。";
const registerUnavailableMessage = "注册服务暂不可用，请稍后再试。";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RegisterPayload | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const username =
    typeof body?.username === "string" && body.username.trim() ? body.username.trim() : email.split("@")[0];
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "请输入有效邮箱。" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: "密码至少 6 位。" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 500 });
  }

  if (!supabase) {
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 503 });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          firstLoginDone: false,
          xp: 0,
          badges: [],
        },
      },
    });

    if (error) {
      const status = isSupabaseNetworkError(error) ? 502 : 400;
      return NextResponse.json(
        { ok: false, error: status === 502 ? supabaseNetworkErrorMessage : "注册失败，请检查邮箱和密码后重试。" },
        { status },
      );
    }

    if (!data.user) {
      return NextResponse.json({ ok: false, error: registerUnavailableMessage }, { status: 502 });
    }

    if (!data.session) {
      return NextResponse.json(
        {
          ok: false,
          error: "注册成功，请前往邮箱完成确认后再登录。",
        },
        { status: 409 },
      );
    }

    const response = NextResponse.json({ ok: true, profile: profileFromSupabaseUser(data.user) });
    setAuthCookies(response, data.session);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: isSupabaseNetworkError(error) ? supabaseNetworkErrorMessage : registerUnavailableMessage,
      },
      { status: isSupabaseNetworkError(error) ? 502 : 500 },
    );
  }
}
