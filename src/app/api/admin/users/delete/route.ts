import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

interface DeleteUserPayload {
  userId?: unknown;
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) {
    return guard.response;
  }

  let payload: DeleteUserPayload;
  try {
    payload = (await request.json()) as DeleteUserPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "请求格式不正确。" }, { status: 400 });
  }

  const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ ok: false, error: "用户参数不正确。" }, { status: 400 });
  }

  const { currentUser, serviceClient } = guard.context;
  if (userId === currentUser.id) {
    return NextResponse.json({ ok: false, error: "不能删除当前登录的管理员账号。" }, { status: 400 });
  }

  const { error } = await serviceClient.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ ok: false, error: "删除用户失败，请稍后再试。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
