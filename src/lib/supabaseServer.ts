import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export const supabaseNetworkErrorMessage =
  "暂时无法连接登录服务，请稍后再试。";
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseAuthEnvState() {
  return {
    nodeEnv: process.env.NODE_ENV,
    authEnv: isSupabaseConfigured ? "exists" : "missing",
    supabaseUrlExists: Boolean(supabaseUrl),
    supabaseAnonKeyExists: Boolean(supabaseAnonKey),
    supabaseServiceRoleKeyExists: Boolean(supabaseServiceRoleKey),
  };
}

export function createSupabaseServerClient(accessToken?: string) {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (supabaseUrl.includes("/rest/v1")) {
    throw new Error("Supabase URL 应为项目根地址，不能使用带 /rest/v1/ 的 API URL。");
  }

  if (supabaseAnonKey.startsWith("sb_secret_")) {
    throw new Error("当前配置像是 Secret key。请只使用 Supabase anon/publishable key。");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}

export function createSupabaseServiceRoleClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  if (supabaseUrl.includes("/rest/v1")) {
    throw new Error("Supabase URL 应为项目根地址，不能使用带 /rest/v1/ 的 API URL。");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function isSupabaseNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch|network|connect|connection|econn|enotfound|etimedout|tls|socket|und_err/i.test(message);
}
