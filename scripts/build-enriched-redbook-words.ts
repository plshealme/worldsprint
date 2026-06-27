{
const { readFile, writeFile, stat } = require("node:fs/promises") as typeof import("node:fs/promises");
const { resolve } = require("node:path") as typeof import("node:path");

const SKELETON_PATH = "data/redbook_words.json";
const CLEAN_XLSX_INPUT_PATH = "data/redbook_words_enriched_clean.xlsx";
const CLEAN_CSV_INPUT_PATH = "data/redbook_words_enriched_clean.csv";
const XLSX_INPUT_PATH = "data/redbook_words_enriched.xlsx";
const CSV_INPUT_PATH = "data/redbook_words_enriched.csv";
const OUTPUT_PATH = "data/redbook_words.enriched.json";
const BUILD_REPORT_PATH = "data/redbook_words.enriched.build-report.json";
const SKIPPED_REPORT_PATH = "data/redbook_words.enriched.skipped.json";

const FIELD_ALIASES: Record<string, string[]> = {
  word: ["word", "display_word", "raw_headword", "word_raw_clean", "\u5355\u8bcd", "\u82f1\u6587", "\u8bcd\u6761"],
  displayWord: ["displayWord", "display_word", "\u663e\u793a\u5355\u8bcd"],
  coreMeaning: [
    "coreMeaning",
    "core_meaning",
    "meaning_zh",
    "meaningZh",
    "meaning",
    "\u6838\u5fc3\u610f\u601d",
    "\u6838\u5fc3\u91ca\u4e49",
    "\u4e2d\u6587",
    "\u4e2d\u6587\u91ca\u4e49",
    "\u8bcd\u4e49",
    "\u91ca\u4e49",
  ],
  choiceMeaning: [
    "choiceMeaning",
    "choice_meaning",
    "choice meaning",
    "\u9009\u9879\u91ca\u4e49",
    "\u9009\u62e9\u9898\u91ca\u4e49",
    "\u77ed\u91ca\u4e49",
  ],
  fullMeanings: [
    "fullMeanings",
    "full_meanings",
    "fullMeaning",
    "meaning_zh",
    "meaningZh",
    "\u5b8c\u6574\u91ca\u4e49",
    "\u5b8c\u6574\u610f\u601d",
    "\u5168\u90e8\u91ca\u4e49",
  ],
  phonetic: ["phonetic", "音标"],
  partOfSpeech: ["partOfSpeech", "part_of_speech", "pos", "\u8bcd\u6027"],
  section: ["section", "\u90e8\u5206", "\u8bcd\u8868", "\u7c7b\u522b"],
  unit: ["unit", "Unit", "\u5355\u5143"],
  subsection: ["subsection", "\u5c0f\u8282", "\u5206\u7ec4"],
  sourcePage: ["sourcePage", "source_page", "page", "\u9875\u7801", "\u6765\u6e90\u9875"],
  sourceId: ["sourceId", "source_id", "\u6e90ID"],
  sourceOrder: ["sourceOrder", "source_order", "unit_order", "order", "\u987a\u5e8f", "\u6e90\u987a\u5e8f"],
  originalLine: ["originalLine", "original_line", "line", "\u539f\u59cb\u884c\u53f7"],
  wordRaw: ["wordRaw", "word_raw", "raw_headword", "\u539f\u59cb\u5355\u8bcd"],
  rawMeaning: ["rawMeaning", "raw_meaning", "\u539f\u59cb\u91ca\u4e49", "\u6821\u5bf9\u539f\u6587"],
  choiceUsable: ["choiceUsable", "choice_usable", "\u9009\u9879\u53ef\u7528"],
  needsReview: ["needsReview", "needs_review", "\u9700\u8981\u590d\u6838"],
  reviewReason: ["reviewReason", "review_reason", "\u590d\u6838\u539f\u56e0"],
  cleanStatus: ["cleanStatus", "clean_status", "\u6e05\u6d17\u72b6\u6001"],
  codexImportKey: ["codex_import_key", "codexImportKey", "import_key"],
};

interface SkeletonWord {
  source_id: number;
  section: string;
  unit: number | null;
  subsection: string | null;
  source_order: number;
  word_raw: string | null;
  word: string;
  flags: string | null;
}

interface RawRow {
  values: Record<string, string>;
  originalLine: number;
}

interface EnrichedWord {
  sourceId: number | null;
  sourceOrder: number | null;
  originalLine: number;
  sourcePage: number | string | null;
  wordRaw: string | null;
  word: string;
  displayWord: string | null;
  coreMeaning: string;
  choiceMeaning: string | null;
  choiceUsable: boolean | null;
  fullMeanings: string | null;
  rawMeaning: string | null;
  phonetic: string | null;
  partOfSpeech: string | null;
  section: string | null;
  unit: number | null;
  subsection: string | null;
  flags: string | null;
  needsReview: boolean | null;
  reviewReason: string | null;
  cleanStatus: string | null;
  codexImportKey: string | null;
  alignment: "sourceIdSection" | "sectionUnitSourceOrder" | "sectionUnitOriginalLine" | "sectionUnitWord" | "unmatched";
}

async function main() {
  const input = await findInput();
  if (!input) {
    printMissingInputHelp();
    process.exitCode = 1;
    return;
  }

  const skeleton = JSON.parse(await readFile(resolve(SKELETON_PATH), "utf8")) as SkeletonWord[];
  const loaded = input.type === "xlsx" ? await readXlsxRows(input.path) : await readCsvRows(input.path);
  if (!loaded) {
    process.exitCode = 1;
    return;
  }

  const index = buildSkeletonIndex(skeleton);
  const enriched: EnrichedWord[] = [];
  const errors: Array<{ originalLine: number; reason: string; row: Record<string, string> }> = [];
  const warnings: Array<{ originalLine: number; reason: string; word: string }> = [];
  let missingFullMeanings = 0;
  let missingPartOfSpeech = 0;

  for (const row of loaded.rows) {
    const parsed = parseEnrichedRow(row, index);
    if ("error" in parsed) {
      errors.push({ originalLine: row.originalLine, reason: parsed.error, row: row.values });
      continue;
    }
    if (!parsed.word.fullMeanings) missingFullMeanings += 1;
    if (!parsed.word.partOfSpeech) missingPartOfSpeech += 1;
    if (parsed.word.alignment === "unmatched") {
      warnings.push({ originalLine: row.originalLine, reason: "could not align to skeleton", word: parsed.word.word });
    }
    enriched.push(parsed.word);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    input: input.path,
    sheetName: loaded.sheetName,
    sheetNames: loaded.sheetNames,
    headers: loaded.headers,
    output: OUTPUT_PATH,
    totalRows: loaded.rows.length,
    validRows: enriched.length,
    invalidRows: errors.length,
    missingFullMeanings,
    missingPartOfSpeech,
    unmatchedRows: warnings.length,
    errors: errors.slice(0, 100),
    warnings: warnings.slice(0, 100),
  };

  await writeFile(resolve(BUILD_REPORT_PATH), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(resolve(SKIPPED_REPORT_PATH), `${JSON.stringify(errors, null, 2)}\n`, "utf8");
  if (enriched.length === 0) {
    console.error("No valid enriched rows were found.");
    console.error(`Build report: ${BUILD_REPORT_PATH}`);
    process.exitCode = 1;
    return;
  }

  if (errors.length > 0) {
    console.warn(`Skipped invalid enriched rows: ${errors.length}`);
    console.warn(`Build report: ${BUILD_REPORT_PATH}`);
  }

  enriched.sort((a, b) => {
    const aOrder = a.sourceId ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.sourceId ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || (a.sourceOrder ?? a.originalLine) - (b.sourceOrder ?? b.originalLine);
  });

  await writeFile(resolve(OUTPUT_PATH), `${JSON.stringify(enriched, null, 2)}\n`, "utf8");
  console.log(`Input: ${input.path}`);
  console.log(`Sheet: ${loaded.sheetName ?? "(csv)"}`);
  console.log(`Built enriched words: ${enriched.length}`);
  console.log(`Missing fullMeanings: ${missingFullMeanings}`);
  console.log(`Missing partOfSpeech: ${missingPartOfSpeech}`);
  console.log(`Unmatched rows: ${warnings.length}`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log(`Build report: ${BUILD_REPORT_PATH}`);
  console.log(`Skipped report: ${SKIPPED_REPORT_PATH}`);
}

async function exists(path: string) {
  try {
    await stat(resolve(path));
    return true;
  } catch {
    return false;
  }
}

async function findInput() {
  const candidates: Array<{ path: string; type: "xlsx" | "csv" }> = [
    { path: CLEAN_XLSX_INPUT_PATH, type: "xlsx" },
    { path: CLEAN_CSV_INPUT_PATH, type: "csv" },
    { path: XLSX_INPUT_PATH, type: "xlsx" },
    { path: CSV_INPUT_PATH, type: "csv" },
  ];
  for (const candidate of candidates) {
    if (await exists(candidate.path)) {
      return candidate;
    }
  }
  return null;
}

function printMissingInputHelp() {
  console.error("No enriched wordlist found.");
  console.error("Please place one of these files in the project:");
  console.error(`- ${CLEAN_XLSX_INPUT_PATH} (preferred clean workbook)`);
  console.error(`- ${CLEAN_CSV_INPUT_PATH} (clean CSV fallback)`);
  console.error(`- ${XLSX_INPUT_PATH} (preferred)`);
  console.error(`- ${CSV_INPUT_PATH} (CSV fallback)`);
  console.error("Required fields: word, coreMeaning, section, unit, sourceId or sourceOrder.");
  console.error("Clean files may also include: choiceMeaning, fullMeanings, rawMeaning, phonetic, partOfSpeech.");
  console.error("Supported aliases include: meaning_zh -> coreMeaning/fullMeanings, unit_order -> sourceOrder.");
  console.error("Optional but recommended fields: fullMeanings, partOfSpeech, sourcePage.");
}

async function readXlsxRows(path: string): Promise<LoadedRows | null> {
  try {
    const xlsx = require("xlsx") as {
      readFile: (path: string) => { SheetNames: string[]; Sheets: Record<string, unknown> };
      utils: { sheet_to_json: (sheet: unknown, options: { defval: string }) => Array<Record<string, string | number | null>> };
    };
    const book = xlsx.readFile(resolve(path));
    const candidates = book.SheetNames.map((sheetName) => {
      const sheet = book.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" }).map((row, index) => ({
        values: Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim(), String(value ?? "").trim()])),
        originalLine: index + 2,
      }));
      const headers = rows[0] ? Object.keys(rows[0].values) : [];
      return { sheetName, rows, headers, score: scoreHeaders(headers) };
    }).sort((a, b) => b.score - a.score || b.rows.length - a.rows.length);

    const selected = candidates[0];
    if (!selected || selected.score < 2) {
      console.error(`Could not find a data sheet in ${path}.`);
      console.error("Expected headers such as word and coreMeaning/meaning_zh.");
      console.error(`Sheets found: ${book.SheetNames.join(", ")}`);
      return null;
    }

    return {
      sheetName: selected.sheetName,
      sheetNames: book.SheetNames,
      headers: selected.headers,
      rows: selected.rows,
    };
  } catch (error) {
    console.error(`Found ${path}, but it could not be parsed.`);
    console.error("Please check the workbook format, or export it as a clean CSV and rerun pnpm run words:build-enriched.");
    console.error(error instanceof Error ? error.message : error);
    return null;
  }
}

interface LoadedRows {
  rows: RawRow[];
  headers: string[];
  sheetName: string | null;
  sheetNames: string[];
}

async function readCsvRows(path: string): Promise<LoadedRows> {
  const text = stripBom(await readFile(resolve(path), "utf8"));
  const rows = parseCsv(text);
  const headers = rows[0]?.map((item) => item.trim()) ?? [];
  return {
    sheetName: null,
    sheetNames: [],
    headers,
    rows: rows.slice(1).flatMap((row, index) => {
      if (row.length === 1 && row[0].trim() === "") return [];
      return [{
        originalLine: index + 2,
        values: headers.reduce<Record<string, string>>((record, header, headerIndex) => {
          record[header] = row[headerIndex]?.trim() ?? "";
          return record;
        }, {}),
      }];
    }),
  };
}

function scoreHeaders(headers: string[]) {
  let score = 0;
  if (hasField(headers, "word")) score += 2;
  if (hasField(headers, "coreMeaning")) score += 2;
  if (hasField(headers, "section")) score += 1;
  if (hasField(headers, "unit")) score += 1;
  if (hasField(headers, "sourceOrder")) score += 1;
  return score;
}

function hasField(headers: string[], field: keyof typeof FIELD_ALIASES) {
  return headers.some((header) => FIELD_ALIASES[field].some((alias) => normalizeHeader(header) === normalizeHeader(alias)));
}

function parseEnrichedRow(row: RawRow, index: ReturnType<typeof buildSkeletonIndex>): { word: EnrichedWord } | { error: string } {
  const word = getField(row.values, "word");
  const coreMeaning = getField(row.values, "coreMeaning");
  if (!word) return { error: "word is required" };
  if (!coreMeaning) return { error: "coreMeaning is required" };

  const sourceId = parseOptionalInteger(getField(row.values, "sourceId"));
  const sourceOrder = parseOptionalInteger(getField(row.values, "sourceOrder"));
  const originalLine = parseOptionalInteger(getField(row.values, "originalLine")) ?? row.originalLine;
  const rowSection = getField(row.values, "section");
  const rowUnit = parseOptionalInteger(getField(row.values, "unit"));
  const aligned = alignSkeleton({ word, section: rowSection, unit: rowUnit, sourceId, sourceOrder, originalLine }, index);
  const unitValue = rowUnit === null ? (aligned?.unit === null ? null : String(aligned?.unit ?? "")) : String(rowUnit);

  return {
    word: {
      sourceId: aligned?.source_id ?? sourceId ?? null,
      sourceOrder: aligned?.source_order ?? sourceOrder ?? null,
      originalLine,
      sourcePage: getField(row.values, "sourcePage") ?? null,
      wordRaw: getField(row.values, "wordRaw") ?? aligned?.word_raw ?? null,
      word,
      displayWord: getField(row.values, "displayWord") ?? null,
      coreMeaning,
      choiceMeaning: getField(row.values, "choiceMeaning") ?? null,
      choiceUsable: parseOptionalBoolean(getField(row.values, "choiceUsable")),
      fullMeanings: getField(row.values, "fullMeanings") ?? null,
      rawMeaning: getField(row.values, "rawMeaning") ?? null,
      phonetic: getField(row.values, "phonetic") ?? null,
      partOfSpeech: getField(row.values, "partOfSpeech") ?? null,
      section: rowSection ?? aligned?.section ?? null,
      unit: parseOptionalInteger(unitValue),
      subsection: getField(row.values, "subsection") ?? aligned?.subsection ?? null,
      flags: aligned?.flags ?? null,
      needsReview: parseOptionalBoolean(getField(row.values, "needsReview")),
      reviewReason: getField(row.values, "reviewReason") ?? null,
      cleanStatus: getField(row.values, "cleanStatus") ?? null,
      codexImportKey: getField(row.values, "codexImportKey") ?? null,
      alignment: alignmentType({ sourceId, sourceOrder, originalLine }, aligned),
    },
  };
}

function getField(row: Record<string, string>, field: keyof typeof FIELD_ALIASES) {
  for (const alias of FIELD_ALIASES[field]) {
    const key = Object.keys(row).find((item) => normalizeHeader(item) === normalizeHeader(alias));
    const value = key ? row[key]?.trim() : "";
    if (value) return value;
  }
  return null;
}

function buildSkeletonIndex(skeleton: SkeletonWord[]) {
  const bySourceIdSection = new Map<string, SkeletonWord>();
  const bySectionUnitSourceOrder = new Map<string, SkeletonWord>();
  const bySectionUnitOriginalLine = new Map<string, SkeletonWord>();
  const bySectionUnitWord = new Map<string, SkeletonWord[]>();
  for (const item of skeleton) {
    bySourceIdSection.set(sourceIdSectionKey(item.source_id, item.section), item);
    bySectionUnitSourceOrder.set(sectionUnitOrderKey(item.section, item.unit, item.source_order), item);
    bySectionUnitOriginalLine.set(sectionUnitOrderKey(item.section, item.unit, item.source_id + 1), item);
    const wordKey = sectionUnitWordKey(item.section, item.unit, item.word);
    bySectionUnitWord.set(wordKey, [...(bySectionUnitWord.get(wordKey) ?? []), item]);
  }
  return { bySourceIdSection, bySectionUnitSourceOrder, bySectionUnitOriginalLine, bySectionUnitWord };
}

function alignSkeleton(
  row: { word: string; section: string | null; unit: number | null; sourceId: number | null; sourceOrder: number | null; originalLine: number },
  index: ReturnType<typeof buildSkeletonIndex>,
) {
  if (row.sourceId !== null && row.section) {
    const bySourceIdSection = index.bySourceIdSection.get(sourceIdSectionKey(row.sourceId, row.section));
    if (
      bySourceIdSection &&
      (sameWord(bySourceIdSection.word, row.word) ||
        (row.sourceOrder !== null && bySourceIdSection.source_order === row.sourceOrder))
    ) {
      return bySourceIdSection;
    }
  }
  if (row.sourceOrder !== null && row.section && row.unit !== null) {
    const positionMatched = index.bySectionUnitSourceOrder.get(sectionUnitOrderKey(row.section, row.unit, row.sourceOrder));
    if (positionMatched) return positionMatched;
  }
  if (row.section && row.unit !== null) {
    const byLine = index.bySectionUnitOriginalLine.get(sectionUnitOrderKey(row.section, row.unit, row.originalLine));
    if (byLine) return byLine;
    const wordMatches = index.bySectionUnitWord.get(sectionUnitWordKey(row.section, row.unit, row.word)) ?? [];
    if (wordMatches.length === 1) return wordMatches[0];
  }
  return null;
}

function alignmentType(
  row: { sourceId: number | null; sourceOrder: number | null; originalLine: number },
  aligned: SkeletonWord | null,
): EnrichedWord["alignment"] {
  if (!aligned) return "unmatched";
  if (row.sourceId !== null && row.sourceId === aligned.source_id) return "sourceIdSection";
  if (row.sourceOrder !== null && row.sourceOrder === aligned.source_order) return "sectionUnitSourceOrder";
  return "sectionUnitOriginalLine";
}

function sectionUnitOrderKey(section: string, unit: number | null, order: number) {
  return `${section}::${unit ?? ""}::${order}`;
}

function sectionUnitWordKey(section: string, unit: number | null, word: string) {
  return `${section}::${unit ?? ""}::${word.toLowerCase()}`;
}

function sourceIdSectionKey(sourceId: number, section: string) {
  return `${sourceId}::${section}`;
}

function sameWord(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function parseOptionalInteger(value: string | null | undefined) {
  const clean = value?.trim();
  if (!clean) return null;
  if (!/^\d+$/.test(clean)) return null;
  return Number(clean);
}

function parseOptionalBoolean(value: string | null | undefined) {
  const clean = value?.trim().toLowerCase();
  if (!clean) return null;
  if (["true", "1", "yes", "y", "\u662f"].includes(clean)) return true;
  if (["false", "0", "no", "n", "\u5426"].includes(clean)) return false;
  return null;
}

function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  return rows;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
}
