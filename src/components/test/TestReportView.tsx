"use client";

import Link from "next/link";
import { Copy, FileDown, Image, RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/common/Button";
import { StatCard } from "@/components/common/StatCard";
import { formatDuration, formatPercent, modeName, typeName } from "@/lib/utils";
import type { TestReport } from "@/types/test";

export interface PracticeRoundSummary {
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
  newMistakes: number;
  masteryImproved: number;
}

export function TestReportView({
  report,
  onRestart,
  practiceSummary,
}: {
  report: TestReport;
  onRestart: () => void;
  practiceSummary?: PracticeRoundSummary | null;
}) {
  const answerMap = new Map(report.answers.map((answer) => [answer.questionId, answer]));
  const wrongQuestions = report.questions.filter((question) => {
    const answer = answerMap.get(question.id);
    return answer?.selectedOptionId && !answer.isCorrect;
  });

  function copySummary() {
    const text = `我刚刚在 WordSprint 完成了一次 ${modeName(report.mode)} 测试：共 ${report.total} 题，正确率 ${formatPercent(
      report.questionAccuracy,
    )}，用时 ${formatDuration(report.durationMs)}。Learn it fast. Make it last.`;
    navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-panel p-6 shadow-soft">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand">{modeName(report.mode)} Report</p>
            <h2 className="mt-2 text-4xl font-bold">{report.score} 分</h2>
            <p className="mt-2 text-sm text-subtle">{report.title}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onRestart}>
              <RotateCcw size={17} />
              再来一次
            </Button>
            <ButtonLink href="/mistakes" variant="secondary">
              重练错题
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="题目正确率" value={formatPercent(report.questionAccuracy)} hint={`${report.correct}/${report.total}`} />
        <StatCard label="单词正确率" value={formatPercent(report.wordAccuracy)} hint="重复词只算一次" />
        <StatCard label="用时" value={formatDuration(report.durationMs)} />
        <StatCard label="未作答数" value={report.unanswered} />
        <StatCard label="XP 变化" value={`+${report.xpDelta}`} />
      </section>

      {practiceSummary ? (
        <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-bold">本轮总结</h3>
              <p className="mt-1 text-sm text-subtle">本轮即时练习已写入本地学习记录。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onRestart}>
                <RotateCcw size={17} />
                继续下一轮
              </Button>
              <ButtonLink href="/mistakes" variant="secondary">
                进入错题本
              </ButtonLink>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard label="本轮总题数" value={practiceSummary.total} />
            <StatCard label="答对数" value={practiceSummary.correct} />
            <StatCard label="答错数" value={practiceSummary.wrong} />
            <StatCard label="正确率" value={formatPercent(practiceSummary.accuracy)} />
            <StatCard label="新增错题数" value={practiceSummary.newMistakes} />
            <StatCard label="掌握提升" value={practiceSummary.masteryImproved} />
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-5 shadow-soft">
          <h3 className="text-lg font-bold">薄弱题型</h3>
          <div className="mt-4 space-y-3">
            {report.weakTypes.map((item) => (
              <div key={item.type}>
                <div className="flex justify-between text-sm">
                  <span>{typeName(item.type)}</span>
                  <span>{formatPercent(item.accuracy)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(item.accuracy * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-panel p-5 shadow-soft">
          <h3 className="text-lg font-bold">下一步复习建议</h3>
          <div className="mt-4 space-y-3">
            {report.suggestions.map((suggestion) => (
              <p key={suggestion} className="rounded-lg bg-surface px-3 py-2 text-sm leading-6 text-subtle">
                {suggestion}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-bold">错题列表</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={copySummary}>
              <Copy size={16} />
              复制成绩总结
            </Button>
            <Button variant="secondary" type="button">
              <Image size={16} />
              生成成绩图片
            </Button>
            <Button variant="secondary" type="button">
              <FileDown size={16} />
              导出
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {wrongQuestions.length === 0 ? (
            <p className="rounded-lg bg-positive/10 px-4 py-3 text-sm text-positive">本次没有错题。</p>
          ) : (
            wrongQuestions.map((question) => {
              const word = question.word;
              const answer = answerMap.get(question.id);
              const selected = question.options.find((option) => option.id === answer?.selectedOptionId);
              const correct = question.options.find((option) => option.isCorrect);
              return (
                <Link
                  key={question.id}
                  href={`/words/${question.wordId}`}
                  className="block rounded-lg border border-line bg-surface p-4 hover:border-brand"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="word-font text-2xl font-bold">{word?.word}</p>
                      <p className="mt-1 text-sm text-subtle">{word?.unit} · {typeName(question.type)}</p>
                    </div>
                    <div className="text-sm leading-6 md:text-right">
                      <p className="text-danger">你的答案：{selected?.text}</p>
                      <p className="text-positive">正确答案：{correct?.text}</p>
                    </div>
                  </div>
                  {question.explanation ? <p className="mt-3 text-sm leading-6 text-subtle">{question.explanation}</p> : null}
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
