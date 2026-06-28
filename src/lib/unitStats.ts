"use client";

import { getLocalWordsResult } from "@/lib/localWordsClient";
import { wordSectionUnitKey } from "@/lib/sectionUnit";
import { OFFICIAL_CLEAN_WORD_COUNT } from "@/lib/vocab";
import type { MistakeItem } from "@/types/mistake";
import type { WordProgress } from "@/types/word";

export interface UnitStatsRow {
  key: string;
  section: string;
  unit: string;
  total: number;
  mastered: number;
  attempts: number;
  correct: number;
  mistakes: number;
  accuracy: number;
}

export async function unitStats(progress: Record<string, WordProgress>, mistakes: MistakeItem[]): Promise<UnitStatsRow[]> {
  const activeMistakes = new Set(mistakes.filter((item) => item.active).map((item) => item.wordId));
  const { words } = await getLocalWordsResult({ pageSize: OFFICIAL_CLEAN_WORD_COUNT });
  const units = new Map<string, Omit<UnitStatsRow, "key" | "accuracy">>();

  for (const word of words) {
    const key = wordSectionUnitKey(word);
    const item = units.get(key) ?? {
      section: word.section || "未分 section",
      unit: `${word.section || "未分 section"} ${word.unit || "未分单元"}`.trim(),
      total: 0,
      mastered: 0,
      attempts: 0,
      correct: 0,
      mistakes: 0,
    };
    const wordProgress = progress[word.id];
    const mastery = wordProgress?.masteryLevel ?? wordProgress?.mastery;

    item.total += 1;
    if (mastery === "mastered" || mastery === "known") {
      item.mastered += 1;
    }
    item.attempts += wordProgress?.attempts ?? 0;
    item.correct += wordProgress?.correctCount ?? wordProgress?.correct ?? 0;
    item.mistakes += wordProgress?.isMistake || activeMistakes.has(word.id) ? 1 : 0;
    units.set(key, item);
  }

  return Array.from(units.entries())
    .map(([key, item]) => ({
      key,
      ...item,
      accuracy: item.attempts === 0 ? 0 : item.correct / item.attempts,
    }))
    .sort((a, b) => a.section.localeCompare(b.section, "zh-CN") || a.unit.localeCompare(b.unit, "zh-CN", { numeric: true }));
}
