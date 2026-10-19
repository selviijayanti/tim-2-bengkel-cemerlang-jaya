import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Calendar,
  CircleDollarSign,
  Package,
  Percent,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rupiah, tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";

export default async function HalamanLaporanLaba({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string }>;
}) {
  const profil = await ambilProfilSaya();
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const { dari: paramDari, sampai: paramSampai } = await searchParams;

  // Bawaan periode: bulan berjalan (WIB)
  const now = new Date();
  const tahunIni = now.getFullYear();
  const bulanIni = String(now.getMonth() + 1).padStart(2, "0");
  const tglAwalBulan = `${tahunIni}-${bulanIni}-01`;
  const tglAkhirBulan = new Date(tahunIni, now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const dari = paramDari || tglAwalBulan;
  const sampai = paramSampai || tglAkhirBulan;

  const supabase = await createClient();

  // Panggil database function public.laporan_laba(p_dari, p_sampai)
  const { data: laporan, error } = await supabase.rpc("laporan_laba", {
    p_dari: dari,
    p_sampai: sampai,
  });

  // Ringkasan agregasi
  const totalPendapatan = laporan?.reduce((acc, row) => acc + Number(row.pendapatan), 0) ?? 0;
  const totalModal = laporan?.reduce((acc, row) => acc + Number(row.modal), 0) ?? 0;
  const totalLaba = laporan?.reduce((acc, row) => acc + Number(row.laba), 0) ?? 0;
  const marginPersen =
    totalPendapatan > 0 ? Math.round((totalLaba / totalPendapatan) * 1000) / 10 : 0;

  // Preset tanggal untuk kemudahan navigasi
  const tglBulanLaluAwal = new Date(tahunIni, now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const tglBulanLaluAkhir = new Date(tahunIni, now.getMonth(), 0).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-text">
            <TrendingUp className="h-6 w-6 text-primary" />
            Laporan Laba
          </h1>
          <p className="text-sm text-text-muted">
            Analisis pendapatan, modal, dan laba kotor per Work Order (khusus Owner).
          </p>
        </div>
      </div>

      {/* Penyaring Periode Tanggal */}
      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-3" role="search">
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="dari" className="mb-1.5 block text-xs font-medium text-text-body">
              Tanggal Mulai
            </label>
            <Input id="dari" name="dari" type="date" defaultValue={dari} className="w-full" />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label htmlFor="sampai" className="mb-1.5 block text-xs font-medium text-text-body">
              Tanggal Selesai
            </label>
            <Input id="sampai" name="sampai" type="date" defaultValue={sampai} className="w-full" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="default" className="gap-1.5">
              <Calendar className="h-4 w-4" />
              Tampilkan
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/laporan-laba?dari=${tglAwalBulan}&sampai=${tglAkhirBulan}`}>
                Bulan Ini
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/laporan-laba?dari=${tglBulanLaluAwal}&sampai=${tglBulanLaluAkhir}`}>
                Bulan Lalu
              </Link>
            </Button>
          </div>
        </form>
      </Card>

      {/* Kartu Ringkasan KPI (PRD 6.12) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-text-muted">Total Pendapatan</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-text">
              {rupiah(totalPendapatan)}
            </div>
            <p className="mt-1 text-xs text-text-muted">Dari seluruh invoice terbit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-text-muted">Modal Spare Part</CardTitle>
            <Package className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-text">{rupiah(totalModal)}</div>
            <p className="mt-1 text-xs text-text-muted">Total HPP part terpakai</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-text-muted">Laba Kotor</CardTitle>
            <Wallet className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tabular-nums ${totalLaba < 0 ? "text-danger" : "text-success"}`}
            >
              {rupiah(totalLaba)}
            </div>
            <p className="mt-1 text-xs text-text-muted">Pendapatan dikurangi modal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-text-muted">Margin Laba</CardTitle>
            <Percent className="h-4 w-4 text-primary-strong" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tabular-nums ${marginPersen < 0 ? "text-danger" : "text-primary-strong"}`}
            >
              {marginPersen}%
            </div>
            <p className="mt-1 text-xs text-text-muted">Persentase laba terhadap pendapatan</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Rincian Per Work Order (PRD 6.12) */}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">No. WO</TableHead>
              <TableHead>No. Invoice</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Plat Kendaraan</TableHead>
              <TableHead className="text-right">Pendapatan</TableHead>
              <TableHead className="text-right">Modal</TableHead>
              <TableHead className="text-right">Laba Kotor</TableHead>
              <TableHead className="pr-4 text-right">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-danger">
                  Gagal memuat laporan laba: {error.message}
                </TableCell>
              </TableRow>
            )}
            {!error && laporan?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-text-muted">
                  Tidak ada data transaksi invoice pada periode {tanggal(dari)} s/d {tanggal(sampai)}.
                </TableCell>
              </TableRow>
            )}
            {laporan?.map((row) => {
              const labaMinus = Number(row.laba) < 0;
              const marginMinus = Number(row.margin_persen) < 0;

              return (
                <TableRow key={row.work_order_id} className="hover:bg-muted/40">
                  <TableCell className="pl-4 font-mono font-medium">
                    <Link
                      href={`/work-orders/${row.work_order_id}`}
                      className="text-primary hover:underline"
                    >
                      {row.nomor_wo}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-text-muted">
                    {row.nomor_invoice}
                  </TableCell>
                  <TableCell className="text-xs text-text-body whitespace-nowrap">
                    {tanggal(row.tanggal)}
                  </TableCell>
                  <TableCell className="font-mono font-medium uppercase text-text">
                    {row.plat}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-text">
                    {rupiah(Number(row.pendapatan))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-text-muted">
                    {rupiah(Number(row.modal))}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-xs font-semibold tabular-nums ${labaMinus ? "text-danger" : "text-success"}`}
                  >
                    {rupiah(Number(row.laba))}
                  </TableCell>
                  <TableCell
                    className={`pr-4 text-right font-mono text-xs tabular-nums ${marginMinus ? "text-danger font-semibold" : "text-text-body"}`}
                  >
                    {row.margin_persen}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
