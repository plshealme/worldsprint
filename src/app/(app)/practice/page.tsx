"use client";

import { useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { TestReportView, type PracticeRoundSummary } from "@/components/test/TestReportView";
import { TestRunner } from "@/components/test/TestRunner";
import { TestSetupWizard } from "@/components/test/TestSetupWizard";
import { useAppState } from "@/components/providers/AppStateProvider";
import { buildReport } from "@/lib/scoring";
import type { Question, TestReport, TestSetup } from "@/types/test";
import type { WordProgress } from "@/types/word";

export default function PracticePage() {
  const { applyReport, progress, recordAnswerResult } = useAppState();
  const [setup, setSetup] = useState<TestSetup | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [report, setReport] = useState<TestReport | null>(null);
  const [practiceSummary, setPracticeSummary] = useState<PracticeRoundSummary | null>(null);
  const [startProgress, setStartProgress] = useState<Record<string, WordProgress>>({});

  if (report) {
    return <TestReportView report={report} practiceSummary={practiceSummary} onRestart={() => setReport(null)} />;
  }

  if (questions.length > 0 && setup) {
    return (
      <TestRunner
        mode="practice"
        questions={questions}
        onCancel={() => {
          setQuestions([]);
          setSetup(null);
        }}
        onAnswer={(question, answer) => recordAnswerResult(question, answer, "practice", setup.includeMistakesProgress)}
        onFinish={(answers, startedAt, submittedAt, finalQuestions) => {
          const nextReport = buildReport("practice", "Practice 练习记录", finalQuestions, answers, startedAt, submittedAt);
          applyReport(nextReport, setup.includeMistakesProgress, { skipLearningRecords: true });
          setPracticeSummary(buildPracticeSummary(finalQuestions, answers, startProgress));
          setReport(nextReport);
          setQuestions([]);
        }}
      />
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <p className="text-sm font-semibold text-brand">Practice</p>
        <h1 className="mt-1 text-2xl font-bold">快速开始练习</h1>
        <p className="mt-2 text-sm text-subtle md:hidden">即时反馈 · 答错自动加入错题本</p>
        <p className="mt-2 hidden max-w-3xl text-sm leading-6 text-subtle md:block">
          答题后立即显示正确答案和简短解释，答错会进入错题进度。练习记录只进入 Practice Records，不计入正式成绩趋势。
        </p>
      </section>
      <TestSetupWizard
        mode="practice"
        onStart={(nextSetup, generation) => {
          if (generation.questions.length === 0) {
            return;
          }
          setSetup(nextSetup);
          setStartProgress(progress);
          setPracticeSummary(null);
          setQuestions(generation.questions);
        }}
      />
      {questions.length === 0 ? null : <EmptyState title="准备中" description="正在生成题目。" />}
    </div>
  );
}

function buildPracticeSummary(questions: Question[], answers: TestReport["answers"], startProgress: Record<string, WordProgress>): PracticeRoundSummary {
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer]));
  const answered = questions.map((question) => ({ question, answer: answerMap.get(question.id) })).filter((item) => item.answer?.selectedOptionId);
  const correct = answered.filter((item) => item.answer?.isCorrect).length;
  const wrong = answered.length - correct;
  const wrongWordIds = new Set(answered.filter((item) => !item.answer?.isCorrect).map((item) => item.question.wordId));
  const improvedWordIds = new Set(
    answered
      .filter((item) => item.answer?.isCorrect)
      .filter((item) => {
        const before = startProgress[item.question.wordId]?.masteryLevel ?? startProgress[item.question.wordId]?.mastery ?? "unlearned";
        return before === "unlearned" || before === "unknown" || before === "vague";
      })
      .map((item) => item.question.wordId),
  );
  return {
    total: questions.length,
    correct,
    wrong,
    accuracy: answered.length ? correct / answered.length : 0,
    newMistakes: Array.from(wrongWordIds).filter((wordId) => !startProgress[wordId]?.isMistake).length,
    masteryImproved: improvedWordIds.size,
  };
}
