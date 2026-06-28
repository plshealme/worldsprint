import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

type AdminRole = "user" | "admin";

interface UpdateRolePayload {
  userId?: unknown;
  role?: unknown;
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) {
    return guard.response;
  }

  let payload: UpdateRolePayload;
  try {
    payload = (await request.json()) as UpdateRolePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "请求格式不正确。" }, { status: 400 });
  }

  const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
  const role = normalizeRole(payload.role);

  if (!userId || !role) {
    return NextResponse.json({ ok: false, error: "用户或角色参数不正确。" }, { status: 400 });
  }

  const { currentUser, serviceClient } = guard.context;
  if (userId === currentUser.id && role !== "admin") {
    return NextResponse.json({ ok: false, error: "不能取消自己的管理员身份。" }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id,email,username,role,created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: "角色更新失败，请稍后再试。" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: "没有找到该用户资料。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user: data });
}

function normalizeRole(role: unknown): AdminRole | null {
  return role === "user" || role === "admin" ? role : null;
}
