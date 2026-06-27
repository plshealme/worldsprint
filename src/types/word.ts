export type ExamCategory = "考研英语" | "四级" | "六级" | "中考" | "高考";

export type MasteryStatus = "unlearned" | "known" | "vague" | "unknown" | "mastered";

export type OfficialTag =
  | "高频"
  | "阅读"
  | "写作"
  | "熟词僻义"
  | "形近易混"
  | "意近易混"
  | "抽象词"
  | "态度词"
  | "学术";

export interface WordEntry {
  id: string;
  word: string;
  appOrder?: number;
  wordRaw?: string;
  coreMeaning: string;
  displayWord?: string;
  choiceMeaning?: string;
  choiceUsable?: boolean;
  rawMeaning?: string;
  phonetic?: string;
  partOfSpeech?: string;
  fullMeanings?: string;
  example?: string;
  collocation?: string;
  category?: ExamCategory;
  book?: string;
  section?: string;
  unit?: string;
  subsection?: string;
  sourceId?: number;
  sourceOrder?: number;
  sourcePage?: number | string;
  originalLine?: number;
  needsReview?: boolean;
  reviewReason?: string;
  cleanStatus?: string;
  codexImportKey?: string;
  page?: number;
  officialTags?: OfficialTag[];
  similarWordsGroup?: string[];
  synonymGroup?: string[];
  confusableNotes?: string;
  familiarMeaningNotes?: string;
}

export interface PersonalTag {
  id: string;
  name: string;
  color: "slate" | "blue" | "green" | "amber" | "rose";
}

export interface WordProgress {
  wordId: string;
  word: string;
  mastery: MasteryStatus;
  masteryLevel: MasteryStatus;
  favorite: boolean;
  isFavorite: boolean;
  isMistake: boolean;
  note: string;
  personalTagIds: string[];
  attempts: number;
  correct: number;
  correctCount: number;
  wrong: number;
  wrongCount: number;
  correctStreak?: number;
  lastAnswerCorrect?: boolean;
  lastPracticedAt?: string;
  nextReviewAt?: string;
  lastAnsweredAt?: string;
}
