{
const { readFile, writeFile } = require("node:fs/promises") as typeof import("node:fs/promises");
const { resolve } = require("node:path") as typeof import("node:path");

const HEADERS = ["source_id", "section", "unit", "subsection", "source_order", "word_raw", "word", "flags"] as const;
const ALLOWED_SECTIONS = new Set(["必考词", "基础词", "超纲词"]);
const INPUT_PATH = "data/redbook_words.csv";
const OUTPUT_PATH = "data/redbook_words.json";
const SKIPPED_REPORT_PATH = "data/redbook_words.skipped.json";
const DUPLICATE_REPORT_PATH = "data/redbook_words.duplicates.json";
const STATS_REPORT_PATH = "data/redbook_words.stats.json";

interface RedbookJsonWord {
  source_id: number;
  section: string;
  unit: number | null;
  subsection: string | null;
  source_order: number;
  word_raw: string | null;
  word: string;
  flags: string | null;
}

interface WordWithMeta {
  word: RedbookJsonWord;
  originalLine: number;
  rawContent: string;
}

interface SkippedRow {
  originalLine: number;
  reason: string;
  rawContent: string;
}

interface DuplicateWordReport {
  word: string;
  count: number;
  occurrences: Array<{
    sourcePage: null;
    section: string;
    unit: number | null;
    subsection: string | null;
    sourceId: number;
    sourceOrder: number;
    originalLine: number;
    wordRaw: string | null;
  }>;
}

interface ConversionStats {
  csvTotalLines: number;
  csvNonEmptyLines: number;
  csvParsedRows: number;
  csvDataRowsIncludingEmpty: number;
  validWordRows: number;
  emptyRows: number;
  skippedRows: number;
  invalidRows: number;
  missingWordRows: number;
  duplicateSourceIdRows: number;
  duplicateWordGroups: number;
  duplicateWordExtraOccurrences: number;
  finalJsonRows: number;
  firstSourceId: number | null;
  lastSourceId: number | null;
  output: string;
  skippedReport: string;
  duplicateReport: string;
}

async function main() {
  const input = resolve(INPUT_PATH);
  const output = resolve(OUTPUT_PATH);
  const text = stripBom(await readFile(input, "utf8"));
  const parsedCsv = parseCsv(text);
  const rows = parsedCsv.rows;
  const headers = rows[0]?.map((header) => header.trim()) ?? [];
  const missing = HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new Error(`Missing CSV headers: ${missing.join(", ")}`);
  }

  const words: WordWithMeta[] = [];
  const skippedRows: SkippedRow[] = [];
  const seenSourceIds = new Set<number>();
  let emptyRows = 0;
  let missingWordRows = 0;
  let invalidRows = 0;
  let duplicateSourceIdRows = 0;

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const originalLine = index + 1;
    const rawContent = parsedCsv.rowTexts[index] ?? row.join(",");

    if (row.length === 1 && row[0].trim() === "") {
      emptyRows += 1;
      skippedRows.push({ originalLine, reason: "empty row", rawContent });
      continue;
    }

    if (row.length !== headers.length) {
      invalidRows += 1;
      skippedRows.push({
        originalLine,
        reason: `field count mismatch: expected ${headers.length}, got ${row.length}`,
        rawContent,
      });
      continue;
    }

    const raw = rowToObject(headers, row);
    const parsed = parseRow(raw, originalLine);
    if ("error" in parsed) {
      invalidRows += 1;
      if (parsed.reason === "missing word") {
        missingWordRows += 1;
      }
      skippedRows.push({ originalLine, reason: parsed.error, rawContent });
      continue;
    }

    if (seenSourceIds.has(parsed.word.source_id)) {
      duplicateSourceIdRows += 1;
      skippedRows.push({
        originalLine,
        reason: `duplicate source_id ${parsed.word.source_id}`,
        rawContent,
      });
      continue;
    }

    seenSourceIds.add(parsed.word.source_id);
    words.push({ word: parsed.word, originalLine, rawContent });
  }

  words.sort((a, b) => a.word.source_id - b.word.source_id);
  const jsonWords = words.map((item) => item.word);
  const duplicateReport = buildDuplicateReport(words);
  const stats: ConversionStats = {
    csvTotalLines: parsedCsv.totalLines,
    csvNonEmptyLines: parsedCsv.nonEmptyLines,
    csvParsedRows: rows.length,
    csvDataRowsIncludingEmpty: Math.max(0, rows.length - 1),
    validWordRows: words.length,
    emptyRows,
    skippedRows: skippedRows.length,
    invalidRows,
    missingWordRows,
    duplicateSourceIdRows,
    duplicateWordGroups: duplicateReport.length,
    duplicateWordExtraOccurrences: duplicateReport.reduce((sum, item) => sum + item.count - 1, 0),
    finalJsonRows: jsonWords.length,
    firstSourceId: jsonWords[0]?.source_id ?? null,
    lastSourceId: jsonWords.at(-1)?.source_id ?? null,
    output: OUTPUT_PATH,
    skippedReport: SKIPPED_REPORT_PATH,
    duplicateReport: DUPLICATE_REPORT_PATH,
  };

  await writeFile(output, `${JSON.stringify(jsonWords, null, 2)}\n`, "utf8");
  await writeFile(resolve(SKIPPED_REPORT_PATH), `${JSON.stringify(skippedRows, null, 2)}\n`, "utf8");
  await writeFile(resolve(DUPLICATE_REPORT_PATH), `${JSON.stringify(duplicateReport, null, 2)}\n`, "utf8");
  await writeFile(resolve(STATS_REPORT_PATH), `${JSON.stringify(stats, null, 2)}\n`, "utf8");

  printStats(stats);

  if (invalidRows > 0 || duplicateSourceIdRows > 0) {
    process.exitCode = 1;
  }
}

function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  const rowTexts: string[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let rowStart = 0;

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
      rowTexts.push(text.slice(rowStart, index).replace(/\r$/, ""));
      row = [];
      field = "";
      rowStart = index + 1;
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  rowTexts.push(text.slice(rowStart).replace(/\r$/, ""));

  const physicalLines = text.split(/\r\n|\r|\n/);
  return {
    rows,
    rowTexts,
    totalLines: physicalLines.length,
    nonEmptyLines: physicalLines.filter((line) => line.trim()).length,
  };
}

function rowToObject(headers: string[], row: string[]) {
  return headers.reduce<Record<string, string>>((record, header, index) => {
    record[header] = row[index]?.trim() ?? "";
    return record;
  }, {});
}

function parseRow(raw: Record<string, string>, line: number): { word: RedbookJsonWord } | { error: string; reason: string } {
  const sourceId = parseInteger(raw.source_id);
  const sourceOrder = parseInteger(raw.source_order);
  const unit = raw.unit ? parseInteger(raw.unit) : null;
  if (sourceId === null) return { error: `Line ${line}: source_id must be an integer`, reason: "invalid source_id" };
  if (sourceOrder === null) return { error: `Line ${line}: source_order must be an integer`, reason: "invalid source_order" };
  if (raw.unit && unit === null) return { error: `Line ${line}: unit must be empty or an integer`, reason: "invalid unit" };
  if (!raw.word) return { error: `Line ${line}: word is required`, reason: "missing word" };
  if (!raw.section) return { error: `Line ${line}: section is required`, reason: "missing section" };
  if (!ALLOWED_SECTIONS.has(raw.section)) return { error: `Line ${line}: invalid section "${raw.section}"`, reason: "invalid section" };

  return {
    word: {
      source_id: sourceId,
      section: raw.section,
      unit,
      subsection: emptyToNull(raw.subsection),
      source_order: sourceOrder,
      word_raw: emptyToNull(raw.word_raw),
      word: raw.word,
      flags: emptyToNull(raw.flags),
    },
  };
}

function parseInteger(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }
  return Number(value);
}

function emptyToNull(value: string) {
  const clean = value.trim();
  return clean ? clean : null;
}

function buildDuplicateReport(words: WordWithMeta[]): DuplicateWordReport[] {
  const groups = new Map<string, WordWithMeta[]>();
  for (const item of words) {
    const key = item.word.word.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([word, items]) => ({
      word,
      count: items.length,
      occurrences: items.map((item) => ({
        sourcePage: null,
        section: item.word.section,
        unit: item.word.unit,
        subsection: item.word.subsection,
        sourceId: item.word.source_id,
        sourceOrder: item.word.source_order,
        originalLine: item.originalLine,
        wordRaw: item.word.word_raw,
      })),
    }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

function printStats(stats: ConversionStats) {
  console.log(`CSV total lines: ${stats.csvTotalLines}`);
  console.log(`CSV non-empty lines: ${stats.csvNonEmptyLines}`);
  console.log(`CSV parsed rows: ${stats.csvParsedRows}`);
  console.log(`CSV data rows including empty: ${stats.csvDataRowsIncludingEmpty}`);
  console.log(`Valid word rows: ${stats.validWordRows}`);
  console.log(`Empty rows: ${stats.emptyRows}`);
  console.log(`Skipped rows: ${stats.skippedRows}`);
  console.log(`Invalid rows: ${stats.invalidRows}`);
  console.log(`Missing word rows: ${stats.missingWordRows}`);
  console.log(`Duplicate source_id rows skipped: ${stats.duplicateSourceIdRows}`);
  console.log(`Duplicate word groups: ${stats.duplicateWordGroups}`);
  console.log(`Duplicate word extra occurrences: ${stats.duplicateWordExtraOccurrences}`);
  console.log(`Final JSON rows: ${stats.finalJsonRows}`);
  console.log(`First source_id: ${stats.firstSourceId ?? "n/a"}`);
  console.log(`Last source_id: ${stats.lastSourceId ?? "n/a"}`);
  console.log(`Output: ${stats.output}`);
  console.log(`Skipped report: ${stats.skippedReport}`);
  console.log(`Duplicate report: ${stats.duplicateReport}`);
  console.log(`Stats report: ${STATS_REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
}
