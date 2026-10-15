import Link from "next/link";
import { getAiConfig, listProjects } from "@/lib/db";
import { ProjectList } from "@/components/project-list";

// Reads the local SQLite DB; blocking render keeps the list fresh on every visit.
export const instant = false;

export default async function Home() {
  const projects = listProjects();
  const aiReady = Boolean(getAiConfig().api_key);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <header className="mb-10">
        <p className="mb-2 text-sm font-semibold tracking-wide text-primary uppercase">
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
      <p className="mt-12 text-center text-sm text-muted-foreground">
        Cukup tiga langkah:{" "}
        <Link href="/#brand" className="text-primary underline-offset-4 hover:underline">
          tentukan brand
        </Link>{" "}
        → rancang desain → tulis kebutuhan. Unduh hasilnya sebagai file Markdown.
      </p>
    </main>
  );
}
