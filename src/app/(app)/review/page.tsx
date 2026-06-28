"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Heart, Plus, Search, Star, Tag, XCircle } from "lucide-react";
import { Button, ButtonLink } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import { ReviewCard } from "@/components/review/ReviewCard";
import { perfLog } from "@/lib/perfLog";
import { sectionUnitLabelFromKey, wordSectionUnitKey } from "@/lib/sectionUnit";
import { useWords } from "@/lib/useWords";
import { formatPercent, masteryName } from "@/lib/utils";
import { OFFICIAL_CLEAN_WORD_COUNT } from "@/lib/vocab";
import type { MasteryStatus, WordEntry } from "@/types/word";

const pageSize = 10000;
type ReviewView = "due" | "list" | "cards" | "units";

const viewOptions: Array<{ value: ReviewView; label: string }> = [
  { value: "due", label: "到期复习" },
  { value: "list", label: "单词列表" },
  { value: "cards", label: "卡片复习" },
  { value: "units", label: "按单元" },
];

export default function ReviewPage() {
  const { progress, getProgress, toggleFavorite, addTempWord, tempList } = useAppState();
  const [view, setView] = useState<ReviewView>("due");
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState("");
  const [mastery, setMastery] = useState<"" | MasteryStatus>("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    perfLog("Review page mounted");
  }, []);

  const dueIds = useMemo(() => {
    const now = Date.now();
    return Object.values(progress)
      .filter((item) => item.nextReviewAt && new Date(item.nextReviewAt).getTime() <= now)
      .map((item) => item.wordId);
  }, [progress]);
  const wordQuery =
    view === "due"
      ? { ids: dueIds.length ? dueIds : ["__none__"], pageSize: Math.max(dueIds.length, 1), q: query }
      : { page, pageSize, unit, q: query, all: !unit };
  const { words, units, loading, error } = useWords(wordQuery);

  useEffect(() => {
    setPage(1);
  }, [favoriteOnly, mastery, query, unit, view]);

  const dueWords = useMemo(() => {
    if (view === "due") {
      return words;
    }
    const now = Date.now();
    return words.filter((word) => {
      const nextReviewAt = getProgress(word.id).nextReviewAt;
      return nextReviewAt ? new Date(nextReviewAt).getTime() <= now : false;
    });
  }, [getProgress, view, words]);

  const browseFiltered = useMemo(
    () => filterWords(words, { query, unit, mastery, favoriteOnly, getProgress }),
    [favoriteOnly, getProgress, mastery, query, unit, words],
  );

  const dueFiltered = useMemo(
    () => filterWords(dueWords, { query, unit, mastery, favoriteOnly, getProgress }),
    [dueWords, favoriteOnly, getProgress, mastery, query, unit],
  );

  const activeWords = view === "due" ? dueFiltered : browseFiltered;
  const unitCards = useMemo(() => buildUnitCards(words, units, getProgress), [getProgress, units, words]);

  return (
    <div className="space-y-5 pb-24 md:space-y-6 md:pb-0">
      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand">今日复习</p>
            <h1 className="mt-1 text-3xl font-bold">{dueWords.length} 个待复习词</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-subtle">
              完成 Practice 后，系统会根据答题结果安排下一次复习。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:min-w-64">
            <TopMetric label="词库" value={OFFICIAL_CLEAN_WORD_COUNT} />
            <TopMetric label="收藏" value={words.filter((word) => getProgress(word.id).isFavorite).length} />
            {tempList.length > 0 ? (
              <ButtonLink href="/temp-list" variant="secondary" className="col-span-2 min-h-10">
                临测 {tempList.length}
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-2 shadow-soft">
        <div className="grid grid-cols-4 gap-1">
          {viewOptions.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`focus-ring min-h-11 rounded-lg px-2 text-sm font-semibold ${
                view === item.value ? "bg-brand text-white" : "text-subtle hover:bg-muted hover:text-ink"
              }`}
              onClick={() => setView(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {view === "due" && !loading && dueWords.length === 0 ? (
        <section className="rounded-lg border border-line bg-panel p-5 text-center shadow-soft">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-positive/10 text-positive">
            <CheckCircle2 size={24} />
          </div>
          <h2 className="mt-3 text-xl font-bold">暂无到期复习词</h2>
          <p className="mt-2 text-sm leading-6 text-subtle">先去练一组新词，系统会帮你安排下次复习。</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <ButtonLink href="/practice">去练习</ButtonLink>
            <Button variant="secondary" onClick={() => setView("list")}>
              浏览词库
            </Button>
          </div>
        </section>
      ) : null}

      {view !== "due" || dueWords.length > 0 ? (
        <section className="rounded-lg border border-line bg-panel p-4 shadow-soft">
          <label className="flex min-h-12 items-center gap-2 rounded-lg border border-line bg-surface px-3">
            <Search size={18} className="text-subtle" />
            <input
              className="w-full bg-transparent outline-none"
              placeholder="搜索英文、中文或备注"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <select
              className="min-h-10 shrink-0 rounded-full border border-line bg-surface px-3 text-sm font-semibold outline-none"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            >
              <option value="">全部单元</option>
              {units.map((item) => (
                <option key={item} value={item}>
                  {compactUnitLabel(item)}
                </option>
              ))}
            </select>
            <select
              className="min-h-10 shrink-0 rounded-full border border-line bg-surface px-3 text-sm font-semibold outline-none"
              value={mastery}
              onChange={(event) => setMastery(event.target.value as "" | MasteryStatus)}
            >
              <option value="">全部状态</option>
              <option value="unlearned">未学</option>
              <option value="known">认识</option>
              <option value="vague">模糊</option>
              <option value="unknown">不认识</option>
              <option value="mastered">已掌握</option>
            </select>
            <button
              type="button"
              className={`focus-ring flex min-h-10 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-semibold ${
                favoriteOnly ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:border-brand"
              }`}
              onClick={() => setFavoriteOnly((value) => !value)}
            >
              <Heart size={15} className={favoriteOnly ? "fill-current" : ""} />
              只看收藏
            </button>
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">{error}</p> : null}
      {loading ? (
        <section className="rounded-lg border border-line bg-panel p-5 text-sm text-subtle shadow-soft">正在读取词库...</section>
      ) : null}

      {!loading && view === "due" && dueWords.length > 0 && activeWords.length === 0 ? (
        <CompactEmpty title="当前筛选没有到期词" text="换一个 Unit、关键词或筛选条件再试。" />
      ) : null}

      {!loading && view === "cards" && activeWords.length > 0 ? <ReviewCard words={activeWords} /> : null}

      {!loading && view === "units" ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {unitCards.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setUnit(item.key);
                setView("list");
              }}
              className={`rounded-lg border bg-panel p-4 text-left shadow-soft hover:border-brand ${
                unit === item.key ? "border-brand ring-1 ring-brand/20" : "border-line"
              }`}
            >
              <BookOpen className="text-brand" size={20} />
              <h3 className="mt-3 font-bold">{compactUnitLabel(item.key)}</h3>
              <p className="mt-1 text-xs leading-5 text-subtle">
                {item.total}词 · 已练{item.studied}
              </p>
              <p className="mt-1 text-xs text-subtle">正确率{formatPercent(item.accuracy)}</p>
            </button>
          ))}
        </section>
      ) : null}

      {!loading && (view === "list" || view === "due") && activeWords.length > 0 ? (
        <section className="space-y-3">
          {activeWords.map((word) => (
            <WordListItem key={word.id} word={word} toggleFavorite={toggleFavorite} addTempWord={addTempWord} />
          ))}
        </section>
      ) : null}

      {!loading && view !== "due" && activeWords.length === 0 ? (
        <CompactEmpty title="没有匹配的单词" text="换一个关键词、Unit 或筛选条件再试。" />
      ) : null}
    </div>
  );
}

function filterWords(
  source: WordEntry[],
  {
    query,
    unit,
    mastery,
    favoriteOnly,
    getProgress,
  }: {
    query: string;
    unit: string;
    mastery: "" | MasteryStatus;
    favoriteOnly: boolean;
    getProgress: ReturnType<typeof useAppState>["getProgress"];
  },
) {
  const normalized = query.trim().toLowerCase();
  return source.filter((word) => {
    const progress = getProgress(word.id);
    const matchesQuery =
      !normalized ||
      word.word.toLowerCase().includes(normalized) ||
      word.coreMeaning.includes(query) ||
      word.choiceMeaning?.includes(query) ||
      word.fullMeanings?.includes(query) ||
      progress.note.includes(query);
    const matchesUnit = !unit || wordSectionUnitKey(word) === unit;
    const matchesMastery = !mastery || progress.masteryLevel === mastery;
    const matchesFavorite = !favoriteOnly || progress.isFavorite;
    return matchesQuery && matchesUnit && matchesMastery && matchesFavorite;
  });
}

function buildUnitCards(words: WordEntry[], units: string[], getProgress: ReturnType<typeof useAppState>["getProgress"]) {
  return units.map((key) => {
    const unitWords = words.filter((word) => wordSectionUnitKey(word) === key);
    const studied = unitWords.filter((word) => getProgress(word.id).attempts > 0).length;
    const attempts = unitWords.reduce((sum, word) => sum + getProgress(word.id).attempts, 0);
    const correct = unitWords.reduce((sum, word) => sum + getProgress(word.id).correctCount, 0);
    return {
      key,
      total: unitWords.length,
      studied,
      accuracy: attempts ? correct / attempts : 0,
    };
  });
}

function WordListItem({
  word,
  toggleFavorite,
  addTempWord,
}: {
  word: WordEntry;
  toggleFavorite: ReturnType<typeof useAppState>["toggleFavorite"];
  addTempWord: ReturnType<typeof useAppState>["addTempWord"];
}) {
  const { getProgress } = useAppState();
  const progress = getProgress(word.id);
  const isDue = progress.nextReviewAt ? new Date(progress.nextReviewAt).getTime() <= Date.now() : false;
  const meaning = word.choiceMeaning || word.coreMeaning;

  return (
    <article className="rounded-lg border border-line bg-panel p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/words/${word.id}`} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="word-font text-3xl font-bold">{word.word}</h2>
            {word.phonetic ? <span className="text-sm text-subtle">{word.phonetic}</span> : null}
            {word.partOfSpeech ? <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-subtle">{word.partOfSpeech}</span> : null}
          </div>
          <p className="mt-2 text-base font-semibold">{meaning}</p>
        </Link>
        <button
          type="button"
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-subtle"
          onClick={() => toggleFavorite(word.id, word.word)}
          aria-label="收藏"
        >
          <Heart size={17} className={progress.isFavorite ? "fill-current text-danger" : ""} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {progress.attempts > 0 ? <StatusChip icon={CheckCircle2} label="已练" tone="positive" /> : null}
        {progress.isMistake || progress.wrongCount > 0 ? <StatusChip icon={XCircle} label="错题" tone="danger" /> : null}
        {progress.isFavorite ? <StatusChip icon={Star} label="收藏" tone="brand" /> : null}
        {isDue ? <StatusChip icon={BookOpen} label="待复习" tone="brand" /> : null}
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-subtle">{masteryName(progress.masteryLevel)}</span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-subtle">{word.unit ?? "未分单元"}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-subtle">
          正确率 {formatPercent(progress.attempts ? progress.correctCount / progress.attempts : 0)} · 错题 {progress.wrongCount}
        </p>
        <Button variant="secondary" className="min-h-10 px-3 text-xs" onClick={() => addTempWord(word.id, "review")}>
          <Plus size={15} />
          加入测试
        </Button>
      </div>
    </article>
  );
}

function StatusChip({ icon: Icon, label, tone }: { icon: typeof Tag; label: string; tone: "positive" | "danger" | "brand" }) {
  const color = tone === "positive" ? "text-positive bg-positive/10" : tone === "danger" ? "text-danger bg-danger/10" : "text-brand bg-brand/10";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
      <Icon size={13} />
      {label}
    </span>
  );
}

function TopMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function CompactEmpty({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-5 text-center shadow-soft">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-subtle">{text}</p>
    </section>
  );
}

function compactUnitLabel(unitKey: string) {
  const label = sectionUnitLabelFromKey(unitKey);
  const match = /Unit\s*(\d+)/i.exec(label);
  return match ? `Unit ${match[1]}` : label;
}
