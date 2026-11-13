"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAiConfigAction, saveAiConfigAction } from "@/app/actions";
import type { AiConfigView } from "@/lib/db";
import { toast } from "sonner";

/** View + the in-flight key the user is typing (never the stored key). */
type Draft = AiConfigView & { api_key: string };

export function SettingsDialog({
  trigger,
  onSaved,
}: {
  trigger: React.ReactElement;
  onSaved?: (config: AiConfigView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<Draft>({
    base_url: "https://api.openai.com/v1",
    api_key: "",
    model: "gpt-4o-mini",
    has_key: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // The key never arrives from the server; the field starts empty and an
      // empty submit keeps the stored key.
      fetchAiConfigAction()
        .then((c) => setConfig({ ...c, api_key: "" }))
        .catch(() => toast.error("Gagal memuat pengaturan"));
    }
  }, [open]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveAiConfigAction(config);
      onSaved?.(config);
      toast.success("Pengaturan AI tersimpan");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Pengaturan AI</DialogTitle>
          <DialogDescription>
            Sambungkan AI apa pun yang kompatibel dengan API OpenAI (ChatGPT, Ollama, Groq,
            OpenRouter, dll).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="base_url">Base URL</Label>
            <Input
              id="base_url"
              value={config.base_url}
              onChange={(e) => setConfig({ ...config, base_url: e.target.value })}
              placeholder="https://api.openai.com/v1"
              autoComplete="url"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="api_key">API Key</Label>
            <Input
              id="api_key"
              type="password"
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              placeholder={config.has_key ? "•••••••• (biarkan kosong untuk mempertahankan)" : "sk-..."}
              autoComplete="off"
            />
            {config.has_key && (
              <p className="text-xs text-muted-foreground">
                Kunci tersimpan terenkripsi di server. Isi hanya jika ingin menggantinya.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="model">Nama Model</Label>
            <Input
              id="model"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              placeholder="gpt-4o-mini"
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button variant="cta" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
