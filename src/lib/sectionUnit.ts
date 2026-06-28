import type { WordEntry } from "@/types/word";

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

export function compareSectionUnitKeys(a: string, b: string) {
  const [sectionA, unitA] = a.split("::");
  const [sectionB, unitB] = b.split("::");
  return sectionA.localeCompare(sectionB, "zh-CN") || (parseUnitValue(unitA) ?? 0) - (parseUnitValue(unitB) ?? 0) || unitA.localeCompare(unitB, "zh-CN");
}
