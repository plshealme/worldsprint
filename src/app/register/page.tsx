"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";

export default function RegisterPage() {
  const { authMode, register } = useAppState();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await register(email, username, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败，请稍后重试。");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10 text-ink">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-lg border border-line bg-panel p-6 shadow-soft">
        <p className="text-sm font-semibold text-brand">WordSprint</p>
        <h1 className="mt-2 text-2xl font-bold">创建账号</h1>
        <p className="mt-2 text-sm text-subtle">
          {authMode === "dev"
            ? "开发模式：注册仍会尝试真实 Supabase；日常开发可直接用 demo / admin 开发账号登录。"
            : authMode === "supabase"
              ? "注册会创建真实 Supabase 用户，成功后直接进入首次使用引导。"
              : "本地开发 fallback：注册信息只保存在本机浏览器。"}
        </p>

        <label className="mt-6 block">
          <span className="text-sm font-semibold">邮箱</span>
          <input
            className="mt-2 min-h-12 w-full rounded-lg border border-line bg-surface px-3 outline-none"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-semibold">用户名</span>
          <input
            className="mt-2 min-h-12 w-full rounded-lg border border-line bg-surface px-3 outline-none"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-semibold">密码</span>
          <input
            className="mt-2 min-h-12 w-full rounded-lg border border-line bg-surface px-3 outline-none"
            type="password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error ? <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

        <Button className="mt-6 w-full" type="submit">
          注册并开始
          <ArrowRight size={18} />
        </Button>

        <p className="mt-5 text-center text-sm text-subtle">
          已有账号？{" "}
          <Link href="/login" className="font-semibold text-brand">
            登录
          </Link>
        </p>
      </form>
    </main>
  );
}
