{
const { readFile, writeFile } = require("node:fs/promises") as typeof import("node:fs/promises");
const { resolve } = require("node:path") as typeof import("node:path");

const INPUT_PATH = "data/redbook_words.json";
const OUTPUT_PATH = "data/redbook_words.audit.json";
const VOCAB_VERSION = "redbook-basic-u1-u30-clean-v1-2499";
const PENDING_MEANING = "释义待校对";
const SAMPLE_LIMIT = 50;

interface CleanWord {
  appOrder?: number | null;
  sourceId?: number | null;
  source_id?: number | null;
  sourceOrder?: number | null;
  source_order?: number | null;
  originalLine?: number | null;
  word?: string | null;
  displayWord?: string | null;
  section?: string | null;
  unit?: number | string | null;
  subsection?: string | null;
  phonetic?: string | null;
  partOfSpeech?: string | null;
  coreMeaning?: string | null;
  choiceMeaning?: string | null;
  fullMeanings?: string | null;
  choiceUsable?: boolean | null;
  needsReview?: boolean | null;
  reviewReason?: string | null;
  cleanStatus?: string | null;
  codex_import_key?: string | null;
  rawMeaning?: string | null;
}

interface IssueSample {
  appOrder: number | null;
  sourceId: number | null;
  word: string;
  section: string;
  unit: number | string | null;
  sourceOrder: number | null;
  reason: string;
}

async function main() {
  const rows = JSON.parse(await readFile(resolve(INPUT_PATH), "utf8")) as CleanWord[];
  const sectionDistribution: Record<string, number> = {};
  const unitDistribution: Record<string, number> = {};
  const sectionUnitDistribution: Record<string, number> = {};
  const sectionUnitStats: Record<string, Record<string, { unit: string; total: number; enriched: number; fallback: number }>> = {};
  const missingCoreMeaning: IssueSample[] = [];
  const missingChoiceMeaning: IssueSample[] = [];
  const missingFullMeanings: IssueSample[] = [];
  const missingPartOfSpeech: IssueSample[] = [];
  const pendingMeaning: IssueSample[] = [];
  const invalidChoiceUsable: IssueSample[] = [];

  let coreMeaningEmptyCount = 0;
  let choiceMeaningEmptyCount = 0;
  let fullMeaningsEmptyCount = 0;
  let coreMeaningPendingCount = 0;
  let fullMeaningsPendingCount = 0;
  let partOfSpeechMissingCount = 0;
  let usableForChineseMeaningQuestions = 0;

  rows.forEach((row) => {
    const section = clean(row.section) ?? "未分 section";
    const unitKey = formatUnit(row.unit ?? null);
    const sample = toSample(row);
    const coreMeaning = clean(row.coreMeaning);
    const choiceMeaning = clean(row.choiceMeaning);
    const fullMeanings = clean(row.fullMeanings);
    const partOfSpeech = clean(row.partOfSpeech);
    const usableChoice = row.choiceUsable !== false && isUsableMeaning(choiceMeaning);

    sectionDistribution[section] = (sectionDistribution[section] ?? 0) + 1;
    unitDistribution[unitKey] = (unitDistribution[unitKey] ?? 0) + 1;
    sectionUnitDistribution[`${section} / ${unitKey}`] = (sectionUnitDistribution[`${section} / ${unitKey}`] ?? 0) + 1;

    if (!coreMeaning) {
      coreMeaningEmptyCount += 1;
      pushSample(missingCoreMeaning, { ...sample, reason: "missing coreMeaning" });
    } else if (isPendingMeaning(coreMeaning)) {
      coreMeaningPendingCount += 1;
      pushSample(pendingMeaning, { ...sample, reason: `coreMeaning is ${PENDING_MEANING}` });
    }

    if (!choiceMeaning) {
      choiceMeaningEmptyCount += 1;
      pushSample(missingChoiceMeaning, { ...sample, reason: "missing choiceMeaning" });
    }

    if (!fullMeanings) {
      fullMeaningsEmptyCount += 1;
      pushSample(missingFullMeanings, { ...sample, reason: "missing fullMeanings" });
    } else if (isPendingMeaning(fullMeanings)) {
      fullMeaningsPendingCount += 1;
      pushSample(pendingMeaning, { ...sample, reason: `fullMeanings is ${PENDING_MEANING}` });
    }

    if (!partOfSpeech) {
      partOfSpeechMissingCount += 1;
      pushSample(missingPartOfSpeech, { ...sample, reason: "missing partOfSpeech" });
    }

    if (usableChoice) {
      usableForChineseMeaningQuestions += 1;
    } else {
      pushSample(invalidChoiceUsable, { ...sample, reason: "choiceMeaning is not usable for options" });
    }

    const unitStats = sectionUnitStats[section] ?? {};
    const currentUnit = unitStats[unitKey] ?? { unit: unitKey, total: 0, enriched: 0, fallback: 0 };
    currentUnit.total += 1;
    if (usableChoice) {
      currentUnit.enriched += 1;
    } else {
      currentUnit.fallback += 1;
    }
    unitStats[unitKey] = currentUnit;
    sectionUnitStats[section] = unitStats;
  });

  const appOrders = rows.map((row) => row.appOrder).filter((value): value is number => typeof value === "number");
  const report = {
    generatedAt: new Date().toISOString(),
    currentSource: "clean-only",
    vocabVersion: VOCAB_VERSION,
    source: {
      clean: INPUT_PATH,
    },
    output: OUTPUT_PATH,
    cleanTotal: rows.length,
    totalWords: rows.length,
    appOrderMin: appOrders.length ? Math.min(...appOrders) : null,
    appOrderMax: appOrders.length ? Math.max(...appOrders) : null,
    appOrderContinuous: isContinuous(appOrders, rows.length),
    coreMeaningEmptyCount,
    choiceMeaningEmptyCount,
    fullMeaningsEmptyCount,
    coreMeaningPendingCount,
    fullMeaningsPendingCount,
    partOfSpeechMissingCount,
    sectionDistribution: sortRecord(sectionDistribution),
    unitDistribution: sortRecord(unitDistribution),
    sectionUnitDistribution: sortRecord(sectionUnitDistribution),
    sectionUnitStats: sortSectionUnitStats(sectionUnitStats),
    usableForChineseMeaningQuestions,
    fallbackOnlyCount: rows.length - usableForChineseMeaningQuestions,
    issueSamples: {
      missingCoreMeaning,
      missingChoiceMeaning,
      missingFullMeanings,
      missingPartOfSpeech,
      pendingMeaning,
      invalidChoiceUsable,
    },
  };

  await writeFile(resolve(OUTPUT_PATH), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Current source: ${report.currentSource}`);
  console.log(`Vocab version: ${report.vocabVersion}`);
  console.log(`Clean total: ${report.cleanTotal}`);
  console.log(`App order: ${report.appOrderMin}..${report.appOrderMax}`);
  console.log(`App order continuous: ${report.appOrderContinuous}`);
  console.log(`Usable for Chinese meaning questions: ${report.usableForChineseMeaningQuestions}`);
  console.log(`Fallback only: ${report.fallbackOnlyCount}`);
  console.log(`Missing coreMeaning: ${report.coreMeaningEmptyCount}`);
  console.log(`Missing choiceMeaning: ${report.choiceMeaningEmptyCount}`);
  console.log(`Missing fullMeanings: ${report.fullMeaningsEmptyCount}`);
  console.log(`Missing partOfSpeech: ${report.partOfSpeechMissingCount}`);
  console.log(`Report: ${OUTPUT_PATH}`);

  if (!report.appOrderContinuous) {
    process.exitCode = 1;
  }
}

function sourceId(row: CleanWord) {
  return row.sourceId ?? row.source_id ?? null;
}

function sourceOrder(row: CleanWord) {
  return row.sourceOrder ?? row.source_order ?? null;
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isPendingMeaning(value: string | null) {
  return value === PENDING_MEANING;
}

function isUsableMeaning(value: string | null) {
  return Boolean(value && !isPendingMeaning(value) && value.toLowerCase() !== "undefined" && value.toLowerCase() !== "null");
}

function pushSample(target: IssueSample[], sample: IssueSample) {
  if (target.length < SAMPLE_LIMIT) {
    target.push(sample);
  }
}

function toSample(row: CleanWord): IssueSample {
  return {
    appOrder: row.appOrder ?? null,
    sourceId: sourceId(row),
    word: clean(row.word ?? undefined) ?? "",
    section: clean(row.section ?? undefined) ?? "未分 section",
    unit: row.unit ?? null,
    sourceOrder: sourceOrder(row),
    reason: "",
  };
}

function formatUnit(unit: number | string | null) {
  if (unit === null || unit === "") {
    return "未分 unit";
  }
  return typeof unit === "number" ? `Unit ${unit}` : `Unit ${parseUnitNumber(String(unit)) ?? unit}`;
}

function isContinuous(values: number[], total: number) {
  if (values.length !== total) return false;
  const unique = new Set(values);
  if (unique.size !== total) return false;
  for (let index = 1; index <= total; index += 1) {
    if (!unique.has(index)) return false;
  }
  return true;
}

function sortRecord(record: Record<string, number>) {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b, "zh-CN", { numeric: true })));
}

function sortSectionUnitStats(record: Record<string, Record<string, { unit: string; total: number; enriched: number; fallback: number }>>) {
  return Object.fromEntries(
    Object.entries(record)
      .sort(([a], [b]) => a.localeCompare(b, "zh-CN"))
      .map(([section, units]) => [
        section,
        Object.values(units).sort((a, b) => (parseUnitNumber(a.unit) ?? 0) - (parseUnitNumber(b.unit) ?? 0) || a.unit.localeCompare(b.unit, "zh-CN")),
      ]),
  );
}

function parseUnitNumber(unit: string) {
  const match = /(\d+)/.exec(unit);
  return match ? Number(match[1]) : null;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
}
