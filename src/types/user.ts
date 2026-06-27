export type ThemePreference = "system" | "light" | "dark" | "eye";
export type FontSizePreference = "small" | "medium" | "large";

export interface UserSettings {
  theme: ThemePreference;
  fontSize: FontSizePreference;
  autoRemoveMistakeStreak: 2 | 3 | 5;
  defaultQuestionCount: number;
  defaultTypeRatio: {
    enToZh: number;
    zhToEn: number;
    similar: number;
    synonym: number;
    familiar: number;
  };
  examHideHints: boolean;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  earnedAt?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  isAdmin: boolean;
  firstLoginDone: boolean;
  xp: number;
  badges: Badge[];
  createdAt: string;
}
