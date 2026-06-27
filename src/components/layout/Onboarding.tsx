"use client";

import { ArrowRight, BookOpen, CheckCircle2, ClipboardList, Gauge, Layers, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import { PUBLIC_VOCAB_NAME } from "@/lib/vocab";

const items = [
  { icon: Gauge, title: "Home", text: "看等级、XP、正确率和最近成绩，快速进入学习。" },
  { icon: ClipboardList, title: "Practice / Exam", text: "Practice 即时反馈，Exam 统一交卷出报告。" },
  { icon: BookOpen, title: "Review", text: "列表、卡片、单元浏览和搜索都在这里。" },
  { icon: Layers, title: "Mistakes", text: "错题自动进入，连续答对后按设置移出。" },
];

export function Onboarding() {
  const { completeOnboarding } = useAppState();

  return (
    <main className="min-h-screen bg-surface px-4 py-8 text-ink">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand">Welcome to WordSprint</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-5xl">Learn it fast. Make it last.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-subtle">
              先选择{PUBLIC_VOCAB_NAME}的单元，再用 Practice 快速找薄弱词，用 Exam 记录正式成绩。
            </p>
          </div>
          <Button variant="ghost" onClick={completeOnboarding} aria-label="跳过引导">
            <X size={18} />
            跳过
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.title} className="rounded-lg border border-line bg-panel p-5 shadow-soft">
              <item.icon className="text-brand" size={24} />
              <h2 className="mt-4 text-xl font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-subtle">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-line bg-panel p-5 shadow-soft">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-positive">
                <CheckCircle2 size={18} />
                <span className="text-sm font-semibold">推荐下一步</span>
              </div>
              <p className="mt-2 text-lg font-semibold">做一次 10 题体验测试，熟悉即时反馈和错题流转。</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/practice" onClick={completeOnboarding}>
                10题体验测试
                <ArrowRight size={18} />
              </ButtonLink>
              <Button variant="secondary" onClick={completeOnboarding}>
                自己选择范围
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
