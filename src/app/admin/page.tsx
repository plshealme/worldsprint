"use client";

import { Download, Eye, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import { PUBLIC_VOCAB_INTERNAL_LABEL, PUBLIC_VOCAB_NAME, PUBLIC_VOCAB_RANGE } from "@/lib/vocab";
import auditReport from "../../../data/redbook_words.audit.json";

interface AuditReport {
  currentSource?: string;
  vocabVersion?: string;
  cleanTotal?: number;
  totalWords: number;
  usableForChineseMeaningQuestions: number;
  fallbackOnlyCount: number;
  coreMeaningEmptyCount: number;
  fullMeaningsEmptyCount: number;
  partOfSpeechMissingCount: number;
  sectionUnitStats?: Record<string, Array<{ unit: string; total: number; enriched: number; fallback: number }>>;
}

export default function AdminPage() {
  const { user } = useAppState();

  if (!user?.isAdmin) {
    return (
      <section className="rounded-lg border border-line bg-panel p-8 text-center shadow-soft">
        <h1 className="text-2xl font-bold">无权限访问</h1>
        <p className="mt-2 text-sm text-subtle">普通用户不会在账户菜单中看到 Admin，后台接口后续也需要做权限校验。</p>
      </section>
    );
  }

  const audit = auditReport as AuditReport;
  const totalWords = audit.cleanTotal ?? audit.totalWords;
  const sectionUnitStats = audit.sectionUnitStats ?? {};

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand">Admin</p>
        <h1 className="mt-2 text-2xl font-bold">官方词库后台</h1>
        <p className="mt-2 text-sm text-subtle">
          当前启用：{PUBLIC_VOCAB_NAME} · {PUBLIC_VOCAB_RANGE}。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminAction icon={Upload} title="官方词库导入" text="Excel / CSV 上传、字段识别和映射预览。" />
        <AdminAction icon={FileSpreadsheet} title="批量更新" text="按 sourceId 或 section + unit + sourceOrder 匹配更新。" />
        <AdminAction icon={Eye} title="公开 / 隐藏" text={`当前 MVP 只展示 ${PUBLIC_VOCAB_NAME}。`} />
        <AdminAction icon={Download} title="模板与缺失导出" text="下载官方模板，导出缺失字段列表。" />
      </section>

      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
        <h2 className="text-lg font-bold">词库质量</h2>
        <p className="mt-2 text-sm text-subtle">当前审计范围：{PUBLIC_VOCAB_NAME} · {PUBLIC_VOCAB_RANGE}，不自动补释义。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Completeness label="总词数" value={totalWords} />
          <Completeness label="可用释义词数" value={audit.usableForChineseMeaningQuestions} />
          <Completeness label="待补释义词数" value={audit.fallbackOnlyCount} />
          <Completeness label="缺词性数量" value={audit.partOfSpeechMissingCount} />
          <Completeness label="已开放词数" value={totalWords} />
        </div>
        <p className="mt-3 text-sm text-subtle">
          当前词库：{PUBLIC_VOCAB_NAME} · {PUBLIC_VOCAB_RANGE} · 内部版本：{PUBLIC_VOCAB_INTERNAL_LABEL}
        </p>
      </section>

      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
        <h2 className="text-lg font-bold">每个 section / unit 词数</h2>
        <div className="mt-4 space-y-5">
          {Object.entries(sectionUnitStats).map(([section, units]) => (
            <div key={section}>
              <h3 className="font-bold">{section}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {units.map((unit) => (
                  <div key={`${section}-${unit.unit}`} className="rounded-lg bg-surface p-4">
                    <p className="font-semibold">{unit.unit}</p>
                    <p className="mt-1 text-2xl font-bold">{unit.total}</p>
                    <p className="mt-1 text-xs text-subtle">
                      可用释义 {unit.enriched} · 待补 {unit.fallback}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminAction({ icon: Icon, title, text }: { icon: typeof Upload; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-5 shadow-soft">
      <Icon className="text-brand" size={24} />
      <h2 className="mt-4 font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-subtle">{text}</p>
      <Button className="mt-4 w-full" variant="secondary">占位入口</Button>
    </div>
  );
}

function Completeness({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm text-subtle">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
