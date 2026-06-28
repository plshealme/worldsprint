"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, BarChart3, EyeOff, FileCheck, XCircle } from "lucide-react";
import { TestReportView } from "@/components/test/TestReportView";
import { TestRunner } from "@/components/test/TestRunner";
import { TestSetupWizard } from "@/components/test/TestSetupWizard";
import { useAppState } from "@/components/providers/AppStateProvider";
import { perfLog } from "@/lib/perfLog";
import { buildReport } from "@/lib/scoring";
import type { Question, TestReport, TestSetup } from "@/types/test";

export default function ExamPage() {
  const { applyReport } = useAppState();
  const [setup, setSetup] = useState<TestSetup | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [report, setReport] = useState<TestReport | null>(null);

  useEffect(() => {
    perfLog("Exam page mounted");
  }, []);

  if (report) {
    return <TestReportView report={report} onRestart={() => setReport(null)} />;
  }

  if (questions.length > 0 && setup) {
    return (
      <TestRunner
        mode="exam"
        questions={questions}
        contextTitle="正式测试"
        contextDescription={`${questions.length} 题 · 不显示即时反馈 · 提交后统一查看成绩`}
        cancelLabel="退出测试"
        showCancelInHeader
        onCancel={() => {
          if (window.confirm("退出不会保存正式成绩。确认放弃本次测试吗？")) {
            setQuestions([]);
            setSetup(null);
          }
        }}
        onFinish={(answers, startedAt, submittedAt, finalQuestions) => {
          const nextReport = buildReport("exam", "Exam 正式测试", finalQuestions, answers, startedAt, submittedAt);
          applyReport(nextReport, true);
          setReport(nextReport);
          setQuestions([]);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand">Exam</p>
        <h1 className="mt-2 text-2xl font-bold">正式测试</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-subtle">
          测试中不显示答案，提交后统一查看成绩。本次成绩会计入 Exam Records 和正确率趋势。
        </p>
      </section>
      <section className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <RuleChip icon={<EyeOff size={17} />} text="不显示即时反馈" />
        <RuleChip icon={<XCircle size={17} />} text="退出不保存成绩" />
        <RuleChip icon={<AlertTriangle size={17} />} text="提交前二次确认" />
        <RuleChip icon={<FileCheck size={17} />} text="未作答单独统计" />
        <RuleChip icon={<BarChart3 size={17} />} text="计入 Exam Records" />
      </section>
      <TestSetupWizard
        mode="exam"
        onStart={(nextSetup, generation) => {
          if (generation.questions.length === 0) {
            return;
          }
          setSetup(nextSetup);
          setQuestions(generation.questions);
        }}
      />
    </div>
  );
}

function RuleChip({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex min-h-14 items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-ink shadow-soft">
      <span className="text-brand">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
