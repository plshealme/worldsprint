import redbookWordsJson from "../../data/redbook_words.json";
import type { MistakeItem } from "@/types/mistake";
import type { TestRecordSummary } from "@/types/test";
import type { WordProgress } from "@/types/word";
import { sectionUnitKey, sectionUnitLabelFromKey } from "./words";
import { VOCAB_VERSION } from "./vocab";

interface RedbookStatsWord {
  sourceId?: number;
  source_id?: number;
  appOrder?: number;
  section: string;
  unit: number | null;
}

const redbookWords = redbookWordsJson as RedbookStatsWord[];
export const OFFICIAL_WORD_COUNT = redbookWords.length;
export const OFFICIAL_VOCAB_VERSION = VOCAB_VERSION;

export function computeLearningStats(
  progress: Record<string, WordProgress>,
  mistakes: MistakeItem[],
  records: TestRecordSummary[],
) {
  const now = Date.now();
  const progressItems = Object.values(progress);
  const attempts = progressItems.reduce((sum, item) => sum + (item.attempts ?? 0), 0);
  const correct = progressItems.reduce((sum, item) => sum + (item.correctCount ?? item.correct ?? 0), 0);
  const mastered = progressItems.filter((item) => {
    const mastery = item.masteryLevel ?? item.mastery;
    return mastery === "mastered" || mastery === "known";
  }).length;
  const activeMistakeWordIds = new Set([
    ...progressItems.filter((item) => item.isMistake).map((item) => item.wordId),
    ...mistakes.filter((item) => item.active).map((item) => item.wordId),
  ]);
  const dueReview = progressItems.filter((item) => item.nextReviewAt && new Date(item.nextReviewAt).getTime() <= now);
  const lastExam = records.find((record) => record.mode === "exam");
  const lastRecord = records[0];
  const bestExam = records.filter((record) => record.mode === "exam").sort((a, b) => b.score - a.score)[0];
  const studiedWords = new Set(
    progressItems
      .filter((item) => (item.attempts ?? 0) > 0 || (item.masteryLevel ?? item.mastery) !== "unlearned")
      .map((item) => item.wordId),
  );

  return {
    attempts,
    correct,
    totalAccuracy: attempts === 0 ? 0 : correct / attempts,
    activeMistakes: activeMistakeWordIds.size,
    dueReview: dueReview.length,
    mastered,
    totalWords: OFFICIAL_WORD_COUNT,
    studiedWords: studiedWords.size,
    lastExam,
    lastRecord,
    bestExam,
  };
}

export function unitStats(progress: Record<string, WordProgress>, mistakes: MistakeItem[]) {
  const activeMistakes = new Set(mistakes.filter((item) => item.active).map((item) => item.wordId));
  const units = new Map<string, { section: string; unit: string; total: number; mastered: number; attempts: number; correct: number; mistakes: number }>();

  for (const word of redbookWords) {
    const sourceId = word.sourceId ?? word.source_id ?? word.appOrder;
    if (!sourceId) continue;
    const wordId = `redbook-${sourceId}`;
    const unitLabel = typeof word.unit === "number" ? `Unit ${word.unit}` : "未分单元";
    const key = sectionUnitKey(word.section, unitLabel);
    const item = units.get(key) ?? {
      section: word.section || "未分 section",
      unit: sectionUnitLabelFromKey(key),
      total: 0,
      mastered: 0,
      attempts: 0,
      correct: 0,
      mistakes: 0,
    };
    const wordProgress = progress[wordId];
    const mastery = wordProgress?.masteryLevel ?? wordProgress?.mastery;

    item.total += 1;
    if (mastery === "mastered" || mastery === "known") {
      item.mastered += 1;
    }
    item.attempts += wordProgress?.attempts ?? 0;
    item.correct += wordProgress?.correctCount ?? wordProgress?.correct ?? 0;
    item.mistakes += wordProgress?.isMistake || activeMistakes.has(wordId) ? 1 : 0;
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
