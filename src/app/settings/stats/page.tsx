"use client";

import { useMemo, useState } from "react";
import { BarChart3, BookOpen, ClipboardList, RotateCcw } from "lucide-react";
import { ButtonLink } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import { computeLearningStats, unitStats } from "@/lib/stats";
import { formatDuration, formatPercent, shortDateTime } from "@/lib/utils";
import { PUBLIC_VOCAB_NAME, PUBLIC_VOCAB_RANGE } from "@/lib/vocab";
import type { TestRecordSummary } from "@/types/test";

type RecordTab = "practice" | "exam";
type UnitFilter = "all" | "started" | "notStarted" | "mistakes";

const unitFilters: Array<{ key: UnitFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "started", label: "已开始" },
  { key: "notStarted", label: "未开始" },
  { key: "mistakes", label: "易错多" },
];

export default function StatsPage() {
  const { progress, mistakes, records } = useAppState();
  const [recordTab, setRecordTab] = useState<RecordTab>("practice");
  const [unitFilter, setUnitFilter] = useState<UnitFilter>("all");
  const stats = computeLearningStats(progress, mistakes, records);
  const units = unitStats(progress, mistakes);
  const practiceRecords = records.filter((record) => record.mode === "practice");
  const examRecords = records.filter((record) => record.mode === "exam");
  const recentExam = examRecords.slice(0, 30).reverse();
  const selectedRecords = recordTab === "practice" ? practiceRecords : examRecords;

  const insight = useMemo(() => {
    const startedUnits = units.filter((unit) => unit.attempts > 0);
    if (stats.attempts === 0 || startedUnits.length === 0) {
      return "还没有足够学习数据。先完成一组 Practice，系统会开始生成统计。";
    }
    const topUnit = [...startedUnits].sort((a, b) => b.attempts - a.attempts)[0];
    return `你目前主要练习了 ${topUnit.unit}。已掌握 ${topUnit.mastered} / ${topUnit.total}，正确率 ${formatPercent(topUnit.accuracy)}，还有 ${topUnit.mistakes} 个易错词。`;
  }, [stats.attempts, units]);

  const nextAction = stats.dueReview > 0
    ? { href: "/review", label: "去 Review", icon: BookOpen }
    : stats.activeMistakes > 0
      ? { href: "/mistakes", label: "练易错词", icon: RotateCcw }
      : { href: "/practice", label: "去 Practice", icon: ClipboardList };

  const filteredUnits = units.filter((unit) => {
    if (unitFilter === "started") return unit.attempts > 0;
    if (unitFilter === "notStarted") return unit.attempts === 0;
    if (unitFilter === "mistakes") return unit.mistakes >= 2;
    return true;
  });

  return (
    <div className="space-y-5 pb-24 md:space-y-6 md:pb-0">
      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand">Stats</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">学习统计</h1>
        <p className="mt-2 text-sm leading-6 text-subtle">看看最近练了多少、错在哪里、哪些单元还没开始。</p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard label="已练词数" value={stats.studiedWords} hint={`累计答题 ${stats.attempts}`} />
        <MetricCard label="平均正确率" value={formatPercent(stats.totalAccuracy)} />
        <MetricCard label="易错词" value={stats.activeMistakes} />
        <MetricCard label="待复习" value={stats.dueReview} />
        <MetricCard label="词库总数" value={stats.totalWords} className="col-span-2 md:col-span-1" />
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 text-sm shadow-soft">
        <div className="grid gap-2 md:grid-cols-3">
          <InfoLine label="当前词库" value={PUBLIC_VOCAB_NAME} />
          <InfoLine label="当前范围" value={PUBLIC_VOCAB_RANGE} />
          <InfoLine label="词数" value={`${stats.totalWords} 词`} />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <BarChart3 size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-ink">学习洞察</h2>
            <p className="mt-2 text-sm leading-6 text-subtle">{insight}</p>
            <ButtonLink href={nextAction.href} className="mt-4">
              <nextAction.icon size={17} />
              {nextAction.label}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <h2 className="text-lg font-bold text-ink">Exam 正确率趋势</h2>
        {recentExam.length === 0 ? (
          <div className="mt-4 rounded-lg border border-line bg-surface p-4">
            <p className="font-bold text-ink">暂无正式测试记录</p>
            <p className="mt-1 text-sm leading-6 text-subtle">完成一次 Exam 后，这里会显示正确率趋势。</p>
            <ButtonLink href="/exam" className="mt-4">
              去 Exam 测一次
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-4 flex h-40 items-end gap-2 overflow-x-auto rounded-lg bg-surface p-4">
            {recentExam.map((record) => (
              <div key={record.id} className="flex min-w-8 flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t bg-brand" style={{ height: `${Math.max(8, record.questionAccuracy * 120)}px` }} />
                <span className="text-[11px] text-subtle">{record.score}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">最近记录</h2>
            <p className="mt-1 text-sm text-subtle">
              Practice {practiceRecords.length} 场 · Exam {examRecords.length} 场
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["practice", "exam"] as const).map((tab) => (
              <button
                key={tab}
                className={`focus-ring min-h-9 rounded-md px-3 text-sm font-semibold ${recordTab === tab ? "bg-ink text-panel" : "text-ink hover:bg-panel"}`}
                type="button"
                onClick={() => setRecordTab(tab)}
              >
                {tab === "practice" ? "Practice" : "Exam"}
              </button>
            ))}
          </div>
        </div>
        <RecordsList records={selectedRecords} mode={recordTab} />
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">按单元统计</h2>
            <p className="mt-1 text-sm text-subtle">查看哪些单元已经开始，哪些还没动。</p>
          </div>
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
            {unitFilters.map((item) => (
              <button
                key={item.key}
                className={`focus-ring min-h-9 rounded-md px-2 text-xs font-semibold ${unitFilter === item.key ? "bg-ink text-panel" : "text-ink hover:bg-panel"}`}
                type="button"
                onClick={() => setUnitFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {filteredUnits.map((unit) => (
            <UnitCard key={unit.key} unit={unit} />
          ))}
          {filteredUnits.length === 0 ? <p className="rounded-lg bg-surface p-4 text-sm text-subtle">当前筛选下暂无单元。</p> : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
          <h2 className="text-lg font-bold text-ink">按题型统计</h2>
          <div className="mt-4 space-y-3">
            {(["enToZh", "zhToEn", "similar", "synonym", "familiar"] as const).map((type) => {
              const items = records.flatMap((record) => record.weakTypes.filter((item) => item.type === type));
              const accuracy = items.length ? items.reduce((sum, item) => sum + item.accuracy, 0) / items.length : 0;
              return (
                <div key={type}>
                  <div className="flex justify-between text-sm">
                    <span>{typeLabel(type)}</span>
                    <span>{formatPercent(accuracy)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(accuracy * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
          <h2 className="text-lg font-bold text-ink">学习日历</h2>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, index) => (
              <span key={index} className={`h-7 rounded ${index > 34 - records.length ? "bg-brand/80" : "bg-muted"}`} title="学习记录" />
            ))}
          </div>
          <p className="mt-4 text-sm text-subtle">连续学习天数：{Math.min(30, new Set(records.map((record) => record.createdAt.slice(0, 10))).size)} 天</p>
          <p className="mt-2 text-xs text-subtle">当前词库：{PUBLIC_VOCAB_NAME} · {PUBLIC_VOCAB_RANGE}</p>
        </div>
      </section>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2">
      <span className="text-subtle">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </p>
  );
}

function MetricCard({ label, value, hint, className = "" }: { label: string; value: string | number; hint?: string; className?: string }) {
  return (
    <div className={`rounded-lg border border-line bg-panel p-4 shadow-soft ${className}`}>
      <p className="text-xs font-semibold text-subtle">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

function RecordsList({ records, mode }: { records: TestRecordSummary[]; mode: RecordTab }) {
  return (
    <div className="mt-4 space-y-2">
      {records.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="font-bold text-ink">暂无{mode === "practice" ? "练习" : "正式测试"}场次记录</p>
          <p className="mt-1 text-sm leading-6 text-subtle">
            {mode === "practice" ? "已练词数来自单词进度统计，场次记录会在完成练习后显示。" : "完成一次 Exam 后，这里会显示正式测试记录。"}
          </p>
        </div>
      ) : (
        records.slice(0, 6).map((record) => (
          <div key={record.id} className="rounded-lg border border-line bg-surface p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate font-semibold">{record.title}</p>
              <p className="shrink-0 font-bold">{record.score} 分</p>
            </div>
            <p className="mt-1 text-xs text-subtle">
              {shortDateTime(record.createdAt)} · {record.total} 题 · {formatDuration(record.durationMs)} · 正确率 {formatPercent(record.questionAccuracy)}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

function UnitCard({ unit }: { unit: ReturnType<typeof unitStats>[number] }) {
  const started = unit.attempts > 0;
  const progress = unit.total ? unit.mastered / unit.total : 0;
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-ink">{unit.unit}</h3>
          <p className="mt-1 text-xs font-semibold text-subtle">{started ? "已开始" : "尚未开始"}</p>
        </div>
        <span className="shrink-0 text-sm font-bold text-ink">
          {unit.mastered} / {unit.total}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${started ? "bg-positive" : "bg-muted"}`} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      {started ? (
        <p className="mt-2 text-xs text-subtle">
          正确率 {formatPercent(unit.accuracy)} · 易错词 {unit.mistakes}
        </p>
      ) : (
        <p className="mt-2 text-xs text-subtle">还没有练习记录</p>
      )}
    </div>
  );
}

function typeLabel(type: "enToZh" | "zhToEn" | "similar" | "synonym" | "familiar") {
  const labels = {
    enToZh: "英译汉",
    zhToEn: "汉译英",
    similar: "形近词",
    synonym: "意近词",
    familiar: "熟词僻义",
  };
  return labels[type];
}
