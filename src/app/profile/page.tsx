"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Award, BarChart3, ChevronRight, Database, Info, LogOut, Pencil, Save, Settings, Shield, Type } from "lucide-react";
import { Button } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import { computeLearningStats } from "@/lib/stats";
import { formatPercent, levelFromXp } from "@/lib/utils";

const badgeCatalog = [
  { id: "review-50", name: "稳步复习", description: "累计覆盖 50 个词" },
  { id: "answer-100", name: "百题起跑", description: "累计完成 100 道题" },
  { id: "exam-90", name: "精准冲刺", description: "Exam 正确率达到 90%" },
  { id: "mistake-clear", name: "错题回收", description: "清空一组重点错题" },
];

export default function ProfilePage() {
  const { user, updateUsername, progress, mistakes, records, logout } = useAppState();
  const [username, setUsername] = useState(user?.username ?? "");
  const [editingProfile, setEditingProfile] = useState(false);
  const stats = computeLearningStats(progress, mistakes, records);
  const level = levelFromXp(user?.xp ?? 0);
  const earnedBadgeIds = useMemo(() => new Set(user?.badges.map((badge) => badge.id) ?? []), [user?.badges]);
  const streakDays = Math.min(30, new Set(records.map((record) => record.createdAt.slice(0, 10))).size);

  function save(event: FormEvent) {
    event.preventDefault();
    updateUsername(username);
    setEditingProfile(false);
  }

  if (!user) return null;

  const initial = user.username.slice(0, 1).toUpperCase();
  const statItems = [
    { label: "累计答题", value: stats.attempts },
    { label: "正确率", value: formatPercent(stats.totalAccuracy) },
    { label: "连续学习", value: `${streakDays} 天` },
    { label: "错题数", value: stats.activeMistakes },
    { label: "最好成绩", value: stats.bestExam ? `${stats.bestExam.score} 分` : "暂无" },
  ];

  return (
    <div className="space-y-5 pb-24 md:space-y-6 md:pb-0">
      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft md:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand text-2xl font-bold text-white md:h-20 md:w-20 md:text-3xl">{initial}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand">我的</p>
                <h1 className="mt-1 truncate text-2xl font-bold text-ink">{user.username}</h1>
                <p className="mt-1 truncate text-sm text-subtle">{user.email}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link className="focus-ring rounded-full border border-line bg-surface p-2 text-subtle hover:bg-muted" href="/settings" aria-label="设置中心">
                  <Settings size={18} />
                </Link>
                <button
                  className="focus-ring rounded-full border border-line bg-surface p-2 text-subtle hover:bg-muted"
                  type="button"
                  aria-label="编辑资料"
                  onClick={() => setEditingProfile((value) => !value)}
                >
                  <Pencil size={18} />
                </button>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex justify-between text-sm font-semibold">
                <span>{level.name}</span>
                <span>{user.xp} XP</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(level.progress * 100)}%` }} />
              </div>
            </div>

            <button
              className="focus-ring mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-muted px-3 text-sm font-semibold text-ink hover:bg-line/60"
              type="button"
              onClick={() => setEditingProfile((value) => !value)}
            >
              <Pencil size={16} />
              编辑资料
            </button>
          </div>
        </div>

        {editingProfile ? (
          <form onSubmit={save} className="mt-4 rounded-lg border border-line bg-surface p-3">
            <label className="text-sm font-semibold text-ink" htmlFor="profile-username">
              用户名
            </label>
            <input
              id="profile-username"
              className="mt-2 min-h-11 w-full rounded-lg border border-line bg-panel px-3 outline-none"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <Button className="mt-3 w-full" type="submit">
              <Save size={17} />
              保存
            </Button>
          </form>
        ) : null}
      </section>

      <Link className="flex items-center gap-3 rounded-lg border border-brand/25 bg-brand/10 p-4 shadow-soft hover:border-brand/50" href="/settings">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white">
          <Settings size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold text-ink">设置中心</span>
          <span className="mt-0.5 block text-sm text-subtle">主题、字号、数据备份、学习偏好</span>
        </span>
        <ChevronRight className="text-subtle" size={20} />
      </Link>

      {user.isAdmin ? <AdminConsoleCard /> : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {statItems.map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-panel p-4 shadow-soft">
            <p className="text-xs font-semibold text-subtle">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-ink">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">成就徽章</h2>
            <p className="mt-1 text-sm text-subtle">学习进度会点亮新的徽章。</p>
          </div>
          <Award className="text-brand" size={22} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {badgeCatalog.map((badge) => {
            const earned = earnedBadgeIds.has(badge.id);
            return (
              <div key={badge.id} className={`rounded-lg border p-3 ${earned ? "border-brand bg-brand/10" : "border-line bg-surface opacity-75"}`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${earned ? "bg-brand text-white" : "bg-muted text-subtle"}`}>
                  <Award size={18} />
                </div>
                <h3 className="mt-3 text-sm font-bold text-ink">{badge.name}</h3>
                <p className="mt-1 text-xs leading-5 text-subtle">{badge.description}</p>
                <p className={`mt-2 text-xs font-semibold ${earned ? "text-brand" : "text-subtle"}`}>{earned ? "已获得" : "未获得"}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <h2 className="text-lg font-bold text-ink">设置</h2>
        <div className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
          <SettingsLink href="/settings" icon={<Type size={18} />} title="主题与字号" description="调整外观、字体大小和学习偏好" />
          <SettingsLink href="/settings/data" icon={<Database size={18} />} title="学习数据 / 备份" description="导出、导入或管理本地学习记录" />
          <SettingsLink href="/settings/stats" icon={<BarChart3 size={18} />} title="统计详情" description="查看答题数、正确率、错题和复习数据" />
          <SettingsLink href="/settings/about" icon={<Info size={18} />} title="关于 WordSprint" description="Learn it fast. Make it last." />
          <button className="flex w-full items-center gap-3 bg-panel px-3 py-3 text-left hover:bg-muted" type="button" onClick={logout}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
              <LogOut size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-danger">退出登录</span>
              <span className="mt-0.5 block text-sm text-subtle">离开当前账号</span>
            </span>
            <ChevronRight className="text-subtle" size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}

function AdminConsoleCard() {
  return (
    <Link
      className="block overflow-hidden rounded-lg border border-brand/30 bg-panel shadow-soft hover:border-brand"
      href="/admin"
    >
      <div className="bg-gradient-to-br from-brand/14 via-panel to-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white">
            <Shield size={20} />
          </span>
          <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">Admin Only</span>
        </div>
        <h2 className="mt-4 text-lg font-bold text-ink">管理员控制台</h2>
        <p className="mt-1 text-sm leading-6 text-subtle">词库质量、用户与系统管理工具</p>
      </div>
    </Link>
  );
}

function SettingsLink({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link className="flex items-center gap-3 bg-panel px-3 py-3 hover:bg-muted" href={href}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-brand">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-subtle">{description}</span>
      </span>
      <ChevronRight className="text-subtle" size={18} />
    </Link>
  );
}
