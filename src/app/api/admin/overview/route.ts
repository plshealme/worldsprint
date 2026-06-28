import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAuthEnvState } from "@/lib/supabaseServer";
import { OFFICIAL_CLEAN_WORD_COUNT, PUBLIC_VOCAB_NAME, PUBLIC_VOCAB_RANGE } from "@/lib/vocab";
import redbookWordsJson from "../../../../../data/redbook_words.json";

export const runtime = "nodejs";

const appVersion = "1.0.0";
const unitRange = "U1–U30";
const activeQuestionType = "英译汉";
const disabledQuestionTypes = [
  { label: "汉译英", status: "未开放" },
  { label: "形近词", status: "未开放" },
  { label: "意近词", status: "未开放" },
  { label: "熟词僻义", status: "未开放" },
];

interface RedbookAdminWord {
  word: string;
  displayWord?: string | null;
  phonetic?: string | null;
  partOfSpeech?: string | null;
  coreMeaning?: string | null;
  choiceMeaning?: string | null;
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) {
    return guard.response;
  }

  const { serviceClient } = guard.context;
  const [users, admins, normalUsers] = await Promise.all([
    countProfiles(serviceClient),
    countProfiles(serviceClient, "admin"),
    countProfiles(serviceClient, "user"),
  ]);

  if (users.error || admins.error || normalUsers.error) {
    return NextResponse.json({ ok: false, error: "无法读取用户概览。" }, { status: 500 });
  }

  const env = supabaseAuthEnvState();

  return NextResponse.json({
    ok: true,
    appVersion,
    wordCount: OFFICIAL_CLEAN_WORD_COUNT,
    unitRange,
    activeQuestionType,
    disabledQuestionTypes,
    userCount: users.count,
    adminCount: admins.count,
    normalUserCount: normalUsers.count,
    currentEnvironment: process.env.NODE_ENV,
    supabaseStatus: "正常",
    supabaseEnv: {
      hasSupabaseUrl: env.supabaseUrlExists,
      hasSupabaseAnonKey: env.supabaseAnonKeyExists,
      hasSupabaseServiceRoleKey: env.supabaseServiceRoleKeyExists,
    },
    vocab: {
      name: PUBLIC_VOCAB_NAME,
      range: PUBLIC_VOCAB_RANGE,
      usableForEnToZh: OFFICIAL_CLEAN_WORD_COUNT,
      status: "词库状态正常",
      randomWords: randomWordSample(),
    },
  });
}

async function countProfiles(serviceClient: SupabaseClient, role?: "user" | "admin") {
  let query = serviceClient.from("profiles").select("id", { count: "exact", head: true });
  if (role) {
    query = query.eq("role", role);
  }
  const { count, error } = await query;
  return { count: count ?? 0, error };
}

function randomWordSample() {
  const words = redbookWordsJson as RedbookAdminWord[];
  return [...words]
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
    .map((word) => ({
      word: word.displayWord || word.word,
      phonetic: word.phonetic ?? "",
      partOfSpeech: word.partOfSpeech ?? "",
      choiceMeaning: word.choiceMeaning || word.coreMeaning || "释义待校对",
    }));
}
