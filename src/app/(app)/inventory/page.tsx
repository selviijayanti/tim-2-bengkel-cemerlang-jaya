import Link from "next/link";
import { Search } from "lucide-react";
import { Paginasi } from "@/components/Paginasi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rupiah, tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormSparePart, type SparePartItem } from "./FormSparePart";
import { FormJasa, type JasaItem } from "./FormJasa";
import { FormStokMasuk } from "./FormStokMasuk";
import { FormSesuaikanStok } from "./FormSesuaikanStok";

const PER_HALAMAN = 20;

export default async function HalamanInventory({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    status?: string;
    hal?: string;
  }>;
}) {
  const { tab = "part", q = "", status = "semua", hal } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);
  const cari = q.replace(/[,()*%\\]/g, " ").trim();

  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  const isOwner = profil.peran === "owner";
  const isAdmin = profil.peran === "admin";
  const bolehTambah = isOwner || isAdmin;

  // --------------------------------------------------------------------------
  // TAB 1: SPARE PART
  // --------------------------------------------------------------------------
  if (tab === "part") {
    let parts: SparePartItem[] = [];
    let totalCount = 0;
    let adaError = false;

    // Hemat egress & kerahasiaan: kolom inventory_costs HANYA di-query jika peran adalah Owner
    if (isOwner) {
      let kueri = supabase
        .from("inventory_items")
        .select(
          "id, kode, nama, jenis, stok, stok_minimum, harga_jual, aktif, inventory_costs(harga_modal)",
          { count: "exact" }
        )
        .eq("jenis", "part");

      if (cari) {
        kueri = kueri.or(`nama.ilike.%${cari}%,kode.ilike.%${cari}%`);
      }
      if (status === "habis") {
        kueri = kueri.eq("stok", 0);
      }

      const { data, count, error } = await kueri
        .order("nama")
        .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

      if (error) adaError = true;
      totalCount = count ?? 0;
      parts = (data ?? []).map((p) => {
        const modal = Array.isArray(p.inventory_costs)
          ? p.inventory_costs[0]?.harga_modal
          : (p.inventory_costs as { harga_modal?: number } | null)?.harga_modal;

        return {
          id: p.id,
          kode: p.kode,
          nama: p.nama,
          stok: p.stok,
          stok_minimum: p.stok_minimum,
          harga_jual: Number(p.harga_jual),
          aktif: p.aktif,
          harga_modal: modal !== undefined && modal !== null ? Number(modal) : null,
        };
      });
    } else {
      let kueri = supabase
        .from("inventory_items")
        .select("id, kode, nama, jenis, stok, stok_minimum, harga_jual, aktif", {
          count: "exact",
        })
        .eq("jenis", "part");

      if (cari) {
        kueri = kueri.or(`nama.ilike.%${cari}%,kode.ilike.%${cari}%`);
      }
      if (status === "habis") {
        kueri = kueri.eq("stok", 0);
      }

      const { data, count, error } = await kueri
        .order("nama")
        .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

      if (error) adaError = true;
      totalCount = count ?? 0;
      parts = (data ?? []).map((p) => ({
        id: p.id,
        kode: p.kode,
        nama: p.nama,
        stok: p.stok,
        stok_minimum: p.stok_minimum,
        harga_jual: Number(p.harga_jual),
        aktif: p.aktif,
      }));
    }

    if (status === "menipis") {
      parts = parts.filter((p) => p.stok > 0 && p.stok <= p.stok_minimum);
    } else if (status === "aman") {
      parts = parts.filter((p) => p.stok > p.stok_minimum);
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text">Inventory</h1>
            <p className="text-sm text-muted-foreground">
              Kelola stok spare part, tarif jasa, dan riwayat pergerakan stok.
            </p>
          </div>
          {bolehTambah && <FormSparePart isOwner={isOwner} />}
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-border gap-6">
          <Link
            href="/inventory?tab=part"
            className="border-b-2 border-primary pb-3 font-semibold text-primary"
          >
            Spare Part
          </Link>
          <Link
            href="/inventory?tab=jasa"
            className="pb-3 text-muted-foreground hover:text-text"
          >
            Jasa
          </Link>
          <Link
            href="/inventory?tab=riwayat"
            className="pb-3 text-muted-foreground hover:text-text"
          >
            Riwayat Stok
          </Link>
        </div>

        {/* Form Pencarian & Filter Status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form className="flex max-w-md flex-1 gap-2" role="search">
            <input type="hidden" name="tab" value="part" />
            <input type="hidden" name="status" value={status} />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Cari nama atau kode spare part"
              aria-label="Cari spare part"
            />
            <Button type="submit" variant="outline">
              <Search className="h-4 w-4" />
              Cari
            </Button>
          </form>

          {/* Filter Status Badge */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground mr-1">Status:</span>
            {[
              { id: "semua", label: "Semua" },
              { id: "aman", label: "Aman" },
              { id: "menipis", label: "Menipis" },
              { id: "habis", label: "Habis" },
            ].map((s) => (
              <Link
                key={s.id}
                href={`/inventory?tab=part&status=${s.id}${cari ? `&q=${cari}` : ""}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  status === s.id
                    ? "bg-primary text-white"
                    : "bg-bg-app text-muted-foreground hover:bg-border"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Tabel Spare Part */}
        <Card className="py-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">SKU</TableHead>
                <TableHead>Nama Item</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Harga Jual</TableHead>
                {isOwner && <TableHead className="text-right">Harga Modal</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adaError && (
                <TableRow>
                  <TableCell
                    colSpan={isOwner ? 8 : 7}
                    className="py-10 text-center text-danger"
                  >
                    Gagal memuat data spare part. Muat ulang halaman ini.
                  </TableCell>
                </TableRow>
              )}
              {!adaError && parts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isOwner ? 8 : 7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {cari
                      ? `Tidak ada spare part yang cocok dengan "${cari}".`
                      : "Belum ada data spare part."}
                  </TableCell>
                </TableRow>
              )}
              {parts.map((p) => {
                const statusBadge =
                  p.stok === 0 ? (
                    <Badge variant="destructive">Habis</Badge>
                  ) : p.stok <= p.stok_minimum ? (
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none">
                      Menipis
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                      Aman
                    </Badge>
                  );

                return (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4 font-mono text-xs text-muted-foreground">
                      {p.kode}
                    </TableCell>
                    <TableCell className="font-medium text-text">
                      {p.nama}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {p.stok}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {p.stok_minimum}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {rupiah(p.harga_jual)}
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.harga_modal !== null && p.harga_modal !== undefined ? (
                          rupiah(p.harga_modal)
                        ) : (
                          <span className="text-xs text-amber-600 italic">
                            Belum diisi
                          </span>
                        )}

                      </TableCell>
                    )}
                    <TableCell>{statusBadge}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {bolehTambah && (
                          <FormStokMasuk
                            item={{ id: p.id, nama: p.nama, kode: p.kode, stok: p.stok }}
                          />
                        )}
                        {isOwner && (
                          <FormSesuaikanStok
                            item={{ id: p.id, nama: p.nama, kode: p.kode, stok: p.stok }}
                          />
                        )}
                        {isOwner && (
                          <FormSparePart
                            item={p}
                            isOwner={isOwner}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        <Paginasi
          halaman={halaman}
          totalBaris={totalCount}
          perHalaman={PER_HALAMAN}
          params={{ tab: "part", q: cari, status }}
        />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // TAB 2: JASA
  // --------------------------------------------------------------------------
  if (tab === "jasa") {
    let kueri = supabase
      .from("inventory_items")
      .select("id, kode, nama, harga_jual, aktif", { count: "exact" })
      .eq("jenis", "jasa");

    if (cari) {
      kueri = kueri.or(`nama.ilike.%${cari}%,kode.ilike.%${cari}%`);
    }

    const { data: jasa, count, error } = await kueri
      .order("nama")
      .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text">Inventory</h1>
            <p className="text-sm text-muted-foreground">
              Daftar layanan servis dan tarif baku bengkel.
            </p>
          </div>
          {bolehTambah && <FormJasa />}
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-border gap-6">
          <Link
            href="/inventory?tab=part"
            className="pb-3 text-muted-foreground hover:text-text"
          >
            Spare Part
          </Link>
          <Link
            href="/inventory?tab=jasa"
            className="border-b-2 border-primary pb-3 font-semibold text-primary"
          >
            Jasa
          </Link>
          <Link
            href="/inventory?tab=riwayat"
            className="pb-3 text-muted-foreground hover:text-text"
          >
            Riwayat Stok
          </Link>
        </div>

        {/* Form Pencarian */}
        <form className="flex max-w-md gap-2" role="search">
          <input type="hidden" name="tab" value="jasa" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Cari nama atau kode jasa"
            aria-label="Cari jasa"
          />
          <Button type="submit" variant="outline">
            <Search className="h-4 w-4" />
            Cari
          </Button>
        </form>

        {/* Tabel Jasa */}
        <Card className="py-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Kode</TableHead>
                <TableHead>Nama Layanan Jasa</TableHead>
                <TableHead className="text-right">Tarif</TableHead>
                <TableHead>Status</TableHead>
                {isOwner && <TableHead className="pr-4 text-right">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {error && (
                <TableRow>
                  <TableCell
                    colSpan={isOwner ? 5 : 4}
                    className="py-10 text-center text-danger"
                  >
                    Gagal memuat data jasa. Muat ulang halaman ini.
                  </TableCell>
                </TableRow>
              )}
              {!error && jasa?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isOwner ? 5 : 4}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {cari
                      ? `Tidak ada jasa yang cocok dengan "${cari}".`
                      : "Belum ada data layanan jasa."}
                  </TableCell>
                </TableRow>
              )}
              {jasa?.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="pl-4 font-mono text-xs text-muted-foreground">
                    {j.kode}
                  </TableCell>
                  <TableCell className="font-medium text-text">{j.nama}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {rupiah(Number(j.harga_jual))}
                  </TableCell>
                  <TableCell>
                    {j.aktif ? (
                      <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Nonaktif
                      </Badge>
                    )}
                  </TableCell>
                  {isOwner && (
                    <TableCell className="pr-4 text-right">
                      <FormJasa item={j as JasaItem} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Paginasi
          halaman={halaman}
          totalBaris={count ?? 0}
          perHalaman={PER_HALAMAN}
          params={{ tab: "jasa", q: cari }}
        />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // TAB 3: RIWAYAT STOK
  // --------------------------------------------------------------------------
  let kueriRiwayat = supabase
    .from("stock_movements")
    .select(
      "id, created_at, jenis, jumlah, stok_sesudah, keterangan, inventory_items(kode, nama), work_orders(nomor), profiles(nama)",
      { count: "exact" }
    );

  if (cari) {
    kueriRiwayat = kueriRiwayat.ilike("keterangan", `%${cari}%`);
  }

  const { data: riwayat, count: totalRiwayat, error: errRiwayat } = await kueriRiwayat
    .order("created_at", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Riwayat lengkap pergerakan stok spare part (masuk, keluar, penyesuaian, kembali).
          </p>
        </div>
      </div>

      {/* Tab Navigasi */}
      <div className="flex border-b border-border gap-6">
        <Link
          href="/inventory?tab=part"
          className="pb-3 text-muted-foreground hover:text-text"
        >
          Spare Part
        </Link>
        <Link
          href="/inventory?tab=jasa"
          className="pb-3 text-muted-foreground hover:text-text"
        >
          Jasa
        </Link>
        <Link
          href="/inventory?tab=riwayat"
          className="border-b-2 border-primary pb-3 font-semibold text-primary"
        >
          Riwayat Stok
        </Link>
      </div>

      {/* Form Pencarian Keterangan */}
      <form className="flex max-w-md gap-2" role="search">
        <input type="hidden" name="tab" value="riwayat" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Cari keterangan riwayat stok"
          aria-label="Cari riwayat"
        />
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" />
          Cari
        </Button>
      </form>

      {/* Tabel Riwayat Stok */}
      <Card className="py-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Tanggal</TableHead>
              <TableHead>Item Spare Part</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead className="text-right">Stok Sesudah</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead>No. WO</TableHead>
              <TableHead className="pr-4">Dicatat Oleh</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errRiwayat && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-danger">
                  Gagal memuat riwayat stok. Muat ulang halaman ini.
                </TableCell>
              </TableRow>
            )}
            {!errRiwayat && riwayat?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  Belum ada catatan pergerakan stok.
                </TableCell>
              </TableRow>
            )}
            {riwayat?.map((r) => {
              const item = r.inventory_items as { kode: string; nama: string } | null;
              const wo = r.work_orders as { nomor: string } | null;
              const pencatat = r.profiles as { nama: string } | null;

              let badgeJenis;
              if (r.jenis === "masuk") {
                badgeJenis = (
                  <Badge className="bg-primary text-white border-none">
                    Masuk
                  </Badge>
                );
              } else if (r.jenis === "keluar") {
                badgeJenis = (
                  <Badge variant="destructive">
                    Keluar
                  </Badge>
                );
              } else if (r.jenis === "penyesuaian") {
                badgeJenis = (
                  <Badge className="bg-amber-500 text-white border-none">
                    Penyesuaian
                  </Badge>
                );
              } else {
                badgeJenis = (
                  <Badge variant="secondary">
                    Kembali
                  </Badge>
                );
              }

              return (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 text-xs tabular-nums text-muted-foreground">
                    {tanggal(r.created_at)}
                  </TableCell>
                  <TableCell className="font-medium text-text">
                    {item ? (
                      <div>
                        <span>{item.nama}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {item.kode}
                        </span>
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{badgeJenis}</TableCell>
                  <TableCell
                    className={`text-right font-semibold tabular-nums ${
                      r.jumlah > 0
                        ? "text-success"
                        : r.jumlah < 0
                        ? "text-danger"
                        : ""
                    }`}
                  >
                    {r.jumlah > 0 ? `+${r.jumlah}` : r.jumlah}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {r.stok_sesudah}
                  </TableCell>
                  <TableCell className="text-sm text-text-body">
                    {r.keterangan || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {wo?.nomor ? (
                      <span className="text-primary font-medium">{wo.nomor}</span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-sm text-muted-foreground">
                    {pencatat?.nama || "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Paginasi
        halaman={halaman}
        totalBaris={totalRiwayat ?? 0}
        perHalaman={PER_HALAMAN}
        params={{ tab: "riwayat", q: cari }}
      />
    </div>
  );
}
