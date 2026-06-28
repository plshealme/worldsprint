export const WORD_META = {
  wordCount: 2499,
  unitRange: "U1-U30",
  wordBankName: "考研英语大纲词汇",
  activeQuestionType: "英译汉",
  publicRange: "基础词 U1-U30",
} as const;

export function getWordMeta() {
  return WORD_META;
}
