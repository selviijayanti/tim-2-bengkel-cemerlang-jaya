import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";
import { FormLogin } from "./FormLogin";

export default async function HalamanLogin({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; pesan?: string }>;
}) {
  const { next, pesan } = await searchParams;

  // Diurai dengan URL karena peramban membaca "/\evil.com" sebagai "//evil.com". Hasil normalisasi juga dicek:
  // "/.//evil.com" menjadi "//evil.com", yang dibaca peramban sebagai situs luar.
  // Parsed with URL because browsers read "/\evil.com" as "//evil.com". The normalized result is checked too:
  // "/.//evil.com" becomes "//evil.com", which browsers treat as another site.
  const url = next?.startsWith("/") && URL.canParse(next, "http://lokal") ? new URL(next, "http://lokal") : null;
  const tujuan =
    url?.origin === "http://lokal" && !url.pathname.startsWith("//") ? url.pathname + url.search : "/dashboard";

  return (
    <main className="relative flex min-h-dvh items-center justify-center p-4">
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors p-2 rounded-lg hover:bg-neutral-200/50"
        >
          <ArrowLeft className="size-4" />
          <span>Kembali ke Beranda</span>
        </Link>
      </div>

      <div className="w-full max-w-sm space-y-6">
        <Link
          href="/"
          className="flex flex-col items-center gap-2 text-center group cursor-pointer"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground group-hover:opacity-90 transition-opacity shadow-sm">
            <Wrench className="size-6" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Cemerlang Jaya Motor</h1>
          <p className="text-sm text-muted-foreground">Masuk untuk mengelola bengkel</p>
        </Link>

        <FormLogin
          tujuan={tujuan}
          pesanAwal={pesan === "nonaktif" ? "Akunmu dinonaktifkan. Hubungi Owner" : null}
        />

        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-xs text-[var(--text-muted)] hover:text-[var(--primary-strong)] transition-colors"
          >
            Bukan staf bengkel? Kembali ke Halaman Depan
          </Link>
        </div>
      </div>
    </main>
  );
}
