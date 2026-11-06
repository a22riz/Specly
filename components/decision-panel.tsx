"use client";

import { useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [rewriting, setRewriting] = useState(false);

  if (!plan || decisions.length === 0) return null;

  function update(id: string, chosen: string) {
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
      setDecisions(j.decisions);
      setInstruction("");
      setDirty(true);
      setSaved(false);
      toast.success("Keputusan diperbarui AI. Tekan Simpan untuk menyimpannya.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal meminta perubahan");
    } finally {
      setRewriting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="font-heading text-lg">Keputusan yang dipakai</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              AI mengambil keputusan ini dari ceritamu. Ubah lewat obrolan, lalu tekan{" "}
              <em>Buat ulang</em> untuk menerapkannya ke PRD.
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
                          onChange={() => update(d.id, "")}
                        />
                        Lainnya
                      </label>
                    </div>
                  )}
                  {isOther && (
                    <Input
                      value={d.chosen}
                      onChange={(e) => update(d.id, e.target.value)}
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
                disabled={!dirty || saving}
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save data-icon="inline-start" />}
                {saving ? "Menyimpan..." : "Simpan keputusan"}
              </Button>
              {dirty && (
                <span className="text-xs text-muted-foreground">
                  Ada perubahan belum disimpan.
                </span>
              )}
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
                disabled={rewriting}
                aria-label="Instruksi AI untuk keputusan"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void rewrite()}
                disabled={rewriting || !instruction.trim()}
                className="shrink-0"
              >
                {rewriting ? <Loader2 className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
                Minta ubah
              </Button>
            </div>
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
          <Button variant="cta" size="sm" onClick={onRerun} disabled={dirty}>
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
