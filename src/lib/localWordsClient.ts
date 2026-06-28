"use client";

import { compareSectionUnitKeys, parseUnitValue, sectionFromSectionUnitKey, wordSectionUnitKey } from "@/lib/sectionUnit";
import {
  getKnownSectionUnitKeys,
  loadAllWords,
  loadWordsByIds,
  loadWordsByUnits,
  UNREVIEWED_MEANING,
} from "@/lib/wordLoader";
import type { WordEntry } from "@/types/word";

export { UNREVIEWED_MEANING };
export const DEFAULT_WORD_PAGE_SIZE = 100;

export interface WordQuery {
  ids?: string[];
  section?: string;
  unit?: string | number | null;
  units?: string[];
  all?: boolean;
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

export async function getLocalWordsResult(query: WordQuery = {}): Promise<WordsResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.max(1, query.pageSize ?? DEFAULT_WORD_PAGE_SIZE);
  const normalized = query.q?.trim().toLowerCase() ?? "";
  const entries = await loadScopedWords(query, normalized);
  const idSet = query.ids?.length ? new Set(query.ids) : null;
  const unitKey = typeof query.unit === "string" && query.unit.includes("::") ? query.unit : null;
  const unit = unitKey ? null : parseUnitValue(query.unit);
  const section = (unitKey ? sectionFromSectionUnitKey(unitKey) : query.section)?.trim();

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
    units: getKnownSectionUnitKeys().sort(compareSectionUnitKeys),
    source: "redbook-clean-json",
  };
}

export async function getLocalWordById(id: string) {
  const words = await loadWordsByIds([id]);
  return words[0] ?? null;
}

async function loadScopedWords(query: WordQuery, normalizedQuery: string) {
  if (Array.isArray(query.ids)) {
    if (query.ids.length === 0 || query.ids.every((id) => id.startsWith("__"))) {
      return [];
    }
    return loadWordsByIds(query.ids);
  }

  const requestedUnits = query.units?.length ? query.units : query.unit ? [query.unit] : [];
  if (requestedUnits.length > 0 && !normalizedQuery) {
    return loadWordsByUnits(requestedUnits);
  }

  if (requestedUnits.length > 0 && normalizedQuery) {
    return loadWordsByUnits(requestedUnits);
  }

  if (query.all) {
    return loadAllWords();
  }

  return [];
}
