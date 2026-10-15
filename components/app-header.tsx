import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Specly — halaman utama">
          <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
            <rect width="24" height="24" rx="5" fill="#2563eb" />
            <path
              d="M15.5 8.2c-.6-1-1.9-1.6-3.5-1.6-2 0-3.5 1-3.5 2.6 0 3.4 7 2 7 5 0 1.7-1.5 2.8-3.7 2.8-1.8 0-3.2-.7-3.8-1.9"
              stroke="#ffffff"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <span className="font-heading text-lg font-bold tracking-tight">Specly</span>
        </Link>
        <span className="text-sm text-muted-foreground">PRD Builder untuk AI Coding</span>
      </div>
    </header>
  );
}
