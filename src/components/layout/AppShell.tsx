"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ClipboardList, Home, LogOut, RotateCcw, Search, Settings, Shield, User } from "lucide-react";
import { useAppState } from "@/components/providers/AppStateProvider";
import { cn, levelFromXp } from "@/lib/utils";
import { Onboarding } from "./Onboarding";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/practice", label: "Practice", icon: ClipboardList },
  { href: "/exam", label: "Exam", icon: Shield },
  { href: "/review", label: "Review", icon: BookOpen },
  { href: "/mistakes", label: "Mistakes", icon: RotateCcw },
  { href: "/settings", label: "Settings", icon: Settings },
];

const bottomNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/practice", label: "Practice", icon: ClipboardList },
  { href: "/review", label: "Review", icon: BookOpen },
  { href: "/mistakes", label: "Mistakes", icon: RotateCcw },
  { href: "/profile", label: "Profile", icon: User },
];

const authPaths = ["/login", "/register"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, user, settings, logout, tempList } = useAppState();
  const [accountOpen, setAccountOpen] = useState(false);
  const [tempToastOpen, setTempToastOpen] = useState(false);
  const previousTempCountRef = useRef<number | null>(null);
  const isAuthPath = authPaths.includes(pathname);

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      const theme =
        settings.theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : settings.theme;
      root.dataset.theme = theme;
      root.dataset.fontSize = settings.fontSize;
    };
    applyTheme();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [settings.fontSize, settings.theme]);

  useEffect(() => {
    if (!ready) return;
    if (!user && !isAuthPath) {
      router.replace("/login");
    }
    if (user && isAuthPath) {
      router.replace("/");
    }
  }, [isAuthPath, ready, router, user]);

  const title = useMemo(() => pageTitle(pathname), [pathname]);
  const level = user ? levelFromXp(user.xp) : null;
  const showTempToast = tempToastOpen && tempList.length > 0 && !pathname.startsWith("/temp-list") && !pathname.startsWith("/exam") && !isAuthPath;

  useEffect(() => {
    const previous = previousTempCountRef.current;
    previousTempCountRef.current = tempList.length;
    if (tempList.length === 0) {
      setTempToastOpen(false);
      return undefined;
    }
    if (previous !== null && tempList.length > previous) {
      setTempToastOpen(true);
      const timer = window.setTimeout(() => setTempToastOpen(false), 4200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [tempList.length]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-subtle">
        正在准备 WordSprint...
      </div>
    );
  }

  if (isAuthPath) {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  if (!user.firstLoginDone) {
    return <Onboarding />;
  }

  return (
    <div className="min-h-screen bg-surface text-ink md:grid md:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-panel/86 px-4 py-5 md:block">
        <Link href="/" className="block rounded-lg px-3 py-2">
          <p className="text-xl font-bold">WordSprint</p>
          <p className="mt-1 text-xs text-subtle">Learn it fast. Make it last.</p>
        </Link>
        <nav className="mt-8 space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.href} item={item} active={isActivePath(pathname, item.href)} />
          ))}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-line bg-muted/60 p-4">
          <p className="text-xs text-subtle">当前等级</p>
          <p className="mt-1 font-semibold">{level?.name}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((level?.progress ?? 0) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-subtle">{user.xp} XP</p>
        </div>
      </aside>

      <div className="min-w-0 pb-24 md:pb-0">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/92 px-4 py-3 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-brand">WordSprint</p>
              <h1 className="truncate text-xl font-bold md:text-2xl">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/search"
                className="focus-ring flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold text-subtle hover:bg-muted md:px-3"
                aria-label="Search"
              >
                <Search size={18} />
                <span className="hidden md:inline">Search</span>
              </Link>
              <Link href="/profile" className="focus-ring flex h-11 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 md:hidden" aria-label="Profile">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
                <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-subtle">{level?.name}</span>
              </Link>
              <div className="relative hidden md:block">
                <button
                  className="focus-ring flex h-11 items-center gap-2 rounded-lg border border-line bg-panel px-2.5"
                  onClick={() => setAccountOpen((open) => !open)}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                    {user.username.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-sm font-semibold">{user.username}</span>
                </button>
                {accountOpen ? (
                  <div className="absolute right-0 mt-2 w-52 rounded-lg border border-line bg-panel p-2 shadow-soft">
                    <MenuLink href="/profile" icon={User} label="Profile" onClick={() => setAccountOpen(false)} />
                    <MenuLink href="/settings" icon={Settings} label="Settings" onClick={() => setAccountOpen(false)} />
                    {user.isAdmin ? <MenuLink href="/admin" icon={Shield} label="Admin" onClick={() => setAccountOpen(false)} /> : null}
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-danger hover:bg-muted"
                      onClick={() => {
                        setAccountOpen(false);
                        logout();
                      }}
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-8">{children}</main>
      </div>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-panel/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {bottomNavItems.map((item) => (
            <MobileNavItem key={item.href} item={item} active={isActivePath(pathname, item.href)} />
          ))}
        </div>
      </nav>

      {showTempToast ? (
        <div className="fixed bottom-24 left-4 right-4 z-40 md:left-auto md:right-8 md:w-80">
          <div className="relative rounded-lg border border-line bg-panel p-3 pr-10 shadow-soft">
            <button
              className="focus-ring absolute right-2 top-2 rounded-full px-2 py-1 text-sm font-bold text-subtle hover:bg-muted"
              type="button"
              aria-label="收起临时测试提示"
              onClick={() => setTempToastOpen(false)}
            >
              ×
            </button>
            <p className="font-bold text-ink">已加入临时测试</p>
            <p className="mt-1 text-sm text-subtle">当前 {tempList.length} 个词</p>
            <div className="mt-3 flex gap-2">
              <Link href="/temp-list" className="focus-ring flex-1 rounded-lg bg-ink px-3 py-2 text-center text-sm font-semibold text-panel" onClick={() => setTempToastOpen(false)}>
                开始测试
              </Link>
              <Link href="/temp-list" className="focus-ring flex-1 rounded-lg bg-muted px-3 py-2 text-center text-sm font-semibold text-ink" onClick={() => setTempToastOpen(false)}>
                查看列表
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavItem({
  item,
  active,
}: {
  item: (typeof navItems)[number];
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
        active ? "bg-brand text-white" : "text-subtle hover:bg-muted hover:text-ink",
      )}
    >
      <item.icon size={19} />
      {item.label}
    </Link>
  );
}

function MobileNavItem({ item, active }: { item: (typeof bottomNavItems)[number]; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold",
        active ? "bg-brand text-white" : "text-subtle",
      )}
    >
      <item.icon size={19} />
      <span>{item.label}</span>
    </Link>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: typeof User;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted">
      <Icon size={16} />
      {label}
    </Link>
  );
}

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function pageTitle(pathname: string) {
  if (pathname.startsWith("/practice")) return "Practice";
  if (pathname.startsWith("/exam")) return "Exam";
  if (pathname.startsWith("/review")) return "Review";
  if (pathname.startsWith("/mistakes")) return "Mistakes";
  if (pathname.startsWith("/settings/stats")) return "Stats / 学习统计";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/profile")) return "我的";
  if (pathname.startsWith("/admin")) return "Admin";
  if (pathname.startsWith("/words")) return "Word Detail";
  if (pathname.startsWith("/search")) return "Search";
  if (pathname.startsWith("/temp-list")) return "临时测试列表";
  return "Home";
}
