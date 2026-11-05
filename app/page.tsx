import { Bot, Check, ChevronRight, FileText, MessagesSquare, Package, Sparkles } from "lucide-react";
import { getAiConfig, listProjects } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ProjectList } from "@/components/project-list";

// Reads the local SQLite DB; blocking render keeps the list fresh on every visit.
export const instant = false;

const FEATURES = [
  {
    icon: MessagesSquare,
    title: "Ngobrol biasa",
    body: "Jawab pertanyaan AI dengan bahasa sehari-hari. Tidak ada istilah teknis yang harus kamu pahami.",
  },
  {
    icon: Package,
    title: "Satu PRD lengkap",
    body: "12 bagian PRD tersusun rapi — dari masalah, fitur, sampai kriteria keberhasilan siap eksekusi.",
  },
  {
    icon: FileText,
    title: "Siap untuk AI coding",
    body: "Unduh sebagai Markdown + AGENTS.md. Claude Code, Cursor, dan Copilot langsung paham.",
  },
];

export default async function Home() {
  const user = await requireUser();
  const projects = listProjects(user.id);
  const aiReady = Boolean(getAiConfig(user.id).api_key);

  return (
    <main className="animate-fade-up mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      {/* Hero: pitch on the left, product sketch on the right */}
      <section className="mb-14 grid items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-semibold tracking-wide text-primary uppercase">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Specly
          </p>
          <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
            Bikin PRD tanpa perlu jago IT
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Jawab pertanyaan sederhana, AI membantu merapikan. Hasilnya dokumen lengkap siap
            diberikan ke AI coding agent mana pun.
          </p>
          <p className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            {["Ceritakan ide", "Jawab pertanyaan", "Dapat PRD"].map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                <span className="rounded-full border border-border bg-card px-3 py-1.5 font-medium">
                  {i + 1}. {step}
                </span>
              </span>
            ))}
          </p>
        </div>

        {/* Pure-CSS product preview: the real output — a finished PRD doc plus
            the two files agents care about. Real text reads better than skeletons. */}
        <div aria-hidden="true" className="relative hidden pb-8 pl-6 lg:block">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-destructive/50" />
              <span className="size-2.5 rounded-full bg-amber-400" />
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <span className="ml-2 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Kasir Warung — PRD.md
              </span>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <p className="font-heading text-sm font-bold">## Functional Requirements</p>
                <div className="mt-2.5 space-y-2">
                  {[
                    ["FR-1", "Kasir dapat membuat pesanan baru", "Terisi"],
                    ["FR-2", "Stok otomatis berkurang saat checkout", "Terisi"],
                    ["FR-3", "Notifikasi saat stok habis", "Menunggu"],
                  ].map(([id, text, status]) => (
                    <div key={id} className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2">
                      <span
                        className={`inline-flex size-4 items-center justify-center rounded-full ${
                          status === "Terisi" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Check className="size-3" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">{id}</span>
                      <span className="text-xs text-foreground">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <div className="max-w-[85%] rounded-lg rounded-bl-sm bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
                  <Bot className="mr-1 inline size-3.5 text-primary" aria-hidden="true" />
                  Stok habis di tengah checkout gimana?
                </div>
                <div className="ml-auto mt-2 max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3 py-2 text-xs text-primary-foreground">
                  Notifikasi + tetap simpan keranjang
                </div>
              </div>
            </div>
          </div>

          {/* Floating export artifacts — what you hand to the coding agent */}
          <div className="absolute -top-4 right-2 flex rotate-3 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
            <FileText className="size-3.5 text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold">AGENTS.md</span>
            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
              dibaca agent
            </span>
          </div>
        </div>
      </section>

      <ProjectList initialProjects={projects} aiReady={aiReady} />

      {/* Why Specly */}
      <section className="mt-16">
        <h2 className="font-heading text-center text-2xl font-bold">Kenapa lewat Specly?</h2>
        <div className="stagger mt-6 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="size-5 text-primary" aria-hidden="true" />
              </div>
              <h3 className="font-heading font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
