"use client";

import { useState } from "react";
import { Download, Loader2, RefreshCw, Save, Shapes } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { saveSectionAction } from "@/app/actions";

export function LogoCard({
  projectId,
  svg,
  onSaved,
}: {
  projectId: number;
  svg: string;
  onSaved: (svg: string) => void;
}) {
  const [current, setCurrent] = useState(svg);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const json = (await res.json()) as { svg?: string; error?: string };
      if (!res.ok || !json.svg) throw new Error(json.error ?? "Gagal membuat logo");
      setCurrent(json.svg);
      await saveSectionAction(projectId, "brand.logo", json.svg);
      onSaved(json.svg);
      toast.success("Logo dibuat dan tersimpan. Klik Regenerate bila mau variasi lain.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat logo");
    } finally {
      setGenerating(false);
    }
  }

  async function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed.startsWith("<svg")) {
      toast.error("Kode harus dimulai dengan <svg");
      return;
    }
    setCurrent(trimmed);
    setEditing(false);
    await saveSectionAction(projectId, "brand.logo", trimmed);
    onSaved(trimmed);
    toast.success("Logo tersimpan");
  }

  const dataUri = current ? `data:image/svg+xml;utf8,${encodeURIComponent(current)}` : "";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <Shapes className="size-5 text-primary" />
          Logo
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          AI membuat logo SVG dari arah brand di atas (voice &amp; identitas visual). Format vektor,
          siap dipakai developer.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex min-h-40 items-center justify-center rounded-lg border border-border bg-white p-4">
          {generating ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              AI sedang mendesain logo... (bisa 1–2 menit)
            </div>
          ) : current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUri}
              alt={`Logo proyek`}
              className="max-h-40 w-auto"
              aria-label="Pratinjau logo"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada logo.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="cta" onClick={() => void generate()} disabled={generating}>
            {generating ? <Loader2 className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
            {current ? "Regenerate" : "Generate Logo"}
          </Button>
          {current && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft(current);
                  setEditing((e) => !e);
                }}
              >
                {editing ? "Tutup Editor" : "Edit SVG"}
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <a
                    href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(current)}`}
                    download="LOGO.svg"
                  />
                }
              >
                <Download data-icon="inline-start" />
                Unduh .svg
              </Button>
            </>
          )}
        </div>
        {editing && (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-40 font-mono text-xs"
              aria-label="Kode SVG logo"
            />
            <Button variant="cta" onClick={() => void saveEdit()}>
              <Save data-icon="inline-start" />
              Simpan Perubahan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
