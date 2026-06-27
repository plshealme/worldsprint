import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_ACCESS_COOKIE } from "@/lib/authCookies";
import { createSupabaseServerClient, isSupabaseNetworkError, supabaseNetworkErrorMessage } from "@/lib/supabaseServer";
import { redbookRowToWordEntry, sourceIdFromWordId, type RedbookWordRow } from "@/lib/words";

export const runtime = "nodejs";

const columns =
  "id,source_id,word,word_raw,section,unit,subsection,source_order,flags,phonetic,part_of_speech,meaning,is_reviewed,created_at,updated_at";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const sourceId = sourceIdFromWordId(id);
  if (sourceId === null) {
    return NextResponse.json({ ok: false, error: "无效词条 ID。" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "请先登录后再读取词库。" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createSupabaseServerClient(accessToken);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Supabase 配置无效。" }, { status: 500 });
  }

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase 环境变量未配置，无法读取词库。" }, { status: 503 });
  }

  try {
    const { data, error } = await supabase.from("words").select(columns).eq("source_id", sourceId).maybeSingle();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ word: data ? redbookRowToWordEntry(data as RedbookWordRow) : null });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: isSupabaseNetworkError(error) ? supabaseNetworkErrorMessage : "读取词条失败。" },
      { status: isSupabaseNetworkError(error) ? 502 : 500 },
    );
  }
}
