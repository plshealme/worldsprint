import { mockWords } from "@/data/mockWords";
import type { MistakeItem } from "@/types/mistake";
import type { PracticeMode, Question, QuestionOption, QuestionType, TestSetup } from "@/types/test";
import type { WordEntry, WordProgress } from "@/types/word";
import { shuffleArray as shuffle } from "./shuffle";
import { uid } from "./storage";
import { wordSectionUnitKey } from "./sectionUnit";

export interface QuestionGenerationResult {
  questions: Question[];
  warnings: string[];
  rangeStats: {
    totalWords: number;
    mistakeWords: number;
    unknownWords: number;
  };
}

const activeQuestionTypes: QuestionType[] = ["enToZh"];
const invalidMeaningLabels = new Set(["", "undefined", "null", "释义待校对"]);

export function getAvailableWords(setup: TestSetup, words = mockWords) {
  return words.filter((word) => {
    if (setup.category && word.category !== setup.category) {
      return false;
    }
    if (setup.section && word.section !== setup.section) {
      return false;
    }
    if (setup.units.length > 0 && !setup.units.includes(wordSectionUnitKey(word))) {
      return false;
    }
    if (setup.tags.length > 0 && !setup.tags.some((tag) => word.officialTags?.includes(tag as never))) {
      return false;
    }
    return true;
  });
}

export function generateQuestions(
  setup: TestSetup,
  progress: Record<string, WordProgress> = {},
  mistakes: MistakeItem[] = [],
  words = mockWords,
): QuestionGenerationResult {
  const baseAvailable = getAvailableWords(setup, words);
  const activeMistakes = new Set([
    ...mistakes.filter((item) => item.active).map((item) => item.wordId),
    ...Object.values(progress).filter((item) => item.isMistake).map((item) => item.wordId),
  ]);
  const available = filterPracticeWords(baseAvailable, setup, progress, activeMistakes);
  const sorted = sortPracticeWords(available, baseAvailable, setup, progress, mistakes, activeMistakes);
  const selectedRoundWords = pickRoundWords(sorted, setup.questionCount);
  const roundWords = shuffle(selectedRoundWords);
  const requestedTypes = expandTypes(setup.ratio, setup.questionCount);
  const meaningReplacementPool = shuffle(sorted.filter(hasUsableMeaning));
  const generalReplacementPool = shuffle(sorted);
  const questions: Question[] = [];
  const warnings = new Set<string>();
  const usedQuestionWordIds = new Set<string>();
  const unknownWords = available.filter((word) => {
    const mastery = progress[word.id]?.masteryLevel ?? progress[word.id]?.mastery;
    return mastery === "unknown" || mastery === "vague";
  });

  if (setup.questionCount > available.length && available.length > 0) {
    warnings.add(`当前范围最多可生成 ${available.length} 个不重复词，部分词可能重复出现。`);
  }

  if (available.length === 0) {
    return {
      questions: [],
      warnings: ["当前筛选范围没有可用词，请返回调整词库、单元或标签。"],
      rangeStats: { totalWords: 0, mistakeWords: 0, unknownWords: 0 },
    };
  }

  for (let i = 0; i < roundWords.length; i += 1) {
    let word = roundWords[i];
    const desiredType = requestedTypes[i % requestedTypes.length] ?? "enToZh";
    const finalType = supportsQuestionType(word, desiredType) ? desiredType : fallbackType(i);
    if (usedQuestionWordIds.has(word.id) || (requiresUsableMeaning(finalType) && !hasUsableMeaning(word))) {
      const pool = requiresUsableMeaning(finalType) ? meaningReplacementPool : generalReplacementPool;
      const replacement = pool.find((item) => !usedQuestionWordIds.has(item.id));
      if (replacement) {
        word = replacement;
      }
    }
    usedQuestionWordIds.add(word.id);
    if (finalType !== desiredType) {
      warnings.add(`${typeDataName(desiredType)}数据不足，已用普通选择题补足题量。`);
    }
    questions.push(buildQuestion(word, finalType, baseAvailable, i));
  }

  return {
    questions,
    warnings: Array.from(warnings),
    rangeStats: {
      totalWords: available.length,
      mistakeWords: available.filter((word) => activeMistakes.has(word.id) || (progress[word.id]?.wrongCount ?? progress[word.id]?.wrong ?? 0) > 0).length,
      unknownWords: unknownWords.length,
    },
  };
}

function sortWords(
  words: WordEntry[],
  setup: TestSetup,
  progress: Record<string, WordProgress>,
  mistakes: MistakeItem[],
) {
  const mistakeMap = new Map(mistakes.map((item) => [item.wordId, item]));
  const copy = [...words];
  if (setup.strategy === "random") {
    return shuffle(copy);
  }
  if (setup.strategy === "unit") {
    return copy.sort((a, b) => `${wordSectionUnitKey(a)}-${a.word}`.localeCompare(`${wordSectionUnitKey(b)}-${b.word}`));
  }
  if (setup.strategy === "mistakes") {
    return copy.sort((a, b) => (mistakeMap.get(b.id)?.wrongCount ?? 0) - (mistakeMap.get(a.id)?.wrongCount ?? 0));
  }
  if (setup.strategy === "lowAccuracy") {
    return copy.sort((a, b) => wordAccuracy(progress[a.id]) - wordAccuracy(progress[b.id]));
  }
  if (setup.strategy === "unknown") {
    return copy.sort(
      (a, b) =>
        masteryWeight(progress[b.id]?.masteryLevel ?? progress[b.id]?.mastery) -
        masteryWeight(progress[a.id]?.masteryLevel ?? progress[a.id]?.mastery),
    );
  }
  return copy.sort((a, b) => smartWeight(b, progress, mistakeMap) - smartWeight(a, progress, mistakeMap));
}

function filterPracticeWords(
  words: WordEntry[],
  setup: TestSetup,
  progress: Record<string, WordProgress>,
  activeMistakes: Set<string>,
) {
  if (setup.mode !== "practice") {
    return words;
  }
  const mode = setup.practiceMode ?? "mixed";
  if (mode === "new") {
    return words.filter((word) => (progress[word.id]?.attempts ?? 0) === 0);
  }
  if (mode === "mistakes") {
    return words.filter((word) => activeMistakes.has(word.id) || (progress[word.id]?.wrongCount ?? progress[word.id]?.wrong ?? 0) > 0);
  }
  if (mode === "review") {
    const now = Date.now();
    return words.filter((word) => {
      const nextReviewAt = progress[word.id]?.nextReviewAt;
      return nextReviewAt ? new Date(nextReviewAt).getTime() <= now : false;
    });
  }
  const mixed = new Map<string, WordEntry>();
  for (const word of words) {
    const item = progress[word.id];
    const due = item?.nextReviewAt ? new Date(item.nextReviewAt).getTime() <= Date.now() : false;
    if ((item?.attempts ?? 0) === 0 || activeMistakes.has(word.id) || (item?.wrongCount ?? item?.wrong ?? 0) > 0 || due) {
      mixed.set(word.id, word);
    }
  }
  return Array.from(mixed.values());
}

function sortPracticeWords(
  available: WordEntry[],
  baseAvailable: WordEntry[],
  setup: TestSetup,
  progress: Record<string, WordProgress>,
  mistakes: MistakeItem[],
  activeMistakes: Set<string>,
) {
  if (setup.mode === "practice" && (setup.practiceMode ?? "mixed") === "mixed") {
    return interleavePracticeBuckets(baseAvailable, progress, activeMistakes);
  }
  return sortWords(available, setup, progress, mistakes);
}

function interleavePracticeBuckets(words: WordEntry[], progress: Record<string, WordProgress>, activeMistakes: Set<string>) {
  const now = Date.now();
  const newWords = shuffle(words.filter((word) => (progress[word.id]?.attempts ?? 0) === 0));
  const mistakeWords = words
    .filter((word) => activeMistakes.has(word.id) || (progress[word.id]?.wrongCount ?? progress[word.id]?.wrong ?? 0) > 0)
    .sort((a, b) => (progress[b.id]?.wrongCount ?? progress[b.id]?.wrong ?? 0) - (progress[a.id]?.wrongCount ?? progress[a.id]?.wrong ?? 0));
  const dueWords = words
    .filter((word) => {
      const nextReviewAt = progress[word.id]?.nextReviewAt;
      return nextReviewAt ? new Date(nextReviewAt).getTime() <= now : false;
    })
    .sort((a, b) => new Date(progress[a.id]?.nextReviewAt ?? 0).getTime() - new Date(progress[b.id]?.nextReviewAt ?? 0).getTime());
  const result: WordEntry[] = [];
  const seen = new Set<string>();
  const buckets = [dueWords, mistakeWords, newWords];
  let index = 0;
  while (buckets.some((bucket) => bucket.length > 0)) {
    const bucket = buckets[index % buckets.length];
    const next = bucket.shift();
    if (next && !seen.has(next.id)) {
      seen.add(next.id);
      result.push(next);
    }
    index += 1;
  }
  return result;
}

function pickRoundWords(words: WordEntry[], count: number) {
  const unique: WordEntry[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    if (!seen.has(word.id)) {
      seen.add(word.id);
      unique.push(word);
    }
    if (unique.length >= count) {
      return unique;
    }
  }
  if (unique.length === 0) {
    return [];
  }
  const result = [...unique];
  let index = 0;
  while (result.length < count) {
    result.push(unique[index % unique.length]);
    index += 1;
  }
  return result;
}

function smartWeight(word: WordEntry, progress: Record<string, WordProgress>, mistakeMap: Map<string, MistakeItem>) {
  const item = progress[word.id];
  const mistake = mistakeMap.get(word.id);
  return (
    (mistake?.active ? 30 : 0) +
    (mistake?.wrongCount ?? 0) * 8 +
    masteryWeight(item?.masteryLevel ?? item?.mastery) * 6 +
    (1 - wordAccuracy(item)) * 10 +
    (item?.lastPracticedAt || item?.lastAnsweredAt ? Math.min(8, daysSince(item.lastPracticedAt ?? item.lastAnsweredAt ?? "") / 3) : 8)
  );
}

function wordAccuracy(progress?: WordProgress) {
  if (!progress || progress.attempts === 0) {
    return 0.5;
  }
  return (progress.correctCount ?? progress.correct) / progress.attempts;
}

function masteryWeight(mastery?: string) {
  if (mastery === "unknown") return 4;
  if (mastery === "vague") return 3;
  if (mastery === "unlearned" || !mastery) return 2;
  if (mastery === "known") return 1;
  return 0;
}

function daysSince(iso: string) {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 86400000);
}

function expandTypes(_ratio: Record<QuestionType, number>, count: number) {
  return Array.from({ length: count }, (_, index) => activeQuestionTypes[index % activeQuestionTypes.length]);
}

function supportsQuestionType(word: WordEntry, type: QuestionType) {
  if (type === "similar") {
    return Boolean(word.similarWordsGroup?.length && word.confusableNotes);
  }
  if (type === "synonym") {
    return Boolean(word.synonymGroup?.length && word.confusableNotes);
  }
  if (type === "familiar") {
    return Boolean(word.familiarMeaningNotes);
  }
  return true;
}

function fallbackType(_index: number): QuestionType {
  return "enToZh";
}

function requiresUsableMeaning(type: QuestionType) {
  return type === "enToZh" || type === "zhToEn" || type === "familiar";
}

function buildQuestion(word: WordEntry, type: QuestionType, scope: WordEntry[], index: number): Question {
  const correctMeaning = choiceMeaningFor(word) ?? undefined;
  if (type === "zhToEn") {
    if (!hasUsableMeaning(word)) {
      return buildWordChoiceQuestion(word, type, scope, index);
    }
    const options = makeWordOptions(word, scope, index);
    const correctOption = getRequiredCorrectOption(options, word.id, word.word);
    return {
      id: uid("q"),
      type,
      wordId: word.id,
      wordText: word.word,
      prompt: correctMeaning ?? word.coreMeaning,
      options,
      correctOptionId: correctOption.id,
      correctOptionText: correctOption.label,
      correctMeaning,
      choiceMeaning: cleanMeaning(word.choiceMeaning) ?? undefined,
      partOfSpeech: word.partOfSpeech,
      phonetic: word.phonetic,
      explanation: compactExplanation(word),
      word,
    };
  }
  if (type === "similar" || type === "synonym") {
    const groupWords = type === "similar" ? word.similarWordsGroup ?? [] : word.synonymGroup ?? [];
    const labels = [...new Set([word.word, ...groupWords])];
    const extra = scope.filter((item) => !labels.includes(item.word)).map((item) => item.word);
    const distractors = [...labels.filter((label) => label !== word.word), ...extra].map((label, optionIndex) => ({
      id: `${word.id}-${type}-${index}-${optionIndex}`,
      label,
      text: label,
      isCorrect: false,
      wordId: scope.find((item) => item.word === label)?.id,
    }));
    const options = makeStableOptions({ id: `${word.id}-${type}-correct-${index}`, label: word.word, text: word.word, isCorrect: true, wordId: word.id }, distractors);
    const correctOption = getRequiredCorrectOption(options, word.id, word.word);
    return {
      id: uid("q"),
      type,
      wordId: word.id,
      wordText: word.word,
      prompt: type === "similar" ? "根据语境选择最合适的形近词" : "根据语境选择最合适的近义词",
      context: word.example,
      options,
      correctOptionId: correctOption.id,
      correctOptionText: correctOption.label,
      correctMeaning,
      choiceMeaning: cleanMeaning(word.choiceMeaning) ?? undefined,
      partOfSpeech: word.partOfSpeech,
      phonetic: word.phonetic,
      explanation: word.confusableNotes,
      word,
    };
  }
  if (type === "familiar") {
    if (!hasUsableMeaning(word)) {
      return buildWordChoiceQuestion(word, type, scope, index);
    }
    const options = makeMeaningOptions(word, scope, index);
    if (options.length < 4) {
      return buildWordChoiceQuestion(word, type, scope, index);
    }
    const correctOption = getRequiredCorrectOption(options, word.id, correctMeaning);
    return {
      id: uid("q"),
      type,
      wordId: word.id,
      wordText: word.word,
      prompt: `句中 ${word.word} 更接近哪一层意思？`,
      context: word.example,
      options,
      correctOptionId: correctOption.id,
      correctOptionText: correctOption.label,
      correctMeaning,
      choiceMeaning: cleanMeaning(word.choiceMeaning) ?? undefined,
      partOfSpeech: word.partOfSpeech,
      phonetic: word.phonetic,
      explanation: word.familiarMeaningNotes,
      word,
    };
  }
  if (!hasUsableMeaning(word)) {
    return buildWordChoiceQuestion(word, "enToZh", scope, index);
  }
  const options = makeMeaningOptions(word, scope, index);
  if (options.length < 4) {
    return buildWordChoiceQuestion(word, "enToZh", scope, index);
  }
  const correctOption = getRequiredCorrectOption(options, word.id, correctMeaning);
  return {
    id: uid("q"),
    type: "enToZh",
    wordId: word.id,
    wordText: word.word,
    prompt: word.word,
    options,
    correctOptionId: correctOption.id,
    correctOptionText: correctOption.label,
    correctMeaning,
    choiceMeaning: cleanMeaning(word.choiceMeaning) ?? undefined,
    partOfSpeech: word.partOfSpeech,
    phonetic: word.phonetic,
    explanation: compactExplanation(word),
    word,
  };
}

function makeMeaningOptions(word: WordEntry, scope: WordEntry[], index: number): QuestionOption[] {
  const correctMeaning = choiceMeaningFor(word);
  if (!correctMeaning) {
    return makeWordOptions(word, scope, index);
  }
  const distractors = prioritizeDistractors(word, scope).filter((item) => choiceMeaningFor(item)).map((item) => ({
    id: `${word.id}-m-${item.id}-${index}`,
    label: choiceMeaningFor(item) ?? item.coreMeaning,
    text: choiceMeaningFor(item) ?? item.coreMeaning,
    isCorrect: false,
    wordId: item.id,
  }));
  const options = makeStableOptions({ id: `${word.id}-m-correct-${index}`, label: correctMeaning, text: correctMeaning, isCorrect: true, wordId: word.id }, distractors);
  return options;
}

function makeWordOptions(word: WordEntry, scope: WordEntry[], index: number): QuestionOption[] {
  const distractors = prioritizeDistractors(word, scope).map((item) => ({
    id: `${word.id}-w-${item.id}-${index}`,
    label: item.word,
    text: item.word,
    isCorrect: false,
    wordId: item.id,
  }));
  return makeStableOptions({ id: `${word.id}-w-correct-${index}`, label: word.word, text: word.word, isCorrect: true, wordId: word.id }, distractors);
}

function prioritizeDistractors(word: WordEntry, scope: WordEntry[]) {
  const candidates = [...scope, ...mockWords].filter((item) => item.id !== word.id);
  const seen = new Set<string>();
  return candidates
    .filter((item) => {
      const key = item.word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => distractorScore(b, word) - distractorScore(a, word))
    .slice(0, 24);
}

function compactExplanation(word: WordEntry) {
  return [word.partOfSpeech, word.coreMeaning, word.confusableNotes, word.familiarMeaningNotes].filter(Boolean).join(" · ");
}

function buildWordChoiceQuestion(word: WordEntry, type: QuestionType, scope: WordEntry[], index: number): Question {
  const options = makeWordOptions(word, scope, index);
  const correctOption = getRequiredCorrectOption(options, word.id, word.word);
  return {
    id: uid("q"),
    type,
    wordId: word.id,
    wordText: word.word,
    prompt: word.section ? `${word.section}${word.unit ? ` · ${word.unit}` : ""} · #${word.sourceOrder ?? word.sourceId ?? index + 1}` : "选择本轮目标词",
    context: "当前词条释义待校对，先进行词形识别练习。",
    options,
    correctOptionId: correctOption.id,
    correctOptionText: correctOption.label,
    correctMeaning: choiceMeaningFor(word) ?? undefined,
    choiceMeaning: cleanMeaning(word.choiceMeaning) ?? undefined,
    partOfSpeech: word.partOfSpeech,
    phonetic: word.phonetic,
    explanation: compactExplanation(word),
    word,
  };
}

function distractorScore(candidate: WordEntry, word: WordEntry) {
  let score = Math.random();
  if (candidate.section && candidate.section === word.section) score += 12;
  if (wordSectionUnitKey(candidate) === wordSectionUnitKey(word)) score += 10;
  if (candidate.partOfSpeech && candidate.partOfSpeech === word.partOfSpeech) score += 6;
  if (word.similarWordsGroup?.includes(candidate.word)) score += 20;
  if (word.synonymGroup?.includes(candidate.word)) score += 16;
  return score;
}

function cleanMeaning(value: string | undefined) {
  const clean = value?.trim();
  if (!clean) return null;
  if (invalidMeaningLabels.has(clean) || invalidMeaningLabels.has(clean.toLowerCase())) return null;
  return clean;
}

function choiceMeaningFor(word: WordEntry) {
  if (word.choiceUsable === false) {
    return null;
  }
  const choiceMeaning = cleanMeaning(word.choiceMeaning);
  if (choiceMeaning) {
    return choiceMeaning;
  }
  if (typeof word.sourceId === "number") {
    return null;
  }
  return cleanMeaning(word.coreMeaning);
}

function hasUsableMeaning(word: WordEntry) {
  return Boolean(choiceMeaningFor(word));
}

function uniqueOptions(options: QuestionOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = option.label.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeStableOptions(correct: QuestionOption, distractors: QuestionOption[]) {
  const unique = uniqueOptions([correct, ...distractors.filter((item) => item.label !== correct.label)]);
  const correctOption = unique.find((option) => option.isCorrect) ?? correct;
  const selectedDistractors = shuffle(unique.filter((option) => option.id !== correctOption.id)).slice(0, 3);
  return shuffle([correctOption, ...selectedDistractors]);
}

function getRequiredCorrectOption(options: QuestionOption[], wordId: string, correctText?: string) {
  const normalizedCorrectText = correctText?.trim();
  const correct = options.find(
    (option) => option.isCorrect && option.wordId === wordId && (!normalizedCorrectText || option.text.trim() === normalizedCorrectText),
  );
  if (!correct) {
    throw new Error(`Question option invariant failed: correct option missing for ${wordId}`);
  }
  return correct;
}

function typeDataName(type: QuestionType) {
  if (type === "similar") return "形近词辨析";
  if (type === "synonym") return "意近词辨析";
  if (type === "familiar") return "熟词僻义";
  return "专项";
}
