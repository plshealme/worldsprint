import { PUBLIC_VOCAB_NAME } from "@/lib/vocab";
import type { WordEntry } from "@/types/word";

export const UNREVIEWED_MEANING = "释义待校对";
export const DEFAULT_WORD_PAGE_SIZE = 100;

export interface RedbookWordRow {
  id: number;
  source_id: number;
  word: string;
  word_raw: string | null;
  section: string;
  unit: number | null;
  subsection: string | null;
  source_order: number;
  flags: string | null;
  phonetic: string | null;
  part_of_speech: string | null;
  meaning: string | null;
  is_reviewed: boolean;
  created_at: string;
  updated_at: string;
}

export function redbookRowToWordEntry(row: RedbookWordRow): WordEntry {
  const meaning = cleanNullable(row.meaning);
  return {
    id: redbookWordId(row.source_id),
    word: row.word,
    coreMeaning: meaning ?? UNREVIEWED_MEANING,
    wordRaw: cleanNullable(row.word_raw),
    phonetic: cleanNullable(row.phonetic),
    partOfSpeech: cleanNullable(row.part_of_speech),
    fullMeanings: meaning ?? undefined,
    category: "考研英语",
    book: PUBLIC_VOCAB_NAME,
    section: row.section,
    unit: formatUnit(row.unit),
    subsection: cleanNullable(row.subsection),
    sourceId: row.source_id,
    sourceOrder: row.source_order,
    originalLine: row.source_id + 1,
    officialTags: undefined,
  } satisfies WordEntry;
}

export function redbookWordId(sourceId: number) {
  return `redbook-${sourceId}`;
}

export function sourceIdFromWordId(wordId: string) {
  const match = /^redbook-(\d+)$/.exec(wordId);
  return match ? Number(match[1]) : null;
}

export function formatUnit(unit: number | null | undefined) {
  return typeof unit === "number" ? `Unit ${unit}` : undefined;
}

export function parseUnitValue(unit: string | number | null | undefined) {
  if (typeof unit === "number") {
    return Number.isFinite(unit) ? unit : null;
  }
  if (!unit) {
    return null;
  }
  const match = /(\d+)/.exec(unit);
  return match ? Number(match[1]) : null;
}

function cleanNullable(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : undefined;
}
