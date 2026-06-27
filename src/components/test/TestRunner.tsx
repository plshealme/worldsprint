"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Flag, Pause, Send, XCircle } from "lucide-react";
import { Button } from "@/components/common/Button";
import { cn, formatDuration, typeName } from "@/lib/utils";
import type { Answer, Question, QuestionOption, TestMode } from "@/types/test";

export function TestRunner({
  mode,
  questions,
  onFinish,
  onCancel,
  onAnswer,
  contextTitle,
  contextDescription,
  cancelLabel,
  showCancelInHeader = false,
}: {
  mode: TestMode;
  questions: Question[];
  onFinish: (answers: Answer[], startedAt: number, submittedAt: number, finalQuestions: Question[]) => void;
  onCancel: () => void;
  onAnswer?: (question: Question, answer: Answer) => void;
  contextTitle?: string;
  contextDescription?: string;
  cancelLabel?: string;
  showCancelInHeader?: boolean;
}) {
  const [roundQuestions, setRoundQuestions] = useState<Question[]>(questions);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = roundQuestions[index];
  const currentAnswer = current ? answers[current.id] : undefined;
  const streak = useMemo(() => {
    let count = 0;
    for (const answer of Object.values(answers).reverse()) {
      if (!answer.isCorrect) break;
      count += 1;
    }
    return count;
  }, [answers]);

  useEffect(() => {
    setRoundQuestions(questions);
    setIndex(0);
    setAnswers({});
  }, [questions]);

  useEffect(() => {
    if (paused) {
      return undefined;
    }
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [paused, startedAt]);

  function answer(optionId: string) {
    if (!current || (mode === "practice" && currentAnswer)) {
      return;
    }
    const selectedOption = current.options.find((option) => option.id === optionId);
    const isCorrect = selectedOption?.isCorrect ?? false;
    const nextAnswer: Answer = {
      questionId: current.id,
      wordId: current.wordId,
      selectedOptionId: optionId,
      isCorrect,
      answeredAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
    };
    logQuestionDebug(current, selectedOption, isCorrect);
    setAnswers((value) => ({ ...value, [current.id]: nextAnswer }));
    onAnswer?.(current, nextAnswer);
    if (mode === "exam" && index < roundQuestions.length - 1) {
      window.setTimeout(() => setIndex((currentIndex) => currentIndex + 1), 120);
    }
  }

  function submit() {
    const unanswered = roundQuestions.length - Object.keys(answers).length;
    if (mode === "exam" && unanswered > 0 && !window.confirm(`还有 ${unanswered} 题未作答，确认交卷吗？`)) {
      return;
    }
    onFinish(Object.values(answers), startedAt, Date.now(), roundQuestions);
  }

  function goNext() {
    if (index < roundQuestions.length - 1) {
      setIndex((value) => Math.min(roundQuestions.length - 1, value + 1));
      return;
    }
    submit();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) {
        return;
      }
      if (event.key >= "1" && event.key <= "4" && current && !currentAnswer) {
        const option = current.options[Number(event.key) - 1];
        if (option) {
          event.preventDefault();
          answer(option.id);
        }
        return;
      }
      if (event.key === "Enter" && currentAnswer) {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!current) {
    return null;
  }

  const targetCount = roundQuestions.length;
  const progress = ((index + 1) / targetCount) * 100;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-line bg-panel p-4 shadow-soft">
        {contextTitle ? (
          <div className="mb-4 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-brand">{contextTitle}</p>
              {mode === "exam" ? <p className="mt-1 font-bold text-ink">第 {index + 1} 题 / 共 {targetCount} 题</p> : null}
              {contextDescription ? <p className="mt-1 text-sm text-subtle">{contextDescription}</p> : null}
            </div>
            {showCancelInHeader ? (
              <Button variant="secondary" onClick={onCancel}>
                <XCircle size={17} />
                {cancelLabel ?? "退出"}
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm font-semibold text-subtle">
            <span>
              {index + 1} / {targetCount}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={16} />
              {formatDuration(elapsed)}
            </span>
            <span className="flex items-center gap-1">
              <Flag size={16} />
              连击 {streak}
            </span>
          </div>
          <div className="flex gap-2">
            {mode === "practice" ? (
              <Button variant="secondary" onClick={() => setPaused((value) => !value)}>
                <Pause size={17} />
                {paused ? "继续" : "暂停"}
              </Button>
            ) : null}
            <Button variant={mode === "exam" ? "primary" : "secondary"} onClick={submit}>
              <Send size={17} />
              {mode === "exam" ? "交卷" : "结束"}
            </Button>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {paused ? (
        <div className="rounded-lg border border-line bg-panel p-8 text-center shadow-soft">
          <h2 className="text-2xl font-bold">练习已暂停</h2>
          <p className="mt-2 text-sm text-subtle">进度会保留在当前页面。继续后接着答。</p>
          <Button className="mt-5" onClick={() => setPaused(false)}>
            继续练习
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[0.96fr_1.04fr]">
          <section className="rounded-lg border border-line bg-panel p-6 shadow-soft">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">{typeName(current.type)}</span>
              {(current.partOfSpeech ?? current.word.partOfSpeech) && (mode === "practice" || current.type !== "enToZh") ? (
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-subtle">{current.partOfSpeech ?? current.word.partOfSpeech}</span>
              ) : null}
              {(current.phonetic ?? current.word.phonetic) && mode === "practice" ? (
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-subtle">{current.phonetic ?? current.word.phonetic}</span>
              ) : null}
            </div>
            <div className="mt-8">
              <p className={cn("leading-tight", current.type === "enToZh" ? "word-font text-5xl font-bold" : "text-3xl font-bold")}>
                {current.prompt}
              </p>
              {current.context ? <p className="mt-6 text-lg leading-8 text-subtle">{current.context}</p> : null}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-panel p-4 shadow-soft">
            <div className="grid gap-3 sm:grid-cols-2">
              {current.options.map((option) => {
                const selected = currentAnswer?.selectedOptionId === option.id;
                const correct = option.isCorrect;
                const showFeedback = mode === "practice" && currentAnswer;
                return (
                  <button
                    key={option.id}
                    onClick={() => answer(option.id)}
                    className={cn(
                      "focus-ring min-h-20 rounded-lg border p-4 text-left text-base font-semibold leading-6 transition",
                      showFeedback && correct && "border-positive bg-positive/10 text-positive",
                      showFeedback && selected && !correct && "border-danger bg-danger/10 text-danger",
                      !showFeedback && selected && "border-brand bg-brand/10",
                      !showFeedback && !selected && "border-line bg-surface hover:border-brand",
                    )}
                  >
                    {option.text}
                  </button>
                );
              })}
            </div>

            {mode === "practice" && currentAnswer ? (
              <div className="mt-4 rounded-lg border border-line bg-surface p-4">
                <div className={`flex items-center gap-2 font-semibold ${currentAnswer.isCorrect ? "text-positive" : "text-danger"}`}>
                  {currentAnswer.isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  {currentAnswer.isCorrect ? "答对了，继续保持。" : "答错了，已加入错题进度。"}
                </div>
                {current.explanation ? <p className="mt-2 text-sm leading-6 text-subtle">{current.explanation}</p> : null}
                <Button className="mt-4 w-full" onClick={goNext}>
                  {index < roundQuestions.length - 1 ? "下一题" : "完成练习"}
                </Button>
              </div>
            ) : null}

            {mode === "exam" ? (
              <div className="mt-4 flex flex-wrap justify-between gap-3">
                <Button variant="secondary" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
                  上一题
                </Button>
                <Button variant="secondary" disabled={index === roundQuestions.length - 1} onClick={() => setIndex((value) => Math.min(roundQuestions.length - 1, value + 1))}>
                  下一题
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      )}

      {!showCancelInHeader ? (
        <div className="flex justify-between">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel ?? "放弃并重新开始"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function logQuestionDebug(question: Question, selectedOption: QuestionOption | undefined, isCorrect: boolean) {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.debug("[WordSprint Practice Debug]", {
    word: question.word.word,
    wordId: question.wordId,
    wordText: question.wordText,
    partOfSpeech: question.partOfSpeech ?? question.word.partOfSpeech,
    phonetic: question.phonetic ?? question.word.phonetic,
    correctMeaning: question.correctMeaning,
    correctOptionId: question.correctOptionId,
    correctOptionText: question.correctOptionText,
    options: question.options.map((option) => ({
      id: option.id,
      text: option.text,
      isCorrect: option.isCorrect,
      wordId: option.wordId,
    })),
    selectedOption: selectedOption
      ? {
          id: selectedOption.id,
          text: selectedOption.text,
          isCorrect: selectedOption.isCorrect,
          wordId: selectedOption.wordId,
        }
      : null,
    isCorrect,
  });
}
