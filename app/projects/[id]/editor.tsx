"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, CircleHelp, Download, FileText, Loader2, Save, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DecisionPanel } from "@/components/decision-panel";
import { saveSectionAction } from "@/app/actions";
import type { Message, Project } from "@/lib/db";
import type { Plan } from "@/lib/plan";
import { PRD_SECTIONS } from "@/lib/prompts";
import { extractContent, shouldAutoRun } from "@/lib/prd";
import { parseSSERecords } from "@/lib/sse";

type ChatMessage = { role: "user" | "assistant"; content: string };
type SectionStatus = "pending" | "generating" | "done" | "error";

export function Editor({
  project,
  initialSections,
  initialMessages,
  aiReady,
  plan,
}: {
  project: Project;
  initialSections: Record<string, string>;
  initialMessages: Message[];
  aiReady: boolean;
  plan: Plan | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.map((m) => ({ role: m.role, content: m.content })),
  );
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [sections, setSections] = useState<Record<string, string>>(initialSections);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<Record<string, SectionStatus>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const prdAbortRef = useRef<AbortController | null>(null);

  const [refineInputs, setRefineInputs] = useState<Record<string, string>>({});
  const [refiningKey, setRefiningKey] = useState<string | null>(null);
  const [refineLive, setRefineLive] = useState("");

  const hasContent = PRD_SECTIONS.some((s) => (sections[s.key] ?? "").trim());
  const doneCount = PRD_SECTIONS.filter((s) => progress[s.key] === "done").length;

  const startedRef = useRef(false);
  // Auto-draft once on first visit to an empty project. The ref guard prevents a
  // second run on remount (StrictMode) or after the AI already wrote sections.
  useEffect(() => {
    if (shouldAutoRun(hasContent, aiReady, startedRef.current)) {
      startedRef.current = true;
      void runPrd(false);
    }
    // Intentionally mount-only: runPrd/hasContent are read at first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollToEnd() {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || streaming) return;
    if (!aiReady) {
      toast.error("AI belum diatur. Buka Pengaturan AI di halaman utama terlebih dulu.");
      return;
    }
    setChatInput("");
    setMessages((c) => [
      ...c,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setStreaming(true);
    scrollToEnd();

    const ac = new AbortController();
    chatAbortRef.current = ac;
    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, message: text }),
        signal: ac.signal,
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
        setMessages((c) => {
          const n = [...c];
          n[n.length - 1] = { role: "assistant", content: full };
          return n;
        });
        scrollToEnd();
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.info("Dihentikan.");
      } else {
        toast.error(err instanceof Error ? err.message : "Gagal menghubungi AI");
      }
      // Drop the empty assistant placeholder so no blank bubble lingers.
      setMessages((c) =>
        c[c.length - 1]?.role === "assistant" && !c[c.length - 1].content ? c.slice(0, -1) : c,
      );
    } finally {
      setStreaming(false);
      chatAbortRef.current = null;
    }
  }

  function startPrd() {
    if (!aiReady) {
      toast.error("AI belum diatur. Buka Pengaturan AI di halaman utama terlebih dulu.");
      return;
    }
    if (hasContent) setConfirmOpen(true);
    else void runPrd(false);
  }

  async function runPrd(force: boolean) {
    if (!aiReady) {
      toast.error("AI belum diatur. Buka Pengaturan AI di halaman utama terlebih dulu.");
      return;
    }
    setConfirmOpen(false);
    setGenerating(true);
    setProgress(Object.fromEntries(PRD_SECTIONS.map((s) => [s.key, "pending" as SectionStatus])));

    const ac = new AbortController();
    prdAbortRef.current = ac;
    let completed = false;
    let failed = false;
    let written = 0;
    try {
      const res = await fetch("/api/prd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, force }),
        signal: ac.signal,
      });
      if (res.status === 409) {
        // Server already has PRD content (e.g. legacy rows or an aborted run that
        // persisted sections). Surface the overwrite confirm instead of a bare error.
        setConfirmOpen(true);
        toast.info("PRD sudah ada — konfirmasi untuk menimpanya.");
        return;
      }
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Gagal membuat PRD");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = parseSSERecords(buffer);
        buffer = remainder;
        for (const { event: evt, data: raw } of events) {
          const data = JSON.parse(raw) as { key?: string; written?: number; message?: string };
          const key = data.key;
          if (evt === "section_start" && key) {
            setProgress((p) => ({ ...p, [key]: "generating" }));
          } else if (evt === "section_done" && key) {
            setProgress((p) => ({ ...p, [key]: "done" }));
          } else if (evt === "error") {
            // Section errors map onto their card; the plan-phase error (key
            // "plan") has no card — surface it as a toast, not a phantom entry.
            if (key && PRD_SECTIONS.some((s) => s.key === key)) {
              setProgress((p) => ({ ...p, [key]: "error" }));
            } else {
              failed = true;
              toast.error(data.message ?? "Gagal membuat PRD");
            }
          } else if (evt === "done") {
            written = data.written ?? 0;
          }
        }
      }
      completed = true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.info("Pembuatan PRD dibatalkan.");
      } else {
        toast.error(err instanceof Error ? err.message : "Gagal membuat PRD");
      }
    } finally {
      setGenerating(false);
      prdAbortRef.current = null;
    }

    if (completed) {
      if (failed) {
        // The failure was already surfaced as a toast; skip the success line.
      } else if (written > 0) {
        toast.success(`PRD selesai: ${written} bagian dibuat.`);
      } else {
        toast.info("Tidak ada bagian baru yang dibuat.");
      }
      // Reload only after a real write. A failed or zero-write run leaves
      // hasContent false, so reloading would re-trigger auto-run into a loop.
      if (!failed && written > 0) {
        // Server has persisted every section; reload to hydrate from the DB.
        window.location.reload();
      }
    }
  }

  function updateSection(key: string, value: string) {
    setSections((s) => ({ ...s, [key]: value }));
    setDirtyKeys((d) => new Set(d).add(key));
  }

  function toggleSection(key: string) {
    setOpenKeys((k) => {
      const n = new Set(k);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  async function persistSection(key: string) {
    setSavingKey(key);
    try {
      await saveSectionAction(project.id, key, sections[key] ?? "");
      setDirtyKeys((d) => {
        const n = new Set(d);
        n.delete(key);
        return n;
      });
      toast.success("Bagian disimpan.");
    } catch {
      toast.error("Gagal menyimpan. Coba lagi.");
    } finally {
      setSavingKey(null);
    }
  }

  async function refineSection(key: string) {
    const instruction = (refineInputs[key] ?? "").trim();
    if (!instruction || refiningKey) return;
    if (!aiReady) {
      toast.error("AI belum diatur. Buka Pengaturan AI di halaman utama terlebih dulu.");
      return;
    }
    setRefiningKey(key);
    setRefineLive("");
    const ac = new AbortController();
    let buf = "";
    let settled = false;
    try {
      const res = await fetch("/api/prd/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, key, instruction }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Gagal meminta perubahan");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = parseSSERecords(buffer);
        buffer = remainder;
        for (const { event: evt, data: raw } of events) {
          const data = JSON.parse(raw) as { key?: string; text?: string; message?: string };
          if (evt === "chunk") {
            buf += data.text ?? "";
            setRefineLive(buf);
          } else if (evt === "section_done" && data.key === key) {
            settled = true;
          } else if (evt === "error") {
            throw new Error(data.message ?? "Gagal meminta perubahan");
          }
        }
      }
      if (settled) {
        // The server persisted the section; hydrate it from the streamed body.
        const content = extractContent(buf);
        if (content) setSections((s) => ({ ...s, [key]: content }));
        setDirtyKeys((d) => {
          const n = new Set(d);
          n.delete(key);
          return n;
        });
        setRefineInputs((r) => ({ ...r, [key]: "" }));
        toast.success("Bagian diperbarui oleh AI.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.info("Dihentikan.");
      } else {
        toast.error(err instanceof Error ? err.message : "Gagal meminta perubahan");
      }
    } finally {
      setRefiningKey(null);
      setRefineLive("");
    }
  }

  const cleanRefineLive = refineLive
    .replace(/<\/?content>/g, "")
    .replace(/^```[a-z]*\n?/i, "")
    .trim();

  return (
    <main className="animate-fade-up mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>
            <ArrowLeft data-icon="inline-start" />
            Semua proyek
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" size="sm" aria-label="Cara pakai hasil unduhan" />}>
                <CircleHelp data-icon="inline-start" />
                Cara pakai hasilnya
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-heading">Cara pakai hasil unduhan</DialogTitle>
                  <DialogDescription>
                    Panduan singkat menyerahkan PRD ini ke AI coding agent. Panduan lengkap ikut di
                    dalam ZIP sebagai CARA_PAKAI.md.
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
                    contohnya di bagian Skenario Penerimaan dan Kriteria Keberhasilan.
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
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={`/api/export?project=${project.id}`} />}
            >
              <Download data-icon="inline-start" />
              Unduh PRD (ZIP)
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={`/api/export?project=${project.id}&file=onboarding`} />}
            >
              <FileText data-icon="inline-start" />
              AGENTS.md
            </Button>
          </div>
        </div>
        <h1 className="font-heading text-3xl font-bold">{project.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ceritakan idemu lewat obrolan — PRD dibuat otomatis. Sesuaikan keputusan lalu tekan{" "}
          <em>Buat ulang</em> bila perlu; hasilnya bisa kamu sunting di bawah sebelum diunduh.
        </p>
      </header>

      <div className="grid gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-heading text-lg">
              <Bot className="size-5 text-primary" />
              Obrolan dengan AI
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Jawab pertanyaan AI dengan bahasa sehari-hari. Semakin lengkap ceritamu, semakin
              lengkap PRD-nya.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              ref={scrollRef}
              className="max-h-[50vh] min-h-40 space-y-3 overflow-y-auto rounded-lg border border-border p-3"
              aria-live="polite"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-4 text-center">
                  <Bot className="size-6 text-primary" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    Mulai dengan menceritakan aplikasi yang ingin kamu buat di bawah.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    AI akan bertanya satu per satu — jawab pakai bahasa sehari-hari saja.
                  </p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={i}
                    className={`animate-pop-in max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.content ? (
                      <>
                        {m.content}
                        {streaming && i === messages.length - 1 && m.role === "assistant" && (
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

            <div className="flex flex-wrap items-center gap-2">
              {streaming && (
                <Button variant="outline" onClick={() => chatAbortRef.current?.abort()}>
                  <X data-icon="inline-start" />
                  Hentikan
                </Button>
              )}
              <Button variant="cta" onClick={startPrd} disabled={generating || streaming}>
                {generating ? <Loader2 className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
                {generating ? "Membuat PRD..." : hasContent ? "Buat ulang" : "Buat PRD"}
              </Button>
              {generating && (
                <Button variant="outline" onClick={() => prdAbortRef.current?.abort()}>
                  Batal
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {aiReady
                  ? "Kamu tetap pegang kendali penuh atas isi PRD."
                  : "AI belum aktif — atur lewat halaman utama."}
              </span>
            </div>

            {generating && (
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                      Membuat PRD…
                    </span>
                    <span className="tabular-nums text-muted-foreground" aria-live="polite">
                      {doneCount}/{PRD_SECTIONS.length} bagian
                    </span>
                  </div>
                  <Progress
                    value={(doneCount / PRD_SECTIONS.length) * 100}
                    aria-label="Progres pembuatan PRD"
                  />
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-3 text-sm">
                  {PRD_SECTIONS.map((s) => {
                    const status = progress[s.key];
                    return (
                      <div
                        key={s.key}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-md px-2 py-1 transition-colors",
                          status === "generating" && "bg-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "truncate",
                            status === "generating"
                              ? "font-medium text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {s.title}
                        </span>
                        <Badge
                          variant={
                            status === "done"
                              ? "default"
                              : status === "generating"
                                ? "secondary"
                                : status === "error"
                                  ? "destructive"
                                  : "outline"
                          }
                          className="shrink-0 text-xs"
                        >
                          {status === "done" ? (
                            "✓"
                          ) : status === "generating" ? (
                            <Loader2 className="size-3 animate-spin" aria-label="Sedang dibuat" />
                          ) : status === "error" ? (
                            "!"
                          ) : (
                            "○"
                          )}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <DecisionPanel projectId={project.id} plan={plan} />

        <section className="space-y-4">
          <div>
            <h2 className="font-heading text-xl font-bold">Pratinjau PRD</h2>
            <p className="text-sm text-muted-foreground">
              12 bagian PRD. Sunting langsung bila perlu, lalu simpan.
            </p>
          </div>
          {PRD_SECTIONS.map((s) => {
            const value = sections[s.key] ?? "";
            const filled = value.trim().length > 0;
            const open = openKeys.has(s.key);
            const preview = value.trim().split("\n").find((l) => l.trim()) ?? "";
            return (
              <Card key={s.key}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="font-heading text-base">{s.title}</CardTitle>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {open || !filled ? s.hint : preview}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={filled ? "secondary" : "outline"} className="text-xs">
                        {filled ? "Terisi" : "Perlu keputusan"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSection(s.key)}
                        aria-expanded={open}
                      >
                        {open ? "Tutup" : "Sunting"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {open && (
                  <CardContent className="space-y-2">
                    <Textarea
                      value={value}
                      onChange={(e) => updateSection(s.key, e.target.value)}
                      placeholder={s.hint}
                      className="min-h-40 font-mono text-sm"
                      aria-label={`Isi bagian ${s.title}`}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="cta"
                        size="sm"
                        onClick={() => void persistSection(s.key)}
                        disabled={savingKey === s.key || !dirtyKeys.has(s.key)}
                      >
                        {savingKey === s.key ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Save data-icon="inline-start" />
                        )}
                        {savingKey === s.key ? "Menyimpan..." : "Simpan"}
                      </Button>
                      {dirtyKeys.has(s.key) && (
                        <span className="text-xs text-muted-foreground">Ada perubahan belum disimpan.</span>
                      )}
                    </div>
                    <div className="flex items-end gap-2 pt-1">
                      <Input
                        value={refineInputs[s.key] ?? ""}
                        onChange={(e) =>
                          setRefineInputs((r) => ({ ...r, [s.key]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void refineSection(s.key);
                          }
                        }}
                        placeholder="Minta ubah lewat AI... (mis. buat lebih ringkas)"
                        disabled={refiningKey === s.key}
                        aria-label={`Instruksi AI untuk bagian ${s.title}`}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void refineSection(s.key)}
                        disabled={
                          refiningKey === s.key || !(refineInputs[s.key] ?? "").trim()
                        }
                        className="shrink-0"
                      >
                        {refiningKey === s.key ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Sparkles data-icon="inline-start" />
                        )}
                        Minta ubah
                      </Button>
                    </div>
                    {refiningKey === s.key && cleanRefineLive && (
                      <pre className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 text-xs whitespace-pre-wrap text-muted-foreground">
                        {cleanRefineLive}
                      </pre>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </section>

        <p className="text-sm text-muted-foreground">
          Semua dokumen diunduh sebagai Markdown — format yang dipahami AI coding agent mana pun.
        </p>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Timpa PRD yang ada?</DialogTitle>
            <DialogDescription>
              Proyek ini sudah punya isi PRD. Membuat ulang akan menimpa semua 12 bagian dengan
              hasil AI terbaru dari percakapanmu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button variant="cta" onClick={() => void runPrd(true)}>
              Ya, buat ulang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
