import { mockWords } from "@/data/mockWords";
import redbookWordsJson from "../../data/redbook_words.json";
import { PUBLIC_VOCAB_NAME } from "@/lib/vocab";
import type { WordEntry } from "@/types/word";

export const UNREVIEWED_MEANING = "释义待校对";
export const DEFAULT_WORD_PAGE_SIZE = 100;

export interface RedbookWordRow {
  id: number;
  source_id: number;
  word: string;
  word_raw: string | null;
  section: "必考词" | "基础词" | "超纲词";
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

interface RedbookEnrichedJsonWord {
  sourceId: number | null;
  sourceOrder: number | null;
  originalLine: number;
  sourcePage: number | string | null;
  wordRaw: string | null;
  word: string;
  displayWord?: string | null;
  coreMeaning: string;
  choiceMeaning?: string | null;
  choiceUsable?: boolean | null;
  rawMeaning?: string | null;
  fullMeanings: string | null;
  phonetic?: string | null;
  partOfSpeech: string | null;
  section: string | null;
  unit: number | null;
  subsection: string | null;
  flags: string | null;
  needsReview?: boolean | null;
  reviewReason?: string | null;
  cleanStatus?: string | null;
  codexImportKey?: string | null;
  alignment?: string;
}

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
  source: "supabase" | "redbook-clean-json" | "redbook-merged-json" | "redbook-enriched-json" | "redbook-json" | "mock";
}

export type WordSource = WordsResult["source"];

const redbookJsonWords = (redbookWordsJson as RedbookJsonWord[])
  .filter((word) => Boolean(word.word?.trim()))
  .slice()
  .sort((a, b) => redbookAppOrder(a) - redbookAppOrder(b));
const activeRedbookEntries = redbookJsonWords.map(redbookJsonWordToEntry);
const enrichedJsonWords: RedbookEnrichedJsonWord[] = [];

function redbookSourceId(row: RedbookJsonWord) {
  return row.sourceId ?? row.source_id ?? row.appOrder ?? 0;
}

function redbookSourceOrder(row: RedbookJsonWord) {
  return row.sourceOrder ?? row.source_order ?? row.appOrder ?? 0;
}

function redbookAppOrder(row: RedbookJsonWord) {
  return row.appOrder ?? redbookSourceOrder(row) ?? redbookSourceId(row);
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
    category: mockWords[0]?.category,
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

export function sectionUnitKey(section: string | null | undefined, unit: string | number | null | undefined) {
  const cleanSection = section?.trim() || "未分 section";
  const cleanUnit = typeof unit === "number" ? formatUnit(unit) : unit?.trim();
  return `${cleanSection}::${cleanUnit || "未分单元"}`;
}

export function wordSectionUnitKey(word: Pick<WordEntry, "section" | "unit">) {
  return sectionUnitKey(word.section, word.unit);
}

export function sectionUnitLabelFromKey(key: string) {
  const [section, unit] = key.split("::");
  if (!section || section === "未分 section") {
    return unit || "未分单元";
  }
  return `${section} ${unit || "未分单元"}`;
}

export function sectionFromSectionUnitKey(key: string) {
  return key.includes("::") ? key.split("::")[0] : null;
}

export function unitFromSectionUnitKey(key: string) {
  return key.includes("::") ? key.split("::").slice(1).join("::") : key;
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

export async function fetchWords(query: WordQuery = {}): Promise<WordsResult> {
  const params = new URLSearchParams();
  if (query.ids?.length) params.set("ids", query.ids.join(","));
  const queryUnit = typeof query.unit === "string" && query.unit.includes("::") ? unitFromSectionUnitKey(query.unit) : query.unit;
  const querySection = typeof query.unit === "string" && query.unit.includes("::") ? sectionFromSectionUnitKey(query.unit) : query.section;
  if (querySection) params.set("section", querySection);
  const unit = parseUnitValue(queryUnit);
  if (unit !== null) params.set("unit", String(unit));
  if (query.q?.trim()) params.set("q", query.q.trim());
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? DEFAULT_WORD_PAGE_SIZE));

  const response = await fetch(`/api/words?${params.toString()}`, {
    credentials: "include",
  });
  const data = (await response.json().catch(() => null)) as (WordsResult & { error?: string }) | null;
  if (!response.ok || !data) {
    throw new Error(data?.error ?? "Failed to load words.");
  }
  return data;
}

export async function fetchWordById(id: string) {
  const response = await fetch(`/api/words/${encodeURIComponent(id)}`, {
    credentials: "include",
  });
  const data = (await response.json().catch(() => null)) as { word?: WordEntry; error?: string } | null;
  if (!response.ok || !data) {
    throw new Error(data?.error ?? "Failed to load word.");
  }
  return data.word ?? null;
}

export function getFallbackWordsResult(query: WordQuery = {}): WordsResult {
  if (redbookJsonWords.length > 0) {
    return getRedbookJsonWordsResult(query);
  }
  return getMockWordsResult(query);
}

export function getFallbackWordById(id: string) {
  return getRedbookJsonWordById(id) ?? getMockWordById(id);
}

export function wordSourceLabel(source: WordSource) {
  if (source === "supabase") return PUBLIC_VOCAB_NAME;
  if (source.startsWith("redbook")) return PUBLIC_VOCAB_NAME;
  return "开发示例词库";
}

export function getRedbookJsonWordsResult(query: WordQuery = {}): WordsResult {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.max(1, query.pageSize ?? DEFAULT_WORD_PAGE_SIZE);
  const idSet = query.ids?.length ? new Set(query.ids) : null;
  const unitKey = typeof query.unit === "string" && query.unit.includes("::") ? query.unit : null;
  const unit = unitKey ? null : parseUnitValue(query.unit);
  const section = query.section?.trim();
  const normalized = query.q?.trim().toLowerCase() ?? "";
  const filtered = getActiveRedbookEntries()
    .filter((word) => !idSet || idSet.has(word.id))
    .filter((word) => !section || word.section === section)
    .filter((word) => !unitKey || wordSectionUnitKey(word) === unitKey)
    .filter((word) => unit === null || parseUnitValue(word.unit) === unit)
    .filter((word) => {
      if (!normalized) return true;
      return (
        word.word.toLowerCase().includes(normalized) ||
        word.wordRaw?.toLowerCase().includes(normalized) ||
        word.coreMeaning.includes(query.q ?? "") ||
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
    units: getRedbookJsonUnits(),
    source: "redbook-clean-json",
  };
}

export function getMockWordsResult(query: WordQuery = {}): WordsResult {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.max(1, query.pageSize ?? DEFAULT_WORD_PAGE_SIZE);
  const idSet = query.ids?.length ? new Set(query.ids) : null;
  const unitKey = typeof query.unit === "string" && query.unit.includes("::") ? query.unit : null;
  const unit = unitKey ? null : parseUnitValue(query.unit);
  const normalized = query.q?.trim().toLowerCase() ?? "";
  const filtered = mockWords
    .filter((word) => !idSet || idSet.has(word.id))
    .filter((word) => !unitKey || wordSectionUnitKey(word) === unitKey)
    .filter((word) => unit === null || parseUnitValue(word.unit) === unit)
    .filter((word) => {
      if (!normalized) return true;
      return (
        word.word.toLowerCase().includes(normalized) ||
        word.coreMeaning.includes(query.q ?? "") ||
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
    units: getMockWordUnits(),
    source: "mock",
  };
}

export function getRedbookJsonWordById(id: string) {
  return activeRedbookEntries.find((word) => word.id === id) ?? null;
}

export function getMockWordById(id: string) {
  return mockWords.find((word) => word.id === id) ?? null;
}

export function getRedbookJsonUnits() {
  return Array.from(
    new Set(activeRedbookEntries.map((word) => wordSectionUnitKey(word))),
  ).sort(compareSectionUnitKeys);
}

export function getMockWordUnits() {
  return Array.from(new Set(mockWords.map((word) => wordSectionUnitKey(word)))).sort(compareSectionUnitKeys);
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
    category: mockWords[0]?.category,
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

function enrichedJsonWordToEntry(row: RedbookEnrichedJsonWord): WordEntry {
  return {
    id: row.sourceId ? redbookWordId(row.sourceId) : `redbook-enriched-${row.originalLine}`,
    word: row.word,
    wordRaw: cleanNullable(row.wordRaw),
    coreMeaning: row.coreMeaning,
    displayWord: cleanNullable(row.displayWord),
    choiceMeaning: cleanNullable(row.choiceMeaning),
    choiceUsable: row.choiceUsable ?? undefined,
    rawMeaning: cleanNullable(row.rawMeaning),
    fullMeanings: cleanNullable(row.fullMeanings),
    phonetic: cleanNullable(row.phonetic),
    partOfSpeech: cleanNullable(row.partOfSpeech),
    category: mockWords[0]?.category,
    book: PUBLIC_VOCAB_NAME,
    section: cleanNullable(row.section),
    unit: formatUnit(row.unit),
    subsection: cleanNullable(row.subsection),
    sourceId: row.sourceId ?? undefined,
    sourceOrder: row.sourceOrder ?? undefined,
    sourcePage: row.sourcePage ?? undefined,
    originalLine: row.originalLine,
    needsReview: row.needsReview ?? undefined,
    reviewReason: cleanNullable(row.reviewReason),
    cleanStatus: cleanNullable(row.cleanStatus),
    codexImportKey: cleanNullable(row.codexImportKey),
  } satisfies WordEntry;
}

function buildMergedRedbookEntries() {
  const skeletonEntries = redbookJsonWords.map(redbookJsonWordToEntry);
  if (enrichedJsonWords.length === 0) {
    return skeletonEntries;
  }

  const skeletonIndex = buildSkeletonEntryIndex(skeletonEntries);
  const overlays = new Map<string, RedbookEnrichedJsonWord>();

  for (const enriched of enrichedJsonWords) {
    const target = findMergedTarget(enriched, skeletonIndex);
    if (target) {
      overlays.set(target.id, enriched);
    }
  }

  return skeletonEntries.map((entry) => {
    const overlay = overlays.get(entry.id);
    if (!overlay) {
      return entry;
    }
    return {
      ...entry,
      coreMeaning: overlay.coreMeaning,
      displayWord: cleanNullable(overlay.displayWord) ?? entry.displayWord,
      choiceMeaning: cleanNullable(overlay.choiceMeaning) ?? entry.choiceMeaning,
      choiceUsable: overlay.choiceUsable ?? entry.choiceUsable,
      rawMeaning: cleanNullable(overlay.rawMeaning) ?? entry.rawMeaning,
      fullMeanings: cleanNullable(overlay.fullMeanings) ?? entry.fullMeanings,
      phonetic: cleanNullable(overlay.phonetic) ?? entry.phonetic,
      partOfSpeech: cleanNullable(overlay.partOfSpeech) ?? entry.partOfSpeech,
      sourcePage: overlay.sourcePage ?? entry.sourcePage,
      needsReview: overlay.needsReview ?? entry.needsReview,
      reviewReason: cleanNullable(overlay.reviewReason) ?? entry.reviewReason,
      cleanStatus: cleanNullable(overlay.cleanStatus) ?? entry.cleanStatus,
      codexImportKey: cleanNullable(overlay.codexImportKey) ?? entry.codexImportKey,
    } satisfies WordEntry;
  });
}

function buildSkeletonEntryIndex(entries: WordEntry[]) {
  const bySourceIdSection = new Map<string, WordEntry>();
  const bySectionUnitSourceOrder = new Map<string, WordEntry>();
  const bySectionUnitOriginalLine = new Map<string, WordEntry>();
  const bySectionUnitWord = new Map<string, WordEntry[]>();

  for (const entry of entries) {
    if (typeof entry.sourceId === "number") {
      bySourceIdSection.set(sourceIdSectionKey(entry.sourceId, entry.section), entry);
    }
    if (typeof entry.sourceOrder === "number") {
      bySectionUnitSourceOrder.set(sectionUnitOrderKey(entry.section, entry.unit, entry.sourceOrder), entry);
    }
    if (typeof entry.originalLine === "number") {
      bySectionUnitOriginalLine.set(sectionUnitOrderKey(entry.section, entry.unit, entry.originalLine), entry);
    }
    const wordKey = sectionUnitWordKey(entry.section, entry.unit, entry.word);
    bySectionUnitWord.set(wordKey, [...(bySectionUnitWord.get(wordKey) ?? []), entry]);
  }

  return { bySourceIdSection, bySectionUnitSourceOrder, bySectionUnitOriginalLine, bySectionUnitWord };
}

function findMergedTarget(enriched: RedbookEnrichedJsonWord, index: ReturnType<typeof buildSkeletonEntryIndex>) {
  const section = enriched.section ?? undefined;
  const unit = formatUnit(enriched.unit);
  if (typeof enriched.sourceId === "number" && section) {
    const bySourceId = index.bySourceIdSection.get(sourceIdSectionKey(enriched.sourceId, section));
    if (bySourceId) return bySourceId;
  }
  if (typeof enriched.sourceOrder === "number" && section && unit) {
    const byPosition = index.bySectionUnitSourceOrder.get(sectionUnitOrderKey(section, unit, enriched.sourceOrder));
    if (byPosition) return byPosition;
  }
  if (typeof enriched.originalLine === "number" && section && unit) {
    const byLine = index.bySectionUnitOriginalLine.get(sectionUnitOrderKey(section, unit, enriched.originalLine));
    if (byLine) return byLine;
  }
  if (section && unit) {
    const wordMatches = index.bySectionUnitWord.get(sectionUnitWordKey(section, unit, enriched.word)) ?? [];
    return wordMatches.length === 1 ? wordMatches[0] : null;
  }
  return null;
}

function sectionUnitOrderKey(section: string | undefined, unit: string | undefined, sourceOrder: number) {
  return `${section ?? ""}::${unit ?? ""}::${sourceOrder}`;
}

function sectionUnitWordKey(section: string | undefined, unit: string | undefined, word: string) {
  return `${section ?? ""}::${unit ?? ""}::${word.trim().toLowerCase()}`;
}

function sourceIdSectionKey(sourceId: number, section: string | undefined) {
  return `${sourceId}::${section ?? ""}`;
}

function compareSectionUnitKeys(a: string, b: string) {
  const [sectionA, unitA] = a.split("::");
  const [sectionB, unitB] = b.split("::");
  return sectionA.localeCompare(sectionB, "zh-CN") || (parseUnitValue(unitA) ?? 0) - (parseUnitValue(unitB) ?? 0) || unitA.localeCompare(unitB, "zh-CN");
}

function getActiveRedbookEntries() {
  return activeRedbookEntries;
}

function cleanNullable(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : undefined;
}
