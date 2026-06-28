"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { FileDown, MoreHorizontal, Printer, RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import { formatPercent, shortDateTime } from "@/lib/utils";
import { sectionUnitLabelFromKey, wordSectionUnitKey } from "@/lib/words";
import { useWords } from "@/lib/useWords";
import type { MistakeItem, MistakeReason } from "@/types/mistake";
import type { WordEntry, WordProgress } from "@/types/word";

type SortKey = "wrongCount" | "unit" | "lastWrongAt" | "reason";
type QuickFilter = "all" | "recent" | "wrong2" | "mastered";

const quickFilters: Array<{ key: QuickFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "recent", label: "最近错" },
  { key: "wrong2", label: "高频错" },
  { key: "mastered", label: "已掌握" },
];

const sortLabels: Record<SortKey, string> = {
  wrongCount: "排序：错误次数",
  unit: "排序：单元顺序",
  lastWrongAt: "排序：最近错误",
  reason: "排序：错因分类",
};

export default function MistakesPage() {
  const { mistakes, progress, getProgress, removeMistake, setMastery, addTempWord, tempList } = useAppState();
  const [sort, setSort] = useState<SortKey>("wrongCount");
  const [unit, setUnit] = useState("");
  const [pos, setPos] = useState("");
  const [minWrong, setMinWrong] = useState(1);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const mistakeIds = useMemo(
    () =>
      Object.values(progress)
        .filter((item) => item.isMistake)
        .map((item) => item.wordId),
    [progress],
  );
  const requestedIds = mistakeIds.length ? mistakeIds : ["__none__"];
  const { words, units, loading, error } = useWords({ ids: requestedIds, pageSize: Math.max(requestedIds.length, 1) });

  const mistakeMap = useMemo(() => new Map(mistakes.map((item) => [item.wordId, item])), [mistakes]);
  const filtered = useMemo(() => {
    const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const rows = words
      .map((word) => ({ word, record: getProgress(word.id), mistake: mistakeMap.get(word.id) }))
      .filter((item) => item.record.isMistake)
      .filter((item) => !unit || wordSectionUnitKey(item.word) === unit)
      .filter((item) => !pos || item.word.partOfSpeech === pos)
      .filter((item) => item.record.wrongCount >= minWrong)
      .filter((item) => {
        if (quickFilter === "recent") {
          const lastWrongAt = item.mistake?.lastWrongAt ?? item.record.lastPracticedAt;
          return lastWrongAt ? new Date(lastWrongAt).getTime() >= recentCutoff : false;
        }
        if (quickFilter === "wrong2") {
          return item.record.wrongCount >= 2;
        }
        if (quickFilter === "mastered") {
          return item.record.masteryLevel === "mastered" || item.record.masteryLevel === "known";
        }
        return true;
      });

    rows.sort((a, b) => {
      if (sort === "unit") return `${wordSectionUnitKey(a.word)}-${a.word.word}`.localeCompare(`${wordSectionUnitKey(b.word)}-${b.word.word}`);
      if (sort === "lastWrongAt") {
        return new Date(b.mistake?.lastWrongAt ?? b.record.lastPracticedAt ?? 0).getTime() - new Date(a.mistake?.lastWrongAt ?? a.record.lastPracticedAt ?? 0).getTime();
      }
      if (sort === "reason") return (a.mistake?.reason ?? "").localeCompare(b.mistake?.reason ?? "");
      return b.record.wrongCount - a.record.wrongCount;
    });
    return rows;
  }, [getProgress, minWrong, mistakeMap, pos, quickFilter, sort, unit, words]);

  const posOptions = Array.from(new Set(words.map((word) => word.partOfSpeech).filter(Boolean))) as string[];
  const hasMistakes = filtered.length > 0;
  const mistakeCountLabel = filtered.length === 0 ? "暂无易错词" : `${filtered.length} 个易错词`;
  const filterSummary = [sortLabels[sort], unit ? sectionUnitLabelFromKey(unit) : "全部单元", pos || "全部词性", `错≥${minWrong}`].join(" · ");

  function addAllToTemp() {
    for (const item of filtered) {
      addTempWord(item.word.id, "mistakes");
    }
  }

  function markMastered(wordId: string, word: string) {
    setMastery(wordId, "mastered", word);
    removeMistake(wordId);
  }

  function applyQuickFilter(filter: QuickFilter) {
    setQuickFilter(filter);
    if (filter === "all") {
      setMinWrong(1);
      setSort("wrongCount");
      return;
    }
    if (filter === "recent") {
      setSort("lastWrongAt");
      return;
    }
    if (filter === "wrong2") {
      setMinWrong(2);
      setSort("wrongCount");
      return;
    }
    setSort("wrongCount");
  }

  return (
    <div className="space-y-4 pb-4 md:space-y-6 md:pb-0">
      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand">Mistakes</p>
            <h1 className="text-2xl font-bold text-ink md:text-3xl">错题本</h1>
            <p className="mt-2 text-xl font-semibold text-ink">{mistakeCountLabel}</p>
            <p className="mt-1 text-sm leading-6 text-subtle">最近练习里容易混淆的词都在这里。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tempList.length > 0 ? (
              <ButtonLink href="/temp-list" variant="secondary" className="px-3">
                临测 {tempList.length}
              </ButtonLink>
            ) : null}
            <ButtonLink href="/temp-list" onClick={addAllToTemp} aria-disabled={!hasMistakes || loading} className={!hasMistakes || loading ? "pointer-events-none opacity-50" : undefined}>
              <RotateCcw size={17} />
              开始错题专项 {filtered.length} 词
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-2">
        {quickFilters.map((item) => (
          <button
            key={item.key}
            className={`focus-ring min-h-10 rounded-full border px-2 text-sm font-semibold transition ${
              quickFilter === item.key ? "border-brand bg-brand text-white" : "border-line bg-panel text-ink"
            }`}
            type="button"
            onClick={() => applyQuickFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-panel p-3 shadow-soft md:p-4">
        <div className="grid grid-cols-[1fr_auto] gap-2 md:block">
          <button
            className="focus-ring min-w-0 rounded-lg border border-line bg-surface px-3 py-2.5 text-left"
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <span className="block text-sm font-bold text-ink">筛选</span>
            <span className="mt-0.5 block truncate text-xs text-subtle">{filterSummary}</span>
          </button>

          <div className="relative md:hidden">
            <button
              className="focus-ring flex h-full min-h-12 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm font-semibold"
              type="button"
              onClick={() => setMobileMoreOpen((value) => !value)}
            >
              更多
            </button>
            {mobileMoreOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-line bg-panel p-2 shadow-soft">
                <MobileMenuButton icon={<FileDown size={15} />} label="导出 Excel" onClick={() => setMobileMoreOpen(false)} />
                <MobileMenuButton icon={<FileDown size={15} />} label="导出 PDF" onClick={() => setMobileMoreOpen(false)} />
                <MobileMenuButton icon={<Printer size={15} />} label="打印错题" onClick={() => setMobileMoreOpen(false)} />
              </div>
            ) : null}
          </div>
        </div>

        <div className={`${filtersOpen ? "grid" : "hidden md:grid"} mt-3 gap-2 md:grid-cols-4`}>
          <select className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-semibold" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="wrongCount">排序：错误次数</option>
            <option value="unit">排序：单元顺序</option>
            <option value="lastWrongAt">排序：最近错误</option>
            <option value="reason">排序：错因分类</option>
          </select>
          <select className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-semibold" value={unit} onChange={(event) => setUnit(event.target.value)}>
            <option value="">全部单元</option>
            {units.map((item) => (
              <option key={item} value={item}>
                {sectionUnitLabelFromKey(item)}
              </option>
            ))}
          </select>
          <select className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-semibold" value={pos} onChange={(event) => setPos(event.target.value)}>
            <option value="">全部词性</option>
            {posOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold">
            错误次数 ≥
            <input
              className="w-12 bg-transparent text-center outline-none"
              type="number"
              min={1}
              value={minWrong}
              onChange={(event) => setMinWrong(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
        </div>

        <div className="mt-3 hidden flex-wrap gap-2 md:flex">
          <Button variant="secondary">
            <FileDown size={16} />
            导出 Excel
          </Button>
          <Button variant="secondary">
            <Printer size={16} />
            打印错题
          </Button>
          <Button variant="secondary">
            <FileDown size={16} />
            导出 PDF
          </Button>
        </div>
      </section>

      {error ? <p className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">{error}</p> : null}
      {loading ? <p className="rounded-lg border border-line bg-panel px-4 py-3 text-sm text-subtle shadow-soft">正在加载错题词条...</p> : null}

      {!loading && filtered.length === 0 ? (
        <section className="rounded-lg border border-line bg-panel p-5 text-center shadow-soft">
          <h2 className="text-xl font-bold text-ink">暂无错题 🎉</h2>
          <p className="mt-2 text-sm leading-6 text-subtle">完成 Practice 或 Exam 后，答错的词会自动进入这里。</p>
          <ButtonLink href="/practice" className="mt-4">
            去 Practice
          </ButtonLink>
        </section>
      ) : (
        <section className="space-y-2.5">
          {filtered.map(({ mistake, record, word }) => (
            <MistakeCard
              key={word.id}
              word={word}
              record={record}
              mistake={mistake}
              openActionId={openActionId}
              onToggleActions={() => setOpenActionId((value) => (value === word.id ? null : word.id))}
              onCloseActions={() => setOpenActionId(null)}
              onAddTemp={() => addTempWord(word.id, "mistakes")}
              onMarkMastered={() => markMastered(word.id, word.word)}
              onRemove={() => removeMistake(word.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function MistakeCard({
  word,
  record,
  mistake,
  openActionId,
  onToggleActions,
  onCloseActions,
  onAddTemp,
  onMarkMastered,
  onRemove,
}: {
  word: WordEntry;
  record: WordProgress;
  mistake?: MistakeItem;
  openActionId: string | null;
  onToggleActions: () => void;
  onCloseActions: () => void;
  onAddTemp: () => void;
  onMarkMastered: () => void;
  onRemove: () => void;
}) {
  const displayWord = word.displayWord || word.word;
  const meaning = word.coreMeaning || word.choiceMeaning || "释义待校对";
  const accuracy = record.attempts ? record.correctCount / record.attempts : 0;
  const recent = record.lastPracticedAt ?? mistake?.lastWrongAt;
  const unitLabel = sectionUnitLabelFromKey(wordSectionUnitKey(word));
  const isActionOpen = openActionId === word.id;

  function confirmRemove() {
    if (window.confirm("确认从错题本移除这个词？历史答题记录会保留。")) {
      onRemove();
    }
    onCloseActions();
  }

  return (
    <article className="relative rounded-lg border border-line bg-panel p-3.5 shadow-soft transition hover:border-brand/50 md:p-4">
      <Link href={`/words/${word.id}`} className="block pr-9">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="word-font text-2xl font-bold leading-tight text-ink md:text-3xl">{displayWord}</h2>
          {word.phonetic ? <span className="text-sm text-subtle">{word.phonetic}</span> : null}
          {word.partOfSpeech ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-subtle">{word.partOfSpeech}</span> : null}
        </div>
        <p className="mt-1.5 text-base font-semibold leading-6 text-ink">{meaning}</p>
        <p className="mt-2 text-xs font-semibold leading-5 text-subtle">
          错误 {record.wrongCount} 次 · {unitLabel} · 正确率 {formatPercent(accuracy)}
        </p>
        {mistake?.reason ? <p className="mt-1 text-xs leading-5 text-subtle">原因：{mistake.reason}</p> : null}
        <p className="mt-1 text-xs leading-5 text-subtle">最近：{shortDateTime(recent)}</p>
      </Link>

      <div className="absolute right-2 top-2">
        <button className="focus-ring rounded-full p-2 text-subtle hover:bg-muted" type="button" aria-label="更多操作" onClick={onToggleActions}>
          <MoreHorizontal size={19} />
        </button>
        {isActionOpen ? (
          <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-line bg-panel p-2 text-sm shadow-soft">
            <ActionMenuButton label="加入临时测试" onClick={() => { onAddTemp(); onCloseActions(); }} />
            <ActionMenuButton label="标记已掌握" onClick={() => { onMarkMastered(); onCloseActions(); }} />
            <ActionMenuButton danger label="从错题本移除" onClick={confirmRemove} />
            <ActionMenuLink href={`/words/${word.id}`} label="查看详情" onClick={onCloseActions} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function MobileMenuButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-muted" type="button" onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function ActionMenuButton({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className={`w-full rounded-md px-3 py-2 text-left font-semibold hover:bg-muted ${danger ? "text-danger" : "text-ink"}`} type="button" onClick={onClick}>
      {label}
    </button>
  );
}

function ActionMenuLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return (
    <Link className="block w-full rounded-md px-3 py-2 text-left font-semibold text-ink hover:bg-muted" href={href} onClick={onClick}>
      {label}
    </Link>
  );
}
