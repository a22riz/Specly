"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Download, FileText, Plus, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { createProjectAction, deleteProjectAction } from "@/app/actions";
import type { Project } from "@/lib/db";
import { SettingsDialog } from "@/components/settings-dialog";

export function ProjectList({
  initialProjects,
  aiReady,
}: {
  initialProjects: Project[];
  aiReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const project = await createProjectAction(title);
      setOpen(false);
      setTitle("");
      router.push(`/projects/${project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat proyek");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Hapus proyek ini beserta seluruh isinya?")) return;
    try {
      await deleteProjectAction(id);
      router.refresh();
      toast.success("Proyek dihapus");
    } catch {
      toast.error("Gagal menghapus proyek");
    }
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold">Proyek Saya</h2>
        <div className="flex items-center gap-2">
          <SettingsDialog
            trigger={
              <Button variant="outline">
                <Settings data-icon="inline-start" />
                Pengaturan AI
              </Button>
            }
            onSaved={() => router.refresh()}
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button variant="cta" />}>
              <Plus data-icon="inline-start" />
              Proyek Baru
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">Proyek Baru</DialogTitle>
                <DialogDescription>
                  Beri nama aplikasi atau produk yang mau kamu bangun.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 py-2">
                <Label htmlFor="project-title">Nama proyek</Label>
                <Input
                  id="project-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="cth: Aplikasi Kasir Warung"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Batal
                </Button>
                <Button variant="cta" onClick={handleCreate} disabled={creating || !title.trim()}>
                  {creating ? "Membuat..." : "Buat & Mulai"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!aiReady && (
        <Card className="mb-4 border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-base">
              <Bot className="size-5 text-primary" />
              AI belum dihubungkan
            </CardTitle>
            <CardDescription>
              Buka <span className="font-medium text-foreground">Pengaturan AI</span> untuk memasukkan
              Base URL, API key, dan nama model. Isi dokumen tetap bisa dilakukan manual, lalu
              unduh hasilnya.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {initialProjects.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Belum ada proyek</CardTitle>
            <CardDescription>
              Klik <span className="font-medium text-foreground">Proyek Baru</span> untuk mulai
              menulis PRD pertamamu.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {initialProjects.map((project) => (
            <Card key={project.id} className="transition-shadow hover:shadow-lg">
              <CardHeader>
                <CardTitle className="font-heading">
                  <Link href={`/projects/${project.id}`} className="hover:text-primary">
                    {project.title}
                  </Link>
                </CardTitle>
                <CardDescription>
                  Terakhir diubah {new Date(project.updated_at + "Z").toLocaleString("id-ID")}
                </CardDescription>
              </CardHeader>
              <CardFooter className="justify-between">
                <Button variant="secondary" render={<Link href={`/projects/${project.id}`} />}>
                  <FileText data-icon="inline-start" />
                  Buka
                </Button>
                <CardAction className="flex items-center gap-1">
                  <Button size="icon-sm" variant="ghost" render={<a href={`/api/export?project=${project.id}`} />}>
                    <Download />
                    <span className="sr-only">Unduh semua dokumen (ZIP)</span>
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    title="Hapus proyek"
                    aria-label="Hapus proyek"
                    onClick={() => handleDelete(project.id)}
                  >
                    <Trash2 />
                  </Button>
                </CardAction>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
