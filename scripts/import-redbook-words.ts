{
const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
const { readFile } = require("node:fs/promises") as typeof import("node:fs/promises");
const { resolve } = require("node:path") as typeof import("node:path");

const REQUIRED_HEADERS = ["source_id", "section", "unit", "subsection", "source_order", "word_raw", "word", "flags"] as const;
const REQUIRED_VALUES = ["source_id", "section", "source_order", "word"] as const;
const ALLOWED_SECTIONS = new Set(["必考词", "基础词", "超纲词"]);
const BATCH_SIZE = 500;

type CsvHeader = (typeof REQUIRED_HEADERS)[number];

interface ParsedWord {
  source_id: number;
  section: string;
  unit: number | null;
  subsection: string | null;
  source_order: number;
  word_raw: string | null;
  word: string;
  flags: string | null;
}

interface ImportOptions {
  dryRun: boolean;
  filePath: string;
}

interface ImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  inserted: number;
  updated: number;
  errors: string[];
}

type RowValidationResult = { ok: true; word: ParsedWord } | { ok: false; error: string };

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const summary = await importRedbookWords(options);
  printSummary(summary, options.dryRun);

  if (summary.invalidRows > 0 || summary.errors.length > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): ImportOptions {
  let filePath = "data/redbook_words.csv";
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--file") {
      const next = args[index + 1];
      if (!next) {
        throw new Error("--file requires a path.");
      }
      filePath = next;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { dryRun, filePath };
}

async function importRedbookWords(options: ImportOptions): Promise<ImportSummary> {
  const summary: ImportSummary = {
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    inserted: 0,
    updated: 0,
    errors: [],
  };

  let csvText = "";
  try {
    csvText = await readFile(resolve(options.filePath), "utf8");
  } catch (error) {
    summary.errors.push(`Cannot read CSV file: ${options.filePath}. ${error instanceof Error ? error.message : String(error)}`);
    return summary;
  }

  const rows = parseCsv(stripBom(csvText));
  if (rows.length === 0) {
    summary.errors.push("CSV is empty.");
    return summary;
  }

  const headers = rows[0].map((header) => header.trim()) as CsvHeader[];
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    summary.errors.push(`Missing required headers: ${missingHeaders.join(", ")}`);
    return summary;
  }

  const records: ParsedWord[] = [];
  const seenSourceIds = new Set<number>();
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (row.length === 1 && row[0].trim() === "") {
      continue;
    }

    summary.totalRows += 1;
    const raw = rowToObject(headers, row);
    const validation = validateRow(raw, rowIndex + 1);
    if (!validation.ok) {
      summary.invalidRows += 1;
      summary.errors.push(validation.error);
      continue;
    }

    if (seenSourceIds.has(validation.word.source_id)) {
      summary.invalidRows += 1;
      summary.errors.push(`Line ${rowIndex + 1}: duplicate source_id ${validation.word.source_id} in CSV.`);
      continue;
    }

    seenSourceIds.add(validation.word.source_id);
    records.push(validation.word);
    summary.validRows += 1;
  }

  records.sort((a, b) => a.source_id - b.source_id);

  if (options.dryRun || records.length === 0) {
    return summary;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    summary.errors.push("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for import.");
    return summary;
  }

  if (supabaseUrl.includes("/rest/v1")) {
    summary.errors.push("SUPABASE_URL must be the project root URL, not a /rest/v1 API URL.");
    return summary;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  for (let index = 0; index < records.length; index += BATCH_SIZE) {
    const batch = records.slice(index, index + BATCH_SIZE);
    const sourceIds = batch.map((record) => record.source_id);
    const { data: existingRows, error: selectError } = await supabase
      .from("words")
      .select("source_id")
      .in("source_id", sourceIds);

    if (selectError) {
      summary.errors.push(`Batch ${index / BATCH_SIZE + 1}: failed to fetch existing rows. ${selectError.message}`);
      continue;
    }

    const existing = new Set((existingRows ?? []).map((row) => row.source_id as number));
    const { error: upsertError } = await supabase.from("words").upsert(batch, { onConflict: "source_id" });

    if (upsertError) {
      summary.errors.push(`Batch ${index / BATCH_SIZE + 1}: upsert failed. ${upsertError.message}`);
      continue;
    }

    summary.updated += batch.filter((record) => existing.has(record.source_id)).length;
    summary.inserted += batch.filter((record) => !existing.has(record.source_id)).length;
  }

  return summary;
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

function rowToObject(headers: CsvHeader[], row: string[]) {
  return headers.reduce<Record<string, string>>((record, header, index) => {
    record[header] = row[index]?.trim() ?? "";
    return record;
  }, {});
}

function validateRow(raw: Record<string, string>, lineNumber: number): RowValidationResult {
  const missing = REQUIRED_VALUES.filter((field) => !raw[field]);
  if (missing.length > 0) {
    return { ok: false, error: `Line ${lineNumber}: missing required values: ${missing.join(", ")}.` };
  }

  if (!ALLOWED_SECTIONS.has(raw.section)) {
    return { ok: false, error: `Line ${lineNumber}: invalid section "${raw.section}".` };
  }

  const sourceId = parseInteger(raw.source_id);
  if (sourceId === null) {
    return { ok: false, error: `Line ${lineNumber}: source_id must be an integer.` };
  }

  const sourceOrder = parseInteger(raw.source_order);
  if (sourceOrder === null) {
    return { ok: false, error: `Line ${lineNumber}: source_order must be an integer.` };
  }

  const unit = raw.unit ? parseInteger(raw.unit) : null;
  if (raw.unit && unit === null) {
    return { ok: false, error: `Line ${lineNumber}: unit must be empty or an integer.` };
  }

  return {
    ok: true,
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
  if (!/^-?\d+$/.test(value.trim())) {
    return null;
  }
  return Number(value);
}

function emptyToNull(value: string) {
  const clean = value.trim();
  return clean ? clean : null;
}

function printSummary(summary: ImportSummary, dryRun: boolean) {
  console.log(`Mode: ${dryRun ? "dry-run" : "import"}`);
  console.log(`CSV total rows: ${summary.totalRows}`);
  console.log(`Valid rows: ${summary.validRows}`);
  console.log(`Invalid rows: ${summary.invalidRows}`);
  console.log(`Inserted rows: ${summary.inserted}`);
  console.log(`Updated rows: ${summary.updated}`);
  if (summary.errors.length > 0) {
    console.log("Error summary:");
    for (const error of summary.errors.slice(0, 20)) {
      console.log(`- ${error}`);
    }
    if (summary.errors.length > 20) {
      console.log(`- ... ${summary.errors.length - 20} more errors`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
}
