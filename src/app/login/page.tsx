"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, User } from "lucide-react";
import { Button } from "@/components/common/Button";
import { postAuthProfile } from "@/lib/authClient";
import { perfLog, perfNow } from "@/lib/perfLog";
import { OFFICIAL_CLEAN_WORD_COUNT, PUBLIC_VOCAB_NAME } from "@/lib/vocab";

const featureTags = ["Practice 即时反馈", "Exam 正式测试", "Review 到期复习", "Mistakes 易错词巩固"];

function friendlyLoginError(error: unknown) {
  const message = error instanceof Error ? error.message : "登录失败，请稍后重试。";
  const lowerMessage = message.toLowerCase();

  if (
    message.includes("服务器登录配置缺失") ||
    message.includes("暂时无法连接登录服务") ||
    message.includes("登录服务暂不可用")
  ) {
    return message;
  }

  if (
    message.includes("用户名") ||
    message.includes("密码") ||
    lowerMessage.includes("invalid") ||
    lowerMessage.includes("credential") ||
    lowerMessage.includes("incorrect")
  ) {
    return "用户名或密码错误";
  }

  if (lowerMessage.includes("fetch") || lowerMessage.includes("network") || message.includes("连接")) {
    return "登录服务连接失败，请稍后再试。";
  }

  if (lowerMessage.includes("supabase") || message.includes("配置")) {
    return "登录服务暂不可用，请稍后再试。";
  }

  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    perfLog("Login mounted");
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const submitStartedAt = perfNow();
    perfLog("login submit start");
    submittingRef.current = true;
    setError("");
    setIsSubmitting(true);
    let shouldResetSubmitState = true;
    try {
      await postAuthProfile("/api/auth/login", {
        identifier: identifier.trim().toLowerCase(),
        password,
      });
      perfLog("client loginSubmit", { ms: Math.round(perfNow() - submitStartedAt) });
      window.sessionStorage.setItem("wordsprint:authRedirecting", "1");
      shouldResetSubmitState = false;
      perfLog("route to home start");
      router.replace("/");
    } catch (err) {
      setError(friendlyLoginError(err));
    } finally {
      if (shouldResetSubmitState) {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  }

  return (
    <main className="min-h-screen bg-surface text-ink lg:grid lg:grid-cols-[0.95fr_1.05fr]">
      <section className="hidden min-h-screen flex-col justify-between bg-ink px-12 py-10 text-white lg:flex">
        <div>
          <p className="text-2xl font-bold">WordSprint</p>
          <p className="mt-2 text-sm text-white/70">Learn it fast. Make it last.</p>
        </div>

        <div className="max-w-xl space-y-8">
          <div>
            <p className="text-sm font-semibold text-white/62">{PUBLIC_VOCAB_NAME}</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight xl:text-4xl">
              围绕考研英语大纲词汇，完成练习、测试、复习和错题巩固。
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/68">
              学习记录保存在当前设备，可在学习数据 / 备份中导出。
            </p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/8 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-white/62">当前词库</p>
                <p className="mt-1 text-xl font-bold">{PUBLIC_VOCAB_NAME}</p>
              </div>
              <p className="text-sm font-semibold text-white/72">{OFFICIAL_CLEAN_WORD_COUNT} 词 · 英译汉练习</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {featureTags.map((feature) => (
                <span key={feature} className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white/76">
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-8 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-7 text-center lg:hidden">
            <p className="text-3xl font-bold">WordSprint</p>
            <p className="mt-2 text-sm text-subtle">Learn it fast. Make it last.</p>
            <p className="mt-4 text-sm leading-6 text-subtle">
              围绕考研英语大纲词汇，完成练习、测试、复习和错题巩固。
            </p>
          </div>

          <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-panel p-6 shadow-soft">
            <div>
              <p className="text-sm font-semibold text-brand">Login</p>
              <h2 className="mt-2 text-2xl font-bold">登录 WordSprint</h2>
              <p className="mt-2 text-sm text-subtle">使用用户名登录，继续你的词汇练习。</p>
            </div>

            <label className="mt-6 block">
              <span className="text-sm font-semibold">用户名</span>
              <span className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3">
                <User size={18} className="text-subtle" />
                <input
                  className="min-h-12 w-full bg-transparent outline-none"
                  type="text"
                  value={identifier}
                  placeholder="请输入用户名"
                  autoComplete="username"
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                />
              </span>
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-semibold">密码</span>
              <span className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3">
                <LockKeyhole size={18} className="text-subtle" />
                <input
                  className="min-h-12 w-full bg-transparent outline-none"
                  type="password"
                  value={password}
                  minLength={6}
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </span>
            </label>

            <div className="mt-3 text-right">
              <Link href="/forgot-password" className="text-xs font-semibold text-brand">
                忘记密码？
              </Link>
            </div>

            {error ? <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

            <Button className="mt-6 w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "登录中..." : "登录"}
              {!isSubmitting ? <ArrowRight size={18} /> : null}
            </Button>

            <p className="mt-5 text-center text-sm text-subtle">
              还没有账号？{" "}
              <Link href="/register" className="font-semibold text-brand">
                注册
              </Link>
            </p>
          </form>

          <p className="mt-6 text-center text-xs text-subtle">
            意见与反馈：{" "}
            <a href="mailto:3172456681@qq.com" className="font-medium text-subtle underline-offset-4 hover:underline">
              3172456681@qq.com
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
