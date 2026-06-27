import type { WordEntry } from "./word";

export type TestMode = "practice" | "exam";

export type QuestionType = "enToZh" | "zhToEn" | "similar" | "synonym" | "familiar";

export type PracticeMode = "new" | "mistakes" | "review" | "mixed";

export type DrawStrategy =
  | "smart"
  | "random"
  | "unit"
  | "mistakes"
  | "lowAccuracy"
  | "unknown";

export interface TestSetup {
  mode: TestMode;
  category: string;
  section?: string;
  practiceMode?: PracticeMode;
  units: string[];
  tags: string[];
  questionCount: number;
  ratio: Record<QuestionType, number>;
  strategy: DrawStrategy;
  includeMistakesProgress: boolean;
}

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
  wordId?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  wordId: string;
  wordText: string;
  prompt: string;
  context?: string;
  options: QuestionOption[];
  correctOptionId: string;
  correctOptionText: string;
  correctMeaning?: string;
  choiceMeaning?: string;
  partOfSpeech?: string;
  phonetic?: string;
  explanation?: string;
  word: WordEntry;
}

export interface Answer {
  questionId: string;
  wordId: string;
  selectedOptionId?: string;
  isCorrect: boolean;
  answeredAt: string;
  elapsedMs: number;
}

export interface TestReport {
  id: string;
  mode: TestMode;
  title: string;
  score: number;
  questionAccuracy: number;
  wordAccuracy: number;
  durationMs: number;
  unanswered: number;
  total: number;
  correct: number;
  wrong: number;
  answers: Answer[];
  questions: Question[];
  createdAt: string;
  weakTypes: Array<{ type: QuestionType; accuracy: number; total: number }>;
  weakUnits: Array<{ unit: string; accuracy: number; total: number }>;
  suggestions: string[];
  xpDelta: number;
}

export interface TestRecordSummary {
  id: string;
  mode: TestMode;
  title: string;
  score: number;
  questionAccuracy: number;
  wordAccuracy: number;
  durationMs: number;
  unanswered: number;
  total: number;
  createdAt: string;
  weakTypes: TestReport["weakTypes"];
}
