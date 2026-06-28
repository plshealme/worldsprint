import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/authCookies";
import { profileFromSupabaseUser } from "@/lib/supabase";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
  isSupabaseNetworkError,
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
const usernamePattern = /^[\p{L}\p{N}_]{2,20}$/u;

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function validateUsername(username: string) {
  if (!usernamePattern.test(username)) {
    return "用户名需为 2–20 个字符，只能包含中文、英文字母、数字和下划线。";
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


  let supabase;
  let serviceClient;
  try {
    supabase = createSupabaseServerClient();
    serviceClient = createSupabaseServiceRoleClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 500 });
  }

  if (!supabase || !serviceClient) {
    return NextResponse.json({ ok: false, error: authConfigMissingMessage }, { status: 503 });
  }

  try {
    const { data: existingUsername, error: usernameLookupError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("username_normalized", usernameNormalized)
      .maybeSingle();

    if (usernameLookupError) {
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
      return NextResponse.json(
        { ok: false, error: status === 502 ? supabaseNetworkErrorMessage : "注册失败，请稍后重试。" },
        { status },
      );
    }

    if (!data.user) {
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
      return NextResponse.json({ ok: false, error: "注册失败，请稍后重试。" }, { status: 500 });
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

    const response = NextResponse.json({
      ok: true,
      profile: profileFromSupabaseUser(data.user, { username, email, role: "user" }),
      accessToken: data.session.access_token,
    });
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
