"use client";

import { PUBLIC_VOCAB_NAME } from "@/lib/vocab";
import {
  compareSectionUnitKeys,
  formatUnit,
  parseUnitValue,
  sectionFromSectionUnitKey,
  wordSectionUnitKey,
} from "@/lib/sectionUnit";
import type { WordEntry } from "@/types/word";

export const UNREVIEWED_MEANING = "释义待校对";
export const DEFAULT_WORD_PAGE_SIZE = 100;

export interface WordQuery {
  ids?: string[];
  section?: string;
  unit?: string | number | null;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface WordsResult {
  words: WordEntry[];
  total: number;
  page: number;
  pageSize: number;
  units: string[];
  source: WordSource;
}

export type WordSource = "supabase" | "redbook-clean-json" | "redbook-merged-json" | "redbook-enriched-json" | "redbook-json" | "mock";

interface RedbookJsonWord {
  appOrder?: number;
  sourceId?: number;
  source_id?: number;
  section: string;
  unit: number | null;
  subsection: string | null;
  sourceOrder?: number | null;
  source_order?: number;
  wordRaw?: string | null;
  word_raw?: string | null;
  word: string;
  displayWord?: string | null;
  coreMeaning?: string | null;
  choiceMeaning?: string | null;
  choiceUsable?: boolean | null;
  rawMeaning?: string | null;
  fullMeanings?: string | null;
  phonetic?: string | null;
  partOfSpeech?: string | null;
  sourcePage?: number | string | null;
  flags?: string | null;
  originalLine?: number;
  needsReview?: boolean | null;
  reviewReason?: string | null;
  cleanStatus?: string | null;
  codex_import_key?: string | null;
  codexImportKey?: string | null;
}

let localWordsPromise: Promise<WordEntry[]> | null = null;

export async function getLocalWordsResult(query: WordQuery = {}): Promise<WordsResult> {
  const entries = await loadLocalWords();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.max(1, query.pageSize ?? DEFAULT_WORD_PAGE_SIZE);
  const idSet = query.ids?.length ? new Set(query.ids) : null;
  const unitKey = typeof query.unit === "string" && query.unit.includes("::") ? query.unit : null;
  const unit = unitKey ? null : parseUnitValue(query.unit);
  const section = (unitKey ? sectionFromSectionUnitKey(unitKey) : query.section)?.trim();
  const normalized = query.q?.trim().toLowerCase() ?? "";

  const filtered = entries
    .filter((word) => !idSet || idSet.has(word.id))
    .filter((word) => !section || word.section === section)
    .filter((word) => !unitKey || wordSectionUnitKey(word) === unitKey)
    .filter((word) => unit === null || parseUnitValue(word.unit) === unit)
    .filter((word) => {
      if (!normalized) return true;
      return (
        word.word.toLowerCase().includes(normalized) ||
        word.displayWord?.toLowerCase().includes(normalized) ||
        word.wordRaw?.toLowerCase().includes(normalized) ||
        word.coreMeaning.includes(query.q ?? "") ||
        word.choiceMeaning?.includes(query.q ?? "") ||
        word.fullMeanings?.includes(query.q ?? "") ||
        word.unit?.toLowerCase().includes(normalized)
      );
    });

  const start = (page - 1) * pageSize;
  return {
    words: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    units: getLocalWordUnits(entries),
    source: "redbook-clean-json",
  };
}

export async function getLocalWordById(id: string) {
  const entries = await loadLocalWords();
  return entries.find((word) => word.id === id) ?? null;
}

async function loadLocalWords() {
  if (!localWordsPromise) {
    localWordsPromise = fetch("/data/redbook_words.json", { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("词库文件加载失败。");
        }
        return response.json() as Promise<RedbookJsonWord[]>;
      })
      .then((words) =>
        words
          .filter((word) => Boolean(word.word?.trim()))
          .slice()
          .sort((a, b) => redbookAppOrder(a) - redbookAppOrder(b))
          .map(redbookJsonWordToEntry),
      );
  }
  return localWordsPromise;
}

function getLocalWordUnits(entries: WordEntry[]) {
  return Array.from(new Set(entries.map((word) => wordSectionUnitKey(word)))).sort(compareSectionUnitKeys);
}

function redbookSourceId(row: RedbookJsonWord) {
  return row.sourceId ?? row.source_id ?? row.appOrder ?? 0;
}

function redbookSourceOrder(row: RedbookJsonWord) {
  return row.sourceOrder ?? row.source_order ?? row.appOrder ?? 0;
}

function redbookAppOrder(row: RedbookJsonWord) {
  return row.appOrder ?? redbookSourceOrder(row) ?? redbookSourceId(row);
}

function redbookWordId(sourceId: number) {
  return `redbook-${sourceId}`;
}

function redbookJsonWordToEntry(row: RedbookJsonWord): WordEntry {
  const sourceId = redbookSourceId(row);
  const sourceOrder = redbookSourceOrder(row);
  return {
    id: redbookWordId(sourceId),
    word: row.word,
    appOrder: row.appOrder,
    wordRaw: cleanNullable(row.wordRaw ?? row.word_raw),
    coreMeaning: cleanNullable(row.coreMeaning) ?? UNREVIEWED_MEANING,
    displayWord: cleanNullable(row.displayWord),
    choiceMeaning: cleanNullable(row.choiceMeaning),
    choiceUsable: row.choiceUsable ?? undefined,
    rawMeaning: cleanNullable(row.rawMeaning),
    fullMeanings: cleanNullable(row.fullMeanings),
    phonetic: cleanNullable(row.phonetic),
    partOfSpeech: cleanNullable(row.partOfSpeech),
    category: "考研英语",
    book: PUBLIC_VOCAB_NAME,
    section: row.section,
    unit: formatUnit(row.unit),
    subsection: cleanNullable(row.subsection),
    sourceId,
    sourceOrder,
    sourcePage: row.sourcePage ?? undefined,
    originalLine: row.originalLine ?? sourceId + 1,
    needsReview: row.needsReview ?? undefined,
    reviewReason: cleanNullable(row.reviewReason),
    cleanStatus: cleanNullable(row.cleanStatus),
    codexImportKey: cleanNullable(row.codexImportKey ?? row.codex_import_key),
  } satisfies WordEntry;
}

function cleanNullable(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : undefined;
}
