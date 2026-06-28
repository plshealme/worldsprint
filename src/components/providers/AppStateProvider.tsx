"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import redbookWordsJson from "../../../data/redbook_words.json";
import { applyMistakeUpdates } from "@/lib/mistakeLogic";
import { toRecordSummary } from "@/lib/scoring";
import {
  activeUserId,
  defaultSettings,
  getAccounts,
  readJson,
  readUserData,
  removeKey,
  saveAccounts,
  scopedKey,
  setActiveUserId,
  uid,
  writeJson,
  writeUserData,
  type LocalAccount,
} from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import { VOCAB_VERSION } from "@/lib/vocab";
import { mergeBadges } from "@/lib/xp";
import type { MistakeItem, MistakeReason, TempTestItem } from "@/types/mistake";
import type { Answer, Question, TestMode, TestRecordSummary, TestReport } from "@/types/test";
import type { Badge, UserProfile, UserSettings } from "@/types/user";
import type { MasteryStatus, PersonalTag, WordProgress } from "@/types/word";

interface AppStateContextValue {
  ready: boolean;
  authMode: "supabase" | "mock" | "dev";
  user: UserProfile | null;
  settings: UserSettings;
  progress: Record<string, WordProgress>;
  mistakes: MistakeItem[];
  records: TestRecordSummary[];
  tempList: TempTestItem[];
  personalTags: PersonalTag[];
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  completeOnboarding: () => void;
  updateUsername: (username: string) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  getProgress: (wordId: string) => WordProgress;
  setMastery: (wordId: string, mastery: MasteryStatus, word?: string) => void;
  toggleFavorite: (wordId: string, word?: string) => void;
  saveNote: (wordId: string, note: string) => void;
  togglePersonalTag: (wordId: string, tagId: string) => void;
  addPersonalTag: (tag: Omit<PersonalTag, "id">) => void;
  addTempWord: (wordId: string, source: TempTestItem["source"]) => "added" | "exists" | "full";
  replaceOldestTempWord: (wordId: string, source: TempTestItem["source"]) => void;
  removeTempWord: (wordId: string) => void;
  clearTempList: () => void;
  recordAnswerResult: (question: Question, answer: Answer, mode: TestMode, includeMistakeProgress?: boolean) => void;
  applyReport: (report: TestReport, includeMistakeProgress?: boolean, options?: { skipLearningRecords?: boolean }) => Badge[];
  removeMistake: (wordId: string) => void;
  updateMistakeReason: (wordId: string, reason: MistakeReason) => void;
  importLearningProgress: (progress: Record<string, WordProgress>) => void;
  clearLearningProgress: () => void;
  resetMistakeStatus: () => void;
  generateDemoLearningData: () => void;
  clearMistakes: () => void;
  clearRecords: () => void;
  resetProgress: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);
const emptyProgress: Record<string, WordProgress> = {};
const activeProfileStorageKey = "activeProfile";

interface AuthApiResponse {
  ok?: boolean;
  profile?: UserProfile;
  error?: string;
}

interface RedbookDemoWord {
  sourceId?: number;
  source_id?: number;
  appOrder?: number;
  word: string;
}

const demoWords = redbookWordsJson as RedbookDemoWord[];

function defaultProgress(wordId: string, word = ""): WordProgress {
  return {
    wordId,
    word,
    mastery: "unlearned",
    masteryLevel: "unlearned",
    favorite: false,
    isFavorite: false,
    isMistake: false,
    note: "",
    personalTagIds: [],
    attempts: 0,
    correct: 0,
    correctCount: 0,
    wrong: 0,
    wrongCount: 0,
    correctStreak: 0,
  };
}

function normalizeProgress(item: Partial<WordProgress> | undefined, wordId: string, word = ""): WordProgress {
  const attempts = item?.attempts ?? 0;
  const correctCount = item?.correctCount ?? item?.correct ?? 0;
  const wrongCount = item?.wrongCount ?? item?.wrong ?? 0;
  const correctStreak = item?.correctStreak ?? 0;
  const masteryLevel = item?.masteryLevel ?? item?.mastery ?? "unlearned";
  const isFavorite = item?.isFavorite ?? item?.favorite ?? false;
  return {
    ...defaultProgress(wordId, word),
    ...item,
    wordId,
    word: item?.word || word,
    mastery: masteryLevel,
    masteryLevel,
    favorite: isFavorite,
    isFavorite,
    isMistake: item?.isMistake ?? wrongCount > 0,
    attempts,
    correct: correctCount,
    correctCount,
    wrong: wrongCount,
    wrongCount,
    correctStreak,
    lastPracticedAt: item?.lastPracticedAt ?? item?.lastAnsweredAt,
    lastAnsweredAt: item?.lastAnsweredAt ?? item?.lastPracticedAt,
  };
}

function normalizeProgressMap(progress: Record<string, WordProgress>) {
  return Object.fromEntries(Object.entries(progress).map(([wordId, item]) => [wordId, normalizeProgress(item, wordId)]));
}

function nextMasteryAfterAnswer(existing: WordProgress, isCorrect: boolean, correctCount: number, wrongCount: number, correctStreak: number): MasteryStatus {
  if (!isCorrect) {
    return existing.masteryLevel === "unlearned" || wrongCount >= 2 ? "unknown" : "vague";
  }
  const accuracy = correctCount / Math.max(1, correctCount + wrongCount);
  if (correctStreak >= 3 && correctCount >= 4 && accuracy >= 0.8) {
    return "mastered";
  }
  if (correctStreak === 1 && existing.masteryLevel === "unknown") {
    return "vague";
  }
  return "known";
}

function nextReviewTime(mastery: MasteryStatus, answeredAt: string, isCorrect: boolean, correctStreak = 0) {
  const base = new Date(answeredAt).getTime();
  const delayHours = !isCorrect
    ? 0.5
    : mastery === "mastered"
      ? 168
      : mastery === "known"
        ? Math.min(120, 24 * Math.max(1, correctStreak))
        : 12;
  return new Date(base + delayHours * 60 * 60 * 1000).toISOString();
}

function applyAnswerToProgress(existing: WordProgress, question: Question, answer: Answer, autoRemoveStreak: 2 | 3 | 5) {
  const current = normalizeProgress(existing, question.wordId, question.word.word);
  const attempts = current.attempts + 1;
  const correctCount = current.correctCount + (answer.isCorrect ? 1 : 0);
  const wrongCount = current.wrongCount + (answer.isCorrect ? 0 : 1);
  const correctStreak = answer.isCorrect ? (current.correctStreak ?? 0) + 1 : 0;
  const masteryLevel = nextMasteryAfterAnswer(current, answer.isCorrect, correctCount, wrongCount, correctStreak);
  return {
    ...current,
    word: question.word.word,
    attempts,
    correct: correctCount,
    correctCount,
    wrong: wrongCount,
    wrongCount,
    mastery: masteryLevel,
    masteryLevel,
    isMistake: answer.isCorrect ? current.isMistake && correctStreak < autoRemoveStreak : true,
    correctStreak,
    lastAnswerCorrect: answer.isCorrect,
    lastPracticedAt: answer.answeredAt,
    lastAnsweredAt: answer.answeredAt,
    nextReviewAt: nextReviewTime(masteryLevel, answer.answeredAt, answer.isCorrect, correctStreak),
  } satisfies WordProgress;
}

function mergePersistedProfile(profile: UserProfile) {
  const persisted = readJson<UserProfile | null>(scopedKey(profile.id, "profile"), null);
  if (!persisted) {
    return profile;
  }

  return {
    ...profile,
    username: persisted.username || profile.username,
    firstLoginDone: persisted.firstLoginDone,
    xp: Math.max(profile.xp, persisted.xp),
    badges: persisted.badges.length ? persisted.badges : profile.badges,
    isAdmin: profile.isAdmin,
  };
}

function persistActiveProfile(profile: UserProfile) {
  writeJson(scopedKey(profile.id, "profile"), profile);
  writeJson(activeProfileStorageKey, profile);
}

async function postAuth(path: string, payload?: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    credentials: "include",
  });
  const data = (await response.json().catch(() => null)) as AuthApiResponse | null;

  if (!response.ok || !data?.ok || !data.profile) {
    throw new Error(data?.error ?? "认证服务暂不可用。");
  }

  return data.profile;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const isDevAuthMode =
    process.env.NODE_ENV !== "production" &&
    (process.env.NEXT_PUBLIC_AUTH_MODE === "dev" || process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true");
  const authMode = isDevAuthMode ? "dev" : isSupabaseConfigured || process.env.NODE_ENV === "production" ? "supabase" : "mock";
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [progress, setProgress] = useState<Record<string, WordProgress>>(emptyProgress);
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [records, setRecords] = useState<TestRecordSummary[]>([]);
  const [tempList, setTempList] = useState<TempTestItem[]>([]);
  const [personalTags, setPersonalTags] = useState<PersonalTag[]>([]);

  const resetSessionState = useCallback(() => {
    setActiveUserId(null);
    removeKey(activeProfileStorageKey);
    setUser(null);
    setSettings(defaultSettings);
    setProgress({});
    setMistakes([]);
    setRecords([]);
    setTempList([]);
    setPersonalTags([]);
  }, []);

  const hydrateProfile = useCallback((profile: UserProfile) => {
    const mergedProfile = mergePersistedProfile(profile);
    const data = readUserData(mergedProfile.id);
    const isCurrentVocab = data.vocabVersion === VOCAB_VERSION;
    setUser(mergedProfile);
    setSettings(data.settings);
    setProgress(isCurrentVocab ? normalizeProgressMap(data.progress) : {});
    setMistakes(isCurrentVocab ? data.mistakes : []);
    setRecords(isCurrentVocab ? data.records : []);
    setTempList(isCurrentVocab ? data.tempList : []);
    setPersonalTags(data.tags);
    setActiveUserId(mergedProfile.id);
    persistActiveProfile(mergedProfile);
  }, []);

  const hydrateAccount = useCallback(
    (account: LocalAccount) => {
      hydrateProfile(account.profile);
    },
    [hydrateProfile],
  );

  useEffect(() => {
    if (authMode === "supabase" || authMode === "dev") {
      const cachedProfile = readJson<UserProfile | null>(activeProfileStorageKey, null);
      if (cachedProfile) {
        hydrateProfile(cachedProfile);
      }
      setReady(true);
      return;
    }

    const accounts = getAccounts();
    const activeId = activeUserId();
    const account = accounts.find((item) => item.profile.id === activeId);
    if (account) {
      hydrateAccount(account);
    }
    setReady(true);
  }, [authMode, hydrateAccount, hydrateProfile]);

  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    writeUserData(user.id, {
      vocabVersion: VOCAB_VERSION,
      settings,
      progress,
      mistakes,
      records,
      tempList,
      tags: personalTags,
    });
  }, [ready, user, settings, progress, mistakes, records, tempList, personalTags]);

  const syncProfile = useCallback((updater: (profile: UserProfile) => UserProfile) => {
    setUser((current) => {
      if (!current) {
        return current;
      }

      const nextProfile = updater(current);
      persistActiveProfile(nextProfile);
      if (authMode === "mock") {
        const accounts = getAccounts().map((account) =>
          account.profile.id === current.id ? { ...account, profile: nextProfile } : account,
        );
        saveAccounts(accounts);
      }
      return nextProfile;
    });
  }, [authMode]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const normalizedIdentifier = identifier.trim().toLowerCase();

      if (authMode === "supabase" || authMode === "dev") {
        const profile = await postAuth("/api/auth/login", {
          identifier: normalizedIdentifier,
          password,
        });
        hydrateProfile(profile);
        return;
      }

      const accounts = ensureDemoAccount(getAccounts());
      const account = accounts.find((item) =>
        normalizedIdentifier.includes("@")
          ? item.profile.email.toLowerCase() === normalizedIdentifier
          : item.profile.username.toLowerCase() === normalizedIdentifier,
      );
      if (!account || account.password !== password) {
        throw new Error("用户名或密码错误");
      }
      saveAccounts(accounts);
      hydrateAccount(account);
    },
    [authMode, hydrateAccount, hydrateProfile],
  );

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      const normalizedEmail = email.trim().toLowerCase();
      const cleanUsername = username.trim() || normalizedEmail.split("@")[0];

      if (authMode === "supabase" || authMode === "dev") {
        const profile = await postAuth("/api/auth/register", {
          email: normalizedEmail,
          password,
          username: cleanUsername,
        });
        hydrateProfile(profile);
        return;
      }

      const accounts = getAccounts();
      if (accounts.some((account) => account.profile.email.toLowerCase() === normalizedEmail)) {
        throw new Error("This email has already been registered.");
      }
      const account: LocalAccount = {
        password,
        profile: {
          id: uid("user"),
          email: normalizedEmail,
          username: cleanUsername,
          isAdmin: false,
          firstLoginDone: false,
          xp: 0,
          badges: [],
          createdAt: new Date().toISOString(),
        },
      };
      saveAccounts([...accounts, account]);
      hydrateAccount(account);
    },
    [authMode, hydrateAccount, hydrateProfile],
  );

  const logout = useCallback(() => {
    if (authMode === "supabase" || authMode === "dev") {
      void fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      }).catch(() => undefined);
    }
    resetSessionState();
  }, [authMode, resetSessionState]);

  const completeOnboarding = useCallback(() => {
    syncProfile((profile) => ({ ...profile, firstLoginDone: true }));
  }, [syncProfile]);

  const updateUsername = useCallback(
    (username: string) => {
      syncProfile((profile) => ({ ...profile, username: username.trim() || profile.username }));
    },
    [syncProfile],
  );

  const updateSettings = useCallback((next: Partial<UserSettings>) => {
    setSettings((current) => ({
      ...current,
      ...next,
      defaultTypeRatio: {
        ...current.defaultTypeRatio,
        ...(next.defaultTypeRatio ?? {}),
      },
    }));
  }, []);

  const getProgress = useCallback(
    (wordId: string): WordProgress =>
      normalizeProgress(progress[wordId], wordId),
    [progress],
  );

  const patchProgress = useCallback((wordId: string, updater: (current: WordProgress) => WordProgress) => {
    setProgress((current) => {
      const existing =
        current[wordId] ??
        defaultProgress(wordId);
      return { ...current, [wordId]: updater(normalizeProgress(existing, wordId)) };
    });
  }, []);

  const setMastery = useCallback(
    (wordId: string, mastery: MasteryStatus, word?: string) => {
      patchProgress(wordId, (current) => ({
        ...current,
        word: current.word || word || "",
        mastery,
        masteryLevel: mastery,
        isMistake: mastery === "mastered" ? false : current.isMistake,
        wrongCount: mastery === "mastered" ? 0 : current.wrongCount,
        wrong: mastery === "mastered" ? 0 : current.wrong,
        correctStreak: mastery === "mastered" ? Math.max(3, current.correctStreak ?? 0) : current.correctStreak,
        nextReviewAt: mastery === "mastered" ? nextReviewTime("mastered", new Date().toISOString(), true, 3) : current.nextReviewAt,
      }));
    },
    [patchProgress],
  );

  const toggleFavorite = useCallback(
    (wordId: string, word?: string) => {
      patchProgress(wordId, (current) => {
        const isFavorite = !current.isFavorite;
        return { ...current, word: current.word || word || "", favorite: isFavorite, isFavorite };
      });
    },
    [patchProgress],
  );

  const saveNote = useCallback(
    (wordId: string, note: string) => {
      patchProgress(wordId, (current) => ({ ...current, note: note.slice(0, 100) }));
    },
    [patchProgress],
  );

  const togglePersonalTag = useCallback(
    (wordId: string, tagId: string) => {
      patchProgress(wordId, (current) => ({
        ...current,
        personalTagIds: current.personalTagIds.includes(tagId)
          ? current.personalTagIds.filter((id) => id !== tagId)
          : [...current.personalTagIds, tagId],
      }));
    },
    [patchProgress],
  );

  const addPersonalTag = useCallback((tag: Omit<PersonalTag, "id">) => {
    setPersonalTags((current) => [...current, { ...tag, id: uid("tag") }]);
  }, []);

  const addTempWord = useCallback((wordId: string, source: TempTestItem["source"]) => {
    let result: "added" | "exists" | "full" = "added";
    setTempList((current) => {
      if (current.some((item) => item.wordId === wordId)) {
        result = "exists";
        return current;
      }
      if (current.length >= 50) {
        result = "full";
        return current;
      }
      return [...current, { wordId, source, addedAt: new Date().toISOString() }];
    });
    return result;
  }, []);

  const replaceOldestTempWord = useCallback((wordId: string, source: TempTestItem["source"]) => {
    setTempList((current) => {
      const without = current.filter((item) => item.wordId !== wordId).slice(-49);
      return [...without, { wordId, source, addedAt: new Date().toISOString() }];
    });
  }, []);

  const removeTempWord = useCallback((wordId: string) => {
    setTempList((current) => current.filter((item) => item.wordId !== wordId));
  }, []);

  const clearTempList = useCallback(() => {
    setTempList([]);
  }, []);

  const recordAnswerResult = useCallback(
    (question: Question, answer: Answer, mode: TestMode, includeMistakeProgress = true) => {
      if (!answer.selectedOptionId) {
        return;
      }
      setProgress((current) => {
        const existing = normalizeProgress(current[question.wordId], question.wordId, question.word.word);
        return { ...current, [question.wordId]: applyAnswerToProgress(existing, question, answer, settings.autoRemoveMistakeStreak) };
      });
      setMistakes((current) =>
        applyMistakeUpdates(
          current,
          [question],
          [answer],
          mode,
          settings.autoRemoveMistakeStreak,
          includeMistakeProgress,
        ),
      );
    },
    [settings.autoRemoveMistakeStreak],
  );

  const applyReport = useCallback(
    (report: TestReport, includeMistakeProgress = true, options?: { skipLearningRecords?: boolean }) => {
      const answerMap = new Map(report.answers.map((answer) => [answer.questionId, answer]));
      let nextProgress = normalizeProgressMap(progress);
      if (!options?.skipLearningRecords) {
        for (const question of report.questions) {
          const answer = answerMap.get(question.id);
          if (!answer?.selectedOptionId) {
            continue;
          }
          const existing = normalizeProgress(nextProgress[question.wordId], question.wordId, question.word.word);
          nextProgress[question.wordId] = applyAnswerToProgress(existing, question, answer, settings.autoRemoveMistakeStreak);
        }
        setProgress(nextProgress);
      }

      if (!options?.skipLearningRecords) {
        setMistakes((current) =>
          applyMistakeUpdates(
            current,
            report.questions,
            report.answers,
            report.mode,
            settings.autoRemoveMistakeStreak,
            includeMistakeProgress,
          ),
        );
      }
      setRecords((current) => [toRecordSummary(report), ...current].slice(0, 160));

      let newBadges: Badge[] = [];
      syncProfile((profile) => {
        newBadges = mergeBadges(profile, nextProgress, [report]);
        return {
          ...profile,
          xp: profile.xp + report.xpDelta,
          badges: [...profile.badges, ...newBadges],
        };
      });
      return newBadges;
    },
    [progress, settings.autoRemoveMistakeStreak, syncProfile],
  );

  const removeMistake = useCallback((wordId: string) => {
    setMistakes((current) => current.map((item) => (item.wordId === wordId ? { ...item, active: false } : item)));
    patchProgress(wordId, (current) => ({ ...current, isMistake: false }));
  }, [patchProgress]);

  const updateMistakeReason = useCallback((wordId: string, reason: MistakeReason) => {
    setMistakes((current) => {
      if (current.some((item) => item.wordId === wordId)) {
        return current.map((item) => (item.wordId === wordId ? { ...item, reason, active: true } : item));
      }
      const itemProgress = getProgress(wordId);
      return [
        ...current,
        {
          wordId,
          wrongCount: Math.max(1, itemProgress.wrongCount),
          correctStreak: 0,
          lastWrongAt: itemProgress.lastPracticedAt ?? new Date().toISOString(),
          reason,
          source: "practice",
          active: true,
        },
      ];
    });
  }, [getProgress]);

  const importLearningProgress = useCallback((nextProgress: Record<string, WordProgress>) => {
    setProgress(normalizeProgressMap(nextProgress));
    setMistakes([]);
  }, []);

  const clearLearningProgress = useCallback(() => {
    setProgress({});
    setMistakes([]);
  }, []);

  const resetMistakeStatus = useCallback(() => {
    setProgress((current) =>
      Object.fromEntries(
        Object.entries(current).map(([wordId, item]) => {
          const normalized = normalizeProgress(item, wordId);
          return [
            wordId,
            {
              ...normalized,
              isMistake: false,
            },
          ];
        }),
      ),
    );
    setMistakes((current) => current.map((item) => ({ ...item, active: false })));
  }, []);

  const generateDemoLearningData = useCallback(() => {
    const shuffled = [...demoWords].sort(() => Math.random() - 0.5);
    const count = Math.min(shuffled.length, 20 + Math.floor(Math.random() * 31));
    const selected = shuffled.slice(0, count);
    const now = Date.now();
    const nextProgress: Record<string, WordProgress> = {};
    const nextMistakes: MistakeItem[] = [];

    selected.forEach((word, index) => {
      const sourceId = word.sourceId ?? word.source_id ?? word.appOrder;
      if (!sourceId) {
        return;
      }
      const wordId = `redbook-${sourceId}`;
      const attempts = 1 + Math.floor(Math.random() * 8);
      const wrongCount = index % 4 === 0 ? 1 + Math.floor(Math.random() * Math.min(3, attempts)) : Math.floor(Math.random() * 2);
      const correctCount = Math.max(0, attempts - wrongCount);
      const isMistake = wrongCount > 0 && index % 3 === 0;
      const dueReview = index % 2 === 0;
      const lastPracticedAt = new Date(now - (index + 1) * 3600_000).toISOString();
      const masteryLevel: MasteryStatus =
        wrongCount >= 2 ? "unknown" : wrongCount === 1 ? "vague" : correctCount >= 4 ? "mastered" : "known";
      nextProgress[wordId] = {
        ...defaultProgress(wordId, word.word),
        attempts,
        correct: correctCount,
        correctCount,
        wrong: wrongCount,
        wrongCount,
        mastery: masteryLevel,
        masteryLevel,
        isMistake,
        lastAnswerCorrect: wrongCount === 0,
        lastPracticedAt,
        lastAnsweredAt: lastPracticedAt,
        nextReviewAt: new Date(now + (dueReview ? -1 : 24 + index) * 3600_000).toISOString(),
      };

      if (isMistake) {
        nextMistakes.push({
          wordId,
          wrongCount,
          correctStreak: 0,
          lastWrongAt: lastPracticedAt,
          reason: "记忆模糊",
          source: "practice",
          active: true,
        });
      }
    });

    setProgress((current) => ({ ...current, ...nextProgress }));
    setMistakes((current) => {
      const generatedIds = new Set(nextMistakes.map((item) => item.wordId));
      return [...current.filter((item) => !generatedIds.has(item.wordId)), ...nextMistakes];
    });
  }, []);

  const clearMistakes = useCallback(() => {
    setMistakes((current) => current.map((item) => ({ ...item, active: false })));
    setProgress((current) =>
      Object.fromEntries(
        Object.entries(current).map(([wordId, item]) => [
          wordId,
          {
            ...normalizeProgress(item, wordId),
            isMistake: false,
          },
        ]),
      ),
    );
  }, []);

  const clearRecords = useCallback(() => {
    setRecords([]);
  }, []);

  const resetProgress = useCallback(() => {
    setProgress({});
    setMistakes([]);
    setRecords([]);
    setTempList([]);
  }, []);

  const value = useMemo<AppStateContextValue>(
    () => ({
      ready,
      authMode,
      user,
      settings,
      progress,
      mistakes,
      records,
      tempList,
      personalTags,
      login,
      register,
      logout,
      completeOnboarding,
      updateUsername,
      updateSettings,
      getProgress,
      setMastery,
      toggleFavorite,
      saveNote,
      togglePersonalTag,
      addPersonalTag,
      addTempWord,
      replaceOldestTempWord,
      removeTempWord,
      clearTempList,
      recordAnswerResult,
      applyReport,
      removeMistake,
      updateMistakeReason,
      importLearningProgress,
      clearLearningProgress,
      resetMistakeStatus,
      generateDemoLearningData,
      clearMistakes,
      clearRecords,
      resetProgress,
    }),
    [
      ready,
      authMode,
      user,
      settings,
      progress,
      mistakes,
      records,
      tempList,
      personalTags,
      login,
      register,
      logout,
      completeOnboarding,
      updateUsername,
      updateSettings,
      getProgress,
      setMastery,
      toggleFavorite,
      saveNote,
      togglePersonalTag,
      addPersonalTag,
      addTempWord,
      replaceOldestTempWord,
      removeTempWord,
      clearTempList,
      recordAnswerResult,
      applyReport,
      removeMistake,
      updateMistakeReason,
      importLearningProgress,
      clearLearningProgress,
      resetMistakeStatus,
      generateDemoLearningData,
      clearMistakes,
      clearRecords,
      resetProgress,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return value;
}

function ensureDemoAccount(accounts: LocalAccount[]) {
  if (accounts.some((account) => account.profile.email === "demo@wordsprint.app")) {
    return accounts;
  }
  return [
    ...accounts,
    {
      password: "123456",
      profile: {
        id: "user-demo",
        email: "demo@wordsprint.app",
        username: "Demo Learner",
        isAdmin: false,
        firstLoginDone: true,
        xp: 260,
        badges: [],
        createdAt: new Date().toISOString(),
      },
    },
  ];
}
