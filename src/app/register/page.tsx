"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import { OFFICIAL_CLEAN_WORD_COUNT, PUBLIC_VOCAB_NAME } from "@/lib/vocab";

function friendlyRegisterError(error: unknown) {
  const message = error instanceof Error ? error.message : "注册失败，请稍后重试。";
  const lowerMessage = message.toLowerCase();

  if (
    message.includes("服务器登录配置缺失") ||
    message.includes("暂时无法连接登录服务") ||
    message.includes("注册服务暂不可用")
  ) {
    return message;
  }

  if (lowerMessage.includes("password") || message.includes("密码")) {
    return "密码至少需要 6 位。";
  }

  if (
    lowerMessage.includes("already") ||
    lowerMessage.includes("registered") ||
    lowerMessage.includes("exists") ||
    message.includes("已注册")
  ) {
    return "这个邮箱已经注册，请直接登录。";
  }

  if (lowerMessage.includes("fetch") || lowerMessage.includes("network") || message.includes("连接")) {
    return "注册服务连接失败，请稍后再试。";
  }

  if (lowerMessage.includes("supabase") || message.includes("配置")) {
    return "注册服务暂不可用，请稍后再试。";
  }

  return message;
}

export default function RegisterPage() {
  const { register } = useAppState();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setError("");
    setNotice("");
    setIsSubmitting(true);
    try {
      await register(email, username, password);
      router.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("注册成功") || message.includes("邮箱确认") || message.toLowerCase().includes("confirm")) {
        setNotice("注册成功，请前往邮箱完成确认后再登录。");
        return;
      }
      setError(friendlyRegisterError(err));
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
          <p className="text-sm font-semibold text-brand">Register</p>
          <h1 className="mt-2 text-2xl font-bold">创建 WordSprint 账号</h1>
          <p className="mt-2 text-sm leading-6 text-subtle">
            开始你的词汇练习。当前词库为{PUBLIC_VOCAB_NAME}，共 {OFFICIAL_CLEAN_WORD_COUNT} 词。
          </p>

          <label className="mt-6 block">
            <span className="text-sm font-semibold">邮箱</span>
            <input
              className="mt-2 min-h-12 w-full rounded-xl border border-line bg-surface px-3 outline-none"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-semibold">用户名</span>
            <input
              className="mt-2 min-h-12 w-full rounded-xl border border-line bg-surface px-3 outline-none"
              value={username}
              autoComplete="nickname"
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-semibold">密码</span>
            <input
              className="mt-2 min-h-12 w-full rounded-xl border border-line bg-surface px-3 outline-none"
              type="password"
              minLength={6}
              value={password}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {notice ? <p className="mt-4 rounded-lg bg-positive/10 px-3 py-2 text-sm text-positive">{notice}</p> : null}
          {error ? <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

          <Button className="mt-6 w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "注册中..." : "注册并开始"}
            {!isSubmitting ? <ArrowRight size={18} /> : null}
          </Button>

          <p className="mt-5 text-center text-sm text-subtle">
            已有账号？{" "}
            <Link href="/login" className="font-semibold text-brand">
              登录
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
    </main>
  );
}
