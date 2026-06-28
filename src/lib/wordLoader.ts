"use client";

import { PUBLIC_VOCAB_NAME } from "@/lib/vocab";
import { perfLog, perfNow } from "@/lib/perfLog";
import { compareSectionUnitKeys, formatUnit, parseUnitValue } from "@/lib/sectionUnit";
import { getWordMeta } from "@/lib/wordMeta";
import type { WordEntry } from "@/types/word";

export const UNREVIEWED_MEANING = "释义待校对";
export const WORD_UNIT_COUNT = 30;

export interface RedbookJsonWord {
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

interface WordIndexRow {
  id: string;
  sourceId: number;
  appOrder?: number;
  section: string;
  unit: number;
  file: string;
}

const unitWordsCache = new Map<number, WordEntry[]>();
const unitPromiseCache = new Map<number, Promise<WordEntry[]>>();
const wordsByIdCache = new Map<string, WordEntry>();
const unitsByIdCache = new Map<string, number>();
let indexPromise: Promise<WordIndexRow[]> | null = null;
let allWordsPromise: Promise<WordEntry[]> | null = null;

export { getWordMeta };

export async function loadWordsByUnits(units: Array<string | number | null | undefined>) {
  const normalizedUnits = normalizeUnitList(units);
  perfLog("loadWordsByUnits called", { count: normalizedUnits.length, units: normalizedUnits });
  if (normalizedUnits.length === 0) {
    return [];
  }

  const chunks = await Promise.all(normalizedUnits.map((unit) => loadUnitWords(unit)));
  return sortWords(chunks.flat());
}

export async function loadAllWords() {
  perfLog("loadAllWords called");
  if (!allWordsPromise) {
    const startedAt = perfNow();
    allWordsPromise = Promise.all(Array.from({ length: WORD_UNIT_COUNT }, (_, index) => loadUnitWords(index + 1)))
      .then((chunks) => sortWords(chunks.flat()))
      .then((words) => {
        perfLog("loadAllWords end", { total: words.length, ms: Math.round(perfNow() - startedAt) });
        return words;
      })
      .catch((error) => {
        allWordsPromise = null;
        throw error;
      });
  } else {
    perfLog("loadAllWords reused");
  }
  return allWordsPromise;
}

export async function loadWordsByIds(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return [];
  }

  const missingIds = uniqueIds.filter((id) => !wordsByIdCache.has(id));
  if (missingIds.length > 0) {
    const index = await loadWordIndex();
    const idsByUnit = new Map<number, string[]>();

    for (const id of missingIds) {
      const unit = unitsByIdCache.get(id) ?? index.find((row) => row.id === id)?.unit;
      if (unit) {
        const current = idsByUnit.get(unit) ?? [];
        current.push(id);
        idsByUnit.set(unit, current);
      }
    }

    perfLog("loadWordsByIds units", {
      ids: uniqueIds.length,
      units: Array.from(idsByUnit.keys()).sort((a, b) => a - b),
    });
    await Promise.all(Array.from(idsByUnit.keys()).map((unit) => loadUnitWords(unit)));
  }

  return sortWords(uniqueIds.map((id) => wordsByIdCache.get(id)).filter((word): word is WordEntry => Boolean(word)));
}

export async function loadWordIndex() {
  if (!indexPromise) {
    perfLog("loadWordIndex called");
    const startedAt = perfNow();
    indexPromise = fetch("/data/words/index.json", { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("词库索引加载失败，请检查网络后重试。");
        }
        return response.json() as Promise<WordIndexRow[]>;
      })
      .then((rows) => {
        rows.forEach((row) => {
          unitsByIdCache.set(row.id, row.unit);
        });
        perfLog("loadWordIndex end", { rows: rows.length, ms: Math.round(perfNow() - startedAt) });
        return rows;
      })
      .catch((error) => {
        indexPromise = null;
        throw error;
      });
  } else {
    perfLog("loadWordIndex reused");
  }
  return indexPromise;
}

export function getCachedWordById(id: string) {
  return wordsByIdCache.get(id) ?? null;
}

export function getKnownSectionUnitKeys() {
  return Array.from({ length: WORD_UNIT_COUNT }, (_, index) => `基础词::Unit ${index + 1}`).sort(compareSectionUnitKeys);
}

async function loadUnitWords(unit: number) {
  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedUnit) {
    return [];
  }

  const cached = unitWordsCache.get(normalizedUnit);
  if (cached) {
    perfLog("loadUnitWords cache hit", { unit: normalizedUnit });
    return cached;
  }

  const existingPromise = unitPromiseCache.get(normalizedUnit);
  if (existingPromise) {
    perfLog("loadUnitWords promise reused", { unit: normalizedUnit });
    return existingPromise;
  }

  perfLog("loadUnitWords called", { unit: normalizedUnit });
  const startedAt = perfNow();
  const promise = fetch(`/data/words/${unitFileName(normalizedUnit)}`, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("词库加载失败，请检查网络后重试。");
      }
      return response.json() as Promise<RedbookJsonWord[]>;
    })
    .then((rows) => sortWords(rows.filter((row) => Boolean(row.word?.trim())).map(redbookJsonWordToEntry)))
    .then((words) => {
      unitWordsCache.set(normalizedUnit, words);
      for (const word of words) {
        wordsByIdCache.set(word.id, word);
        const unitValue = parseUnitValue(word.unit);
        if (unitValue) {
          unitsByIdCache.set(word.id, unitValue);
        }
      }
      perfLog("loadUnitWords end", {
        unit: normalizedUnit,
        total: words.length,
        ms: Math.round(perfNow() - startedAt),
      });
      return words;
    })
    .finally(() => {
      unitPromiseCache.delete(normalizedUnit);
    });

  unitPromiseCache.set(normalizedUnit, promise);
  return promise;
}

function normalizeUnitList(units: Array<string | number | null | undefined>) {
  return Array.from(new Set(units.map(normalizeUnit).filter((unit): unit is number => Boolean(unit)))).sort((a, b) => a - b);
}

function normalizeUnit(unit: string | number | null | undefined) {
  const value = parseUnitValue(unit);
  if (!value || value < 1 || value > WORD_UNIT_COUNT) {
    return null;
  }
  return value;
}

function unitFileName(unit: number) {
  return `u${String(unit).padStart(2, "0")}.json`;
}

function redbookSourceId(row: RedbookJsonWord) {
  return row.sourceId ?? row.source_id ?? row.appOrder ?? 0;
}

function redbookSourceOrder(row: RedbookJsonWord) {
  return row.sourceOrder ?? row.source_order ?? row.appOrder ?? 0;
}

function redbookJsonWordToEntry(row: RedbookJsonWord): WordEntry {
  const sourceId = redbookSourceId(row);
  const sourceOrder = redbookSourceOrder(row);
  return {
    id: `redbook-${sourceId}`,
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

function sortWords(words: WordEntry[]) {
  return words
    .slice()
    .sort((a, b) => (a.appOrder ?? a.sourceOrder ?? a.sourceId ?? 0) - (b.appOrder ?? b.sourceOrder ?? b.sourceId ?? 0));
}

function cleanNullable(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : undefined;
}
