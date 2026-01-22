import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import type { CommonSettings } from "@/domain/types";
import { ensureAppVersion, loadCommonSettings } from "@/storage/local";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

const navItems = [
  { to: "/top", label: "公開テンプレート一覧", tone: "emerald" },
  { to: "/admin/templates", label: "テンプレート管理", tone: "amber" },
  { to: "/admin/designs", label: "デザイン作成履歴", tone: "indigo" },
  { to: "/admin/common", label: "基本設定", tone: "rose" },
  { to: "/categories", label: "カテゴリ別管理", tone: "sky" }
] as const;

const navToneClass: Record<
  typeof navItems[number]["tone"],
  { active: string; inactive: string }
> = {
  emerald: {
    active: "bg-emerald-600 text-white shadow-sm",
    inactive: "border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50"
  },
  amber: {
    active: "bg-amber-500 text-white shadow-sm",
    inactive: "border border-amber-200 text-amber-700 bg-white hover:bg-amber-50"
  },
  indigo: {
    active: "bg-indigo-600 text-white shadow-sm",
    inactive: "border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50"
  },
  rose: {
    active: "bg-rose-500 text-white shadow-sm",
    inactive: "border border-rose-200 text-rose-700 bg-white hover:bg-rose-50"
  },
  sky: {
    active: "bg-sky-500 text-white shadow-sm",
    inactive: "border border-sky-200 text-sky-700 bg-white hover:bg-sky-50"
  }
};

function sizeClass(size?: "sm" | "md" | "lg") {
  if (size === "lg") return "text-base";
  if (size === "md") return "text-sm";
  return "text-xs";
}

const alignClass: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right"
};

const alignItemsClass: Record<"left" | "center" | "right", string> = {
  left: "items-start",
  center: "items-center",
  right: "items-end"
};

export function AppLayout() {
  const [settings, setSettings] = useState<CommonSettings | null>(null);
  const location = useLocation();

  useEffect(() => {
    ensureAppVersion();
    setSettings(loadCommonSettings());
    const handler = () => setSettings(loadCommonSettings());
    window.addEventListener("ksim:commonSettingsUpdated", handler as EventListener);
    return () => window.removeEventListener("ksim:commonSettingsUpdated", handler as EventListener);
  }, []);

  const logoAlign = alignClass[settings?.logoAlign ?? "left"];
  const headerAlign = alignClass[settings?.headerTextAlign ?? "left"];
  const footerAlign = alignClass[settings?.footerTextAlign ?? "center"];
  const footerItemsAlign = alignItemsClass[settings?.footerTextAlign ?? "center"];
  const logoHeight = settings?.logoSize === "lg" ? "h-16 md:h-20" : settings?.logoSize === "md" ? "h-12" : "h-9";
  const hideNav =
    new URLSearchParams(location.search).get("hideNav") === "1" ||
    location.pathname.startsWith("/sim/");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className={`flex items-center gap-3 ${logoAlign}`}>
            {settings?.logoImage && (
              <img src={settings.logoImage} alt="ロゴ" className={`${logoHeight} w-auto`} />
            )}
            <div>
              <Link to="/top" className="text-2xl font-semibold text-slate-900">
                {settings?.landingTitle?.trim() || "デザインシミュレーター"}
              </Link>
              <p className={`text-slate-500 ${sizeClass(settings?.headerTextSize)} ${headerAlign}`}>
                {settings?.headerText ?? ""}
              </p>
            </div>
          </div>
          {!hideNav && (
            <nav className="flex flex-wrap items-center gap-2 text-sm">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/top"}
                  className={({ isActive }) =>
                    [
                      "rounded-full px-3 py-1 transition border",
                      isActive ? navToneClass[item.tone].active : navToneClass[item.tone].inactive
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <ErrorBoundary
          title="表示中にエラーが発生しました。"
          description="自動で再読み込みを試みます。"
          autoReload
          reloadDelayMs={2000}
        >
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="border-t bg-white">
        <div
          className={`mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-slate-500 ${footerItemsAlign}`}
        >
          {settings?.footerText && (
            <p className={`${footerAlign} ${sizeClass(settings?.footerTextSize)}`}>{settings.footerText}</p>
          )}
        </div>
      </footer>
    </div>
  );
}
