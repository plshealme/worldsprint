import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

interface ProfileRow {
  id: string;
  email: string | null;
  username: string | null;
  role: "user" | "admin" | string | null;
  created_at: string | null;
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) {
    return guard.response;
  }

  const { serviceClient, currentUser } = guard.context;
  const { data: profiles, error: profilesError } = await serviceClient
    .from("profiles")
    .select("id,email,username,role,created_at")
    .order("created_at", { ascending: false });

  if (profilesError) {
    return NextResponse.json({ ok: false, error: "无法读取用户资料。" }, { status: 500 });
  }

  const { data: authData, error: authError } = await serviceClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (authError) {
    return NextResponse.json({ ok: false, error: "无法读取认证用户列表。" }, { status: 500 });
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile as ProfileRow]));
  const authUsers = authData.users ?? [];
  const authUserMap = new Map(authUsers.map((user) => [user.id, user]));
  const ids = new Set([...profileMap.keys(), ...authUserMap.keys()]);

  const users = Array.from(ids)
    .map((id) => {
      const profile = profileMap.get(id);
      const authUser = authUserMap.get(id);
      return {
        id,
        email: profile?.email ?? authUser?.email ?? "",
        username: profile?.username ?? usernameFromAuthUser(authUser),
        role: normalizeRole(profile?.role),
        created_at: profile?.created_at ?? authUser?.created_at ?? null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        isCurrentAdmin: id === currentUser.id,
      };
    })
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

  return NextResponse.json({ ok: true, users });
}

function normalizeRole(role: string | null | undefined) {
  return role === "admin" ? "admin" : "user";
}

function usernameFromAuthUser(user: User | undefined) {
  const metadata = user?.user_metadata as { username?: unknown } | undefined;
  if (typeof metadata?.username === "string" && metadata.username.trim()) {
    return metadata.username.trim();
  }
  return user?.email?.split("@")[0] ?? "WordSprint User";
}
