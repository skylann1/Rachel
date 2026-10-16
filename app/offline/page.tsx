import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline — RACHEL K3",
};

// Shown by the service worker (public/sw.js) when a navigation fails offline.
// Kept intentionally dependency-free so it renders with no network access.
export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl">
        📡
      </div>
      <h1 className="text-lg font-semibold text-foreground">Tidak ada koneksi</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Anda sedang offline. Sambungkan kembali perangkat ke internet, lalu coba
        lagi untuk membuka RACHEL K3.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Coba lagi
      </Link>
    </main>
  );
}
