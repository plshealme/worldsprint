import type { MistakeItem, TempTestItem } from "@/types/mistake";
import type { TestRecordSummary } from "@/types/test";
import type { PersonalTag, WordProgress } from "@/types/word";
import type { UserProfile, UserSettings } from "@/types/user";

const APP_PREFIX = "wordsprint";

export interface LocalAccount {
  profile: UserProfile;
  password: string;
}

export const defaultSettings: UserSettings = {
  theme: "system",
  fontSize: "medium",
  autoRemoveMistakeStreak: 3,
  defaultQuestionCount: 10,
  defaultTypeRatio: {
    enToZh: 100,
    zhToEn: 0,
    similar: 0,
    synonym: 0,
    familiar: 0,
  },
  examHideHints: true,
};

export const defaultTags: PersonalTag[] = [
  { id: "tag-core", name: "重点", color: "blue" },
  { id: "tag-reading", name: "阅读易错", color: "amber" },
  { id: "tag-review", name: "二刷", color: "green" },
];

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback;
  }
  const value = window.localStorage.getItem(`${APP_PREFIX}:${key}`);
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(`${APP_PREFIX}:${key}`, JSON.stringify(value));
}

export function removeKey(key: string) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.removeItem(`${APP_PREFIX}:${key}`);
}

export function getAccounts() {
  return readJson<LocalAccount[]>("accounts", []);
}

export function saveAccounts(accounts: LocalAccount[]) {
  writeJson("accounts", accounts);
}

export function scopedKey(userId: string, key: string) {
  return `${userId}:${key}`;
}

export interface LocalUserData {
  vocabVersion: string | null;
  settings: UserSettings;
  progress: Record<string, WordProgress>;
  mistakes: MistakeItem[];
  records: TestRecordSummary[];
  tempList: TempTestItem[];
  tags: PersonalTag[];
}

export function readUserData(userId: string): LocalUserData {
  return {
    vocabVersion: readJson<string | null>(scopedKey(userId, "vocabVersion"), null),
    settings: readJson(scopedKey(userId, "settings"), defaultSettings),
    progress: readJson(scopedKey(userId, "progress"), {}),
    mistakes: readJson(scopedKey(userId, "mistakes"), []),
    records: readJson(scopedKey(userId, "records"), []),
    tempList: readJson(scopedKey(userId, "tempList"), []),
    tags: readJson(scopedKey(userId, "tags"), defaultTags),
  };
}

export function writeUserData(userId: string, data: LocalUserData) {
  writeJson(scopedKey(userId, "vocabVersion"), data.vocabVersion);
  writeJson(scopedKey(userId, "settings"), data.settings);
  writeJson(scopedKey(userId, "progress"), data.progress);
  writeJson(scopedKey(userId, "mistakes"), data.mistakes);
  writeJson(scopedKey(userId, "records"), data.records);
  writeJson(scopedKey(userId, "tempList"), data.tempList);
  writeJson(scopedKey(userId, "tags"), data.tags);
}

export function activeUserId() {
  return readJson<string | null>("activeUserId", null);
}

export function setActiveUserId(userId: string | null) {
  writeJson("activeUserId", userId);
}
