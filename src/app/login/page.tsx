"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, LockKeyhole } from "lucide-react";
import { Button } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";

export default function LoginPage() {
  const { authMode, login } = useAppState();
  const router = useRouter();
  const showLocalDemoDefaults = process.env.NODE_ENV !== "production";
  const [email, setEmail] = useState(showLocalDemoDefaults ? "demo@wordsprint.app" : "");
  const [password, setPassword] = useState(showLocalDemoDefaults ? "123456" : "");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试。");
    }
  }

  return (
    <main className="grid min-h-screen bg-surface text-ink lg:grid-cols-[0.95fr_1.05fr]">
      <section className="flex min-h-[42vh] flex-col justify-between bg-ink px-6 py-8 text-white lg:min-h-screen lg:px-12">
        <div>
          <p className="text-2xl font-bold">WordSprint</p>
          <p className="mt-2 text-sm text-white/70">Learn it fast. Make it last.</p>
        </div>
        <div className="max-w-xl">
          <h1 className="text-4xl font-bold sm:text-5xl">考研词汇测试与复习系统</h1>
          <p className="mt-5 text-base leading-8 text-white/72">
            Practice 找薄弱词，Exam 留正式成绩，错题自动回流复习。第一阶段使用本地 mock 数据，后续可切到 Supabase。
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <form onSubmit={onSubmit} className="w-full max-w-md rounded-lg border border-line bg-panel p-6 shadow-soft">
          <div>
            <p className="text-sm font-semibold text-brand">Login</p>
            <h2 className="mt-2 text-2xl font-bold">登录后继续学习</h2>
            <p className="mt-2 text-sm text-subtle">
              {authMode === "dev"
                ? "开发模式：可用 demo@wordsprint.app / 123456 或 admin@wordsprint.app / 123456 登录。"
                : authMode === "supabase"
                  ? "当前使用真实 Supabase Auth 登录。"
                  : "本地开发 fallback：可用 demo@wordsprint.app / 123456 登录。"}
            </p>
          </div>

          <label className="mt-6 block">
            <span className="text-sm font-semibold">邮箱</span>
            <span className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface px-3">
              <Mail size={18} className="text-subtle" />
              <input
                className="min-h-12 w-full bg-transparent outline-none"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </span>
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-semibold">密码</span>
            <span className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface px-3">
              <LockKeyhole size={18} className="text-subtle" />
              <input
                className="min-h-12 w-full bg-transparent outline-none"
                type="password"
                value={password}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </span>
          </label>

          <div className="mt-3 flex justify-end">
            <button type="button" className="text-sm font-semibold text-brand">
              忘记密码？
            </button>
          </div>

          {error ? <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

          <Button className="mt-6 w-full" type="submit">
            登录
            <ArrowRight size={18} />
          </Button>

          <p className="mt-5 text-center text-sm text-subtle">
            还没有账号？{" "}
            <Link href="/register" className="font-semibold text-brand">
              注册
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
