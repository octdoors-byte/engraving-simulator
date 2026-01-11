type ToastProps = {
  message: string;
  tone?: "info" | "success" | "error";
};

const toneClass = {
  info: "border-slate-200 bg-white text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800"
};

export function Toast({ message, tone = "info" }: ToastProps) {
  return (
    <div className={`rounded-xl border px-4 py-2 text-sm shadow ${toneClass[tone]}`}>
      {message}
    </div>
  );
}
