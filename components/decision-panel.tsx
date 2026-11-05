"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setDecisionAction } from "@/app/actions";
import type { Plan } from "@/lib/plan";

/** Product decisions from the plan: choose an option, then "Buat ulang" applies it. */
export function DecisionPanel({ projectId, plan }: { projectId: number; plan: Plan | null }) {
  const [chosen, setChosen] = useState<Record<string, string>>(() =>
    Object.fromEntries((plan?.decisions ?? []).map((d) => [d.id, d.chosen])),
  );
  const [changed, setChanged] = useState(false);

  if (!plan || plan.decisions.length === 0) return null;

  async function choose(id: string, value: string) {
    if (chosen[id] === value) return;
    setChosen((c) => ({ ...c, [id]: value }));
    setChanged(true);
    try {
      await setDecisionAction(projectId, id, value);
    } catch {
      toast.error("Gagal menyimpan pilihan. Coba lagi.");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-lg">Keputusan produk</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pilih arah yang kamu inginkan. Setelah diubah, tekan <em>Buat ulang</em> agar PRD mengikuti
          pilihan ini.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan.decisions.map((d) => (
          <div key={d.id} className="space-y-2">
            <div className="text-sm font-medium">{d.label}</div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={d.label}>
              {d.options.map((opt) => {
                const active = chosen[d.id] === opt;
                return (
                  <Button
                    key={opt}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    aria-pressed={active}
                    onClick={() => void choose(d.id, opt)}
                  >
                    {active && <Check data-icon="inline-start" />}
                    {opt}
                    {opt === d.recommended && <span className="text-xs opacity-70">· rekomendasi</span>}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
        {changed && (
          <p className="text-xs text-muted-foreground" role="status">
            Pilihan disimpan. Tekan <em>Buat ulang</em> untuk menerapkannya ke PRD.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
