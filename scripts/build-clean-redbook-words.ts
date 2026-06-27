{
const { readFile, writeFile, stat } = require("node:fs/promises") as typeof import("node:fs/promises");
const { resolve } = require("node:path") as typeof import("node:path");

const INPUT_PATHS = [
  "data/redbook_basic_words_U1_U30_clean_core_v1.xlsx",
  "data/redbook_words_enriched_clean.xlsx",
  "data/redbook_words_enriched.xlsx",
];
const OUTPUT_PATH = "data/redbook_words.json";
const REPORT_PATH = "data/redbook_words.clean.build-report.json";
const VOCAB_VERSION = "redbook-basic-u1-u30-clean-v1-2499";
const EXPECTED_TOTAL = 2499;

const REQUIRED_HEADERS = [
  "sourceId",
  "section",
  "unit",
  "sourceOrder",
  "word",
  "coreMeaning",
  "choiceMeaning",
  "choiceUsable",
];

interface CleanWord {
  appOrder: number;
  sourceId: number;
  section: string;
  unit: number;
  sourceOrder: number;
  word: string;
  displayWord: string | null;
  phonetic: string | null;
  partOfSpeech: string | null;
  coreMeaning: string;
  choiceMeaning: string | null;
  fullMeanings: string | null;
  choiceUsable: boolean;
  needsReview: boolean;
  reviewReason: string | null;
  cleanStatus: string | null;
  codex_import_key: string | null;
  rawMeaning: string | null;
  originalLine: number;
}

interface RawRow {
  values: Record<string, string>;
  originalLine: number;
}

async function main() {
  const inputPath = await findInputPath();
  if (!inputPath) {
    console.error(`Missing clean workbook. Put redbook_basic_words_U1_U30_clean_core_v1.xlsx in data/.`);
    process.exitCode = 1;
    return;
  }

  const loaded = await readXlsxRows(inputPath);
  if (!loaded) {
    process.exitCode = 1;
    return;
  }

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !loaded.headers.includes(header));
  if (missingHeaders.length > 0) {
    console.error(`Missing required headers: ${missingHeaders.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const errors: Array<{ originalLine: number; reason: string; row: Record<string, string> }> = [];
  const words: CleanWord[] = [];

  for (const row of loaded.rows) {
    const parsed = parseRow(row);
    if ("error" in parsed) {
      errors.push({ originalLine: row.originalLine, reason: parsed.error, row: row.values });
      continue;
    }
    if (parsed.word.section !== "基础词" || parsed.word.unit < 1 || parsed.word.unit > 30) {
      continue;
    }
    words.push(parsed.word);
  }

  words.sort(
    (a, b) =>
      a.unit - b.unit ||
      a.sourceOrder - b.sourceOrder ||
      a.sourceId - b.sourceId ||
      a.word.localeCompare(b.word),
  );
  words.forEach((word, index) => {
    word.appOrder = index + 1;
  });

  const duplicateSourceIds = findDuplicates(words.map((word) => String(word.sourceId)));
  const duplicateAppOrders = findDuplicates(words.map((word) => String(word.appOrder)));
  const invalidChoiceRows = words.filter((word) => word.choiceUsable === false || !clean(word.choiceMeaning));

  const report = {
    generatedAt: new Date().toISOString(),
    vocabVersion: VOCAB_VERSION,
    mode: "clean-only",
    input: inputPath,
    sheetName: loaded.sheetName,
    sheetNames: loaded.sheetNames,
    headers: loaded.headers,
    output: OUTPUT_PATH,
    totalRows: loaded.rows.length,
    validRows: words.length,
    invalidRows: errors.length,
    expectedTotal: EXPECTED_TOTAL,
    appOrderMin: words[0]?.appOrder ?? null,
    appOrderMax: words.at(-1)?.appOrder ?? null,
    duplicateSourceIds,
    duplicateAppOrders,
    invalidChoiceRows: invalidChoiceRows.map((word) => ({
      appOrder: word.appOrder,
      sourceId: word.sourceId,
      word: word.word,
      unit: word.unit,
      choiceUsable: word.choiceUsable,
      choiceMeaning: word.choiceMeaning,
    })),
    unitCounts: countBy(words, (word) => `Unit ${word.unit}`),
    errors,
  };

  await writeFile(resolve(OUTPUT_PATH), `${JSON.stringify(words, null, 2)}\n`, "utf8");
  await writeFile(resolve(REPORT_PATH), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Input: ${inputPath}`);
  console.log(`Sheet: ${loaded.sheetName}`);
  console.log(`Built clean words: ${words.length}`);
  console.log(`App order: ${report.appOrderMin}..${report.appOrderMax}`);
  console.log(`Invalid choice rows: ${invalidChoiceRows.length}`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log(`Build report: ${REPORT_PATH}`);

  if (errors.length > 0 || words.length !== EXPECTED_TOTAL || duplicateSourceIds.length > 0 || duplicateAppOrders.length > 0) {
    process.exitCode = 1;
  }
}

async function findInputPath() {
  for (const item of INPUT_PATHS) {
    try {
      const info = await stat(resolve(item));
      if (info.isFile()) return item;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

async function readXlsxRows(filePath: string) {
  let xlsx: typeof import("xlsx");
  try {
    xlsx = require("xlsx") as typeof import("xlsx");
  } catch {
    console.error("The xlsx package is required. Run pnpm install first.");
    return null;
  }

  const workbook = xlsx.read(await readFile(resolve(filePath)), { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.error("Workbook has no sheets.");
    return null;
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const headers = rawRows[0] ? Object.keys(rawRows[0]).map((header) => header.trim()) : [];
  const rows = rawRows.map((row, index) => ({
    values: Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim(), String(value ?? "").trim()])),
    originalLine: index + 2,
  }));
  return { sheetNames: workbook.SheetNames, sheetName, headers, rows };
}

function parseRow(row: RawRow): { word: CleanWord } | { error: string } {
  const sourceId = parseInteger(row.values.sourceId);
  const unit = parseInteger(row.values.unit);
  const sourceOrder = parseInteger(row.values.sourceOrder);
  const word = clean(row.values.word);
  const coreMeaning = clean(row.values.coreMeaning);
  const choiceMeaning = clean(row.values.choiceMeaning);

  if (sourceId === null) return { error: "sourceId is required" };
  if (unit === null) return { error: "unit is required" };
  if (sourceOrder === null) return { error: "sourceOrder is required" };
  if (!word) return { error: "word is required" };
  if (!coreMeaning) return { error: "coreMeaning is required" };

  return {
    word: {
      appOrder: 0,
      sourceId,
      section: clean(row.values.section) ?? "",
      unit,
      sourceOrder,
      word,
      displayWord: clean(row.values.displayWord),
      phonetic: clean(row.values.phonetic),
      partOfSpeech: clean(row.values.partOfSpeech),
      coreMeaning,
      choiceMeaning,
      fullMeanings: clean(row.values.fullMeanings),
      choiceUsable: parseBoolean(row.values.choiceUsable) ?? false,
      needsReview: parseBoolean(row.values.needsReview) ?? false,
      reviewReason: clean(row.values.reviewReason),
      cleanStatus: clean(row.values.cleanStatus),
      codex_import_key: clean(row.values.codex_import_key),
      rawMeaning: clean(row.values.rawMeaning),
      originalLine: row.originalLine,
    },
  };
}

function parseInteger(value: string | null | undefined) {
  const item = clean(value);
  if (!item || !/^\d+$/.test(item)) return null;
  return Number(item);
}

function parseBoolean(value: string | null | undefined) {
  const item = clean(value)?.toLowerCase();
  if (!item) return null;
  if (["true", "1", "yes", "y", "是"].includes(item)) return true;
  if (["false", "0", "no", "n", "否"].includes(item)) return false;
  return null;
}

function clean(value: string | null | undefined) {
  const item = value?.trim();
  return item ? item : null;
}

function findDuplicates(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
}

function countBy<T>(items: T[], keyFor: (item: T) => string) {
  return Object.fromEntries(
    Array.from(items.reduce((map, item) => map.set(keyFor(item), (map.get(keyFor(item)) ?? 0) + 1), new Map<string, number>()).entries())
      .sort(([a], [b]) => a.localeCompare(b, "zh-CN", { numeric: true })),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
}
