import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import type { CommonSettings } from "@/domain/types";
import { ensureAppVersion, loadCommonSettings } from "@/storage/local";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

const adminMenuItems = [
  { to: "/admin/common", label: "基本設定", tone: "rose" as const },
  { to: "/categories", label: "カテゴリ一覧", tone: "sky" as const },
  { to: "/admin/templates", label: "テンプレート管理", tone: "amber" as const },
  { to: "/top", label: "公開テンプレート一覧", tone: "emerald" as const }
] as const;

const allNavItems = [
  { to: "/admin/designs", label: "デザイン発行履歴", tone: "indigo" as const, isAdmin: true, isHighlighted: true }
] as const;

const navToneClass: Record<
  typeof allNavItems[number]["tone"],
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
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    ensureAppVersion();
    setSettings(loadCommonSettings());
    const handler = () => setSettings(loadCommonSettings());
    window.addEventListener("ksim:commonSettingsUpdated", handler as EventListener);
    return () => window.removeEventListener("ksim:commonSettingsUpdated", handler as EventListener);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setIsAdminMenuOpen(false);
      }
    };
    if (isAdminMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAdminMenuOpen]);

  const logoAlign = alignClass[settings?.logoAlign ?? "left"];
  const headerAlign = alignClass[settings?.headerTextAlign ?? "left"];
  const footerAlign = alignClass[settings?.footerTextAlign ?? "center"];
  const footerItemsAlign = alignItemsClass[settings?.footerTextAlign ?? "center"];
  const logoSizeClass = settings?.logoSize === "lg" 
    ? "h-16 md:h-20 max-h-20" 
    : settings?.logoSize === "md" 
    ? "h-12 max-h-12" 
    : "h-9 max-h-9";
  const hideNav =
    new URLSearchParams(location.search).get("hideNav") === "1" ||
    location.pathname.startsWith("/sim/");
  
  // かわうそレザーのHPからアクセスする場合（/simulator/）は管理画面のリンクを非表示
  // ただし、開発環境（localhost）では常に表示
  const basePath = import.meta.env.BASE_URL || "/";
  const isProduction = import.meta.env.PROD;
  const isSimulatorPath = basePath === "/simulator/" && isProduction;
  const navItems = isSimulatorPath
    ? allNavItems.filter((item) => !item.isAdmin)
    : allNavItems;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b-2 border-slate-200 bg-white shadow-lg">
        <div className="mx-auto flex max-w-[95%] flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div className={`flex items-center gap-4 ${logoAlign}`}>
            {settings?.logoImage && (
              <div className="rounded-xl border-2 border-slate-200 bg-white p-2 shadow-md">
                <img 
                  src={settings.logoImage} 
                  alt="ロゴ" 
                  className={`${logoSizeClass} w-auto object-contain`}
                  style={{ maxWidth: "none" }}
                />
              </div>
            )}
            <div>
              <Link to="/top" className="text-3xl font-bold text-slate-900 hover:text-slate-700 transition-colors">
                {settings?.landingTitle?.trim() || "デザインシミュレーター"}
              </Link>
              <p className={`text-slate-600 ${sizeClass(settings?.headerTextSize)} ${headerAlign} mt-1 font-medium`}>
                {settings?.headerText ?? ""}
              </p>
            </div>
          </div>
          {!hideNav && (
            <nav className="flex flex-wrap items-center gap-3 text-sm">
              {/* 発行履歴 */}
              {navItems.map((item) => {
                const isHighlighted = "isHighlighted" in item && item.isHighlighted;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/top"}
                    className={({ isActive }) =>
                      [
                        "rounded-xl px-4 py-2.5 font-bold shadow-sm transition-all duration-200 border-2",
                        isHighlighted ? "text-base md:text-lg" : "",
                        isActive 
                          ? `${navToneClass[item.tone].active} scale-105 shadow-md ${isHighlighted ? "ring-4 ring-indigo-300 ring-offset-2" : ""}` 
                          : `${navToneClass[item.tone].inactive} hover:scale-105 hover:shadow-md ${isHighlighted ? "ring-2 ring-indigo-200" : ""}`
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
                );
              })}
              {/* 管理画面ドロップダウン（一番右） */}
              {!isSimulatorPath && (
                <div ref={adminMenuRef} className="relative ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                    className={`rounded-xl p-3 font-bold shadow-sm transition-all duration-200 border-2 ${
                      adminMenuItems.some(item => location.pathname === item.to || 
                        (item.to === "/top" && location.pathname === "/"))
                        ? "bg-slate-700 text-white scale-105 shadow-md"
                        : "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 hover:scale-105 hover:shadow-md"
                    }`}
                    title="管理画面"
                    aria-label="管理画面"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-6 w-6" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                      style={{ transform: isAdminMenuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  {isAdminMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-56 rounded-xl border-2 border-slate-200 bg-white shadow-lg z-50">
                      <div className="py-2">
                        {adminMenuItems.map((item) => {
                          const isActive = location.pathname === item.to || (item.to === "/top" && location.pathname === "/");
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              end={item.to === "/top"}
                              onClick={() => setIsAdminMenuOpen(false)}
                              className={({ isActive: navIsActive }) =>
                                [
                                  "block px-4 py-2.5 text-sm font-semibold transition-colors",
                                  navIsActive || isActive
                                    ? `${navToneClass[item.tone].active}`
                                    : `${navToneClass[item.tone].inactive} hover:bg-slate-50`
                                ].join(" ")
                              }
                            >
                              {item.label}
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </nav>
          )}
        </div>
      </header>
              <main className="mx-auto max-w-[95%] px-4 py-8">
        <ErrorBoundary
          title="表示中にエラーが発生しました。"
          description="自動で再読み込みを試みます。"
          autoReload
          reloadDelayMs={2000}
        >
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="border-t-2 border-slate-200 bg-white shadow-lg">
        <div
          className={`mx-auto flex max-w-[95%] flex-col gap-2 px-6 py-5 text-xs text-slate-600 ${footerItemsAlign}`}
        >
          {settings?.footerText && (
            <p className={`${footerAlign} ${sizeClass(settings?.footerTextSize)} font-semibold`}>{settings.footerText}</p>
          )}
        </div>
      </footer>
    </div>
  );
}
