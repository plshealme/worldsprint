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
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Supabase 配置无效。" }, { status: 500 });
  }

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase 环境变量未配置，无法注册真实账号。" }, { status: 503 });
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
        { ok: false, error: status === 502 ? supabaseNetworkErrorMessage : error.message },
        { status },
      );
    }

    if (!data.user) {
      return NextResponse.json({ ok: false, error: "Supabase 未返回用户信息，注册未完成。" }, { status: 502 });
    }

    if (!data.session) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supabase 当前启用了邮箱确认。请在 Supabase Auth 中关闭 Confirm email 后再直接登录。",
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
        error: isSupabaseNetworkError(error) ? supabaseNetworkErrorMessage : "服务端注册请求失败，请稍后重试。",
      },
      { status: isSupabaseNetworkError(error) ? 502 : 500 },
    );
  }
}
