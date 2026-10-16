import { redirect } from "next/navigation";
import { Info, Search, ShieldCheck } from "lucide-react";
import { Paginasi } from "@/components/Paginasi";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormPengguna, type PenggunaItem } from "./FormPengguna";

const PER_HALAMAN = 20;

export default async function HalamanPengguna({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hal?: string }>;
}) {
  const { q = "", hal } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);
  const cari = q.replace(/[,()*%\\]/g, " ").trim();

  const profil = await ambilProfilSaya();
  // Hanya Owner yang boleh mengakses halaman ini (PRD 6.10)
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  // Ambil hanya kolom yang ditampilkan (hemat egress)
  let kueri = supabase
    .from("profiles")
    .select("id, nama, email, role, aktif, created_at", { count: "exact" });

  if (cari) {
    kueri = kueri.or(`nama.ilike.%${cari}%,email.ilike.%${cari}%`);
  }

  const { data: pengguna, count, error } = await kueri
    .order("created_at", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Pengguna & Peran</h1>
          <p className="text-sm text-muted-foreground">
            Kelola peran hak akses dan status keaktifan akun pengguna bengkel.
          </p>
        </div>
      </div>

      {/* Info Card PRD 6.10 */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
        <Info className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Penambahan Pengguna Baru (PRD 6.10)</p>
          <p className="text-blue-800 text-xs leading-relaxed">
            Akun baru dibuat oleh Owner di <strong>Supabase Dashboard › Authentication › Users › Add user</strong>{" "}
            (masukkan email dan kata sandi sementara, serta centang <em>Auto Confirm User</em>).
            Setelah dibuat, akun otomatis muncul pada daftar di bawah ini untuk diisi nama lengkap, ditetapkan perannya, dan diaktifkan.
          </p>
        </div>
      </div>

      {/* Form Pencarian */}
      <form className="flex max-w-md gap-2" role="search">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Cari nama atau email pengguna"
          aria-label="Cari pengguna"
        />
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" />
          Cari
        </Button>
      </form>

      {/* Tabel Pengguna */}
      <Card className="py-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Terdaftar Sejak</TableHead>
              <TableHead className="pr-4 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-danger">
                  Gagal memuat daftar pengguna. Muat ulang halaman ini.
                </TableCell>
              </TableRow>
            )}
            {!error && pengguna?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  {cari
                    ? `Tidak ada pengguna yang cocok dengan "${cari}".`
                    : "Belum ada data pengguna."}
                </TableCell>
              </TableRow>
            )}
            {pengguna?.map((p) => {
              let peranBadge;
              if (p.role === "owner") {
                peranBadge = (
                  <Badge className="bg-amber-600 text-white hover:bg-amber-700 gap-1 border-none">
                    <ShieldCheck className="h-3 w-3" />
                    Owner
                  </Badge>
                );
              } else if (p.role === "admin") {
                peranBadge = (
                  <Badge className="bg-blue-600 text-white hover:bg-blue-700 border-none">
                    Admin
                  </Badge>
                );
              } else {
                peranBadge = (
                  <Badge variant="secondary">
                    Kepala Mekanik
                  </Badge>
                );
              }

              return (
                <TableRow key={p.id}>
                  <TableCell className="pl-4 font-medium text-text">
                    {p.nama}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.email}
                  </TableCell>
                  <TableCell>{peranBadge}</TableCell>
                  <TableCell>
                    {p.aktif ? (
                      <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Nonaktif
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {tanggal(p.created_at)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <FormPengguna pengguna={p as PenggunaItem} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Paginasi
        halaman={halaman}
        totalBaris={count ?? 0}
        perHalaman={PER_HALAMAN}
        params={{ q: cari }}
      />
    </div>
  );
}
