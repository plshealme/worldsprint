"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/common/Button";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [clientReady, setClientReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = useMemo<SupabaseClient | null>(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: true,
      },
    });
  }, []);

  useEffect(() => {
    async function establishResetSession() {
      if (!supabase) {
        setError("服务器登录配置缺失，请检查部署环境变量。");
        setClientReady(true);
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        }
      } catch {
        setError("密码重置链接已失效，请重新发送重置邮件。");
      } finally {
        setClientReady(true);
      }
    }

    void establishResetSession();
  }, [supabase]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || isSubmitting) return;

    setError("");
    setMessage("");
    if (newPassword.length < 6) {
      setError("新密码至少需要 6 位。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致。");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        throw updateError;
      }
      await supabase.auth.signOut();
      setMessage("密码已更新，请重新登录。");
      window.setTimeout(() => router.replace("/login"), 1200);
    } catch {
      setError("密码更新失败，请重新打开邮件链接或稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-8 text-ink">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <p className="text-3xl font-bold">WordSprint</p>
          <p className="mt-2 text-sm text-subtle">Learn it fast. Make it last.</p>
        </div>

        <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-panel p-6 shadow-soft">
          <p className="text-sm font-semibold text-brand">Password</p>
          <h1 className="mt-2 text-2xl font-bold">重置密码</h1>
          <p className="mt-2 text-sm leading-6 text-subtle">请设置新的登录密码。</p>

          <label className="mt-6 block">
            <span className="text-sm font-semibold">新密码</span>
            <input
              className="mt-2 min-h-12 w-full rounded-xl border border-line bg-surface px-3 outline-none"
              type="password"
              minLength={6}
              value={newPassword}
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              required
              disabled={!clientReady}
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-semibold">确认新密码</span>
            <input
              className="mt-2 min-h-12 w-full rounded-xl border border-line bg-surface px-3 outline-none"
              type="password"
              minLength={6}
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              disabled={!clientReady}
            />
          </label>

          {message ? <p className="mt-4 rounded-lg bg-positive/10 px-3 py-2 text-sm text-positive">{message}</p> : null}
          {error ? <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

          <Button className="mt-6 w-full" type="submit" disabled={!clientReady || isSubmitting || Boolean(message)}>
            {isSubmitting ? "更新中..." : "更新密码"}
          </Button>

          <p className="mt-5 text-center text-sm text-subtle">
            <Link href="/login" className="font-semibold text-brand">
              返回登录
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
