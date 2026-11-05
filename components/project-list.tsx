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
import { Textarea } from "@/components/ui/textarea";
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
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!title.trim() && !description.trim()) return;
    setCreating(true);
    try {
      const project = await createProjectAction(title, description);
      setOpen(false);
      setTitle("");
      setDescription("");
      router.push(`/projects/${project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat proyek");
    } finally {
      setCreating(false);
    }
  }

  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  async function handleDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteProjectAction(deleting.id);
      setDeleting(null);
      router.refresh();
      toast.success("Proyek dihapus");
    } catch {
      toast.error("Gagal menghapus proyek");
    } finally {
      setDeletingBusy(false);
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
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-heading">Proyek Baru</DialogTitle>
                <DialogDescription>
                  Ceritakan aplikasi atau produk yang mau kamu bangun. Judul boleh dikosongkan —
                  kami ambil dari baris pertama ceritamu.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="project-title">Nama proyek (opsional)</Label>
                  <Input
                    id="project-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="cth: Aplikasi Kasir Warung"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project-description">Ceritakan aplikasimu</Label>
                  <Textarea
                    id="project-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ceritakan aplikasimu sebanyak yang kamu mau — siapa penggunanya, masalah apa yang dipecahkan, fitur yang dibayangkan…"
                    rows={6}
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Batal
                </Button>
                <Button
                  variant="cta"
                  onClick={handleCreate}
                  disabled={creating || (!title.trim() && !description.trim())}
                >
                  {creating ? "Membuat..." : "Buat & Mulai"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Hapus proyek?</DialogTitle>
            <DialogDescription>
              Proyek <span className="font-medium text-foreground">{deleting?.title}</span> beserta
              seluruh isinya (PRD dan percakapan) akan dihapus permanen. Tindakan
              ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deletingBusy}>
              {deletingBusy ? "Menghapus..." : "Hapus Permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        <div className="stagger grid gap-4 sm:grid-cols-2">
          {initialProjects.map((project) => (
            <Card key={project.id} className="card-hover hover:border-primary/40">
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
                <Button variant="secondary" nativeButton={false} render={<Link href={`/projects/${project.id}`} />}>
                  <FileText data-icon="inline-start" />
                  Buka
                </Button>
                <CardAction className="flex items-center gap-1">
                  <Button size="icon-sm" variant="ghost" nativeButton={false} render={<a href={`/api/export?project=${project.id}`} />}>
                    <Download />
                    <span className="sr-only">Unduh semua dokumen (ZIP)</span>
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    title="Hapus proyek"
                    aria-label={`Hapus proyek ${project.title}`}
                    onClick={() => setDeleting(project)}
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
