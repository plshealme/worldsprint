export const WORD_META = {
  wordCount: 2499,
  unitRange: "U1-U30",
  wordBankName: "考研英语大纲词汇",
  activeQuestionType: "英译汉",
  publicRange: "基础词 U1-U30",
} as const;

export const WORD_UNIT_COUNTS: Record<string, number> = {
  "基础词::Unit 1": 75,
  "基础词::Unit 2": 71,
  "基础词::Unit 3": 80,
  "基础词::Unit 4": 95,
  "基础词::Unit 5": 84,
  "基础词::Unit 6": 85,
  "基础词::Unit 7": 90,
  "基础词::Unit 8": 88,
  "基础词::Unit 9": 77,
  "基础词::Unit 10": 77,
  "基础词::Unit 11": 87,
  "基础词::Unit 12": 77,
  "基础词::Unit 13": 94,
  "基础词::Unit 14": 88,
  "基础词::Unit 15": 89,
  "基础词::Unit 16": 72,
  "基础词::Unit 17": 70,
  "基础词::Unit 18": 83,
  "基础词::Unit 19": 83,
  "基础词::Unit 20": 88,
  "基础词::Unit 21": 90,
  "基础词::Unit 22": 83,
  "基础词::Unit 23": 80,
  "基础词::Unit 24": 70,
  "基础词::Unit 25": 94,
  "基础词::Unit 26": 87,
  "基础词::Unit 27": 83,
  "基础词::Unit 28": 83,
  "基础词::Unit 29": 88,
  "基础词::Unit 30": 88,
};

export function getWordMeta() {
  return WORD_META;
}
