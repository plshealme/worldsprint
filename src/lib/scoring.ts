import type { Answer, Question, QuestionType, TestMode, TestRecordSummary, TestReport } from "@/types/test";
import { calculateReportXp } from "./xp";
import { uid } from "./storage";
import { typeName } from "./utils";
import { sectionUnitLabelFromKey, wordSectionUnitKey } from "./words";

function accuracy(correct: number, total: number) {
  return total === 0 ? 0 : correct / total;
}

export function buildReport(
  mode: TestMode,
  title: string,
  questions: Question[],
  answers: Answer[],
  startedAt: number,
  submittedAt: number,
): TestReport {
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer]));
  const normalizedAnswers = questions.map((question) => {
    const answer = answerMap.get(question.id);
    return (
      answer ?? {
        questionId: question.id,
        wordId: question.wordId,
        selectedOptionId: undefined,
        isCorrect: false,
        answeredAt: new Date(submittedAt).toISOString(),
        elapsedMs: submittedAt - startedAt,
      }
    );
  });
  const correct = normalizedAnswers.filter((answer) => answer.isCorrect).length;
  const unanswered = normalizedAnswers.filter((answer) => !answer.selectedOptionId).length;
  const wrong = normalizedAnswers.length - correct - unanswered;
  const uniqueWordIds = new Set(questions.map((question) => question.wordId));
  const wordsCorrect = Array.from(uniqueWordIds).filter((wordId) => {
    const wordAnswers = normalizedAnswers.filter((answer) => answer.wordId === wordId && answer.selectedOptionId);
    return wordAnswers.length > 0 && wordAnswers.every((answer) => answer.isCorrect);
  }).length;

  const byType = groupAccuracy(questions, normalizedAnswers, (question) => question.type);
  const byUnit = groupAccuracy(questions, normalizedAnswers, (question) => wordSectionUnitKey(question.word));
  const weakTypes = byType
    .filter((item) => item.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3) as Array<{ type: QuestionType; accuracy: number; total: number }>;
  const weakUnits = byUnit
    .filter((item) => item.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3)
    .map((item) => ({ unit: sectionUnitLabelFromKey(item.type), accuracy: item.accuracy, total: item.total }));

  const reportWithoutXp: Omit<TestReport, "xpDelta"> = {
    id: uid("report"),
    mode,
    title,
    score: Math.round(accuracy(correct, questions.length) * 100),
    questionAccuracy: accuracy(correct, questions.length),
    wordAccuracy: accuracy(wordsCorrect, uniqueWordIds.size),
    durationMs: submittedAt - startedAt,
    unanswered,
    total: questions.length,
    correct,
    wrong,
    answers: normalizedAnswers,
    questions,
    createdAt: new Date(submittedAt).toISOString(),
    weakTypes,
    weakUnits,
    suggestions: buildSuggestions(weakTypes, weakUnits, wrong, unanswered),
  };

  return {
    ...reportWithoutXp,
    xpDelta: calculateReportXp(reportWithoutXp as TestReport),
  };
}

function groupAccuracy<T extends string>(
  questions: Question[],
  answers: Answer[],
  getKey: (question: Question) => T,
) {
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer]));
  const groups = new Map<T, { correct: number; total: number }>();
  for (const question of questions) {
    const key = getKey(question);
    const group = groups.get(key) ?? { correct: 0, total: 0 };
    group.total += 1;
    if (answerMap.get(question.id)?.isCorrect) {
      group.correct += 1;
    }
    groups.set(key, group);
  }
  return Array.from(groups.entries()).map(([type, stat]) => ({
    type,
    accuracy: accuracy(stat.correct, stat.total),
    total: stat.total,
  }));
}

function buildSuggestions(
  weakTypes: Array<{ type: QuestionType; accuracy: number; total: number }>,
  weakUnits: Array<{ unit: string; accuracy: number; total: number }>,
  wrong: number,
  unanswered: number,
) {
  const suggestions: string[] = [];
  const weakestType = weakTypes[0];
  const weakestUnit = weakUnits[0];
  if (weakestType && weakestType.accuracy < 0.75) {
    suggestions.push(`${typeName(weakestType.type)}正确率较低，建议先重练本次错误词，再把该题型比例提高 10%。`);
  }
  if (weakestUnit && weakestUnit.accuracy < 0.75) {
    suggestions.push(`${weakestUnit.unit} 的命中率偏低，建议按单元浏览后做 10 题 Practice。`);
  }
  if (wrong >= 3) {
    suggestions.push(`本次有 ${wrong} 道错题，优先重练错误次数 >= 2 的词，连续答对后再移出错题本。`);
  }
  if (unanswered > 0) {
    suggestions.push(`还有 ${unanswered} 道未作答，Exam 下次可以先完成确定题，再回到犹豫题。`);
  }
  if (suggestions.length === 0) {
    suggestions.push("本次表现稳定，建议切换到未掌握优先或低正确率优先，扩大薄弱词覆盖面。");
  }
  return suggestions;
}

export function toRecordSummary(report: TestReport): TestRecordSummary {
  return {
    id: report.id,
    mode: report.mode,
    title: report.title,
    score: report.score,
    questionAccuracy: report.questionAccuracy,
    wordAccuracy: report.wordAccuracy,
    durationMs: report.durationMs,
    unanswered: report.unanswered,
    total: report.total,
    createdAt: report.createdAt,
    weakTypes: report.weakTypes,
  };
}
