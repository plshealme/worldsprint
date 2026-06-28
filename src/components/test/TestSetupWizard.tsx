"use client";

import { useMemo, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import { generateQuestions, getAvailableWords, type QuestionGenerationResult } from "@/lib/questionGenerator";
import { sectionUnitLabelFromKey, wordSectionUnitKey } from "@/lib/sectionUnit";
import { readJson, writeJson } from "@/lib/storage";
import { useWords } from "@/lib/useWords";
import { PUBLIC_VOCAB_NAME, PUBLIC_VOCAB_RANGE, PUBLIC_VOCAB_SCOPE } from "@/lib/vocab";
import type { PracticeMode, QuestionType, TestMode, TestSetup } from "@/types/test";

const setupWordPageSize = 10000;
const englishOnlyRatio: Record<QuestionType, number> = {
  enToZh: 100,
  zhToEn: 0,
  similar: 0,
  synonym: 0,
  familiar: 0,
};
const disabledQuestionTypes: QuestionType[] = ["zhToEn", "similar", "synonym", "familiar"];
const typeLabels: Record<QuestionType, string> = {
  enToZh: "英译汉",
  zhToEn: "汉译英",
  similar: "形近词",
  synonym: "意近词",
  familiar: "熟词僻义",
};
const roundSizes = [10, 20, 50];
const tags = ["高频", "阅读", "写作", "熟词僻义", "形近易混", "意近易混", "抽象词", "态度词", "学术"];

const practiceModeCards: Array<{ value: PracticeMode; label: string; text: string }> = [
  { value: "new", label: "新词练习", text: "优先未练过的词" },
  { value: "mistakes", label: "错词练习", text: "优先错题" },
  { value: "review", label: "待复习", text: "到期复习词" },
  { value: "mixed", label: "混合练习", text: "综合安排" },
];

const strategies = [
  { value: "smart", label: "智能排序" },
  { value: "random", label: "随机" },
  { value: "unit", label: "单元顺序" },
  { value: "mistakes", label: "错题优先" },
  { value: "lowAccuracy", label: "低正确率优先" },
  { value: "unknown", label: "未掌握优先" },
] as const;

function withEnglishOnlyRatio(setup: TestSetup): TestSetup {
  return {
    ...setup,
    units: normalizeSetupUnits(setup),
    ratio: { ...englishOnlyRatio },
  };
}

function normalizeSetupUnits(setup: TestSetup): string[] {
  const runtimeSetup = setup as { unit?: unknown; units?: unknown };
  const rawUnits: unknown = runtimeSetup.units ?? runtimeSetup.unit;
  if (Array.isArray(rawUnits)) {
    return rawUnits.filter((unit): unit is string => typeof unit === "string" && unit.length > 0);
  }
  if (typeof rawUnits === "string" && rawUnits.length > 0) {
    return [rawUnits];
  }
  return [];
}

export function TestSetupWizard({
  mode,
  onStart,
}: {
  mode: TestMode;
  onStart: (setup: TestSetup, generation: QuestionGenerationResult) => void;
}) {
  const { settings, progress, mistakes } = useAppState();
  const { words, units: wordUnits, loading, error } = useWords({ pageSize: setupWordPageSize });
  const storageKey = `lastSetup:${mode}`;
  const [setup, setSetup] = useState<TestSetup>(() =>
    withEnglishOnlyRatio(readJson<TestSetup>(storageKey, {
      mode,
      category: "考研英语",
      section: "",
      practiceMode: mode === "practice" ? "mixed" : undefined,
      units: [],
      tags: [],
      questionCount: settings.defaultQuestionCount,
      ratio: settings.defaultTypeRatio,
      strategy: mode === "practice" ? "smart" : "random",
      includeMistakesProgress: true,
    })),
  );

  const sections = useMemo(() => Array.from(new Set(words.map((word) => word.section).filter(Boolean))) as string[], [words]);
  const unitWordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const word of words) {
      const key = wordSectionUnitKey(word);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [words]);
  const available = useMemo(() => getAvailableWords(setup, words), [setup, words]);
  const generationPreview = useMemo(
    () => generateQuestions({ ...setup, questionCount: Math.min(setup.questionCount, 5) }, progress, mistakes, words),
    [mistakes, progress, setup, words],
  );

  function patch(next: Partial<TestSetup>) {
    setSetup((current) => withEnglishOnlyRatio({ ...current, ...next }));
  }

  function toggleTag(tag: string) {
    setSetup((current) => ({
      ...current,
      tags: current.tags.includes(tag) ? current.tags.filter((item) => item !== tag) : [...current.tags, tag],
    }));
  }

  function startWith(nextSetup: TestSetup) {
    const effectiveSetup = withEnglishOnlyRatio(nextSetup);
    const generation = generateQuestions(effectiveSetup, progress, mistakes, words);
    writeJson(storageKey, effectiveSetup);
    setSetup(effectiveSetup);
    onStart(effectiveSetup, generation);
  }

  const sharedProps = {
    setup,
    patch,
    toggleTag,
    storageKey,
    sections,
    wordUnits,
    unitWordCounts,
    availableCount: available.length,
    loading,
    error,
    generationPreview,
    onStart: startWith,
  };

  if (mode === "practice") {
    return <PracticeQuickSetup {...sharedProps} />;
  }

  return <ExamSetupWizard {...sharedProps} />;
}

type SharedSetupProps = {
  setup: TestSetup;
  patch: (next: Partial<TestSetup>) => void;
  toggleTag: (tag: string) => void;
  storageKey: string;
  sections: string[];
  wordUnits: string[];
  unitWordCounts: Record<string, number>;
  availableCount: number;
  loading: boolean;
  error: string | null;
  generationPreview: QuestionGenerationResult;
  onStart: (setup: TestSetup) => void;
};

function PracticeQuickSetup({
  setup,
  patch,
  toggleTag,
  storageKey,
  sections,
  wordUnits,
  unitWordCounts,
  availableCount,
  loading,
  error,
  generationPreview,
  onStart,
}: SharedSetupProps) {
  const savedSetup = readJson<TestSetup | null>(storageKey, null);
  const lastSetup = savedSetup ? withEnglishOnlyRatio(savedSetup) : null;
  const canStart = !loading && availableCount > 0 && generationPreview.questions.length > 0;
  const disabledReason = loading
    ? "正在读取词库"
    : availableCount === 0
      ? "当前范围暂无可练习词"
      : generationPreview.questions.length === 0
        ? "当前条件不足，无法生成题目"
        : "";

  return (
    <div className="space-y-4 pb-4 md:pb-0">
      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand">{lastSetup ? "继续上次练习" : "还没有上次设置"}</p>
            <h2 className="mt-1 text-lg font-bold md:text-2xl">{lastSetup ? describePracticeSetup(lastSetup, sections) : "请选择练习模式和范围"}</h2>
            <p className="mt-1 text-xs text-subtle md:text-sm">即时反馈 · 答错自动加入错题本</p>
          </div>
          <Button
            className="min-h-12 w-full md:w-auto"
            variant={lastSetup ? "primary" : "secondary"}
            disabled={!lastSetup || loading}
            onClick={() => {
              if (lastSetup) onStart(lastSetup);
            }}
          >
            <RotateCcw size={17} />
            继续练习
          </Button>
        </div>
        {error ? <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">{error}</p> : null}
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold">练习模式</h2>
          <span className="text-xs text-subtle">本轮 {setup.questionCount} 题</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {practiceModeCards.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => patch({ practiceMode: item.value })}
              className={`focus-ring min-h-[86px] rounded-lg border p-3 text-left transition ${
                (setup.practiceMode ?? "mixed") === item.value ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:border-brand"
              }`}
            >
              <span className="block font-bold">{item.label}</span>
              <span className={`mt-1 block text-xs leading-5 ${(setup.practiceMode ?? "mixed") === item.value ? "text-white/80" : "text-subtle"}`}>{item.text}</span>
            </button>
          ))}
        </div>
      </section>

      <UnitScopeSelector
        variant="practice"
        setup={setup}
        patch={patch}
        sections={sections}
        unitKeys={wordUnits}
        unitWordCounts={unitWordCounts}
        availableCount={availableCount}
      />

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <h2 className="font-bold">题量</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {roundSizes.map((size) => (
            <button
              key={size}
              type="button"
              className={`focus-ring min-h-12 rounded-lg border text-sm font-bold ${
                setup.questionCount === size ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:border-brand"
              }`}
              onClick={() => patch({ questionCount: size })}
            >
              {size} 题
            </button>
          ))}
        </div>
        {setup.questionCount > availableCount ? (
          <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">当前范围仅 {availableCount} 词，请降低题量或增选 Unit。</p>
        ) : null}
      </section>

      <details className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <summary className="cursor-pointer font-bold">高级设置</summary>
        <div className="mt-4 space-y-5">
          <StrategyGrid setup={setup} patch={patch} />
          <RatioControls />
          <TagControls setup={setup} toggleTag={toggleTag} />
          <label className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4">
            <input type="checkbox" checked={setup.includeMistakesProgress} onChange={(event) => patch({ includeMistakesProgress: event.target.checked })} />
            <span className="text-sm font-semibold">计入错题进度</span>
          </label>
        </div>
      </details>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:hidden">
        {disabledReason ? (
          <p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-center text-xs text-warning">
            {disabledReason}
          </p>
        ) : null}
        <Button
          className="min-h-[52px] w-full rounded-2xl text-base font-bold shadow-sm disabled:!bg-muted disabled:!text-subtle disabled:!opacity-100"
          onClick={() => onStart(setup)}
          disabled={!canStart}
        >
          开始 {setup.questionCount} 题练习
        </Button>
      </section>

      <section className="hidden rounded-lg border border-line bg-panel p-5 shadow-soft md:block">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PreviewItem label="范围内词数" value={availableCount} />
          <PreviewItem label="错题数" value={generationPreview.rangeStats.mistakeWords} />
          <PreviewItem label="未掌握词数" value={generationPreview.rangeStats.unknownWords} />
          <PreviewItem label="本轮题量" value={setup.questionCount} />
        </div>
        {generationPreview.warnings.map((warning) => (
          <p key={warning} className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
            {warning}
          </p>
        ))}
        <Button className="mt-4 min-h-12 w-full md:w-auto" onClick={() => onStart(setup)} disabled={!canStart}>
          <Check size={17} />
          开始练习 {setup.questionCount} 题
        </Button>
      </section>
    </div>
  );
}

function ExamSetupWizard({
  setup,
  patch,
  toggleTag,
  storageKey,
  sections,
  wordUnits,
  unitWordCounts,
  availableCount,
  loading,
  error,
  generationPreview,
  onStart,
}: SharedSetupProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const savedSetup = readJson<TestSetup | null>(storageKey, null);
  const lastSetup = savedSetup ? withEnglishOnlyRatio(savedSetup) : null;
  const canStart = !loading && availableCount > 0 && generationPreview.questions.length > 0;
  const disabledReason = loading
    ? "正在读取词库"
    : availableCount === 0
      ? "当前范围暂无可测试词"
      : generationPreview.questions.length === 0
        ? "当前条件不足，无法生成试卷"
        : "";

  return (
    <div className="space-y-5 pb-28 md:pb-0">
      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand">Exam Setup</p>
            <h2 className="mt-1 text-2xl font-bold">考试设置</h2>
            <p className="mt-1 text-sm text-subtle">{loading ? "正在读取词库..." : "选择本次测试范围、题量和题型。"}</p>
            {error ? <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">{error}</p> : null}
          </div>
          <button
            type="button"
            className={`focus-ring rounded-lg border p-3 text-left md:min-w-72 ${
              lastSetup ? "border-line bg-surface hover:border-brand" : "border-line bg-muted/70 opacity-70"
            }`}
            disabled={!lastSetup || loading}
            onClick={() => {
              if (lastSetup) patch(lastSetup);
            }}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-ink">
              <RotateCcw size={16} />
              使用上次考试设置
            </span>
            <span className="mt-1 block text-xs leading-5 text-subtle">{lastSetup ? describeExamSetup(lastSetup, sections) : "暂无上次考试设置"}</span>
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">生成测试卷</h2>
          <span className="text-xs font-semibold text-subtle">{availableCount} 个可选词</span>
        </div>

        <UnitScopeSelector
          variant="exam"
          setup={setup}
          patch={patch}
          sections={sections}
          unitKeys={wordUnits}
          unitWordCounts={unitWordCounts}
          availableCount={availableCount}
          questionCount={setup.questionCount}
        />

        <div className="mt-5">
          <p className="text-sm font-semibold text-subtle">题量</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {roundSizes.map((size) => (
              <button
                key={size}
                type="button"
                className={`focus-ring min-h-11 rounded-lg border text-sm font-bold ${
                  setup.questionCount === size ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:border-brand"
                }`}
                onClick={() => patch({ questionCount: size })}
              >
                {size} 题
              </button>
            ))}
          </div>
          <input
            className="mt-3 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg font-semibold outline-none"
            type="number"
            min={1}
            value={setup.questionCount}
            onChange={(event) => patch({ questionCount: Math.max(1, Number(event.target.value)) })}
          />
          {setup.questionCount > availableCount ? (
            <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">当前范围仅 {availableCount} 词，请降低题量或增选 Unit。</p>
          ) : null}
        </div>

        <details className="mt-5 rounded-lg border border-line bg-surface p-3">
          <summary className="cursor-pointer font-bold">题型比例和抽题策略</summary>
          <div className="mt-4 space-y-5">
            <RatioControls />
            <StrategyGrid setup={setup} patch={patch} />
            <TagControls setup={setup} toggleTag={toggleTag} />
          </div>
        </details>
      </section>

      <section className="rounded-lg border border-brand/25 bg-panel p-4 shadow-soft md:p-5">
        <p className="text-sm font-semibold text-brand">本次试卷</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <PreviewItem label="范围" value={describeScope(setup, sections)} />
          <PreviewItem label="题量" value={`${setup.questionCount} 题`} />
          <PreviewItem label="题型" value={describeExamTypeSummary(setup)} />
          <PreviewItem label="计入成绩" value="是" />
          <PreviewItem label="反馈方式" value="提交后查看" />
        </div>
        {generationPreview.warnings.map((warning) => (
          <p key={warning} className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
            {warning}
          </p>
        ))}
      </section>

      <section className="hidden rounded-lg border border-line bg-panel p-4 shadow-soft md:block">
        {disabledReason ? <p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{disabledReason}</p> : null}
        <Button className="min-h-12" onClick={() => setConfirmOpen(true)} disabled={!canStart}>
          <Check size={17} />
          开始正式测试
        </Button>
      </section>

      <div className="fixed bottom-24 left-4 right-4 z-20 md:hidden">
        {disabledReason ? <p className="mb-2 rounded-lg bg-panel/95 px-3 py-2 text-center text-xs text-warning shadow-soft">{disabledReason}</p> : null}
        <Button className="min-h-12 w-full text-base shadow-soft" onClick={() => setConfirmOpen(true)} disabled={!canStart}>
          开始正式测试
        </Button>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/40 p-4 md:items-center md:justify-center">
          <section className="w-full rounded-lg border border-line bg-panel p-5 shadow-soft md:max-w-md">
            <h2 className="text-xl font-bold text-ink">开始正式测试？</h2>
            <p className="mt-2 text-sm leading-6 text-subtle">测试中不会显示答案。提交后成绩会计入 Exam Records。请确认范围和题量无误。</p>
            <div className="mt-4 rounded-lg bg-surface p-3 text-sm text-subtle">
              {describeScope(setup, sections)} · {setup.questionCount} 题 · {describeExamTypeSummary(setup)}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                取消
              </Button>
              <Button
                onClick={() => {
                  setConfirmOpen(false);
                  onStart(setup);
                }}
              >
                开始
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function UnitScopeSelector({
  variant,
  setup,
  patch,
  sections,
  unitKeys,
  unitWordCounts,
  availableCount,
  questionCount,
}: {
  variant: "practice" | "exam";
  setup: TestSetup;
  patch: (next: Partial<TestSetup>) => void;
  sections: string[];
  unitKeys: string[];
  unitWordCounts: Record<string, number>;
  availableCount: number;
  questionCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draftSection, setDraftSection] = useState(setup.section);
  const [draftAll, setDraftAll] = useState(setup.units.length === 0);
  const [draftUnits, setDraftUnits] = useState<string[]>(setup.units);
  const cleanOnlySection = sections.length === 1 ? sections[0] : null;
  const displaySection = setup.section || cleanOnlySection || "";
  const sheetSection = cleanOnlySection || draftSection;
  const sheetUnitKeys = sheetSection ? unitKeys.filter((unit) => unit.startsWith(`${sheetSection}::`)) : unitKeys;
  const scopeTitle = describeScope(setup, sections);
  const isExam = variant === "exam";
  const selectedTotal = draftAll ? totalUnitWords(sheetUnitKeys, unitWordCounts) : totalUnitWords(draftUnits, unitWordCounts);
  const canConfirmScope = draftAll || draftUnits.length > 0;
  const selectionSummary = describeDraftSelection(draftAll, draftUnits, selectedTotal);

  function openSheet() {
    setDraftSection(setup.section || cleanOnlySection || "");
    setDraftAll(setup.units.length === 0);
    setDraftUnits(setup.units);
    setOpen(true);
  }

  function chooseAll() {
    setDraftAll(true);
    setDraftUnits([]);
  }

  function chooseUnit(unit: string) {
    const unitSection = sectionFromUnitKey(unit) || draftSection;
    setDraftSection(unitSection);
    setDraftAll(false);
    setDraftUnits((current) => {
      const firstSection = current[0] ? sectionFromUnitKey(current[0]) : unitSection;
      if (current.length > 0 && firstSection !== unitSection) {
        return [unit];
      }
      return current.includes(unit) ? current.filter((item) => item !== unit) : [...current, unit];
    });
  }

  function clearSelection() {
    setDraftAll(false);
    setDraftUnits([]);
  }

  function confirmScope() {
    if (!canConfirmScope) {
      return;
    }
    if (!draftAll && draftUnits.length > 0) {
      patch({ section: sectionFromUnitKey(draftUnits[0]) || draftSection, units: draftUnits });
    } else {
      patch({ section: cleanOnlySection || draftSection, units: [] });
    }
    setOpen(false);
  }

  return (
    <section className={`mt-4 rounded-lg border p-4 shadow-soft md:p-5 ${isExam ? "border-brand/25 bg-panel" : "border-line bg-panel"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand">{isExam ? "本次试卷范围" : "当前练习范围"}</p>
          <h2 className="mt-1 text-xl font-bold text-ink">{scopeTitle}</h2>
          <p className="mt-2 text-sm text-subtle">
            {isExam ? `可选词：${availableCount} · 题量：${questionCount ?? setup.questionCount}` : `${availableCount} 个词可练`}
          </p>
          {isExam ? <p className="mt-1 text-xs text-subtle">题型：英译汉 100% · 计入 Exam Records</p> : null}
        </div>
        <Button className="shrink-0 px-3" variant="secondary" onClick={openSheet}>
          更改范围
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/40 p-4 md:items-center md:justify-center">
          <section className="flex max-h-[80vh] w-full flex-col rounded-lg border border-line bg-panel shadow-soft md:max-w-lg">
            <div className="border-b border-line p-4">
              <p className="text-sm font-semibold text-brand">选择单元</p>
              <h2 className="mt-1 text-xl font-bold text-ink">{sheetSection || displaySection || PUBLIC_VOCAB_NAME}</h2>
              <p className="mt-1 text-sm text-subtle">选择全部单元，或自由组合多个 Unit。</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {!cleanOnlySection && sections.length > 1 ? (
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className={`focus-ring min-h-10 rounded-lg border px-3 text-sm font-semibold ${
                      !draftSection ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:border-brand"
                    }`}
                      onClick={() => {
                        setDraftSection("");
                        setDraftAll(true);
                        setDraftUnits([]);
                      }}
                  >
                    全部
                  </button>
                  {sections.map((section) => (
                    <button
                      key={section}
                      type="button"
                      className={`focus-ring min-h-10 rounded-lg border px-3 text-sm font-semibold ${
                        draftSection === section ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:border-brand"
                      }`}
                      onClick={() => {
                        setDraftSection(section);
                        setDraftAll(true);
                        setDraftUnits([]);
                      }}
                    >
                      {section}
                    </button>
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                className={`focus-ring mb-3 flex min-h-12 w-full items-center justify-between rounded-lg border px-4 text-left font-semibold ${
                  draftAll ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:border-brand"
                }`}
                onClick={chooseAll}
              >
                <span>全部单元</span>
                <span className={draftAll ? "text-white/80" : "text-subtle"}>{totalUnitWords(sheetUnitKeys, unitWordCounts)}词</span>
              </button>

              <div className="mb-3 flex items-center justify-between gap-3 text-xs text-subtle">
                <span>{draftAll ? "已选全部单元" : `已选 ${draftUnits.length} 个 Unit`}</span>
                <button type="button" className="font-semibold text-brand disabled:text-subtle" onClick={clearSelection} disabled={!draftAll && draftUnits.length === 0}>
                  清空
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {sheetUnitKeys.map((unit) => {
                  const active = !draftAll && draftUnits.includes(unit);
                  return (
                    <button
                      key={unit}
                      type="button"
                      className={`focus-ring min-h-14 rounded-lg border px-2 py-2 text-center ${
                        active ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:border-brand"
                      }`}
                      onClick={() => chooseUnit(unit)}
                      title={sectionUnitLabelFromKey(unit)}
                    >
                      <span className="block text-sm font-bold">{compactUnitLabel(unit)}</span>
                      <span className={`mt-0.5 block text-[11px] ${active ? "text-white/80" : "text-subtle"}`}>{unitWordCounts[unit] ?? 0}词</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-line p-4">
              <p className={`mb-3 text-sm font-semibold ${canConfirmScope ? "text-ink" : "text-warning"}`}>
                {canConfirmScope ? selectionSummary : "请至少选择一个单元"}
              </p>
              <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={confirmScope} disabled={!canConfirmScope}>
                确认
              </Button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function StrategyGrid({ setup, patch }: { setup: TestSetup; patch: (next: Partial<TestSetup>) => void }) {
  return (
    <div>
      <p className="text-sm font-semibold">抽题策略</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {strategies.map((strategy) => (
          <ToggleChip key={strategy.value} active={setup.strategy === strategy.value} onClick={() => patch({ strategy: strategy.value })}>
            {strategy.label}
          </ToggleChip>
        ))}
      </div>
    </div>
  );
}

function RatioControls() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-brand bg-brand/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-bold text-ink">{typeLabels.enToZh}</span>
          <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">100%</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-subtle">MVP 阶段正式支持</p>
      </div>
      {disabledQuestionTypes.map((type) => (
        <div key={type} className="rounded-lg border border-line bg-muted/60 p-4 text-subtle opacity-75">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">{typeLabels[type]}</span>
            <span className="rounded-full bg-panel px-2.5 py-1 text-xs font-semibold">后续开放</span>
          </div>
          <p className="mt-2 text-xs leading-5">当前不参与抽题</p>
        </div>
      ))}
    </div>
  );
}

function TagControls({ setup, toggleTag }: { setup: TestSetup; toggleTag: (tag: string) => void }) {
  return (
    <div>
      <p className="text-sm font-semibold">官方标签</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <ToggleChip key={tag} active={setup.tags.includes(tag)} onClick={() => toggleTag(tag)}>
            {tag}
          </ToggleChip>
        ))}
      </div>
    </div>
  );
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`focus-ring min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold ${
        active ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:border-brand"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function PreviewItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm text-subtle">{label}</p>
      <p className="mt-1 text-lg font-bold leading-6">{value}</p>
    </div>
  );
}

function describePracticeSetup(setup: TestSetup, sections: string[]) {
  const modeLabel = practiceModeCards.find((item) => item.value === (setup.practiceMode ?? "mixed"))?.label ?? "混合练习";
  return `${modeLabel} · ${describeScope(setup, sections)} · ${setup.questionCount}题`;
}

function describeExamSetup(setup: TestSetup, sections: string[]) {
  return `${describeScope(setup, sections)} · ${setup.questionCount}题 · ${describeExamTypeSummary(setup)}`;
}

function describeExamTypeSummary(_setup: TestSetup) {
  return "英译汉 100%";
}

function describeScope(setup: TestSetup, sections: string[]) {
  if (setup.units.length > 0) {
    return describeUnitList(setup.units);
  }
  const cleanOnlySection = sections.length === 1 ? sections[0] : "";
  const section = setup.section || cleanOnlySection;
  return section ? PUBLIC_VOCAB_SCOPE : PUBLIC_VOCAB_NAME;
}

function describeUnitList(unitKeys: string[]) {
  const section = sectionFromUnitKey(unitKeys[0]) || "";
  if (unitKeys.length === 1) {
    return `${PUBLIC_VOCAB_NAME} · ${sectionUnitLabelFromKey(unitKeys[0])}`.trim();
  }
  const units = unitKeys.map(compactUnitLabel);
  if (unitKeys.length <= 3) {
    return `${PUBLIC_VOCAB_NAME} · ${section} ${units.join("、")}`.trim();
  }
  return `${PUBLIC_VOCAB_NAME} · ${section} ${unitKeys.length} 个 Unit`.trim();
}

function describeDraftSelection(all: boolean, unitKeys: string[], total: number) {
  if (all) {
    return `已选择：${PUBLIC_VOCAB_RANGE} · ${total} 词`;
  }
  if (unitKeys.length === 1) {
    return `已选择：${sectionUnitLabelFromKey(unitKeys[0])} · ${total} 词`;
  }
  if (unitKeys.length <= 3) {
    return `已选择：${unitKeys.map(compactUnitLabel).join("、")} · 共 ${total} 词`;
  }
  return `已选择：${unitKeys.length} 个 Unit · 共 ${total} 词`;
}

function sectionFromUnitKey(unitKey: string) {
  return unitKey.split("::")[0] ?? "";
}

function totalUnitWords(unitKeys: string[], unitWordCounts: Record<string, number>) {
  return unitKeys.reduce((sum, unit) => sum + (unitWordCounts[unit] ?? 0), 0);
}

function compactUnitLabel(unitKey: string) {
  const label = sectionUnitLabelFromKey(unitKey);
  const match = /Unit\s*(\d+)/i.exec(label);
  return match ? `U${match[1]}` : label;
}
