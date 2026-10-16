"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * In-app fallback for any Server Component crash — replaces the raw
 * "Minified React error #441" screen with a friendly, branded popup.
 * The digest is shown so the user can quote it to the admin.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[60vh] flex-1 place-items-center px-4 py-10">
      <div className="animate-pop-in w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="font-heading text-xl font-bold">Ada kendala di server</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Halaman ini gagal dimuat. Coba lagi — kalau terus terjadi, beri tahu admin
          dan sertakan kode di bawah.
        </p>
        {error.digest && (
          <p className="mt-3 rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            Kode: {error.digest}
          </p>
        )}
        <Button variant="cta" className="mt-6" onClick={reset}>
          <RotateCcw data-icon="inline-start" />
          Coba lagi
        </Button>
      </div>
    </main>
  );
}
