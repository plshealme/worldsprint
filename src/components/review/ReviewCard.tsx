"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Heart, Info, Plus } from "lucide-react";
import { Button } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import { cn, masteryName } from "@/lib/utils";
import type { WordEntry } from "@/types/word";

export function ReviewCard({ words }: { words: WordEntry[] }) {
  const { getProgress, setMastery, toggleFavorite, addTempWord } = useAppState();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const current = words[index];
  const progress = current ? getProgress(current.id) : null;

  const summary = useMemo(() => {
    const known = words.filter((word) => getProgress(word.id).masteryLevel === "known" || getProgress(word.id).masteryLevel === "mastered").length;
    const vague = words.filter((word) => getProgress(word.id).masteryLevel === "vague").length;
    const unknown = words.filter((word) => getProgress(word.id).masteryLevel === "unknown").length;
    return { known, vague, unknown };
  }, [getProgress, words]);

  if (!current || !progress) {
    return <div className="rounded-lg border border-line bg-panel p-5 text-sm text-subtle">当前筛选范围没有单词。</div>;
  }

  const displayWord = current.displayWord || current.word;
  const primaryMeaning = current.coreMeaning || current.choiceMeaning;
  const wordMeta = [current.phonetic, current.partOfSpeech].filter(Boolean).join(" · ");

  function move(delta: number) {
    setFlipped(false);
    setIndex((value) => Math.min(words.length - 1, Math.max(0, value + delta)));
  }

  function mark(mastery: "known" | "vague" | "unknown") {
    setMastery(current.id, mastery, current.word);
    if (mastery === "known") {
      move(1);
    } else {
      setFlipped(true);
    }
  }

  function onTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      move(dx > 0 ? -1 : 1);
    } else if (dy < -45) {
      mark("known");
    } else if (dy > 45) {
      mark("unknown");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="认识" value={summary.known} />
        <MiniStat label="模糊" value={summary.vague} />
        <MiniStat label="不认识" value={summary.unknown} />
      </div>

      <div
        className="min-h-[360px] cursor-pointer rounded-lg border border-line bg-panel p-5 shadow-soft transition hover:border-brand md:min-h-[420px] md:p-6"
        onClick={() => setFlipped((value) => !value)}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-subtle">
            {index + 1} / {words.length}
          </span>
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">{masteryName(progress.masteryLevel)}</span>
        </div>

        {!flipped ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center text-center md:min-h-[300px]">
            <p className="word-font text-5xl font-bold md:text-6xl">{displayWord}</p>
            {current.phonetic ? <p className="mt-4 text-lg text-subtle">{current.phonetic}</p> : null}
            {current.partOfSpeech ? <p className="mt-2 text-sm font-semibold text-subtle">{current.partOfSpeech}</p> : null}
            <p className="mt-6 text-xs text-subtle">点击卡片查看释义</p>
          </div>
        ) : (
          <div className="space-y-5 py-4">
            <div className="rounded-lg bg-surface p-4">
              <p className="word-font text-4xl font-bold md:text-5xl">{displayWord}</p>
              {wordMeta ? <p className="mt-3 text-sm font-semibold text-subtle">{wordMeta}</p> : null}
            </div>

            {primaryMeaning ? (
              <div>
                <p className="text-sm font-semibold text-subtle">核心释义</p>
                <p className="mt-1 text-2xl font-bold">{primaryMeaning}</p>
              </div>
            ) : null}

            {current.fullMeanings ? <InfoBlock title="完整释义" text={current.fullMeanings} /> : null}
            {current.example ? <InfoBlock title="例句" text={current.example} /> : null}
            {current.collocation ? <InfoBlock title="搭配" text={current.collocation} /> : null}
            {progress.note ? <InfoBlock title="个人备注" text={progress.note} /> : null}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-center">
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Button variant="secondary" onClick={() => move(-1)} disabled={index === 0}>
            <ChevronLeft size={18} />
          </Button>
          <Button variant="secondary" onClick={() => move(1)} disabled={index === words.length - 1}>
            <ChevronRight size={18} />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="success" onClick={() => mark("known")}>
            <Eye size={17} />
            认识
          </Button>
          <Button variant="secondary" onClick={() => mark("vague")}>
            模糊
          </Button>
          <Button variant="danger" onClick={() => mark("unknown")}>
            <EyeOff size={17} />
            不认识
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2 md:flex">
          <Button variant="secondary" onClick={() => toggleFavorite(current.id, current.word)}>
            <Heart size={17} className={cn(progress.isFavorite && "fill-current text-danger")} />
          </Button>
          <Button variant="secondary" onClick={() => addTempWord(current.id, "review")}>
            <Plus size={17} />
          </Button>
          <Link
            href={`/words/${current.id}`}
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-muted px-4 font-semibold"
          >
            <Info size={17} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-subtle">{title}</p>
      <p className="mt-1 whitespace-pre-wrap leading-7">{text}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
