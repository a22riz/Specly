"use client";

import { useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AiTyping } from "@/components/ai-typing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveDecisionsAction } from "@/app/actions";
import type { Decision, Plan } from "@/lib/plan";

/** Drop a leading "(rekomendasi)" the model may prefix on the first option. */
function optionLabel(option: string) {
  return option.replace(/^\(\s*rekomendasi\s*\)\s*/i, "").trim();
}

/**
 * The plan's decisions. "Buat ulang" re-drafts the PRD with them; Review lets the
 * user pick another option (or a free-text answer) and persist via Save, or ask AI.
 */
export function DecisionPanel({
  plan,
  projectId,
  onRerun,
}: {
  plan: Plan | null;
  projectId: number;
  onRerun: () => void;
}) {
  const [decisions, setDecisions] = useState<Decision[]>(() => plan?.decisions ?? []);
  // Remember free-text answers so switching to an option and back restores them.
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (plan?.decisions ?? [])
        .filter((d) => !d.options.includes(d.chosen))
        .map((d) => [d.id, d.chosen]),
    ),
  );
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [rewriting, setRewriting] = useState(false);
  // The parent replaces `plan` after a review adds escalations; reset the local
  // copies when the prop identity changes (React's "adjust state on prop change").
  // shortcut: this drops unsaved panel edits if a review lands mid-edit — review is
  // explicit and rare. Upgrade path: merge by decision id instead of resetting.
  const [syncedPlan, setSyncedPlan] = useState(plan);
  if (syncedPlan !== plan) {
    setSyncedPlan(plan);
    const ds = plan?.decisions ?? [];
    setDecisions(ds);
    setCustom(
      Object.fromEntries(
        ds.filter((d) => !d.options.includes(d.chosen)).map((d) => [d.id, d.chosen]),
      ),
    );
    setDirty(false);
    setSaved(false);
  }

  if (!plan || decisions.length === 0) return null;

  function update(id: string, chosen: string) {
    if (decisions.find((d) => d.id === id)?.chosen === chosen) return;
    setDecisions((ds) => ds.map((d) => (d.id === id ? { ...d, chosen } : d)));
    setDirty(true);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      await saveDecisionsAction(projectId, decisions);
      setDirty(false);
      setSaved(true);
      toast.success("Keputusan disimpan.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan keputusan.");
    } finally {
      setSaving(false);
    }
  }

  async function rewrite() {
    const text = instruction.trim();
    if (!text || rewriting) return;
    setRewriting(true);
    try {
      const res = await fetch("/api/prd/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, instruction: text }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        decisions?: Decision[];
        error?: string;
      };
      if (!res.ok || !j.decisions) throw new Error(j.error ?? "Gagal meminta perubahan");
      // The route already persisted via savePlan; mirror that, do not leave dirty.
      setDecisions(j.decisions);
      setInstruction("");
      setDirty(false);
      setSaved(true);
      toast.success("Keputusan diperbarui AI.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal meminta perubahan");
    } finally {
      setRewriting(false);
    }
  }

  return (
    <Card id="keputusan" className="scroll-mt-16">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="font-heading text-lg">Keputusan yang dipakai</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              AI mengambil keputusan ini dari ceritamu. Buka <em>Review</em> untuk mengubahnya,
              lalu tekan <em>Simpan</em> untuk menyimpan atau <em>Buat ulang</em> untuk
              menerapkannya ke PRD.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            {open ? "Tutup" : "Review"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {open ? (
          <div className="space-y-3">
            {decisions.map((d) => {
              const isOther = !d.options.includes(d.chosen);
              return (
                <fieldset key={d.id} className="space-y-2 rounded-lg border border-border p-3">
                  <legend className="text-sm font-medium">{d.label}</legend>
                  {d.question && (
                    <p className="text-xs text-muted-foreground">{d.question}</p>
                  )}
                  {d.options.length > 0 && (
                    <div className="space-y-1.5">
                      {d.options.map((opt) => (
                        <label key={opt} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`decision-${d.id}`}
                            className="size-4 accent-primary"
                            checked={d.chosen === opt}
                            onChange={() => update(d.id, opt)}
                          />
                          <span>
                            {optionLabel(opt)}
                            {opt === d.recommended && " (Rekomendasi)"}
                          </span>
                        </label>
                      ))}
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`decision-${d.id}`}
                          className="size-4 accent-primary"
                          checked={isOther}
                          onChange={() => update(d.id, custom[d.id] ?? "")}
                        />
                        Lainnya
                      </label>
                    </div>
                  )}
                  {isOther && (
                    <Input
                      value={d.chosen}
                      onChange={(e) => {
                        setCustom((c) => ({ ...c, [d.id]: e.target.value }));
                        update(d.id, e.target.value);
                      }}
                      placeholder="Tulis keputusanmu..."
                      aria-label={`Keputusan lain untuk ${d.label}`}
                    />
                  )}
                </fieldset>
              );
            })}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="cta"
                size="sm"
                onClick={() => void save()}
                disabled={!dirty || saving || rewriting}
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save data-icon="inline-start" />}
                {saving ? "Menyimpan..." : "Simpan keputusan"}
              </Button>
            </div>

            <div className="flex items-end gap-2">
              <Input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void rewrite();
                  }
                }}
                placeholder="Minta ubah lewat AI... (mis. pilih opsi paling sederhana)"
                disabled={rewriting || dirty}
                aria-label="Instruksi AI untuk keputusan"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void rewrite()}
                disabled={rewriting || dirty || !instruction.trim()}
                className="shrink-0"
              >
                {rewriting ? <Loader2 className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
                Minta ubah
              </Button>
            </div>
            {rewriting && (
              <AiTyping
                phases={["Membaca keputusan…", "Menyusun opsi baru…", "Merapikan rekomendasi…"]}
                interval={2600}
              />
            )}
          </div>
        ) : (
          <dl className="space-y-3">
            {decisions.map((d) => (
              <div key={d.id} className="space-y-1">
                <dt className="text-sm font-medium">{d.label}</dt>
                <dd className="text-sm">{d.chosen}</dd>
                <dd className="text-xs text-muted-foreground">Rekomendasi: {d.recommended}</dd>
                {d.options.length > 0 && (
                  <dd className="text-xs text-muted-foreground">Opsi: {d.options.join(", ")}</dd>
                )}
              </div>
            ))}
          </dl>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="cta" size="sm" onClick={onRerun} disabled={dirty || rewriting}>
            Buat ulang
          </Button>
          <span className="text-xs text-muted-foreground">
            {dirty
              ? "Ada perubahan belum disimpan."
              : saved
                ? "Tekan Buat ulang untuk menerapkan ke PRD."
                : "Susun ulang PRD memakai keputusan di atas."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
