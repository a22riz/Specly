"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, CircleHelp, Download, FileText, Loader2, Save, Send, Shapes, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AiTyping } from "@/components/ai-typing";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { saveSectionAction } from "@/app/actions";
import type { Project } from "@/lib/db";
import { LOGO_KEY, PACK_ORDER, PACKS, type PackId } from "@/lib/prompts";

/** Total fillable sections across all packs — keeps the progress copy honest. */
const TOTAL_SECTIONS = PACK_ORDER.reduce((n, id) => n + PACKS[id].sections.length, 0);
import { LogoCard } from "@/components/logo-card";

type ChatMessage = { role: "user" | "assistant"; content: string };

const EMPTY_SECTION = "_Belum diisi._";

export function Editor({
  project,
  initialSections,
  aiReady,
}: {
  project: Project;
  initialSections: Record<string, string>;
  aiReady: boolean;
}) {
  const [sections, setSections] = useState<Record<string, string>>(initialSections);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [activePack, setActivePack] = useState<PackId>("prd");
  const [activeKey, setActiveKey] = useState(PACKS.prd.sections[0].key);
  const [logoTab, setLogoTab] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateIdea, setGenerateIdea] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<Record<string, "pending" | "generating" | "done" | "skip" | "error">>({});
  const abortRef = useRef<AbortController | null>(null);

  const pack = PACKS[activePack];
  const section = pack.sections.find((s) => s.key === activeKey) ?? pack.sections[0];
  const draft = sections[activeKey] ?? "";

  const packProgress = useMemo(() => {
    const filled = pack.sections.filter((s) => (sections[s.key] ?? "").trim()).length;
    return Math.round((filled / pack.sections.length) * 100);
  }, [pack, sections]);

  const totalSections = Object.values(PACKS).reduce((n, p) => n + p.sections.length, 0);

  const totalFilled = useMemo(
    () =>
      Object.entries(sections).filter(
        ([key, c]) => key !== LOGO_KEY && c.trim() && c.trim() !== EMPTY_SECTION,
      ).length,
    [sections],
  );
  const allFilled = totalFilled === totalSections;

  const packCounts = useMemo(() => {
    const counts = {} as Record<PackId, string>;
    for (const id of PACK_ORDER) {
      const p = PACKS[id];
      const filled = p.sections.filter((s) => (sections[s.key] ?? "").trim()).length;
      counts[id] = `${filled}/${p.sections.length}`;
    }
    return counts;
  }, [sections]);

  function updateDraft(value: string) {
    setSections((s) => ({ ...s, [activeKey]: value }));
    setDirtyKeys((d) => new Set(d).add(activeKey));
  }

  async function persist(key = activeKey, content = sections[activeKey] ?? "") {
    setSaving(true);
    try {
      await saveSectionAction(project.id, key, content);
      setDirtyKeys((d) => {
        const n = new Set(d);
        n.delete(key);
        return n;
      });
    } catch {
      toast.error("Gagal menyimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  /** Switch section/pack, saving any pending edit first. */
  function selectSection(packId: PackId, key: string) {
    if (dirtyKeys.has(activeKey)) void persist();
    setActivePack(packId);
    setActiveKey(PACKS[packId].sections.some((s) => s.key === key) ? key : PACKS[packId].sections[0].key);
    setChat([]);
  }

  async function runAi(mode: "suggest" | "refine", messages: ChatMessage[]) {
    if (!aiReady) {
      toast.error("AI belum diatur. Buka Pengaturan AI di halaman utama terlebih dulu.");
      return;
    }
    setStreaming(true);
    setShowChat(true);
    setChat([...messages, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          pack: activePack,
          sectionKey: activeKey,
          mode,
          draft,
          messages,
        }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Gagal menghubungi AI");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setChat((c) => {
          const n = [...c];
          n[n.length - 1] = { role: "assistant", content: full };
          return n;
        });
        // Page-level follow: the chat area grows with content now, so we scroll the page.
        requestAnimationFrame(() => scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
      }
      const match = full.match(/<content>([\s\S]*?)<\/content>/);
      if (match?.[1]?.trim()) {
        // Models sometimes wrap the body in a markdown fence — strip it.
        const body = match[1].trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
        updateDraft(body);
        toast.success("Draft diperbarui dari AI — silakan sunting bila perlu.");
      } else if (mode === "refine") {
        toast.info("AI belum menulis draft. Coba kirim pesan lanjutan atau minta langsung: \"tulis draft-nya\".");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghubungi AI");
      setChat((c) => c.filter((m) => m.content !== ""));
    } finally {
      setStreaming(false);
    }
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || streaming) return;
    setChatInput("");
    await runAi("suggest", [...chat, { role: "user", content: text }]);
  }

  async function runGenerate() {
    if (!generateIdea.trim() || generating) return;
    setGenerating(true);
    const allSections = PACK_ORDER.flatMap((p) => PACKS[p].sections);
    const progress: Record<string, "pending" | "generating" | "done" | "skip" | "error"> = {};
    for (const s of allSections) progress[s.key] = "pending";
    setGenerateProgress(progress);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, idea: generateIdea.trim() }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error("Gagal memulai generasi");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (let i = 0; i < lines.length; i += 2) {
          const eventLine = lines[i];
          const dataLine = lines[i + 1];
          if (!eventLine?.startsWith("event: ") || !dataLine?.startsWith("data: ")) continue;
          const evt = eventLine.slice(7).trim();
          const data = JSON.parse(dataLine.slice(6));
          if (evt === "section_start") setGenerateProgress((p) => ({ ...p, [data.key]: "generating" }));
          else if (evt === "section_done") setGenerateProgress((p) => ({ ...p, [data.key]: "done" }));
          else if (evt === "section_skip") setGenerateProgress((p) => ({ ...p, [data.key]: "skip" }));
          else if (evt === "error") setGenerateProgress((p) => (data.section ? { ...p, [data.section]: "error" } : p));
          else if (evt === "done") {
            toast.success(`Generasi selesai: ${data.generated} dibuat, ${data.skipped} dilewati.`);
          }
        }
      }
      // Refresh sections from server
      window.location.reload();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.info("Generasi dibatalkan.");
      } else {
        toast.error(err instanceof Error ? err.message : "Gagal menghubungi AI");
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  return (
    <main className="animate-fade-up mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>
            <ArrowLeft data-icon="inline-start" />
            Semua proyek
          </Button>
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger
                render={
                  <Button variant="outline" size="sm" aria-label="Cara pakai hasil unduhan" />
                }
              >
                <CircleHelp data-icon="inline-start" />
                Cara pakai hasilnya
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-heading">Cara pakai hasil unduhan</DialogTitle>
                  <DialogDescription>
                    Panduan singkat menyerahkan dokumen ini ke AI coding agent. Panduan lengkap
                    ikut di dalam ZIP sebagai CARA_PAKAI.md.
                  </DialogDescription>
                </DialogHeader>
                <ol className="list-decimal space-y-2.5 pl-5 text-sm text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">Unduh & extract</span> — taruh
                    semua file di folder utama proyekmu.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Buka AI coding agent</span> di
                    folder itu (Claude Code, Cursor, dll) — mereka otomatis membaca AGENTS.md.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Minta satu fitur dulu</span>,
                    bukan semuanya sekaligus — selesai, cek, lanjut berikutnya.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Meleset? Tunjuk dokumen</span> —
                    sesuai FR-3, contohnya di bagian Contoh Penggunaan.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Kebutuhan berubah?</span> Ubah
                    di Specly, unduh ulang, beri tahu agent.
                  </li>
                </ol>
                <DialogFooter>
                  <DialogClose render={<Button variant="cta" />}>Mengerti</DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
              <DialogTrigger render={<Button variant="cta" size="sm" aria-label="Generate blueprint dengan AI" />}>
                <Sparkles data-icon="inline-start" />
                Generate Blueprint
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-heading">Generate Blueprint dengan AI</DialogTitle>
                  <DialogDescription>
                    Tuliskan ide aplikasimu. AI akan mengisi semua bagian kosong secara berurutan —
                    bagian yang sudah kamu isi tidak akan ditimpa.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  value={generateIdea}
                  onChange={(e) => setGenerateIdea(e.target.value)}
                  placeholder="Contoh: Aplikasi manajemen tugas untuk tim kecil, dengan board Kanban, assignee, dan deadline..."
                  className="min-h-32"
                  aria-label="Ide aplikasi"
                  disabled={generating}
                />
                {generating && (
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-3 text-sm">
                    {PACK_ORDER.flatMap((p) => PACKS[p].sections).map((s) => (
                      <div key={s.key} className="flex items-center justify-between gap-2">
                        <span className="truncate text-muted-foreground">{s.title}</span>
                        <Badge
                          variant={
                            generateProgress[s.key] === "done"
                              ? "default"
                              : generateProgress[s.key] === "generating"
                                ? "secondary"
                                : generateProgress[s.key] === "error"
                                  ? "destructive"
                                  : "outline"
                          }
                          className="shrink-0 text-xs"
                        >
                          {generateProgress[s.key] === "done"
                            ? "✓"
                            : generateProgress[s.key] === "generating"
                              ? "..."
                              : generateProgress[s.key] === "error"
                                ? "!"
                                : generateProgress[s.key] === "skip"
                                  ? "–"
                                  : "○"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                <DialogFooter>
                  {generating ? (
                    <Button variant="outline" onClick={() => abortRef.current?.abort()}>
                      Batal
                    </Button>
                  ) : (
                    <DialogClose
                      render={<Button variant="cta" onClick={() => void runGenerate()} disabled={!generateIdea.trim()} />}
                    >
                      Generate
                    </DialogClose>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/export?project=${project.id}`} />}>
              <Download data-icon="inline-start" />
              Unduh semua (ZIP)
            </Button>
          </div>
        </div>
        <h1 className="font-heading text-3xl font-bold">{project.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalFilled} dari {TOTAL_SECTIONS} bagian terisi. Urutan yang disarankan: PRD → Brand → Design.
        </p>
        <Tabs
          value={logoTab ? "logo" : activePack}
          onValueChange={(v) => {
            if (v === "logo") {
              setLogoTab(true);
            } else {
              setLogoTab(false);
              selectSection(v as PackId, PACKS[v as PackId].sections[0].key);
            }
          }}
          className="mt-4"
        >
          <TabsList>
            {PACK_ORDER.map((packId) => (
              <TabsTrigger key={packId} value={packId}>
                {PACKS[packId].name}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {packCounts[packId]}
                </span>
              </TabsTrigger>
            ))}
            {/* Logo lives outside the authoring flow — own tab, no progress count. */}
            <TabsTrigger value="logo">
              <Shapes className="size-3.5" aria-hidden="true" />
              Logo
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className={logoTab ? "grid gap-6" : "grid gap-6 lg:grid-cols-[300px_1fr]"}>
        {/* Sidebar: section list for the active pack */}
        {!logoTab && (
        <aside className="stagger space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-base">{pack.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{pack.description}</p>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              <Progress value={packProgress} className="mb-3" aria-label={`Progres ${pack.name}: ${packProgress}%`} />
              {pack.sections.map((s) => {
                const filled = Boolean((sections[s.key] ?? "").trim());
                const dirty = dirtyKeys.has(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => selectSection(activePack, s.key)}
                    aria-current={s.key === activeKey ? "true" : undefined}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      s.key === activeKey ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span>{s.title}</span>
                    <Badge variant={dirty ? "default" : filled ? "secondary" : "outline"} className="shrink-0">
                      {dirty ? "Berubah" : filled ? "Terisi" : "Kosong"}
                    </Badge>
                  </button>
                );
              })}
            </CardContent>
          </Card>
          <Card className={allFilled ? "border-primary/60" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-base">
                {allFilled ? "Semua bagian terisi" : `Progres total: ${totalFilled}/${totalSections}`}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {allFilled
                  ? "Dokumen siap diberikan ke AI coding agent."
                  : `Lengkapi ${totalSections - totalFilled} bagian lagi, atau unduh sekarang bila sudah cukup.`}
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="cta" className="w-full" nativeButton={false} render={<a href={`/api/export?project=${project.id}`} />}>
                <Download data-icon="inline-start" />
                {allFilled ? "Selesai — Unduh Dokumen" : "Unduh Dokumen"}
              </Button>
            </CardContent>
          </Card>
          {/* Per-file downloads duplicate the ZIP buttons on small screens. */}
          <Card className="hidden lg:block">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-base">Unduh dokumen</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 pt-0">
              <a
                href={`/api/export?project=${project.id}&file=onboarding`}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <FileText className="size-4 text-primary" />
                AGENTS.md (untuk coding agent)
              </a>
              {PACK_ORDER.map((packId) => (
                <a
                  key={packId}
                  href={`/api/export?project=${project.id}&file=${packId}`}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <FileText className="size-4 text-primary" />
                  {PACKS[packId].file}
                </a>
              ))}
            </CardContent>
          </Card>
        </aside>
        )}

        {/* Main: logo studio when on the Logo tab, otherwise section editor + AI chat */}
        <section className="space-y-4">
          {logoTab ? (
            <LogoCard
              projectId={project.id}
              svg={sections[LOGO_KEY] ?? ""}
              onSaved={(svg) => setSections((s) => ({ ...s, [LOGO_KEY]: svg }))}
            />
          ) : (
          <>
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">{section.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{section.hint}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={draft}
                onChange={(e) => updateDraft(e.target.value)}
                placeholder={section.hint}
                className="min-h-56 font-mono text-sm"
                aria-label={`Isi bagian ${section.title}`}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="cta" onClick={() => void persist()} disabled={saving || !dirtyKeys.has(activeKey)}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save data-icon="inline-start" />}
                  {saving ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void runAi("refine", chat)}
                  disabled={streaming || !draft.trim()}
                >
                  <Wand2 data-icon="inline-start" />
                  Rapikan dengan AI
                </Button>
                {dirtyKeys.has(activeKey) && (
                  <span className="text-xs text-muted-foreground">Ada perubahan belum disimpan.</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {aiReady
                  ? "AI membantu bertanya dan menyusun draf. Kamu tetap pegang kendali penuh atas isinya."
                  : "AI belum aktif — isi manual, lalu unduh. Atur AI lewat halaman utama."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <Sparkles className="size-5 text-primary" />
                Ngobrol dengan AI
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Jawab pertanyaan AI dengan bahasa sehari-hari. Draf bagian ini terbentuk dari
                percakapanmu.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {showChat && (
                <div
                  ref={scrollRef}
                  className="space-y-3 rounded-lg border border-border p-3"
                  aria-live="polite"
                >
                  {chat.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5 py-4 text-center">
                      <Bot className="size-6 text-primary" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">
                        Mulai dengan menekan <em>Mulai Eksplorasi</em>, atau jawab sendiri di bawah.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        AI akan bertanya satu per satu — jawab pakai bahasa sehari-hari saja.
                      </p>
                    </div>
                  ) : (
                    chat.map((m, i) => (
                      <div
                        key={i}
                        className={`animate-pop-in max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                          m.role === "user"
                            ? "ml-auto bg-primary text-primary-foreground"
                            : "bg-card text-card-foreground"
                        }`}
                      >
                        {m.content ? (
                          <>
                            {m.content}
                            {streaming && i === chat.length - 1 && m.role === "assistant" && (
                              <span
                                className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary"
                                aria-hidden="true"
                              />
                            )}
                          </>
                        ) : (
                          <AiTyping />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendChat();
                    }
                  }}
                  placeholder="Tulis jawaban atau pertanyaanmu... (Enter = kirim, Shift+Enter = baris baru)"
                  disabled={streaming}
                  aria-label="Pesan untuk AI"
                  className="min-h-20"
                  rows={2}
                />
                <Button
                  variant="cta"
                  onClick={() => void sendChat()}
                  disabled={streaming || !chatInput.trim()}
                  className="shrink-0"
                >
                  {streaming ? <Loader2 className="animate-spin" /> : <Send />}
                  <span className="sr-only">Kirim pesan</span>
                </Button>
              </div>
              {chat.length === 0 && (
                <Button variant="outline" onClick={() => void runAi("suggest", [])} disabled={streaming}>
                  <Bot data-icon="inline-start" />
                  Mulai Eksplorasi
                </Button>
              )}
              {chat.length > 0 && !streaming && (
                <Button variant="cta" onClick={() => void runAi("suggest", [...chat, { role: "user", content: "Sudah cukup materinya. Tulis final draft bagian ini sekarang di blok <content>." }])}>
                  <FileText data-icon="inline-start" />
                  Tulis Draft-nya Sekarang
                </Button>
              )}
            </CardContent>
          </Card>
          </>
          )}

          <Separator />
          <p className="text-sm text-muted-foreground">
            Semua dokumen diunduh sebagai Markdown — format yang dipahami AI coding agent mana pun.
          </p>
        </section>
      </div>
    </main>
  );
}
