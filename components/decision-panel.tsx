"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Plan } from "@/lib/plan";

/** The plan's decisions, shown read-only. "Buat ulang" re-drafts the PRD with them. */
export function DecisionPanel({
  plan,
  onRerun,
}: {
  projectId: number;
  plan: Plan | null;
  onRerun: () => void;
}) {
  if (!plan || plan.decisions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-lg">Keputusan yang dipakai</CardTitle>
        <p className="text-sm text-muted-foreground">
          AI mengambil keputusan ini dari ceritamu. Ubah lewat obrolan, lalu tekan{" "}
          <em>Buat ulang</em> untuk menerapkannya ke PRD.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-3">
          {plan.decisions.map((d) => (
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="cta" size="sm" onClick={onRerun}>
            Buat ulang
          </Button>
          <span className="text-xs text-muted-foreground">
            Susun ulang PRD memakai keputusan di atas.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
