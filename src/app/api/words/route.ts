import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_ACCESS_COOKIE } from "@/lib/authCookies";
import { createSupabaseServerClient, isSupabaseNetworkError, supabaseNetworkErrorMessage } from "@/lib/supabaseServer";
import { DEFAULT_WORD_PAGE_SIZE, parseUnitValue, redbookRowToWordEntry, sourceIdFromWordId, type RedbookWordRow } from "@/lib/words";

export const runtime = "nodejs";

const columns =
  "id,source_id,word,word_raw,section,unit,subsection,source_order,flags,phonetic,part_of_speech,meaning,is_reviewed,created_at,updated_at";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(500, Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_WORD_PAGE_SIZE)));
  const section = url.searchParams.get("section")?.trim();
  const unit = parseUnitValue(url.searchParams.get("unit"));
  const q = url.searchParams.get("q")?.trim();
  const idsParam = url.searchParams.get("ids");
  const ids = parseIds(idsParam);

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

  if (idsParam !== null && ids.length === 0) {
    return NextResponse.json({
      words: [],
      total: 0,
      page,
      pageSize,
      units: [],
      source: "supabase",
    });
  }

  try {
    let query = supabase.from("words").select(columns, { count: "exact" }).order("source_id", { ascending: true });
    if (ids.length > 0) {
      query = query.in("source_id", ids);
    }
    if (section) {
      query = query.eq("section", section);
    }
    if (unit !== null) {
      query = query.eq("unit", unit);
    }
    if (q) {
      const pattern = `%${q.replace(/[,%]/g, " ")}%`;
      query = query.or(`word.ilike.${pattern},word_raw.ilike.${pattern},meaning.ilike.${pattern}`);
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    const { data, count, error } = await query.range(start, end);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const { data: unitRows } = await supabase.from("words").select("unit").not("unit", "is", null).order("unit", { ascending: true });
    const units = Array.from(new Set((unitRows ?? []).map((row) => `Unit ${row.unit}`)));

    return NextResponse.json({
      words: ((data ?? []) as RedbookWordRow[]).map(redbookRowToWordEntry),
      total: count ?? data?.length ?? 0,
      page,
      pageSize,
      units,
      source: "supabase",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: isSupabaseNetworkError(error) ? supabaseNetworkErrorMessage : "读取词库失败。" },
      { status: isSupabaseNetworkError(error) ? 502 : 500 },
    );
  }
}

function parseIds(value: string | null) {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((id) => sourceIdFromWordId(id.trim()))
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
}
