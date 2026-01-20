type HelpIconProps = {
  guideUrl: string;
  title?: string;
  variant?: "icon" | "button";
};

export function HelpIcon({ guideUrl, title = "操作ガイドを開く", variant = "icon" }: HelpIconProps) {
  if (variant === "button") {
    return (
      <a
        href={guideUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
        title={title}
        aria-label={title}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>使い方ガイド</span>
      </a>
    );
  }

  return (
    <a
      href={guideUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 rounded-full border-2 border-blue-400 bg-blue-50 px-2.5 py-1 text-blue-700 transition hover:border-blue-500 hover:bg-blue-100"
      title={title}
      aria-label={title}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 font-bold"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="text-xs font-semibold">詳細</span>
    </a>
  );
}
