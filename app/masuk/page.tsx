import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { getSessionUser } from "@/lib/auth";

export const instant = false;

const POINTS = [
  "Ngobrol biasa, AI yang menyusun dokumen",
  "PRD lengkap dari obrolan biasa",
  "Hasil siap dipakai AI coding agent",
];

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
        <rect width="24" height="24" rx="6" className="fill-white" />
        <path
          d="M15.5 8.2c-.6-1-1.9-1.6-3.5-1.6-2 0-3.5 1-3.5 2.6 0 3.4 7 2 7 5 0 1.7-1.5 2.8-3.7 2.8-1.8 0-3.2-.7-3.8-1.9"
          className="stroke-primary"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span className="font-heading text-xl font-bold tracking-tight">Specly</span>
    </span>
  );
}

export default async function MasukPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <main className="animate-fade-up mx-auto grid w-full max-w-4xl flex-1 items-stretch gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2">
      {/* Brand panel — fills the left half on desktop */}
      <section
        aria-hidden="true"
        className="hidden flex-col justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary p-8 text-white lg:flex"
      >
        <div>
          <BrandMark />
          <h1 className="mt-10 font-heading text-3xl font-bold leading-snug">
            Selamat datang kembali.
          </h1>
          <p className="mt-3 text-white/80">
            Lanjutkan dari tempat kamu berhenti — atau mulai dokumen untuk ide berikutnya.
          </p>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-white/90">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-col justify-center">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
              <rect width="24" height="24" rx="6" fill="#2563eb" />
              <path
                d="M15.5 8.2c-.6-1-1.9-1.6-3.5-1.6-2 0-3.5 1-3.5 2.6 0 3.4 7 2 7 5 0 1.7-1.5 2.8-3.7 2.8-1.8 0-3.2-.7-3.8-1.9"
                stroke="#ffffff"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <span className="font-heading text-lg font-bold tracking-tight">Specly</span>
          </div>
          <h2 className="font-heading text-xl font-bold">Masuk ke Specly</h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Lanjutkan menyusun dokumen proyekmu.
          </p>
          <AuthForm mode="masuk" />
        </div>
      </section>
    </main>
  );
}
