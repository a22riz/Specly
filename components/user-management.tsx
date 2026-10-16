"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  blockUserAction,
  deleteUserAction,
  setUserRoleAction,
  verifyUserAction,
} from "@/app/actions";
import type { UserRow } from "@/app/admin/page";

export function UserManagement({ users, meId }: { users: UserRow[]; meId: number }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteUserAction(deleting.id);
      setDeleting(null);
      router.refresh();
      toast.success("Akun dihapus");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal");
    } finally {
      setDeletingBusy(false);
    }
  }

  async function run(id: number, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left">
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Terdaftar</th>
            <th className="px-4 py-3 font-medium text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isMe = u.id === meId;
            return (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  {u.email}
                  {isMe && <span className="ml-2 text-xs text-muted-foreground">(kamu)</span>}
                </td>
                <td className="px-4 py-3">
                  {u.role === "admin" ? "Admin" : "Member"}
                </td>
                <td className="px-4 py-3">
                  {u.blocked ? (
                    <span className="text-destructive">Diblokir</span>
                  ) : !u.email_verified ? (
                    <span className="text-amber-600">Menunggu verifikasi</span>
                  ) : (
                    <span className="text-emerald-600">Aktif</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.created_at.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    {!u.email_verified && !u.blocked && (
                      <Button
                        variant="cta"
                        size="sm"
                        disabled={busyId === u.id}
                        onClick={() => void run(u.id, () => verifyUserAction(u.id, true))}
                      >
                        Verifikasi
                      </Button>
                    )}
                    {u.role === "member" && !u.blocked && u.email_verified && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === u.id}
                        onClick={() => void run(u.id, () => blockUserAction(u.id, true))}
                      >
                        Blokir
                      </Button>
                    )}
                    {u.role === "member" && u.blocked && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === u.id}
                        onClick={() => void run(u.id, () => blockUserAction(u.id, false))}
                      >
                        Buka Blokir
                      </Button>
                    )}
                    {!isMe && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === u.id}
                        onClick={() =>
                          void run(u.id, () =>
                            setUserRoleAction(u.id, u.role === "admin" ? "member" : "admin"),
                          )
                        }
                      >
                        {u.role === "admin" ? "Jadikan Member" : "Jadikan Admin"}
                      </Button>
                    )}
                    {u.role === "member" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === u.id}
                        onClick={() => setDeleting(u)}
                      >
                        Hapus
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Hapus akun?</DialogTitle>
            <DialogDescription>
              Akun <span className="font-medium text-foreground">{deleting?.email}</span> beserta
              semua proyeknya akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Batal
            </Button>
            <Button variant="destructive" disabled={deletingBusy} onClick={() => void confirmDelete()}>
              {deletingBusy ? "Menghapus..." : "Hapus Permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
