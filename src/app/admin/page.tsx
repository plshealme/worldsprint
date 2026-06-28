"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Database,
  KeyRound,
  RefreshCw,
  Shield,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { useAppState } from "@/components/providers/AppStateProvider";
import { PUBLIC_VOCAB_NAME, PUBLIC_VOCAB_RANGE } from "@/lib/vocab";

type AccessState = "checking" | "allowed" | "denied";
type AdminRole = "user" | "admin";

interface AdminOverview {
  appVersion: string;
  wordCount: number;
  unitRange: string;
  activeQuestionType: string;
  disabledQuestionTypes: Array<{ label: string; status: string }>;
  userCount: number;
  adminCount: number;
  normalUserCount: number;
  currentEnvironment: string;
  supabaseStatus: string;
  supabaseEnv: {
    hasSupabaseUrl: boolean;
    hasSupabaseAnonKey: boolean;
    hasSupabaseServiceRoleKey: boolean;
  };
  vocab: {
    name: string;
    range: string;
    usableForEnToZh: number;
    status: string;
    randomWords: Array<{
      word: string;
      phonetic: string;
      partOfSpeech: string;
      choiceMeaning: string;
    }>;
  };
}

interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  role: AdminRole;
  created_at: string | null;
  last_sign_in_at: string | null;
  isCurrentAdmin: boolean;
}

interface ApiErrorResponse {
  ok?: boolean;
  error?: string;
}

export default function AdminPage() {
  const { user, logout } = useAppState();
  const router = useRouter();
  const [access, setAccess] = useState<AccessState>("checking");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingUserId, setActingUserId] = useState<string | null>(null);

  const handleUnauthorized = useCallback(() => {
    logout();
    router.replace("/login");
  }, [logout, router]);

  const loadAdminData = useCallback(async () => {
    if (!user) {
      router.replace("/login");
      return;
    }

    if (!user.isAdmin) {
      setAccess("denied");
      setLoading(false);
      return;
    }

    setAccess("checking");
    setLoading(true);
    setError("");

    try {
      const [overviewResponse, usersResponse] = await Promise.all([
        fetch("/api/admin/overview", { credentials: "include" }),
        fetch("/api/admin/users", { credentials: "include" }),
      ]);

      if (overviewResponse.status === 401 || usersResponse.status === 401) {
        handleUnauthorized();
        return;
      }

      if (overviewResponse.status === 403 || usersResponse.status === 403) {
        setAccess("denied");
        return;
      }

      const overviewData = (await overviewResponse.json().catch(() => null)) as
        | (ApiErrorResponse & AdminOverview)
        | null;
      const usersData = (await usersResponse.json().catch(() => null)) as
        | (ApiErrorResponse & { users?: AdminUserRow[] })
        | null;

      if (!overviewResponse.ok || !overviewData?.ok) {
        throw new Error(overviewData?.error ?? "无法读取管理员概览。");
      }

      if (!usersResponse.ok || !usersData?.ok) {
        throw new Error(usersData?.error ?? "无法读取用户列表。");
      }

      setOverview(overviewData);
      setUsers(usersData.users ?? []);
      setAccess("allowed");
    } catch (adminError) {
      setAccess("allowed");
      setError(adminError instanceof Error ? adminError.message : "管理员数据加载失败。");
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized, router, user]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const currentAdminLabel = useMemo(() => {
    if (!user) return "管理员";
    return user.username || user.email || "管理员";
  }, [user]);

  async function updateRole(target: AdminUserRow, nextRole: AdminRole) {
    if (target.isCurrentAdmin && nextRole === "user") {
      setError("不能取消自己的管理员身份。");
      return;
    }

    const actionLabel = nextRole === "admin" ? "设为管理员" : "取消管理员身份";
    if (!window.confirm(`确认要将 ${target.username || target.email} ${actionLabel}吗？`)) {
      return;
    }

    await runUserAction(target.id, "/api/admin/users/update-role", {
      userId: target.id,
      role: nextRole,
    });
  }

  async function deleteUser(target: AdminUserRow) {
    if (target.isCurrentAdmin) {
      setError("不能删除当前登录的管理员账号。");
      return;
    }

    const label = target.username || target.email || "该用户";
    if (!window.confirm(`确认删除 ${label} 吗？此操作会删除该用户账号。`)) {
      return;
    }
    if (!window.confirm("删除用户不可撤销，请再次确认。")) {
      return;
    }

    await runUserAction(target.id, "/api/admin/users/delete", { userId: target.id });
  }

  async function runUserAction(userId: string, path: string, payload: Record<string, unknown>) {
    setActingUserId(userId);
    setError("");

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (response.status === 403) {
        setAccess("denied");
        return;
      }

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "操作失败，请稍后再试。");
      }

      await loadAdminData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "操作失败，请稍后再试。");
    } finally {
      setActingUserId(null);
    }
  }

  if (access === "checking" && loading) {
    return (
      <section className="rounded-lg border border-line bg-panel p-8 text-center shadow-soft">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Shield size={22} />
        </div>
        <h1 className="mt-4 text-2xl font-bold">正在验证管理员权限...</h1>
        <p className="mt-2 text-sm text-subtle">验证完成前不会跳转首页。</p>
      </section>
    );
  }

  if (access === "denied") {
    return (
      <section className="rounded-lg border border-line bg-panel p-8 text-center shadow-soft">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertTriangle size={22} />
        </div>
        <h1 className="mt-4 text-2xl font-bold">无权限访问</h1>
        <p className="mt-2 text-sm text-subtle">当前账号不是管理员，不能进入管理员控制台。</p>
        <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-4 font-semibold text-panel" href="/">
          返回首页
        </Link>
      </section>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 pb-12">
      <section className="overflow-hidden rounded-lg border border-brand/25 bg-panel shadow-soft">
        <div className="bg-gradient-to-br from-brand/14 via-panel to-panel p-5 md:p-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand">
            <Shield size={15} />
            Admin Only
          </p>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ink">管理员控制台</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-subtle">
                用于管理 WordSprint 的用户、词库状态与系统配置。
              </p>
            </div>
            <Button variant="secondary" onClick={() => void loadAdminData()} disabled={loading}>
              <RefreshCw size={16} />
              刷新
            </Button>
          </div>
          <div className="mt-5 grid gap-3 text-sm md:grid-cols-4">
            <HeaderPill label="当前管理员" value={currentAdminLabel} />
            <HeaderPill label="App 版本" value={overview?.appVersion ?? "1.0.0"} />
            <HeaderPill label="当前词库" value={PUBLIC_VOCAB_NAME} />
            <HeaderPill label="当前词数" value={`${overview?.wordCount ?? 2499}`} />
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <OverviewCard icon={BookOpen} label="当前词数" value={`${overview?.wordCount ?? 2499}`} hint="基础词 U1–U30" />
        <OverviewCard icon={Database} label="正式题型" value={overview?.activeQuestionType ?? "英译汉"} hint="其他题型未开放" />
        <OverviewCard icon={Users} label="用户总数" value={`${overview?.userCount ?? 0}`} hint={`管理员 ${overview?.adminCount ?? 0} · 普通用户 ${overview?.normalUserCount ?? 0}`} />
        <OverviewCard
          icon={CheckCircle2}
          label="Supabase 连接状态"
          value={overview?.supabaseStatus ?? (loading ? "检查中" : "异常")}
          hint={`当前环境：${overview?.currentEnvironment ?? process.env.NODE_ENV}`}
        />
      </section>

      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold">用户管理</h2>
            <p className="mt-1 text-sm text-subtle">管理用户角色和账号状态。所有操作都会在服务端再次校验管理员权限。</p>
          </div>
          <p className="text-sm text-subtle">共 {users.length} 位用户</p>
        </div>

        <div className="mt-4 space-y-3 md:hidden">
          {users.map((item) => (
            <UserCard
              key={item.id}
              user={item}
              acting={actingUserId === item.id}
              onUpdateRole={updateRole}
              onDelete={deleteUser}
            />
          ))}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-subtle">
              <tr>
                <th className="py-3 pr-4">邮箱</th>
                <th className="py-3 pr-4">用户名</th>
                <th className="py-3 pr-4">角色</th>
                <th className="py-3 pr-4">注册时间</th>
                <th className="py-3 pr-4">最近登录</th>
                <th className="py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((item) => (
                <tr key={item.id}>
                  <td className="py-4 pr-4 font-medium">{item.email || "暂无"}</td>
                  <td className="py-4 pr-4">{item.username || "暂无"}</td>
                  <td className="py-4 pr-4">
                    <RoleBadge role={item.role} />
                  </td>
                  <td className="py-4 pr-4">{formatDate(item.created_at)}</td>
                  <td className="py-4 pr-4">{formatDate(item.last_sign_in_at)}</td>
                  <td className="py-4">
                    <UserActions
                      user={item}
                      acting={actingUserId === item.id}
                      onUpdateRole={updateRole}
                      onDelete={deleteUser}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && users.length === 0 ? <p className="mt-4 text-sm text-subtle">暂无用户数据。</p> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border border-line bg-panel p-5 shadow-soft">
          <h2 className="text-lg font-bold">词库状态</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoRow label="词库名称" value={`${PUBLIC_VOCAB_NAME} · ${PUBLIC_VOCAB_RANGE}`} />
            <InfoRow label="当前词数" value={`${overview?.wordCount ?? 2499}`} />
            <InfoRow label="可用于英译汉题数" value={`${overview?.vocab.usableForEnToZh ?? 2499}`} />
            <InfoRow label="状态" value={overview?.vocab.status ?? "词库状态正常"} strong />
          </div>
          <div className="mt-5">
            <p className="text-sm font-semibold">禁用题型</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(overview?.disabledQuestionTypes ?? defaultDisabledQuestionTypes).map((type) => (
                <span key={type.label} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-subtle">
                  {type.label}：{type.status}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <p className="text-sm font-semibold">抽查词库</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(overview?.vocab.randomWords ?? []).map((word) => (
                <div key={`${word.word}-${word.choiceMeaning}`} className="rounded-lg border border-line bg-surface p-3">
                  <p className="font-serif text-xl font-bold">{word.word}</p>
                  <p className="mt-1 text-xs text-subtle">
                    {[word.phonetic, word.partOfSpeech].filter(Boolean).join(" · ") || "词性待校对"}
                  </p>
                  <p className="mt-2 text-sm font-semibold">{word.choiceMeaning}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-5 shadow-soft">
          <h2 className="text-lg font-bold">系统工具</h2>
          <div className="mt-4 space-y-3">
            <ToolStatus label="Supabase URL" value={overview?.supabaseEnv.hasSupabaseUrl} />
            <ToolStatus label="Supabase anon key" value={overview?.supabaseEnv.hasSupabaseAnonKey} />
            <ToolStatus label="Supabase service role key" value={overview?.supabaseEnv.hasSupabaseServiceRoleKey} />
          </div>
          <div className="mt-5 rounded-lg bg-surface p-4 text-sm leading-6 text-subtle">
            <p>
              localStorage 学习记录保存在用户本地浏览器，管理员暂不能查看用户学习进度。
            </p>
            <p className="mt-2">Data Backup 已支持导出 / 导入 JSON。</p>
          </div>
          <Link
            href="/settings/data"
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-muted px-4 text-sm font-semibold text-ink hover:bg-line/60"
          >
            查看数据备份说明
          </Link>
        </div>
      </section>
    </div>
  );
}

const defaultDisabledQuestionTypes = [
  { label: "汉译英", status: "未开放" },
  { label: "形近词", status: "未开放" },
  { label: "意近词", status: "未开放" },
  { label: "熟词僻义", status: "未开放" },
];

function HeaderPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel/80 p-3">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 truncate font-semibold text-ink">{value}</p>
    </div>
  );
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon size={20} />
        </span>
        <div>
          <p className="text-sm text-subtle">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-subtle">{hint}</p>
    </div>
  );
}

function UserCard({
  user,
  acting,
  onUpdateRole,
  onDelete,
}: {
  user: AdminUserRow;
  acting: boolean;
  onUpdateRole: (user: AdminUserRow, role: AdminRole) => void;
  onDelete: (user: AdminUserRow) => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.username || "暂无用户名"}</p>
          <p className="mt-1 truncate text-sm text-subtle">{user.email || "暂无邮箱"}</p>
        </div>
        <RoleBadge role={user.role} />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-subtle">
        <p>注册：{formatDate(user.created_at)}</p>
        <p>最近登录：{formatDate(user.last_sign_in_at)}</p>
      </div>
      <div className="mt-3">
        <UserActions user={user} acting={acting} onUpdateRole={onUpdateRole} onDelete={onDelete} />
      </div>
    </div>
  );
}

function UserActions({
  user,
  acting,
  onUpdateRole,
  onDelete,
}: {
  user: AdminUserRow;
  acting: boolean;
  onUpdateRole: (user: AdminUserRow, role: AdminRole) => void;
  onDelete: (user: AdminUserRow) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {user.role === "admin" ? (
        <Button
          variant="secondary"
          disabled={acting || user.isCurrentAdmin}
          onClick={() => onUpdateRole(user, "user")}
          title={user.isCurrentAdmin ? "不能取消自己的管理员身份" : undefined}
        >
          <UserCog size={15} />
          取消管理员
        </Button>
      ) : (
        <Button variant="secondary" disabled={acting} onClick={() => onUpdateRole(user, "admin")}>
          <Shield size={15} />
          设为管理员
        </Button>
      )}
      <Button
        variant="danger"
        disabled={acting || user.isCurrentAdmin}
        onClick={() => onDelete(user)}
        title={user.isCurrentAdmin ? "不能删除当前登录账号" : undefined}
      >
        <Trash2 size={15} />
        删除用户
      </Button>
    </div>
  );
}

function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <span
      className={
        role === "admin"
          ? "inline-flex rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand"
          : "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-subtle"
      }
    >
      {role}
    </span>
  );
}

function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="text-xs text-subtle">{label}</p>
      <p className={`mt-1 ${strong ? "font-bold text-positive" : "font-semibold text-ink"}`}>{value}</p>
    </div>
  );
}

function ToolStatus({ label, value }: { label: string; value?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface p-3 text-sm">
      <span className="inline-flex items-center gap-2 text-subtle">
        <KeyRound size={15} />
        {label}
      </span>
      <span className={value ? "font-semibold text-positive" : "font-semibold text-danger"}>{value ? "是" : "否"}</span>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "暂无";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "暂无";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
