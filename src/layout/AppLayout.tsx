import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import type { CommonSettings } from "@/domain/types";
import { ensureAppVersion, loadCommonSettings } from "@/storage/local";

const navItems = [
  { to: "/top", label: "トップ" },
  { to: "/admin/templates", label: "テンプレート管理" },
  { to: "/admin/designs", label: "デザイン発行履歴" }
];

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

export function AppLayout() {
  const [settings, setSettings] = useState<CommonSettings | null>(null);

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
  const logoHeight = settings?.logoSize === "lg" ? "h-12" : settings?.logoSize === "md" ? "h-10" : "h-8";

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
                デザインシミュレーター
              </Link>
              <p className={`text-slate-500 ${sizeClass(settings?.headerTextSize)} ${headerAlign}`}>
                {settings?.headerText ?? ""}
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/top"}
                className={({ isActive }) =>
                  [
                    "rounded-full px-3 py-1 transition",
                    isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-4 text-xs text-slate-500">
          {settings?.footerText && (
            <p className={`${footerAlign} ${sizeClass(settings?.footerTextSize)}`}>{settings.footerText}</p>
          )}
        </div>
      </footer>
    </div>
  );
}
