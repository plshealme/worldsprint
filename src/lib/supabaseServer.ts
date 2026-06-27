import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export const supabaseNetworkErrorMessage =
  "服务端访问 Supabase 失败。当前本机网络无法连接 Supabase，后续部署到 Vercel 后再验证。";

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

export function isSupabaseNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch|network|connect|connection|econn|enotfound|etimedout|tls|socket|und_err/i.test(message);
}
