"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, ChevronRight, Database, Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import { OFFICIAL_CLEAN_WORD_COUNT, PUBLIC_VOCAB_INTERNAL_LABEL, PUBLIC_VOCAB_NAME, PUBLIC_VOCAB_RANGE, VOCAB_VERSION } from "@/lib/vocab";
import type { WordProgress } from "@/types/word";

const APP_VERSION = "1.0.0";

export default function SettingsDataPage() {
  const {
    authMode,
    user,
    progress,
    importLearningProgress,
    clearLearningProgress,
    resetMistakeStatus,
    generateDemoLearningData,
    clearMistakes,
    clearRecords,
  } = useAppState();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [dangerOpen, setDangerOpen] = useState(false);
  const progressCount = Object.keys(progress).length;
  const showDevDataTools = authMode === "dev" || process.env.NODE_ENV !== "production";

  function confirmAction(message: string, action: () => void) {
    if (window.confirm(message)) {
      action();
    }
  }

  function confirmDanger(message: string, action: () => void) {
    if (window.confirm(message) && window.confirm("二次确认：这个操作不能自动恢复。")) {
      action();
    }
  }

  function exportLearningData() {
    if (!user) {
      window.alert("请先登录后再导出学习记录。");
      return;
    }

    const backup = {
      userId: user.id,
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      vocabVersion: VOCAB_VERSION,
      progress,
    };
    const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wordsprint-${PUBLIC_VOCAB_INTERNAL_LABEL}-${user.id}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importLearningData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) {
      return;
    }

    try {
      const backup = JSON.parse(await file.text()) as unknown;
      const validation = validateBackup(backup, user.id);
      if (!validation.ok) {
        window.alert(validation.error);
        return;
      }
      if (!window.confirm(`确认导入 ${Object.keys(validation.progress).length} 条学习记录？当前用户已有学习记录会被替换。`)) {
        return;
      }
      importLearningProgress(validation.progress);
      window.alert("学习记录已导入，Stats / Mistakes / Review 会自动刷新。");
    } catch {
      window.alert("导入失败：JSON 文件无法解析。");
    }
  }

  function clearCurrentLearningData() {
    if (
      window.confirm("确认清空当前用户学习记录？此操作不会影响词库。") &&
      window.confirm("二次确认：只会清空当前用户的学习进度和错题状态，不能自动恢复。")
    ) {
      clearLearningProgress();
    }
  }

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <header className="flex items-center gap-3">
        <Link
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-ink hover:border-brand"
          href="/settings"
          aria-label="返回设置"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-sm font-semibold text-brand">Settings</p>
          <h1 className="text-2xl font-bold text-ink">学习数据 / 备份</h1>
        </div>
      </header>

      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <Database className="text-brand" size={19} />
          <h2 className="font-bold text-ink">当前数据</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-subtle">学习记录保存在当前设备中。导出 JSON 后，可用于备份或迁移。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <InfoCard label="当前用户记录" value={`${progressCount} 条`} />
          <InfoCard label="词库" value={PUBLIC_VOCAB_NAME} />
          <InfoCard label="范围" value={PUBLIC_VOCAB_RANGE} />
          <InfoCard label="词数" value={`${OFFICIAL_CLEAN_WORD_COUNT} 词`} />
          <InfoCard label="数据保存" value="本地设备" />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <h2 className="font-bold text-ink">主要操作</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button variant="secondary" onClick={exportLearningData} disabled={!user}>
            <Download size={16} />
            导出 JSON
          </Button>
          <Button variant="secondary" onClick={() => importInputRef.current?.click()} disabled={!user}>
            <Upload size={16} />
            导入 JSON
          </Button>
          <input ref={importInputRef} className="hidden" type="file" accept="application/json,.json" onChange={importLearningData} />
          <Button variant="secondary" onClick={() => confirmAction("确认重置错题状态？wrongCount 会保留，但错题本会清空。", resetMistakeStatus)}>
            <RotateCcw size={16} />
            重置错题状态
          </Button>
        </div>
        {showDevDataTools ? (
          <Button className="mt-3 w-full sm:w-auto" variant="success" onClick={generateDemoLearningData}>
            生成测试学习数据
          </Button>
        ) : null}
      </section>

      <section className="rounded-lg border border-danger/35 bg-panel p-4 shadow-soft md:p-5">
        <button className="flex w-full items-center gap-3 text-left" type="button" onClick={() => setDangerOpen((value) => !value)}>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-danger">危险操作</h2>
            <p className="mt-1 text-sm text-subtle">清空学习记录、清空错题本等</p>
          </div>
          <ChevronRight className={`shrink-0 text-subtle transition ${dangerOpen ? "rotate-90" : ""}`} size={20} />
        </button>
        {dangerOpen ? (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <Button variant="danger" onClick={clearCurrentLearningData}>
              <Trash2 size={16} />
              清空学习记录
            </Button>
            <Button variant="secondary" onClick={() => confirmDanger("确认清空错题本？历史答题记录不会删除。", clearMistakes)}>
              <Trash2 size={16} />
              清空错题本
            </Button>
            <Button variant="secondary" onClick={() => confirmDanger("确认清空成绩记录？", clearRecords)}>
              <Trash2 size={16} />
              清空成绩记录
            </Button>
          </div>
        ) : null}
      </section>

      <details className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <summary className="cursor-pointer font-bold text-ink">技术信息</summary>
        <div className="mt-3 space-y-2 text-sm text-subtle">
          <p>内部版本：{PUBLIC_VOCAB_INTERNAL_LABEL}</p>
          <p>appVersion: {APP_VERSION}</p>
          <p>authMode: {authMode}</p>
        </div>
      </details>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 break-words text-base font-bold text-ink">{value}</p>
    </div>
  );
}

function validateBackup(value: unknown, currentUserId: string): { ok: true; progress: Record<string, WordProgress> } | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "导入失败：文件不是有效的备份对象。" };
  }
  const backup = value as {
    userId?: unknown;
    exportedAt?: unknown;
    appVersion?: unknown;
    vocabVersion?: unknown;
    progress?: unknown;
  };
  if (backup.userId !== currentUserId) {
    return { ok: false, error: "导入失败：备份文件不属于当前用户。" };
  }
  if (typeof backup.exportedAt !== "string" || typeof backup.appVersion !== "string" || typeof backup.vocabVersion !== "string") {
    return { ok: false, error: "导入失败：缺少 exportedAt / appVersion / vocabVersion。" };
  }
  if (backup.vocabVersion !== VOCAB_VERSION) {
    return { ok: false, error: `导入失败：备份文件的词库版本与当前词库不匹配。当前词库为${PUBLIC_VOCAB_NAME} · ${PUBLIC_VOCAB_RANGE}。` };
  }
  if (!backup.progress || typeof backup.progress !== "object" || Array.isArray(backup.progress)) {
    return { ok: false, error: "导入失败：progress 必须是对象。" };
  }

  for (const [wordId, item] of Object.entries(backup.progress as Record<string, unknown>)) {
    if (!wordId || !item || typeof item !== "object") {
      return { ok: false, error: `导入失败：${wordId || "未知词条"} 的记录格式不正确。` };
    }
    const record = item as Partial<WordProgress>;
    if (typeof record.wordId !== "string" || record.wordId !== wordId) {
      return { ok: false, error: `导入失败：${wordId} 的 wordId 不匹配。` };
    }
    if (typeof record.attempts !== "number") {
      return { ok: false, error: `导入失败：${wordId} 缺少 attempts。` };
    }
  }

  return { ok: true, progress: backup.progress as Record<string, WordProgress> };
}
