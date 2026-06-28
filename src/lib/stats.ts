import type { MistakeItem } from "@/types/mistake";
import type { TestRecordSummary } from "@/types/test";
import type { WordProgress } from "@/types/word";
import { OFFICIAL_CLEAN_WORD_COUNT, VOCAB_VERSION } from "./vocab";

export const OFFICIAL_WORD_COUNT = OFFICIAL_CLEAN_WORD_COUNT;
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
