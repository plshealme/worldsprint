export type MistakeReason =
  | "中文意思混淆"
  | "词性混淆"
  | "形近词混淆"
  | "意近词混淆"
  | "熟词僻义没掌握"
  | "粗心误点"
  | "完全不认识"
  | "记忆模糊"
  | "语境理解错误";

export interface MistakeItem {
  wordId: string;
  wrongCount: number;
  correctStreak: number;
  lastWrongAt: string;
  reason: MistakeReason;
  source: "practice" | "exam" | "review";
  active: boolean;
}

export interface TempTestItem {
  wordId: string;
  source: "word-detail" | "review" | "mistakes" | "search";
  addedAt: string;
}
