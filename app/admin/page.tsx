import { listUsers } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UserManagement } from "@/components/user-management";

// Reads the local SQLite DB; blocking render keeps the list fresh on every visit.
export const instant = false;

export type UserRow = {
  id: number;
  email: string;
  role: "admin" | "member";
  email_verified: boolean;
  blocked: boolean;
  created_at: string;
};

export default async function AdminPage() {
  const admin = await requireAdmin();
  return (
    <main className="animate-fade-up mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="mb-2 text-sm font-semibold tracking-wide text-primary uppercase">Admin</p>
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">Kelola Pengguna</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Setujui pendaftar baru, blokir akun bermasalah, dan atur siapa yang boleh mengelola
          pengguna. Perubahan berlaku seketika, termasuk untuk sesi yang sedang aktif.
        </p>
      </header>
      {/* SQLite stores 0/1 — coerce to boolean so no `0 && <el/>` chain leaks a literal "0". */}
      <UserManagement
        users={listUsers().map((u) => ({ ...u, email_verified: !!u.email_verified, blocked: !!u.blocked }))}
        meId={admin.id}
      />
    </main>
  );
}
