import Link from "next/link";
import { Plus, Search, AlertCircle } from "lucide-react";
import { BadgeStatus } from "@/components/BadgeStatus";
import { Paginasi } from "@/components/Paginasi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rupiah, tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";

const PER_HALAMAN = 20;

const TAB_STATUS: { kode: string; label: string }[] = [
  { kode: "semua", label: "Semua" },
  { kode: "menunggu", label: "Menunggu" },
  { kode: "dikerjakan", label: "Dikerjakan" },
  { kode: "tertunda", label: "Tertunda" },
  { kode: "selesai", label: "Selesai" },
  { kode: "siap_diambil", label: "Siap Diambil" },
  { kode: "diambil", label: "Diambil" },
  { kode: "dibatalkan", label: "Dibatalkan" },
];

function isTerlambat(status: string, estimasiSelesai: string | null): boolean {
  if (!estimasiSelesai) return false;
  if (["selesai", "siap_diambil", "diambil", "dibatalkan"].includes(status)) return false;
  const tglEstimasi = new Date(estimasiSelesai);
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);
  return tglEstimasi < hariIni;
}

export default async function HalamanWorkOrders({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    tim?: string;
    dari?: string;
    sampai?: string;
    hal?: string;
  }>;
}) {
  const { status = "semua", q = "", tim, dari, sampai, hal } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);
  const cari = q.replace(/[,()*%\\]/g, " ").trim();

  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // Ambil daftar kepala mekanik untuk penyaring
  const { data: listKepala } = await supabase
    .from("profiles")
    .select("id, nama")
    .eq("role", "kepala_mekanik")
    .eq("aktif", true)
    .order("nama");

  // Jika Kepala Mekanik dan belum ada filter tim eksplisit di query param, bawaan ke tim saya (PRD 6.6)
  const timTerpilih =
    tim !== undefined ? tim : profil.peran === "kepala_mekanik" ? profil.id : "semua";

  // Hitung jumlah baris per status untuk tab (PRD 6.6)
  let kueriHitung = supabase.from("work_orders").select("status");
  if (timTerpilih && timTerpilih !== "semua") {
    kueriHitung = kueriHitung.eq("kepala_mekanik_id", timTerpilih);
  }
  const { data: statusRows } = await kueriHitung;

  const hitungStatus: Record<string, number> = { semua: statusRows?.length ?? 0 };
  statusRows?.forEach((r) => {
    hitungStatus[r.status] = (hitungStatus[r.status] ?? 0) + 1;
  });

  // Susun query utama
  let kueri = supabase
    .from("work_orders")
    .select(
      `
      id,
      nomor,
      status,
      estimasi_selesai,
      created_at,
      odometer,
      kepala_mekanik_id,
      vehicles!inner (plat),
      customers!inner (nama),
      profiles!work_orders_kepala_mekanik_id_fkey (nama),
      invoices (total)
    `,
      { count: "exact" },
    );

  // Filter status tab
  if (status && status !== "semua") {
    kueri = kueri.eq("status", status);
  }

  // Filter tim
  if (timTerpilih && timTerpilih !== "semua") {
    kueri = kueri.eq("kepala_mekanik_id", timTerpilih);
  }

  // Filter tanggal
  if (dari) {
    kueri = kueri.gte("created_at", `${dari}T00:00:00Z`);
  }
  if (sampai) {
    kueri = kueri.lte("created_at", `${sampai}T23:59:59Z`);
  }

  // Pencarian no WO, plat, atau nama pelanggan
  if (cari) {
    kueri = kueri.or(
      `nomor.ilike.%${cari}%,vehicles.plat.ilike.%${cari}%,customers.nama.ilike.%${cari}%`,
    );
  }

  const { data: daftarWO, count, error } = await kueri
    .order("created_at", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  const bolehBuat = profil.peran === "admin" || profil.peran === "owner";

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Work Order</h1>
          <p className="text-sm text-muted-foreground">
            Daftar seluruh pengerjaan kendaraan di bengkel
          </p>
        </div>
        {bolehBuat && (
          <Button asChild>
            <Link href="/work-orders/baru">
              <Plus className="size-4" />
              Work Order Baru
            </Link>
          </Button>
        )}
      </div>

      {/* Tab Status */}
      <div className="flex overflow-x-auto border-b border-border pb-1">
        <nav className="flex gap-2" aria-label="Status work order">
          {TAB_STATUS.map((tab) => {
            const aktif = (status || "semua") === tab.kode;
            const jumlah = hitungStatus[tab.kode] ?? 0;
            const sp = new URLSearchParams();
            if (tab.kode !== "semua") sp.set("status", tab.kode);
            if (q) sp.set("q", q);
            if (timTerpilih && timTerpilih !== "semua") sp.set("tim", timTerpilih);
            if (dari) sp.set("dari", dari);
            if (sampai) sp.set("sampai", sampai);

            return (
              <Link
                key={tab.kode}
                href={`/work-orders?${sp.toString()}`}
                className={`whitespace-nowrap px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  aktif
                    ? "bg-primary-soft text-primary-strong"
                    : "text-muted-foreground hover:bg-muted hover:text-text"
                }`}
              >
                {tab.label} <span className="text-xs opacity-75">({jumlah})</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Form Pencarian & Penyaring */}
      <form method="get" className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input type="hidden" name="status" value={status} />

        <div className="relative sm:col-span-2">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Cari No WO, plat, atau nama pelanggan..."
            className="pl-9"
          />
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        </div>

        <div>
          <select
            name="tim"
            defaultValue={timTerpilih}
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
          >
            <option value="semua">Semua Tim</option>
            {listKepala?.map((k) => (
              <option key={k.id} value={k.id}>
                Tim {k.nama} {profil.id === k.id ? "(Tim Saya)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Input
            type="date"
            name="dari"
            defaultValue={dari}
            placeholder="Dari tanggal"
            title="Dari tanggal"
          />
        </div>

        <div className="flex gap-2">
          <Input
            type="date"
            name="sampai"
            defaultValue={sampai}
            placeholder="Sampai tanggal"
            title="Sampai tanggal"
          />
          <Button type="submit" variant="secondary" className="shrink-0">
            Saring
          </Button>
        </div>
      </form>

      {/* Tabel Work Order */}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">No WO</TableHead>
              <TableHead>Plat</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead>Tim</TableHead>
              <TableHead>Estimasi Selesai</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="pr-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-danger">
                  Gagal memuat data Work Order. Silakan muat ulang halaman.
                </TableCell>
              </TableRow>
            )}
            {!error && daftarWO?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Tidak ada Work Order yang ditemukan.
                </TableCell>
              </TableRow>
            )}
            {daftarWO?.map((wo) => {
              const terlambat = isTerlambat(wo.status, wo.estimasi_selesai);
              const invoice = Array.isArray(wo.invoices) ? wo.invoices[0] : wo.invoices;
              const totalNominal = invoice?.total != null ? rupiah(invoice.total) : "-";

              return (
                <TableRow key={wo.id} className="hover:bg-muted/50">
                  <TableCell className="pl-4 font-semibold">
                    <Link
                      href={`/work-orders/${wo.id}`}
                      className="text-primary hover:underline"
                    >
                      {wo.nomor}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono font-medium">
                    {wo.vehicles?.plat ?? "-"}
                  </TableCell>
                  <TableCell>{wo.customers?.nama ?? "-"}</TableCell>
                  <TableCell>
                    {wo.profiles?.nama ? `Tim ${wo.profiles.nama}` : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span>{wo.estimasi_selesai ? tanggal(wo.estimasi_selesai) : "-"}</span>
                      {terlambat && (
                        <Badge variant="destructive" className="gap-1 text-[11px] py-0">
                          <AlertCircle className="size-3" />
                          Terlambat
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {totalNominal}
                  </TableCell>
                  <TableCell className="pr-4">
                    <BadgeStatus status={wo.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Paginasi */}
      <Paginasi
        halaman={halaman}
        totalBaris={count ?? 0}
        perHalaman={PER_HALAMAN}
        params={{ status, q, tim: timTerpilih, dari, sampai }}
      />
    </div>
  );
}
