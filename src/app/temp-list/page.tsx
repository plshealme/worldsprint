"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Play, RotateCcw, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import { TestRunner } from "@/components/test/TestRunner";
import { buildReport } from "@/lib/scoring";
import { generateQuestions } from "@/lib/questionGenerator";
import { useWords } from "@/lib/useWords";
import { formatPercent, shortDateTime } from "@/lib/utils";
import type { Question, TestReport } from "@/types/test";
import type { WordEntry } from "@/types/word";

export default function TempListPage() {
  const { tempList, clearTempList, removeTempWord, progress, mistakes, applyReport, addTempWord } = useAppState();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [report, setReport] = useState<TestReport | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const wordIds = useMemo(() => tempList.map((item) => item.wordId), [tempList]);
  const { words, loading, error } = useWords({ ids: wordIds, pageSize: 50 });

  const rows = useMemo(
    () =>
      tempList
        .map((item) => ({ item, word: words.find((word) => word.id === item.wordId) }))
        .filter((row) => row.word),
    [tempList, words],
  );
  const sourceSummary = useMemo(() => {
    const sources = Array.from(new Set(tempList.map((item) => sourceName(item.source))));
    return sources.length ? sources.join(" / ") : "手动加入";
  }, [tempList]);

  function buildQuestions(selectedWords: WordEntry[]) {
    const generation = generateQuestions(
      {
        mode: "practice",
        category: "考研英语",
        units: [],
        tags: [],
        questionCount: selectedWords.length,
        ratio: { enToZh: 100, zhToEn: 0, similar: 0, synonym: 0, familiar: 0 },
        strategy: "random",
        includeMistakesProgress: true,
      },
      progress,
      mistakes,
      selectedWords,
    );
    setAnsweredCount(0);
    setReport(null);
    setQuestions(generation.questions);
  }

  function start() {
    const selectedWords = rows.map((row) => row.word).filter(Boolean) as WordEntry[];
    buildQuestions(selectedWords);
  }

  function clearWithConfirm() {
    if (window.confirm("确认清空临时测试列表？")) {
      clearTempList();
    }
  }

  function stashAndExit() {
    setExitOpen(false);
    setAnsweredCount(0);
    setQuestions([]);
  }

  function abandonSession() {
    if (!window.confirm("确认放弃本次临时测试？")) {
      return;
    }
    if (window.confirm("是否同时清空临时测试词表？")) {
      clearTempList();
    }
    setExitOpen(false);
    setAnsweredCount(0);
    setQuestions([]);
  }

  if (report) {
    const wrongWordIds = report.answers.filter((answer) => answer.selectedOptionId && !answer.isCorrect).map((answer) => answer.wordId);
    return (
      <div className="space-y-5 pb-24 md:pb-0">
        <section className="rounded-lg border border-line bg-panel p-5 text-center shadow-soft">
          <p className="text-sm font-semibold text-brand">Temporary Test</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">临时测试完成</h1>
          <p className="mt-2 text-sm text-subtle">结果不计入正式 Exam 趋势，但会按现有规则更新单词进度和错题状态。</p>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <ResultStat label="共" value={`${report.total} 词`} />
            <ResultStat label="答对" value={report.correct} />
            <ResultStat label="答错" value={report.wrong} />
            <ResultStat label="正确率" value={formatPercent(report.questionAccuracy)} />
          </div>
        </section>

        <section className="grid gap-3 rounded-lg border border-line bg-panel p-4 shadow-soft md:grid-cols-2">
          <Button
            disabled={wrongWordIds.length === 0}
            onClick={() => {
              clearTempList();
              wrongWordIds.forEach((wordId) => addTempWord(wordId, "mistakes"));
              setReport(null);
            }}
          >
            <RotateCcw size={17} />
            再练错词
          </Button>
          <ButtonLink href="/mistakes" variant="secondary">
            回到错题本
          </ButtonLink>
          <Button
            variant="secondary"
            onClick={() => {
              clearTempList();
              setReport(null);
            }}
          >
            清空临时测试
          </Button>
          <ButtonLink href="/review" variant="secondary">
            继续添加单词
          </ButtonLink>
        </section>
      </div>
    );
  }

  if (questions.length > 0) {
    return (
      <div className="space-y-4 pb-24 md:pb-0">
        <TestRunner
          mode="practice"
          questions={questions}
          contextTitle="临时测试"
          contextDescription={`${questions.length} 词 · 不计入正式 Exam 成绩`}
          cancelLabel="退出"
          showCancelInHeader
          onCancel={() => setExitOpen(true)}
          onAnswer={() => setAnsweredCount((count) => Math.min(questions.length, count + 1))}
          onFinish={(answers, startedAt, submittedAt, finalQuestions) => {
            const nextReport = buildReport("practice", "临时测试", finalQuestions, answers, startedAt, submittedAt);
            applyReport(nextReport, true);
            setReport(nextReport);
            setQuestions([]);
            setAnsweredCount(0);
          }}
        />

        {exitOpen ? (
          <div className="fixed inset-0 z-50 flex items-end bg-ink/40 p-4 md:items-center md:justify-center">
            <section className="w-full rounded-lg border border-line bg-panel p-5 shadow-soft md:max-w-md">
              <h2 className="text-xl font-bold text-ink">要退出临时测试吗？</h2>
              <p className="mt-2 text-sm leading-6 text-subtle">当前进度：{answeredCount} / {questions.length}</p>
              <p className="mt-1 text-sm leading-6 text-subtle">退出后可以保留本次临时测试列表，稍后从确认页重新开始。</p>
              <div className="mt-5 grid gap-2">
                <Button onClick={() => setExitOpen(false)}>继续测试</Button>
                <Button variant="secondary" onClick={stashAndExit}>暂存并退出</Button>
                <Button variant="danger" onClick={abandonSession}>放弃本次</Button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand">Temporary Test</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">临时测试</h1>
        <p className="mt-2 text-lg font-semibold text-ink">本次共 {tempList.length} 个词</p>
        <p className="mt-1 text-sm leading-6 text-subtle">用于快速重练，不计入正式 Exam 成绩。</p>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-3">
          <InfoItem label="来源" value={sourceSummary} />
          <InfoItem label="题量" value={`${tempList.length} 词`} />
          <InfoItem label="题型" value="普通选择题" />
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <Button onClick={start} disabled={loading || rows.length === 0}>
            <Play size={17} />
            开始测试
          </Button>
          <ButtonLink href="/review" variant="secondary">
            <BookOpen size={17} />
            继续添加
          </ButtonLink>
          <Button variant="secondary" onClick={clearWithConfirm} disabled={rows.length === 0}>
            <Trash2 size={17} />
            清空列表
          </Button>
        </div>
      </section>

      {error ? <p className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">{error}</p> : null}
      {loading ? <p className="rounded-lg border border-line bg-panel px-4 py-3 text-sm text-subtle shadow-soft">正在加载临时测试词条...</p> : null}
      {!loading && rows.length === 0 ? (
        <section className="rounded-lg border border-line bg-panel p-5 text-center shadow-soft">
          <h2 className="text-xl font-bold text-ink">临时测试篮为空</h2>
          <p className="mt-2 text-sm leading-6 text-subtle">从单词详情、Review、Mistakes 或搜索结果里添加单词。</p>
          <ButtonLink href="/review" className="mt-4">
            去 Review 添加
          </ButtonLink>
        </section>
      ) : (
        <section className="space-y-2.5">
          {rows.map(({ item, word }) => {
            if (!word) return null;
            return (
              <article key={word.id} className="rounded-lg border border-line bg-panel p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/words/${word.id}`} className="min-w-0">
                    <h2 className="word-font truncate text-2xl font-bold text-ink">{word.displayWord || word.word}</h2>
                    <p className="mt-1 font-semibold text-ink">{word.choiceMeaning || word.coreMeaning || "释义待校对"}</p>
                    <p className="mt-1 text-xs text-subtle">
                      来源：{sourceName(item.source)} · 加入 {shortDateTime(item.addedAt)}
                    </p>
                  </Link>
                  <Button variant="ghost" className="shrink-0 px-3" onClick={() => removeTempWord(word.id)}>
                    移除
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs font-semibold text-subtle">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="text-xs font-semibold text-subtle">{label}</p>
      <p className="mt-1 font-bold text-ink">{value}</p>
    </div>
  );
}

function sourceName(source: string) {
  if (source === "word-detail") return "单词详情";
  if (source === "mistakes") return "错题本";
  if (source === "search") return "搜索结果";
  return "Review";
}
