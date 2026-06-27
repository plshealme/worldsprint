import type { MistakeItem, MistakeReason } from "@/types/mistake";
import type { Answer, Question, TestMode } from "@/types/test";

export function inferMistakeReason(question: Question, selectedOptionId?: string): MistakeReason {
  if (!selectedOptionId) {
    return "完全不认识";
  }
  if (question.type === "similar") {
    return "形近词混淆";
  }
  if (question.type === "synonym") {
    return "意近词混淆";
  }
  if (question.type === "familiar") {
    return "熟词僻义没掌握";
  }
  if (question.word.partOfSpeech && question.options.some((option) => option.label.includes(question.word.partOfSpeech ?? ""))) {
    return "词性混淆";
  }
  return "中文意思混淆";
}

export function applyMistakeUpdates(
  mistakes: MistakeItem[],
  questions: Question[],
  answers: Answer[],
  mode: TestMode,
  autoRemoveStreak: 2 | 3 | 5,
  includeProgress: boolean,
) {
  if (!includeProgress) {
    return mistakes;
  }

  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const next = [...mistakes];

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    if (!question) {
      continue;
    }
    const index = next.findIndex((item) => item.wordId === answer.wordId);
    const existing = index >= 0 ? next[index] : undefined;

    if (!answer.selectedOptionId) {
      continue;
    }

    if (!answer.isCorrect) {
      const item: MistakeItem = {
        wordId: answer.wordId,
        wrongCount: (existing?.wrongCount ?? 0) + 1,
        correctStreak: 0,
        lastWrongAt: answer.answeredAt,
        reason: inferMistakeReason(question, answer.selectedOptionId),
        source: mode,
        active: true,
      };
      if (index >= 0) {
        next[index] = item;
      } else {
        next.push(item);
      }
      continue;
    }

    if (existing?.active) {
      const streak = existing.correctStreak + 1;
      next[index] = {
        ...existing,
        correctStreak: streak,
        active: streak < autoRemoveStreak,
      };
    }
  }

  return next;
}
