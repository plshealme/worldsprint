const fs = require("node:fs") as typeof import("node:fs");
const path = require("node:path") as typeof import("node:path");
const ts = require("typescript") as typeof import("typescript");

const root = process.cwd();
const moduleCache = new Map<string, { exports: unknown }>();

function main() {
  const { generateQuestions } = loadTsModule(path.join(root, "src/lib/questionGenerator.ts")) as typeof import("../src/lib/questionGenerator");
  const words = loadRedbookWords();
  const unit1Words = words.filter((word) => word.section === "\u57fa\u7840\u8bcd" && word.unit === "Unit 1" && word.choiceMeaning);
  if (unit1Words.length < 4) {
    throw new Error(`Need at least 4 usable Unit 1 words, got ${unit1Words.length}.`);
  }

  const setup: import("../src/types/test").TestSetup = {
    mode: "practice",
    category: "",
    section: "",
    practiceMode: "new",
    units: [],
    tags: [],
    questionCount: 200,
    ratio: { enToZh: 100, zhToEn: 0, similar: 0, synonym: 0, familiar: 0 },
    strategy: "random",
    includeMistakesProgress: true,
  };

  verifyTargetWords(generateQuestions, unit1Words);
  verifyUnitOrderShuffle(generateQuestions, words, unit1Words);
  verifyGlobalPracticeExamShuffle(generateQuestions, words, unit1Words);
  verifyHardLimit(generateQuestions, words);

  const generation = generateQuestions(setup, {}, [], unit1Words);
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  const labels = ["A", "B", "C", "D"] as const;

  for (const question of generation.questions) {
    if (question.options.length !== 4) {
      throw new Error(`${question.wordText} has ${question.options.length} options.`);
    }
    const correctOptions = question.options.filter((option) => option.isCorrect);
    if (correctOptions.length !== 1) {
      throw new Error(`${question.wordText} has ${correctOptions.length} correct options.`);
    }
    if (!question.options.some((option) => option.text === question.correctMeaning && option.isCorrect)) {
      throw new Error(`${question.wordText} options do not include its correctMeaning.`);
    }
    const correctIndex = question.options.findIndex((option) => option.isCorrect);
    counts[labels[correctIndex]] += 1;
  }

  const maxCount = Math.max(...Object.values(counts));
  if (maxCount > 110) {
    throw new Error(`Correct answer distribution is too concentrated: ${JSON.stringify(counts)}`);
  }

  console.log("Practice question invariant check passed.");
  console.log(`Generated: ${generation.questions.length}`);
  console.log(`A: ${counts.A}`);
  console.log(`B: ${counts.B}`);
  console.log(`C: ${counts.C}`);
  console.log(`D: ${counts.D}`);
}

interface RedbookJsonWord {
  appOrder?: number;
  sourceId?: number;
  source_id?: number;
  sourceOrder?: number | null;
  source_order?: number;
  word: string;
  displayWord?: string | null;
  coreMeaning?: string | null;
  choiceMeaning?: string | null;
  choiceUsable?: boolean | null;
  fullMeanings?: string | null;
  phonetic?: string | null;
  partOfSpeech?: string | null;
  section: string;
  unit: number | null;
}

function loadRedbookWords(): import("../src/types/word").WordEntry[] {
  const filePath = path.join(root, "data/redbook_words.json");
  const words = JSON.parse(fs.readFileSync(filePath, "utf8")) as RedbookJsonWord[];
  return words
    .filter((word) => Boolean(word.word?.trim()))
    .slice()
    .sort((a, b) => redbookAppOrder(a) - redbookAppOrder(b))
    .map((word) => {
      const sourceId = word.sourceId ?? word.source_id ?? word.appOrder ?? 0;
      const sourceOrder = word.sourceOrder ?? word.source_order ?? word.appOrder ?? 0;
      return {
        id: `redbook-${sourceId}`,
        word: word.word,
        displayWord: cleanNullable(word.displayWord),
        coreMeaning: cleanNullable(word.coreMeaning) ?? "\u91ca\u4e49\u5f85\u6821\u5bf9",
        choiceMeaning: cleanNullable(word.choiceMeaning),
        choiceUsable: word.choiceUsable ?? undefined,
        fullMeanings: cleanNullable(word.fullMeanings),
        phonetic: cleanNullable(word.phonetic),
        partOfSpeech: cleanNullable(word.partOfSpeech),
        section: word.section,
        unit: typeof word.unit === "number" ? `Unit ${word.unit}` : undefined,
        sourceId,
        sourceOrder,
        appOrder: word.appOrder,
      } satisfies import("../src/types/word").WordEntry;
    });
}

function redbookAppOrder(row: RedbookJsonWord) {
  return row.appOrder ?? row.sourceOrder ?? row.source_order ?? row.sourceId ?? row.source_id ?? 0;
}

function cleanNullable(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : undefined;
}

function verifyHardLimit(
  generateQuestions: typeof import("../src/lib/questionGenerator").generateQuestions,
  words: import("../src/types/word").WordEntry[],
) {
  const baseSetup: import("../src/types/test").TestSetup = {
    mode: "practice",
    category: "",
    section: "\u57fa\u7840\u8bcd",
    practiceMode: "new",
    units: ["\u57fa\u7840\u8bcd::Unit 1"],
    tags: [],
    questionCount: 20,
    ratio: { enToZh: 100, zhToEn: 0, similar: 0, synonym: 0, familiar: 0 },
    strategy: "random",
    includeMistakesProgress: true,
  };
  const practiceQuestions = generateQuestions(baseSetup, {}, [], words).questions;
  const examQuestions = generateQuestions({ ...baseSetup, mode: "exam", practiceMode: undefined }, {}, [], words).questions;
  if (practiceQuestions.length !== 20) {
    throw new Error(`Practice hard limit failed: expected 20, got ${practiceQuestions.length}.`);
  }
  if (examQuestions.length !== 20) {
    throw new Error(`Exam hard limit failed: expected 20, got ${examQuestions.length}.`);
  }
  if (practiceQuestions.some((question) => question.word.section !== "\u57fa\u7840\u8bcd" || question.word.unit !== "Unit 1")) {
    throw new Error("Practice hard limit check mixed section/unit.");
  }
  if (examQuestions.some((question) => question.word.section !== "\u57fa\u7840\u8bcd" || question.word.unit !== "Unit 1")) {
    throw new Error("Exam hard limit check mixed section/unit.");
  }
  console.log("Practice/Exam 20-question hard limit check passed.");
}

function verifyUnitOrderShuffle(
  generateQuestions: typeof import("../src/lib/questionGenerator").generateQuestions,
  words: import("../src/types/word").WordEntry[],
  unit1Words: import("../src/types/word").WordEntry[],
) {
  const setup: import("../src/types/test").TestSetup = {
    mode: "practice",
    category: "",
    section: "\u57fa\u7840\u8bcd",
    practiceMode: "new",
    units: ["\u57fa\u7840\u8bcd::Unit 1"],
    tags: [],
    questionCount: unit1Words.length,
    ratio: { enToZh: 100, zhToEn: 0, similar: 0, synonym: 0, familiar: 0 },
    strategy: "unit",
    includeMistakesProgress: true,
  };
  const orders = Array.from({ length: 5 }, () => generateQuestions(setup, {}, [], words).questions.map((question) => question.wordText));
  const expectedCount = unit1Words.length;
  const uniqueOrders = new Set(orders.map((order) => order.join("|")));

  orders.forEach((order, index) => {
    if (order.length !== expectedCount) {
      throw new Error(`Unit 1 round ${index + 1} generated ${order.length} words, expected ${expectedCount}.`);
    }
    if (new Set(order).size !== expectedCount) {
      throw new Error(`Unit 1 round ${index + 1} contains duplicate words.`);
    }
    const generated = generateQuestions(setup, {}, [], words).questions;
    if (generated.some((question) => question.word.section !== "\u57fa\u7840\u8bcd" || question.word.unit !== "Unit 1")) {
      throw new Error(`Unit 1 round ${index + 1} mixed section/unit.`);
    }
  });
  if (uniqueOrders.size === 1) {
    throw new Error("Unit 1 generated the same word order 5 times.");
  }

  console.log("Unit 1 order shuffle check passed.");
  orders.forEach((order, index) => {
    console.log(`Round ${index + 1} first 10: ${order.slice(0, 10).join(", ")}`);
  });
}

function verifyGlobalPracticeExamShuffle(
  generateQuestions: typeof import("../src/lib/questionGenerator").generateQuestions,
  words: import("../src/types/word").WordEntry[],
  unit1Words: import("../src/types/word").WordEntry[],
) {
  const baseSetup: import("../src/types/test").TestSetup = {
    mode: "practice",
    category: "",
    section: "",
    practiceMode: "new",
    units: [],
    tags: [],
    questionCount: unit1Words.length,
    ratio: { enToZh: 100, zhToEn: 0, similar: 0, synonym: 0, familiar: 0 },
    strategy: "unit",
    includeMistakesProgress: true,
  };
  const practiceModes: Array<import("../src/types/test").PracticeMode> = ["new", "mistakes", "review", "mixed"];
  const progress = makeModeProgress(unit1Words);
  const cases: Array<{ name: string; setup: import("../src/types/test").TestSetup; progress?: Record<string, import("../src/types/word").WordProgress> }> = [
    { name: "practice all", setup: { ...baseSetup, questionCount: 40, units: [] } },
    { name: "practice section", setup: { ...baseSetup, questionCount: 40, section: "\u57fa\u7840\u8bcd", units: [] } },
    { name: "practice section+unit", setup: baseSetup },
    ...practiceModes.map((practiceMode) => ({
      name: `practice ${practiceMode}`,
      setup: { ...baseSetup, practiceMode },
      progress,
    })),
    { name: "exam section+unit", setup: { ...baseSetup, mode: "exam", practiceMode: undefined } },
  ];

  for (const item of cases) {
    const first = generateQuestions(item.setup, item.progress ?? {}, [], words).questions.map((question) => question.wordId).join("|");
    const second = generateQuestions(item.setup, item.progress ?? {}, [], words).questions.map((question) => question.wordId).join("|");
    if (!first || !second) {
      throw new Error(`${item.name} did not generate questions.`);
    }
    if (first === second) {
      throw new Error(`${item.name} generated the same order twice.`);
    }
    if (
      item.setup.units.length > 0 &&
      generateQuestions(item.setup, item.progress ?? {}, [], words).questions.some(
        (question) => question.word.section !== "\u57fa\u7840\u8bcd" || question.word.unit !== "Unit 1",
      )
    ) {
      throw new Error(`${item.name} mixed section/unit.`);
    }
  }

  console.log("Global Practice/Exam shuffle coverage passed.");
}

function makeModeProgress(unit1Words: import("../src/types/word").WordEntry[]) {
  const now = new Date().toISOString();
  return Object.fromEntries(
    unit1Words.map((word, index) => [
      word.id,
      {
        wordId: word.id,
        word: word.word,
        mastery: index % 3 === 0 ? "unknown" : "known",
        masteryLevel: index % 3 === 0 ? "unknown" : "known",
        favorite: false,
        isFavorite: false,
        isMistake: index % 5 === 0,
        note: "",
        personalTagIds: [],
        attempts: index % 4 === 0 ? 0 : 2,
        correct: 1,
        correctCount: 1,
        wrong: index % 5 === 0 ? 1 : 0,
        wrongCount: index % 5 === 0 ? 1 : 0,
        nextReviewAt: index % 4 === 0 ? now : undefined,
      },
    ]),
  ) as Record<string, import("../src/types/word").WordProgress>;
}

function verifyTargetWords(
  generateQuestions: typeof import("../src/lib/questionGenerator").generateQuestions,
  unit1Words: import("../src/types/word").WordEntry[],
) {
  const expected = new Map([
    ["plain", "\u6734\u7d20\u7684"],
    ["via", "\u7ecf\u7531"],
    ["marital", "\u5a5a\u59fb\u7684"],
    ["lay", "\u653e\u7f6e"],
    ["pioneer", "\u5f00\u62d3\u8005"],
  ]);
  const setup: import("../src/types/test").TestSetup = {
    mode: "practice",
    category: "",
    section: "",
    practiceMode: "new",
    units: [],
    tags: [],
    questionCount: 1,
    ratio: { enToZh: 100, zhToEn: 0, similar: 0, synonym: 0, familiar: 0 },
    strategy: "smart",
    includeMistakesProgress: true,
  };

  for (const [wordText, meaning] of expected) {
    const target = unit1Words.find((word) => word.word === wordText);
    if (!target) {
      throw new Error(`Missing target word: ${wordText}`);
    }
    const progress = Object.fromEntries(
      unit1Words
        .filter((word) => word.id !== target.id)
        .map((word) => [
          word.id,
          {
            wordId: word.id,
            word: word.word,
            mastery: "known",
            masteryLevel: "known",
            favorite: false,
            isFavorite: false,
            isMistake: false,
            note: "",
            personalTagIds: [],
            attempts: 1,
            correct: 1,
            correctCount: 1,
            wrong: 0,
            wrongCount: 0,
          },
        ]),
    ) as Record<string, import("../src/types/word").WordProgress>;
    for (let index = 0; index < 30; index += 1) {
      const question = generateQuestions(setup, progress, [], unit1Words).questions[0];
      const correctOption = question.options.find((option) => option.isCorrect);
      if (question.wordText !== wordText || question.word.word !== wordText || question.wordId !== target.id) {
        throw new Error(`${wordText} question is bound to ${question.wordText}/${question.wordId}.`);
      }
      if (question.correctMeaning !== meaning || correctOption?.text !== meaning) {
        throw new Error(`${wordText} expected ${meaning}, got ${question.correctMeaning}/${correctOption?.text}.`);
      }
      if (!question.options.some((option) => option.text === meaning && option.isCorrect)) {
        throw new Error(`${wordText} options do not include correct meaning ${meaning}.`);
      }
    }
  }
}

function loadTsModule(file: string) {
  const resolved = path.resolve(file);
  const cached = moduleCache.get(resolved);
  if (cached) {
    return cached.exports;
  }
  if (resolved.endsWith(".json")) {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  }

  const source = fs.readFileSync(resolved, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      resolveJsonModule: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: resolved,
  }).outputText;

  const module = { exports: {} };
  moduleCache.set(resolved, module);
  const fn = new Function("require", "module", "exports", "__filename", "__dirname", output);
  fn((specifier: string) => localRequire(specifier, resolved), module, module.exports, resolved, path.dirname(resolved));
  return module.exports;
}

function localRequire(specifier: string, parentFile: string) {
  const mapped = resolveSpecifier(specifier, parentFile);
  if (mapped === specifier && !specifier.startsWith(".") && !specifier.startsWith("@/")) {
    return require(specifier);
  }
  return loadTsModule(mapped);
}

function resolveSpecifier(specifier: string, parentFile: string) {
  if (specifier.startsWith("@/")) {
    return resolveWithExtensions(path.join(root, "src", specifier.slice(2)));
  }
  if (specifier.startsWith(".")) {
    return resolveWithExtensions(path.resolve(path.dirname(parentFile), specifier));
  }
  return specifier;
}

function resolveWithExtensions(base: string) {
  for (const extension of ["", ".ts", ".tsx", ".js", ".json"]) {
    const candidate = `${base}${extension}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  throw new Error(`Cannot resolve ${base}`);
}

main();
