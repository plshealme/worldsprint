"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/common/Button";

const successMessage = "如果该邮箱已注册，我们会发送密码重置邮件，请前往邮箱查看。";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "暂时无法发送重置邮件，请稍后再试。");
      }
      setMessage(data.message ?? successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法发送重置邮件，请稍后再试。");
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
          <h1 className="mt-2 text-2xl font-bold">找回密码</h1>
          <p className="mt-2 text-sm leading-6 text-subtle">
            请输入注册时使用的邮箱，我们会发送密码重置邮件。
          </p>

          <label className="mt-6 block">
            <span className="text-sm font-semibold">邮箱</span>
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3">
              <Mail size={18} className="text-subtle" />
              <input
                className="min-h-12 w-full bg-transparent outline-none"
                type="email"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </span>
          </label>

          {message ? <p className="mt-4 rounded-lg bg-positive/10 px-3 py-2 text-sm text-positive">{message}</p> : null}
          {error ? <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

          <Button className="mt-6 w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "发送中..." : "发送重置邮件"}
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
