"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Check, CircleHelp, Download, FileText, Loader2, Save, Search, Send, Sparkles } from "lucide-react";
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
import { finishDiscoveryAction, saveSectionAction } from "@/app/actions";
import type { Message, Project } from "@/lib/db";
import type { Plan } from "@/lib/plan";
import { PRD_SECTIONS } from "@/lib/prompts";
import { extractContent, shouldAutoRun } from "@/lib/prd";
import { DISCOVERY_MAX, parseDiscoveryTurn } from "@/lib/discovery";
import { estimateRemainingMs } from "@/lib/estimate";
import { parseSSERecords } from "@/lib/sse";

type ChatMessage = { role: "user" | "assistant"; content: string };
type SectionStatus = "pending" | "generating" | "done" | "error";

/** One applied fix from POST /api/prd/review; `before` is the exact prior text. */
type ReviewApplied = {
  key: string;
  issue: string;
  rule: string;
  before: string;
  after: string;
  removed?: string;
};

/** The review route's response, typed directly — no casts. */
type ReviewSummary = {
  applied: ReviewApplied[];
  escalated: number;
  notes: { section: string; weight: string; issue: string }[];
  decisions: Plan["decisions"];
  usage: { input: number; output: number };
};

/** Drop a leading "(rekomendasi)" the model may prefix on the first option. */
function optionLabel(option: string) {
  return option.replace(/^\(\s*rekomendasi\s*\)\s*/i, "").trim();
}

export function Editor({
  project,
  initialSections,
  initialMessages,
  aiReady,
  plan,
  discoveryDone,
}: {
  project: Project;
  initialSections: Record<string, string>;
  initialMessages: Message[];
  aiReady: boolean;
  plan: Plan | null;
  discoveryDone: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.map((m) => ({ role: m.role, content: m.content })),
  );
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [localDiscoveryDone, setLocalDiscoveryDone] = useState(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const finishingRef = useRef(false);

  const [sections, setSections] = useState<Record<string, string>>(initialSections);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<Record<string, SectionStatus>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const prdAbortRef = useRef<AbortController | null>(null);
  const [draftStartedAt, setDraftStartedAt] = useState<number | null>(null);

  const [refineInputs, setRefineInputs] = useState<Record<string, string>>({});
  const [refiningKey, setRefiningKey] = useState<string | null>(null);
  const [refineLive, setRefineLive] = useState("");

  // Local copy of the plan so a review's escalations reach DecisionPanel without a reload.
  const [planState, setPlanState] = useState<Plan | null>(plan);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<ReviewSummary | null>(null);

  const hasContent = PRD_SECTIONS.some((s) => (sections[s.key] ?? "").trim());
  const doneCount = PRD_SECTIONS.filter((s) => progress[s.key] === "done").length;
  // Rough ETA: null until the first section lands (no rate to project from yet).
  const remainingMs = estimateRemainingMs(
    doneCount,
    PRD_SECTIONS.length,
    draftStartedAt === null ? 0 : Date.now() - draftStartedAt,
  );

  // Discovery: each assistant turn is one JSON object; the last one is the current question.
  const assistantTurns = messages.filter((m) => m.role === "assistant").length;
  const firstAssistant = messages.findIndex((m) => m.role === "assistant");
  // Questions already answered (the initial idea description is not one). +1 = the one on screen.
  const askedCount =
    firstAssistant === -1
      ? 0
      : messages.slice(firstAssistant).filter((m) => m.role === "user").length;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const discoveryTurn =
    lastAssistant && !streaming ? parseDiscoveryTurn(lastAssistant.content) : null;
  const discoveryComplete = discoveryDone || localDiscoveryDone || hasContent;
  // Without AI there is nothing to ask, so skip the card and show the manual editor.
  const showDiscovery = !discoveryComplete && aiReady;

  const startedRef = useRef(false);
  const discoveryStartedRef = useRef(false);
  // Auto-draft once on first visit to a discovery-done project with nothing written.
  // The ref guard prevents a second run on remount (StrictMode) or after a write.
  useEffect(() => {
    if (shouldAutoRun(hasContent, aiReady, startedRef.current, discoveryDone)) {
      startedRef.current = true;
      void runPrd(false);
    }
    if (
      !discoveryDone &&
      !hasContent &&
      aiReady &&
      !messages.some((m) => m.role === "assistant") &&
      !discoveryStartedRef.current
    ) {
      discoveryStartedRef.current = true;
      void streamDiscovery();
    }
    // Intentionally mount-only: runPrd/streamDiscovery read first-render state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // End discovery as soon as the AI says it is done or the question cap is reached.
  useEffect(() => {
    if (discoveryComplete || streaming || !aiReady) return;
    // Cap fires one turn after the 8th question, so the user actually answers
    // all DISCOVERY_MAX questions before hand-off.
    if (discoveryTurn?.done || assistantTurns > DISCOVERY_MAX) void finishDiscovery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryTurn?.done, assistantTurns, streaming, discoveryComplete, aiReady]);

  // Stream one discovery turn. With `text` the user answer is persisted first and
  // the next question streams back; without it (mount) question 1 is fetched.
  async function streamDiscovery(text?: string) {
    if (streaming || finishingRef.current) return;
    if (!aiReady) {
      toast.error("AI belum diatur. Buka Pengaturan AI di halaman utama terlebih dulu.");
      return;
    }
    setChatInput("");
    setMessages((c) => [
      ...c,
      ...(text ? [{ role: "user" as const, content: text }] : []),
      { role: "assistant" as const, content: "" },
    ]);
    setStreaming(true);

    const ac = new AbortController();
    chatAbortRef.current = ac;
    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          text ? { projectId: project.id, message: text } : { projectId: project.id },
        ),
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
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Aborted by "Cukup, lanjut" — that path runs the draft, so stay quiet.
        if (!finishingRef.current) toast.info("Dihentikan.");
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

  function sendAnswer(text: string) {
    const t = text.trim();
    if (!t || streaming || finishingRef.current) return;
    void streamDiscovery(t);
  }

  // Hand off to the draft: mark discovery done, then run the plan → parallel draft.
  async function finishDiscovery() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    chatAbortRef.current?.abort();
    try {
      await finishDiscoveryAction(project.id);
    } catch {
      toast.error("Gagal mengakhiri diskusi. Coba lagi.");
      finishingRef.current = false;
      setFinishing(false);
      return;
    }
    setLocalDiscoveryDone(true);
    void runPrd(false);
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
    setDraftStartedAt(Date.now());
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
        const j = (await res.json().catch(() => ({}))) as { reason?: string };
        if (j.reason === "discovery") {
          // Discussion not finished yet — the guard in the route blocked the draft.
          toast.info("Selesaikan diskusi dulu");
          return;
        }
        // Content already exists (legacy rows or an aborted run that persisted
        // sections). Surface the overwrite confirm instead of a bare error.
        setConfirmOpen(true);
        toast.info("PRD sudah ada. Konfirmasi untuk menimpanya.");
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

  // Review the whole PRD once: the route persists the fixes and merges escalations
  // into the plan. The response carries each fix's exact `before` for undo.
  async function reviewPrd() {
    if (reviewing) return;
    setReviewing(true);
    try {
      const res = await fetch("/api/prd/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const j = (await res.json().catch(() => ({}))) as ReviewSummary & { error?: string };
      if (!res.ok || !j.applied) throw new Error(j.error ?? "Gagal meninjau PRD");
      setSections((s) => {
        const next = { ...s };
        for (const f of j.applied) next[f.key] = f.after;
        return next;
      });
      setPlanState((p) => (p ? { ...p, decisions: j.decisions } : p));
      setReview(j);
      toast.success(`${j.applied.length} dirapikan · ${j.escalated} perlu keputusanmu`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal meninjau PRD");
    } finally {
      setReviewing(false);
    }
  }

  async function undoReview() {
    if (!review || review.applied.length === 0) return;
    // Reverse only the review's own change: a section the user edited or refined
    // after the review no longer holds `after`, so leave it exactly as it is.
    const revertible = review.applied.filter((f) => (sections[f.key] ?? "") === f.after);
    const kept = review.applied.length - revertible.length;
    if (revertible.length === 0) {
      setReview(null);
      toast.info("Tidak ada yang dikembalikan — bagian yang ditinjau sudah kamu ubah.");
      return;
    }
    try {
      for (const f of revertible) await saveSectionAction(project.id, f.key, f.before);
      setSections((s) => {
        const next = { ...s };
        for (const f of revertible) next[f.key] = f.before;
        return next;
      });
      setReview(null);
      toast.success(
        kept
          ? `Perbaikan dibatalkan. ${kept} bagian dibiarkan karena sudah kamu ubah.`
          : "Perbaikan dibatalkan.",
      );
    } catch {
      toast.error("Gagal membatalkan perbaikan.");
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
              Unduh semua (ZIP)
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={`/api/export?project=${project.id}&file=prd`} />}
            >
              <FileText data-icon="inline-start" />
              Unduh PRD (MD)
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={`/api/export?project=${project.id}&file=onboarding`} />}
            >
              <FileText data-icon="inline-start" />
              Unduh AGENTS.md (MD)
            </Button>
          </div>
        </div>
        <h1 className="font-heading text-3xl font-bold">{project.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ceritakan idemu, jawab beberapa pertanyaan singkat, lalu PRD disusun otomatis. Tinjau
          keputusan dan isinya di bawah, buat ulang atau sunting bila perlu, lalu unduh.
        </p>
      </header>

      <div className="grid gap-6">
        {showDiscovery ? (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <Bot className="size-5 text-primary" aria-hidden="true" />
                Kenalan dulu, yuk
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                AI mengajukan beberapa pertanyaan singkat dengan saran bawaan. Jawab seadanya atau
                ambil sarannya; kamu bisa berhenti kapan saja.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  Pertanyaan {Math.min(askedCount + 1, DISCOVERY_MAX)} · maks {DISCOVERY_MAX}
                </span>
                <Progress
                  value={(Math.min(askedCount + 1, DISCOVERY_MAX) / DISCOVERY_MAX) * 100}
                  className="h-1.5"
                  aria-label="Progres diskusi"
                />
              </div>

              <div className="min-h-16 space-y-3" aria-live="polite">
                {discoveryTurn?.say && (
                  <p className="text-sm whitespace-pre-wrap">{discoveryTurn.say}</p>
                )}
                {discoveryTurn?.question ? (
                  <div className="space-y-2">
                    <p className="font-medium">{discoveryTurn.question.text}</p>
                    <div
                      className="flex flex-wrap gap-2"
                      role="group"
                      aria-label={discoveryTurn.question.text}
                    >
                      {discoveryTurn.question.options.map((opt, i) => (
                        <Button
                          key={`${i}-${opt}`}
                          type="button"
                          size="sm"
                          variant={i === 0 ? "default" : "outline"}
                          disabled={streaming || finishing}
                          onClick={() => sendAnswer(optionLabel(opt))}
                        >
                          {i === 0 && <Check data-icon="inline-start" />}
                          {optionLabel(opt)}
                          {i === 0 && (
                            <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[0.65rem] font-medium">
                              Rekomendasi
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  streaming && <AiTyping />
                )}
              </div>

              <div className="flex items-end gap-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendAnswer(chatInput);
                    }
                  }}
                  placeholder="Tulis jawabanmu... (Enter = kirim, Shift+Enter = baris baru)"
                  disabled={streaming || finishing}
                  aria-label="Jawaban untuk AI"
                  className="min-h-20"
                  rows={2}
                />
                <Button
                  variant="cta"
                  onClick={() => sendAnswer(chatInput)}
                  disabled={streaming || finishing || !chatInput.trim()}
                  className="shrink-0"
                >
                  {streaming ? <Loader2 className="animate-spin" /> : <Send />}
                  <span className="sr-only">Kirim jawaban</span>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void finishDiscovery()}
                  disabled={finishing}
                >
                  {finishing && <Loader2 className="animate-spin" />}
                  Cukup, lanjut
                </Button>
                <span className="text-xs text-muted-foreground">
                  Lewati sisa pertanyaan dan susun PRD sekarang.
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <Sparkles className="size-5 text-primary" aria-hidden="true" />
                PRD
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {aiReady
                  ? "Kamu pegang kendali penuh atas isi PRD. Sesuaikan keputusan di bawah, lalu buat ulang bila perlu."
                  : "AI belum aktif. Atur lewat halaman utama untuk menyusun PRD otomatis."}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="cta" onClick={startPrd} disabled={generating || streaming}>
                  {generating ? <Loader2 className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
                  {generating ? "Membuat PRD..." : hasContent ? "Buat ulang" : "Buat PRD"}
                </Button>
                {generating && (
                  <Button variant="outline" onClick={() => prdAbortRef.current?.abort()}>
                    Batal
                  </Button>
                )}
                {hasContent && !generating && (
                  <Button
                    variant="outline"
                    onClick={() => void reviewPrd()}
                    disabled={reviewing}
                  >
                    {reviewing ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Search data-icon="inline-start" />
                    )}
                    {reviewing ? "Meninjau PRD…" : "Tinjau PRD"}
                  </Button>
                )}
              </div>

              {review && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm">
                      <span className="font-medium">
                        {review.applied.length} dirapikan
                      </span>{" "}
                      · {review.escalated} perlu keputusanmu · {review.notes.length} catatan
                    </p>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      ~{review.usage.input + review.usage.output} token
                    </span>
                  </div>

                  {review.applied.map((f) => (
                    <details key={f.key} className="rounded-md border border-border px-3 py-2">
                      <summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
                        {f.issue}
                      </summary>
                      <div className="space-y-2 pt-2">
                        {f.rule && (
                          <p className="text-xs text-muted-foreground">{f.rule}</p>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Sebelum</p>
                            <pre className="max-h-40 overflow-y-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
                              {f.before}
                            </pre>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Sesudah</p>
                            <pre className="max-h-40 overflow-y-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
                              {f.after}
                            </pre>
                          </div>
                        </div>
                        {f.removed && (
                          <p className="text-xs text-muted-foreground">Dihapus: {f.removed}</p>
                        )}
                      </div>
                    </details>
                  ))}

                  {review.notes.length > 0 && (
                    <details className="rounded-md border border-border px-3 py-2">
                      <summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
                        Buka catatan
                      </summary>
                      <ul className="space-y-2 pt-2">
                        {review.notes.map((n, i) => (
                          <li
                            key={`${n.section}-${i}`}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Badge
                              variant={n.weight === "high" ? "destructive" : "outline"}
                              className="mt-0.5 shrink-0"
                            >
                              {n.weight}
                            </Badge>
                            <span>
                              <span className="font-medium">{n.section}</span> — {n.issue}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {review.applied.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => void undoReview()}>
                      Batalkan perbaikan
                    </Button>
                  )}
                </div>
              )}

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
                        <span aria-hidden="true"> · </span>
                        {remainingMs === null
                          ? "memperkirakan…"
                          : `perkiraan ~${Math.ceil(remainingMs / 1000)}s tersisa`}
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
                          {status === "done" ? (
                            <Badge variant="default" className="shrink-0 text-xs">
                              ✓
                            </Badge>
                          ) : status === "error" ? (
                            <Badge variant="destructive" className="shrink-0 text-xs">
                              !
                            </Badge>
                          ) : (
                            <>
                              <span
                                className="h-3 w-16 shrink-0 rounded-full bg-gradient-to-r from-muted via-primary/25 to-muted motion-safe:animate-pulse"
                                aria-hidden="true"
                              />
                              {status === "generating" && (
                                <span className="sr-only">Sedang dibuat</span>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!showDiscovery && (
          <DecisionPanel
            plan={planState}
            projectId={project.id}
            onRerun={() => void runPrd(true)}
          />
        )}

        {!showDiscovery && (
          <section className="space-y-4">
          <div>
            <h2 className="font-heading text-xl font-bold">Pratinjau PRD</h2>
            <p className="text-sm text-muted-foreground">
              12 bagian PRD. Tekan Review untuk meninjau dan menyunting isinya, lalu simpan.
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
                        {open ? "Tutup" : "Review"}
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
        )}

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
