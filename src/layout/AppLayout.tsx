import { Link, NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "シミュレーター" },
  { to: "/admin/templates", label: "テンプレート管理" },
  { to: "/admin/designs", label: "刻印履歴" }
];

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link to="/" className="text-2xl font-semibold text-slate-900">
              名入れ刻印シミュレーター
            </Link>
            <p className="text-sm text-slate-500">ローカルで完結するMVP</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
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
          <p>仕様書 v1.1 に準拠</p>
          <p>ブラウザの localStorage / IndexedDB を活用</p>
        </div>
      </footer>
    </div>
  );
}
