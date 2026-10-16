import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getAiConfig, listProjects } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ProjectList } from "@/components/project-list";

// Reads the local SQLite DB; blocking render keeps the list fresh on every visit.
export const instant = false;

export default async function Home() {
  const user = await requireUser();
  const projects = listProjects(user.id);
  const aiReady = Boolean(getAiConfig(user.id).api_key);

  return (
    <main className="animate-fade-up mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <header className="mb-10">
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-semibold tracking-wide text-primary uppercase">
          Specly
        </p>
        <h1 className="font-heading text-4xl font-bold sm:text-5xl">
          Bikin PRD tanpa perlu jago IT
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Jawab pertanyaan sederhana, AI membantu merapikan. Hasilnya dokumen lengkap siap
          diberikan ke AI coding agent mana pun.
        </p>
      </header>
      <ProjectList initialProjects={projects} aiReady={aiReady} />
      <p className="mt-12 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
        <span className="rounded-full border border-border bg-card px-3 py-1.5 font-medium text-foreground">
          1. Tentukan brand
        </span>
        <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        <span className="rounded-full border border-border bg-card px-3 py-1.5 font-medium text-foreground">
          2. Rancang desain
        </span>
        <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        <span className="rounded-full border border-border bg-card px-3 py-1.5 font-medium text-foreground">
          3. Tulis kebutuhan
        </span>
        <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        <Link href="/#brand" className="rounded-full bg-primary/10 px-3 py-1.5 font-medium text-primary underline-offset-4 transition-colors hover:bg-primary/20 hover:underline">
          Unduh hasilnya sebagai Markdown
        </Link>
      </p>
    </main>
  );
}
