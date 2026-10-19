import { redirect } from "next/navigation";
import { Filter, History, ScrollText } from "lucide-react";
import { Paginasi } from "@/components/Paginasi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tanggalWaktu } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { DialogDetailAudit } from "./DialogDetailAudit";

const PER_HALAMAN = 20;

const DAFTAR_TABEL = [
  { value: "semua", label: "Semua Tabel" },
  { value: "work_orders", label: "Work Orders" },
  { value: "billing_items", label: "Item Tagihan" },
  { value: "billing_item_costs", label: "Modal Tagihan" },
  { value: "inventory_items", label: "Inventory" },
  { value: "inventory_costs", label: "Modal Inventory" },
  { value: "invoices", label: "Invoice" },
  { value: "payments", label: "Pembayaran" },
  { value: "stock_movements", label: "Pergerakan Stok" },
  { value: "profiles", label: "Profil Pengguna" },
];

export default async function HalamanAuditLog({
  searchParams,
}: {
  searchParams: Promise<{ hal?: string; tabel?: string; pelaku?: string }>;
}) {
  const profil = await ambilProfilSaya();
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const { hal, tabel = "semua", pelaku = "semua" } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);

  const supabase = await createClient();

  // Ambil daftar profil untuk dropdown penyaring pelaku
  const { data: semuaProfil } = await supabase
    .from("profiles")
    .select("id, nama, role")
    .order("nama");

  const profilMap = new Map<string, { nama: string; role: string }>();
  semuaProfil?.forEach((p) => profilMap.set(p.id, { nama: p.nama, role: p.role }));

  // Query audit logs dengan filter dan paginasi (20 baris per halaman)
  let kueri = supabase
    .from("audit_logs")
    .select("id, waktu, pelaku_id, pelaku_peran, aksi, tabel, data_id, sebelum, sesudah, alasan", {
      count: "exact",
    });

  if (tabel && tabel !== "semua") {
    kueri = kueri.eq("tabel", tabel);
  }

  if (pelaku && pelaku !== "semua") {
    kueri = kueri.eq("pelaku_id", pelaku);
  }

  const { data: logs, count, error } = await kueri
    .order("waktu", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-text">
            <ScrollText className="h-6 w-6 text-primary" />
            Audit Log
          </h1>
          <p className="text-sm text-text-muted">
            Riwayat lengkap perubahan sistem, status, stok, dan tagihan (khusus Owner).
          </p>
        </div>
      </div>

      {/* Form Penyaring Tabel dan Pelaku */}
      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-4" role="search">
          <div className="min-w-[180px] flex-1">
            <label htmlFor="tabel" className="mb-1.5 block text-xs font-medium text-text-body">
              Penyaring Tabel
            </label>
            <select
              id="tabel"
              name="tabel"
              defaultValue={tabel}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:border-primary focus:outline-hidden"
            >
              {DAFTAR_TABEL.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[180px] flex-1">
            <label htmlFor="pelaku" className="mb-1.5 block text-xs font-medium text-text-body">
              Penyaring Pelaku
            </label>
            <select
              id="pelaku"
              name="pelaku"
              defaultValue={pelaku}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:border-primary focus:outline-hidden"
            >
              <option value="semua">Semua Pelaku</option>
              {semuaProfil?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} ({p.role.replace("_", " ")})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <Button type="submit" variant="default" className="gap-1.5">
              <Filter className="h-4 w-4" />
              Terapkan
            </Button>
            {(tabel !== "semua" || pelaku !== "semua") && (
              <Button variant="outline" asChild>
                <a href="/audit-log">Reset</a>
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Tabel Audit Log */}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Waktu</TableHead>
              <TableHead>Pelaku</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Tabel & Data</TableHead>
              <TableHead>Alasan / Catatan</TableHead>
              <TableHead className="pr-4 text-right">Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-danger">
                  Gagal memuat log audit: {error.message}
                </TableCell>
              </TableRow>
            )}
            {!error && logs?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-text-muted">
                  <div className="flex flex-col items-center gap-1.5">
                    <History className="h-8 w-8 text-text-muted/60" />
                    <p>Belum ada riwayat audit log yang tercatat.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {logs?.map((log) => {
              const infoPelaku = log.pelaku_id ? profilMap.get(log.pelaku_id) : null;
              const namaPelaku = infoPelaku?.nama ?? (log.pelaku_peran ? `User (${log.pelaku_peran})` : "Sistem");
              const peranPelaku = log.pelaku_peran ?? infoPelaku?.role ?? null;

              return (
                <TableRow key={log.id} className="hover:bg-muted/40">
                  <TableCell className="pl-4 font-mono text-xs tabular-nums text-text-body whitespace-nowrap">
                    {tanggalWaktu(log.waktu)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-text">{namaPelaku}</div>
                    {peranPelaku && (
                      <span className="text-xs text-text-muted capitalize">
                        {peranPelaku.replace("_", " ")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.aksi === "INSERT"
                          ? "default"
                          : log.aksi === "DELETE"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-xs"
                    >
                      {log.aksi}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs font-semibold text-text">{log.tabel}</div>
                    {log.data_id && (
                      <div className="font-mono text-xs text-text-muted">ID: {log.data_id}</div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-text-body">
                    {log.alasan || "-"}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <DialogDetailAudit
                      id={log.id}
                      waktu={log.waktu}
                      pelakuNama={namaPelaku}
                      pelakuPeran={peranPelaku}
                      aksi={log.aksi}
                      tabel={log.tabel}
                      dataId={log.data_id}
                      alasan={log.alasan}
                      sebelum={log.sebelum}
                      sesudah={log.sesudah}
                    />
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
        params={{ tabel: tabel !== "semua" ? tabel : undefined, pelaku: pelaku !== "semua" ? pelaku : undefined }}
      />
    </div>
  );
}
