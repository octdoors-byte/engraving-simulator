import { Link, useRouteError } from "react-router-dom";

export function PageNotFound() {
  const error = useRouteError() as Error | null;
  const message = error?.message ? String(error.message) : null;

  return (
    <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow">
      <h1 className="text-3xl font-semibold text-slate-900">ページが見つかりません</h1>
      <p className="mt-2 text-slate-500">
        指定されたページは存在しないか、まだ公開されていない可能性があります。
      </p>
      <Link to="/top" className="mt-6 inline-flex rounded-full bg-slate-900 px-6 py-2 text-sm font-medium text-white">
        トップへ戻る
      </Link>
    </div>
  );
}
