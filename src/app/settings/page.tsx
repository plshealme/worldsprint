"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, ChevronRight, Database, Info, RotateCcw, Settings, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import type { QuestionType } from "@/types/test";
import type { FontSizePreference, ThemePreference } from "@/types/user";

const themeOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "eye", label: "护眼" },
];

const fontOptions: Array<{ value: FontSizePreference; label: string }> = [
  { value: "small", label: "小" },
  { value: "medium", label: "中" },
  { value: "large", label: "大" },
];

const englishOnlyRatio: Record<QuestionType, number> = {
  enToZh: 100,
  zhToEn: 0,
  similar: 0,
  synonym: 0,
  familiar: 0,
};
const disabledTypeKeys: QuestionType[] = ["zhToEn", "similar", "synonym", "familiar"];
const typeLabels: Record<QuestionType, string> = {
  enToZh: "英译汉",
  zhToEn: "汉译英",
  similar: "形近词",
  synonym: "意近词",
  familiar: "熟词僻义",
};
const questionPresets = [10, 20, 50] as const;

export default function SettingsPage() {
  const {
    user,
    settings,
    updateSettings,
    clearMistakes,
    clearRecords,
    resetProgress,
  } = useAppState();
  const [ratioOpen, setRatioOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [customQuestionOpen, setCustomQuestionOpen] = useState(!questionPresets.includes(settings.defaultQuestionCount as (typeof questionPresets)[number]));
  const questionCountIsPreset = questionPresets.includes(settings.defaultQuestionCount as (typeof questionPresets)[number]);
  const showCustomQuestionInput = customQuestionOpen || !questionCountIsPreset;

  useEffect(() => {
    const current = settings.defaultTypeRatio;
    if (
      current.enToZh !== englishOnlyRatio.enToZh ||
      current.zhToEn !== englishOnlyRatio.zhToEn ||
      current.similar !== englishOnlyRatio.similar ||
      current.synonym !== englishOnlyRatio.synonym ||
      current.familiar !== englishOnlyRatio.familiar
    ) {
      updateSettings({ defaultTypeRatio: { ...englishOnlyRatio } });
    }
  }, [
    settings.defaultTypeRatio.enToZh,
    settings.defaultTypeRatio.zhToEn,
    settings.defaultTypeRatio.similar,
    settings.defaultTypeRatio.synonym,
    settings.defaultTypeRatio.familiar,
    updateSettings,
  ]);

  function confirmDanger(message: string, action: () => void) {
    if (window.confirm(message) && window.confirm("二次确认：这个操作不能自动恢复。")) {
      action();
    }
  }

  return (
    <div className="space-y-5 pb-24 md:space-y-6 md:pb-0">
      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand">Settings</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">设置</h1>
        <p className="mt-2 text-sm text-subtle">你的偏好会自动保存。</p>
      </section>

      {user?.isAdmin ? <AdminConsoleCard /> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="外观">
          <div>
            <p className="mb-2 text-sm font-semibold text-subtle">主题</p>
            <div className="grid grid-cols-2 gap-2">
              {themeOptions.map((item) => (
                <Button key={item.value} variant={settings.theme === item.value ? "primary" : "secondary"} onClick={() => updateSettings({ theme: item.value })}>
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-subtle">字体大小</p>
            <Segmented>
              {fontOptions.map((item) => (
                <button
                  key={item.value}
                  className={`focus-ring min-h-10 rounded-md text-sm font-semibold ${settings.fontSize === item.value ? "bg-ink text-panel" : "text-ink hover:bg-muted"}`}
                  type="button"
                  onClick={() => updateSettings({ fontSize: item.value })}
                >
                  {item.label}
                </button>
              ))}
            </Segmented>
          </div>
        </Panel>

        <Panel title="学习偏好">
          <div>
            <p className="mb-2 text-sm font-semibold text-subtle">错题移出规则</p>
            <Segmented>
              {[2, 3, 5].map((value) => (
                <button
                  key={value}
                  className={`focus-ring min-h-10 rounded-md text-sm font-semibold ${
                    settings.autoRemoveMistakeStreak === value ? "bg-ink text-panel" : "text-ink hover:bg-muted"
                  }`}
                  type="button"
                  onClick={() => updateSettings({ autoRemoveMistakeStreak: value as 2 | 3 | 5 })}
                >
                  {value} 次
                </button>
              ))}
            </Segmented>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-subtle">默认测试题量</p>
            <div className="grid grid-cols-4 gap-2">
              {questionPresets.map((value) => (
                <Button
                  key={value}
                  variant={settings.defaultQuestionCount === value ? "primary" : "secondary"}
                  className="px-2"
                  onClick={() => {
                    setCustomQuestionOpen(false);
                    updateSettings({ defaultQuestionCount: value });
                  }}
                >
                  {value}题
                </Button>
              ))}
              <Button variant={showCustomQuestionInput ? "primary" : "secondary"} className="px-2" onClick={() => setCustomQuestionOpen(true)}>
                自定义
              </Button>
            </div>
            {showCustomQuestionInput ? (
              <input
                className="mt-3 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg font-semibold outline-none"
                type="number"
                min={1}
                value={settings.defaultQuestionCount}
                onChange={(event) => updateSettings({ defaultQuestionCount: Math.max(1, Number(event.target.value)) })}
              />
            ) : null}
          </div>
        </Panel>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <button className="flex w-full items-center gap-3 text-left" type="button" onClick={() => setRatioOpen((value) => !value)}>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-ink">题型设置</h2>
            <p className="mt-1 text-sm text-subtle">英译汉 100%</p>
          </div>
          <ChevronRight className={`shrink-0 text-subtle transition ${ratioOpen ? "rotate-90" : ""}`} size={20} />
        </button>
        {ratioOpen ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-brand bg-brand/10 p-3">
              <span className="flex items-center justify-between">
                <span className="font-semibold text-ink">{typeLabels.enToZh}</span>
                <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">100%</span>
              </span>
              <p className="mt-2 text-xs text-subtle">MVP 阶段正式支持</p>
            </div>
            {disabledTypeKeys.map((type) => (
              <div key={type} className="rounded-lg border border-line bg-muted/60 p-3 text-subtle opacity-75">
                <span className="flex items-center justify-between">
                  <span className="font-semibold">{typeLabels[type]}</span>
                  <span className="rounded-full bg-panel px-2.5 py-1 text-xs font-semibold">开发中</span>
                </span>
                <p className="mt-2 text-xs">当前不参与抽题</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <h2 className="text-lg font-bold text-ink">数据与账号</h2>
        <div className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
          <SettingsRow href="/settings/stats" icon={<BarChart3 size={18} />} title="学习统计" description="查看答题数、正确率、错题和复习数据" />
          <SettingsRow href="/settings/data" icon={<Database size={18} />} title="学习数据 / 备份" description="导出、导入或管理本地学习记录" />
          <SettingsRow href="/profile" icon={<Settings size={18} />} title="账号设置" description="修改用户名、查看个人资料和退出登录" />
          <SettingsRow href="/settings/about" icon={<Info size={18} />} title="关于 WordSprint" description="Learn it fast. Make it last." />
        </div>
      </section>

      <section className="rounded-lg border border-danger/35 bg-panel p-4 shadow-soft md:p-5">
        <button className="flex w-full items-center gap-3 text-left" type="button" onClick={() => setDangerOpen((value) => !value)}>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-danger">危险操作</h2>
            <p className="mt-1 text-sm text-subtle">重置学习进度、清空记录等</p>
          </div>
          <ChevronRight className={`shrink-0 text-subtle transition ${dangerOpen ? "rotate-90" : ""}`} size={20} />
        </button>
        {dangerOpen ? (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <Button variant="secondary" onClick={() => confirmDanger("确认清空错题本？历史答题记录不会删除。", clearMistakes)}>
              <Trash2 size={16} />
              清空错题本
            </Button>
            <Button variant="secondary" onClick={() => confirmDanger("确认清空成绩记录？", clearRecords)}>
              <Trash2 size={16} />
              清空成绩记录
            </Button>
            <Button variant="danger" onClick={() => confirmDanger("确认重置所有学习进度？这会清空错题、成绩和临时列表。", resetProgress)}>
              <RotateCcw size={16} />
              重置学习进度
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
      <h2 className="mb-4 text-lg font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Segmented({ children }: { children: ReactNode }) {
  return <div className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg bg-muted p-1">{children}</div>;
}

function AdminConsoleCard() {
  return (
    <Link className="block overflow-hidden rounded-lg border border-brand/30 bg-panel shadow-soft hover:border-brand" href="/admin">
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

function SettingsRow({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
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
