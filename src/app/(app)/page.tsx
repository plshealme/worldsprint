"use client";

import { ArrowRight, BookOpen, ClipboardList, RotateCcw, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { ButtonLink } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import { perfLog } from "@/lib/perfLog";
import { computeLearningStats } from "@/lib/stats";
import { formatPercent, levelFromXp, shortDateTime } from "@/lib/utils";
import { PUBLIC_VOCAB_NAME } from "@/lib/vocab";

const quickActions = [
  {
    href: "/practice",
    title: "新词练习",
    text: "先拿下 20 个词",
    icon: ClipboardList,
  },
  {
    href: "/mistakes",
    title: "错词练习",
    text: "把错题拉回来",
    icon: RotateCcw,
  },
  {
    href: "/review",
    title: "待复习",
    text: "按记忆队列走",
    icon: BookOpen,
  },
  {
    href: "/exam",
    title: "模拟测试",
    text: "不看反馈交卷",
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  const { user, progress, mistakes, records } = useAppState();
  const stats = computeLearningStats(progress, mistakes, records);
  const level = levelFromXp(user?.xp ?? 0);
  const todayPracticed = countTodayPracticed(progress);
  const dailyGoal = 20;
  const recentRecord = stats.lastRecord;
  useEffect(() => {
    perfLog("Home mounted");
    if (window.sessionStorage.getItem("wordsprint:authRedirecting") === "1") {
      window.sessionStorage.removeItem("wordsprint:authRedirecting");
      perfLog("route to home end");
    }
  }, []);
  const ctaText = todayPracticed > 0 ? "继续练习" : "开始练习";

  return (
    <div className="space-y-5 md:space-y-8">
      <section className="md:hidden">
        <p className="text-sm font-semibold text-brand">今天先拿下 20 个词</p>
        <h2 className="mt-1 text-2xl font-bold">坚持一点点，单词就会留下来。</h2>
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-panel shadow-soft">
        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-brand">今日学习</p>
              <h1 className="mt-2 text-2xl font-bold md:text-4xl">WordSprint</h1>
              <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-subtle md:block">Learn it fast. Make it last.</p>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2 text-right">
              <p className="text-xs text-subtle">{level.name}</p>
              <p className="mt-0.5 text-sm font-bold">{user?.xp ?? 0} XP</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-subtle">已练词数 / 目标词数</p>
                <p className="mt-1 text-3xl font-bold">{Math.min(todayPracticed, dailyGoal)} / {dailyGoal}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-subtle">正确率</p>
                <p className="mt-1 text-xl font-bold">{formatPercent(stats.totalAccuracy)}</p>
              </div>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.round((todayPracticed / dailyGoal) * 100))}%` }} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniMetric label="待复习" value={stats.dueReview} />
            <MiniMetric label="错题" value={stats.activeMistakes} />
          </div>

          <ButtonLink href="/practice" className="mt-5 min-h-12 w-full text-base">
            {ctaText}
            <ArrowRight size={18} />
          </ButtonLink>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">快捷练习</h2>
          <span className="hidden text-sm text-subtle md:inline">Practice 和 Exam 分开记录</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {quickActions.map((entry) => (
            <ButtonLink
              key={entry.title}
              href={entry.href}
              variant="secondary"
              className="min-h-[104px] justify-start rounded-lg border border-line bg-panel p-4 text-left shadow-soft hover:border-brand"
            >
              <span className="flex w-full flex-col items-start">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <entry.icon size={20} />
                </span>
                <span className="mt-3 text-base font-bold text-ink">{entry.title}</span>
                <span className="mt-1 text-xs leading-5 text-subtle">{entry.text}</span>
              </span>
            </ButtonLink>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">学习概览</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <DashboardStat icon={Target} label="已练词数" value={stats.studiedWords} hint={`${PUBLIC_VOCAB_NAME} · ${stats.totalWords}词`} />
          <DashboardStat icon={TrendingUp} label="正确率" value={formatPercent(stats.totalAccuracy)} hint={`${stats.correct}/${stats.attempts || 0} 题`} />
          <DashboardStat icon={RotateCcw} label="错题数" value={stats.activeMistakes} hint="可从错题本重练" />
          <DashboardStat icon={BookOpen} label="待复习" value={stats.dueReview} hint="到期复习队列" />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <InfoCard
          title="最近练习"
          text={recentRecord ? `${recentRecord.title} · ${recentRecord.score} 分 · ${shortDateTime(recentRecord.createdAt)}` : "还没有练习记录，先从一轮 Practice 开始。"}
          href="/settings/stats"
          action="查看统计"
        />
        <InfoCard
          title="错题提醒"
          text={stats.activeMistakes > 0 ? `当前有 ${stats.activeMistakes} 个错题，建议先清掉高频错词。` : "错题本很干净，今天可以推进新词。"}
          href="/mistakes"
          action="进入错题本"
        />
      </section>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function DashboardStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Target;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <Icon size={17} className="text-brand" />
        <p className="text-sm text-subtle">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </div>
  );
}

function InfoCard({ title, text, href, action }: { title: string; text: string; href: string; action: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-soft">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-2 min-h-10 text-sm leading-6 text-subtle">{text}</p>
      <LinkButton href={href}>{action}</LinkButton>
    </div>
  );
}

function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <ButtonLink href={href} variant="ghost" className="mt-3 min-h-11 px-0 text-brand hover:bg-transparent">
      {children}
      <ArrowRight size={16} />
    </ButtonLink>
  );
}

function countTodayPracticed(progress: ReturnType<typeof useAppState>["progress"]) {
  const today = new Date().toISOString().slice(0, 10);
  return Object.values(progress).filter((item) => (item.lastPracticedAt ?? item.lastAnsweredAt ?? "").slice(0, 10) === today).length;
}
