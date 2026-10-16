import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Specly — PRD Builder untuk AI Coding",
  description:
    "Bikin PRD, Design Pack, dan Brand Pack siap pakai untuk AI Agentic Coding — tanpa perlu latar belakang IT.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Header reads the session cookie — Suspense keeps pages prerenderable. */}
        <Suspense>
          <AppHeader />
        </Suspense>
        {children}
        <footer className="py-6 text-center text-xs text-muted-foreground">
          © 2026 Ahmad Rizki. Hak cipta dilindungi.
        </footer>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
