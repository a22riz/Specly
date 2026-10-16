"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, registerAction } from "@/app/actions";

export function AuthForm({ mode }: { mode: "masuk" | "daftar" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "masuk") {
        await loginAction(email, password);
        router.push("/");
        router.refresh();
      } else {
        const { role } = await registerAction(email, password);
        if (role === "admin") {
          router.push("/");
          router.refresh();
        } else {
          toast.success("Akun dibuat. Menunggu persetujuan admin sebelum bisa masuk.");
          router.push("/masuk");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@perusahaan.com"
          autoComplete="email"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={mode === "daftar" ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "daftar" ? "Minimal 8 karakter" : "Password kamu"}
          autoComplete={mode === "daftar" ? "new-password" : "current-password"}
        />
      </div>
      <Button type="submit" variant="cta" disabled={busy}>
        {busy ? "Memproses..." : mode === "masuk" ? "Masuk" : "Daftar"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {mode === "masuk" ? (
          <>
            Belum punya akun?{" "}
            <Link href="/daftar" className="text-primary underline-offset-4 hover:underline">
              Daftar
            </Link>
          </>
        ) : (
          <>
            Sudah punya akun?{" "}
            <Link href="/masuk" className="text-primary underline-offset-4 hover:underline">
              Masuk
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
