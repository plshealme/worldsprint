import { clsx, type ClassValue } from "clsx";
import type { MasteryStatus } from "@/types/word";
import type { QuestionType, TestMode } from "@/types/test";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function shortDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function typeName(type: QuestionType) {
  const names: Record<QuestionType, string> = {
    enToZh: "英译汉",
    zhToEn: "汉译英",
    similar: "形近词",
    synonym: "意近词",
    familiar: "熟词僻义",
  };
  return names[type];
}

export function modeName(mode: TestMode) {
  return mode === "practice" ? "Practice" : "Exam";
}

export function masteryName(mastery: MasteryStatus) {
  const names: Record<MasteryStatus, string> = {
    unlearned: "未学",
    known: "认识",
    vague: "模糊",
    unknown: "不认识",
    mastered: "已掌握",
  };
  return names[mastery];
}

export function levelFromXp(xp: number) {
  const tiers = [
    { name: "青铜", min: 0, next: 400 },
    { name: "白银", min: 400, next: 1000 },
    { name: "黄金", min: 1000, next: 1900 },
    { name: "铂金", min: 1900, next: 3200 },
    { name: "钻石", min: 3200, next: 5200 },
  ];
  const tier = [...tiers].reverse().find((item) => xp >= item.min) ?? tiers[0];
  const progress = Math.min(1, (xp - tier.min) / Math.max(1, tier.next - tier.min));
  return { ...tier, progress };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function nowIso() {
  return new Date().toISOString();
}
