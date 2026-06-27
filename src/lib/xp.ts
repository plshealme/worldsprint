import type { Badge, UserProfile } from "@/types/user";
import type { TestReport } from "@/types/test";
import type { WordProgress } from "@/types/word";

const badgeCatalog: Badge[] = [
  {
    id: "review-50",
    name: "稳步复习",
    description: "累计复习或答题覆盖 50 个词",
    tier: "bronze",
  },
  {
    id: "answer-100",
    name: "百题起跑",
    description: "累计完成 100 道题",
    tier: "silver",
  },
  {
    id: "exam-90",
    name: "精准冲刺",
    description: "Exam 正确率达到 90%",
    tier: "gold",
  },
  {
    id: "mistake-clear",
    name: "错题回收",
    description: "连续减少错题数并清空一组错题",
    tier: "platinum",
  },
];

export function calculateReportXp(report: TestReport) {
  const base = report.mode === "exam" ? 6 : 3;
  const answerXp = report.total * base;
  const correctXp = report.correct * (report.mode === "exam" ? 5 : 3);
  const mistakeRecovery = report.answers.filter((answer) => answer.isCorrect).length * 1;
  return Math.max(0, Math.round((answerXp + correctXp + mistakeRecovery) * 0.7));
}

export function mergeBadges(profile: UserProfile, progress: Record<string, WordProgress>, reports: TestReport[]) {
  const existing = new Set(profile.badges.map((badge) => badge.id));
  const earned: Badge[] = [];
  const totalAttempts = Object.values(progress).reduce((sum, item) => sum + item.attempts, 0);
  const coveredWords = Object.values(progress).filter((item) => item.attempts > 0 || item.mastery !== "unlearned").length;
  const latestExam = reports.find((report) => report.mode === "exam");

  const shouldEarn = (badgeId: string) => {
    if (existing.has(badgeId)) {
      return false;
    }
    if (badgeId === "review-50") {
      return coveredWords >= 50;
    }
    if (badgeId === "answer-100") {
      return totalAttempts >= 100;
    }
    if (badgeId === "exam-90") {
      return Boolean(latestExam && latestExam.questionAccuracy >= 0.9);
    }
    if (badgeId === "mistake-clear") {
      return false;
    }
    return false;
  };

  for (const badge of badgeCatalog) {
    if (shouldEarn(badge.id)) {
      earned.push({ ...badge, earnedAt: new Date().toISOString() });
    }
  }

  return earned;
}
