"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Edit2, AlertCircle, CheckCircle2, Receipt, CreditCard, ExternalLink, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { rupiah, tanggal } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { BillingItem, InventoryItem, Invoice, WorkOrder } from "./types";

interface ClientTagihanViewProps {
  wo: WorkOrder;
  billingItems: BillingItem[];
  invoice: Invoice | null;
  inventoryOptions: InventoryItem[];
  peran: string;
  userId: string;
}

const ALASAN_PENYESUAIAN_OPTIONS = [
  "Harga khusus pelanggan",
  "Negosiasi",
  "Harga paket",
  "Koreksi harga master",
  "Lainnya",
];

export function ClientTagihanView({
  wo,
  billingItems: initialBillingItems,
  invoice: initialInvoice,
  inventoryOptions,
  peran,
  userId,
}: ClientTagihanViewProps) {
  const router = useRouter();
  const supabase = createClient();

  // State
  const [pesanError, setPesanError] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);

  // Dialog Tambah Item
  const [dialogTambahBuka, setDialogTambahBuka] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [jumlahItem, setJumlahItem] = useState<number>(1);

  // Dialog Penyesuaian Harga
  const [dialogHargaBuka, setDialogHargaBuka] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<BillingItem | null>(null);
  const [hargaDipakaiInput, setHargaDipakaiInput] = useState<number>(0);
  const [alasanPilihan, setAlasanPilihan] = useState<string>("");
  const [alasanKustom, setAlasanKustom] = useState<string>("");
  const [peringatanModal, setPeringatanModal] = useState(false);

  // Dialog Info Penyesuaian
  const [dialogInfoBuka, setDialogInfoBuka] = useState(false);
  const [itemInfo, setItemInfo] = useState<BillingItem | null>(null);

  // Dialog Diskon
  const [dialogDiskonBuka, setDialogDiskonBuka] = useState(false);
  const [diskonInput, setDiskonInput] = useState<number>(wo.diskon || 0);
  const [alasanDiskonInput, setAlasanDiskonInput] = useState<string>(wo.alasan_diskon || "");

  // Dialog Pembayaran
  const [dialogBayarBuka, setDialogBayarBuka] = useState(false);
  const [metodeBayar, setMetodeBayar] = useState<"tunai" | "transfer" | "qris">("tunai");
  const [jumlahBayar, setJumlahBayar] = useState<number>(0);

  // Akses & Aturan
  const isOwner = peran === "owner";
  const isAdmin = peran === "admin";
  const isKepalaMekanikTim = peran === "kepala_mekanik" && wo.kepala_mekanik_id === userId;
  const bolehKelolaItem = (isOwner || isKepalaMekanikTim) && wo.status === "dikerjakan";
  const bolehKelolaHarga = (isOwner || isAdmin) && !initialInvoice;
  const bolehTerbitkanInvoice = (isOwner || isAdmin) && wo.status === "siap_diambil" && !initialInvoice;
  const bolehCatatBayar = (isOwner || isAdmin) && !!initialInvoice && initialInvoice.status_bayar !== "lunas";

  // Perhitungan Subtotal
  const subtotal = initialBillingItems.reduce((acc, item) => acc + item.jumlah * item.harga_dipakai, 0);
  const diskon = initialInvoice ? initialInvoice.diskon : wo.diskon || 0;
  const total = initialInvoice ? initialInvoice.total : Math.max(0, subtotal - diskon);
  const terbayar = initialInvoice ? initialInvoice.terbayar : 0;
  const sisa = Math.max(0, total - terbayar);

  // Perhitungan Laba untuk Owner
  const totalModal = initialBillingItems.reduce((acc, item) => {
    const cost = item.billing_item_costs?.[0]?.harga_modal || 0;
    return acc + cost * item.jumlah;
  }, 0);
  const labaWO = total - totalModal;

  const bersihkanPesan = () => {
    setPesanError(null);
    setPesanSukses(null);
  };

  // 1. Tambah Item Tagihan
  const handleTambahItem = async () => {
    bersihkanPesan();
    if (!selectedItemId) {
      setPesanError("Pilih item spare part atau jasa terlebih dahulu.");
      return;
    }
    if (jumlahItem < 1) {
      setPesanError("Jumlah item minimal 1.");
      return;
    }

    setMemproses(true);
    try {
      const { error } = await supabase.rpc("tambah_item_tagihan", {
        p_wo: wo.id,
        p_item: selectedItemId,
        p_jumlah: jumlahItem,
      });

      if (error) throw error;

      setPesanSukses("Item tagihan berhasil ditambahkan.");
      setDialogTambahBuka(false);
      setSelectedItemId("");
      setJumlahItem(1);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menambahkan item tagihan";
      setPesanError(pesan);
    } finally {
      setMemproses(false);
    }
  };

  // 2. Hapus Item Tagihan
  const handleHapusItem = async (itemId: string, namaItem: string) => {
    bersihkanPesan();
    if (!confirm(`Hapus ${namaItem} dari tagihan? Stok spare part akan dikembalikan.`)) return;

    setMemproses(true);
    try {
      const { error } = await supabase.rpc("hapus_item_tagihan", {
        p_billing_item: itemId,
      });

      if (error) throw error;

      setPesanSukses(`Item ${namaItem} berhasil dihapus.`);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menghapus item";
      setPesanError(pesan);
    } finally {
      setMemproses(false);
    }
  };

  // 3. Buka Dialog Sesuaikan Harga
  const bukaDialogHarga = (item: BillingItem) => {
    setItemToEdit(item);
    setHargaDipakaiInput(item.harga_dipakai);
    setAlasanPilihan(ALASAN_PENYESUAIAN_OPTIONS.includes(item.alasan_penyesuaian || "") ? (item.alasan_penyesuaian || "") : "Lainnya");
    setAlasanKustom(ALASAN_PENYESUAIAN_OPTIONS.includes(item.alasan_penyesuaian || "") ? "" : (item.alasan_penyesuaian || ""));
    setPeringatanModal(false);
    setDialogHargaBuka(true);
  };

  // Simpan Penyesuaian Harga
  const handleSimpanHarga = async () => {
    if (!itemToEdit) return;
    bersihkanPesan();

    const alasanFinal = alasanPilihan === "Lainnya" ? alasanKustom.trim() : alasanPilihan;
    if (!alasanFinal) {
      setPesanError("Alasan penyesuaian harga wajib diisi.");
      return;
    }
    if (hargaDipakaiInput < 0) {
      setPesanError("Harga tidak boleh negatif.");
      return;
    }

    setMemproses(true);
    try {
      const { data: diBawahModal, error } = await supabase.rpc("sesuaikan_harga_item", {
        p_billing_item: itemToEdit.id,
        p_harga: hargaDipakaiInput,
        p_alasan: alasanFinal,
      });

      if (error) throw error;

      if (diBawahModal) {
        setPeringatanModal(true);
        setPesanSukses("Harga berhasil disesuaikan (Peringatan: Harga ini di bawah harga modal).");
      } else {
        setPesanSukses("Harga item berhasil disesuaikan.");
      }

      setDialogHargaBuka(false);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menyesuaikan harga";
      setPesanError(pesan);
    } finally {
      setMemproses(false);
    }
  };

  // 4. Simpan Diskon
  const handleSimpanDiskon = async () => {
    bersihkanPesan();
    if (diskonInput < 0) {
      setPesanError("Diskon tidak boleh negatif.");
      return;
    }
    if (diskonInput > subtotal) {
      setPesanError("Diskon tidak boleh melebihi subtotal.");
      return;
    }
    if (diskonInput > 0 && !alasanDiskonInput.trim()) {
      setPesanError("Alasan wajib diisi jika diskon lebih dari Rp0.");
      return;
    }

    setMemproses(true);
    try {
      const { error } = await supabase.rpc("atur_diskon", {
        p_wo: wo.id,
        p_diskon: diskonInput,
        p_alasan: diskonInput > 0 ? alasanDiskonInput.trim() : "",
      });

      if (error) throw error;

      setPesanSukses("Diskon berhasil diperbarui.");
      setDialogDiskonBuka(false);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal mengatur diskon";
      setPesanError(pesan);
    } finally {
      setMemproses(false);
    }
  };

  // 5. Terbitkan Invoice
  const handleTerbitkanInvoice = async () => {
    bersihkanPesan();
    if (!confirm("Terbitkan invoice untuk Work Order ini? Setelah terbit, rincian tagihan dan diskon tidak dapat diubah lagi.")) {
      return;
    }

    setMemproses(true);
    try {
      const { error } = await supabase.rpc("terbitkan_invoice", {
        p_wo: wo.id,
      });

      if (error) throw error;

      setPesanSukses("Invoice berhasil diterbitkan.");
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menerbitkan invoice";
      setPesanError(pesan);
    } finally {
      setMemproses(false);
    }
  };

  // 6. Catat Pembayaran
  const handleCatatPembayaran = async () => {
    if (!initialInvoice) return;
    bersihkanPesan();

    if (jumlahBayar <= 0) {
      setPesanError("Jumlah pembayaran harus lebih dari Rp0.");
      return;
    }
    if (jumlahBayar > sisa) {
      setPesanError(`Jumlah pembayaran tidak boleh melebihi sisa tagihan (${rupiah(sisa)}).`);
      return;
    }

    setMemproses(true);
    try {
      const { error } = await supabase.rpc("catat_pembayaran", {
        p_invoice: initialInvoice.id,
        p_metode: metodeBayar,
        p_jumlah: jumlahBayar,
      });

      if (error) throw error;

      setPesanSukses("Pembayaran berhasil dicatat.");
      setDialogBayarBuka(false);
      setJumlahBayar(0);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal mencatat pembayaran";
      setPesanError(pesan);
    } finally {
      setMemproses(false);
    }
  };

  const selectedItemDetail = inventoryOptions.find((i) => i.id === selectedItemId);

  return (
    <div className="space-y-6">
      {/* Alert Notifikasi */}
      {pesanError && (
        <div className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          <AlertCircle className="size-5 shrink-0" />
          <span>{pesanError}</span>
        </div>
      )}
      {pesanSukses && (
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{pesanSukses}</span>
        </div>
      )}
      {peringatanModal && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          <AlertCircle className="size-5 shrink-0" />
          <span>Perhatian: Harga yang baru disimpan berada di bawah harga modal item.</span>
        </div>
      )}

      {/* Header Tagihan & Invoice Status */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-text">Tagihan #{wo.nomor}</h2>
            {initialInvoice ? (
              <Badge
                variant={
                  initialInvoice.status_bayar === "lunas"
                    ? "default"
                    : initialInvoice.status_bayar === "sebagian"
                    ? "secondary"
                    : "outline"
                }
                className="capitalize"
              >
                Invoice: {initialInvoice.status_bayar.replace("_", " ")} ({initialInvoice.nomor})
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Invoice Belum Terbit
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Kendaraan: <span className="font-semibold text-text">{wo.vehicle?.plat || "-"}</span> ({wo.vehicle?.merek_model || "-"}) · Pelanggan:{" "}
            <span className="font-semibold text-text">{wo.customer?.nama || "-"}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {bolehKelolaItem && (
            <Button onClick={() => setDialogTambahBuka(true)} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="size-4" />
              Tambah Item (Part / Jasa)
            </Button>
          )}

          {bolehTerbitkanInvoice && (
            <Button
              onClick={handleTerbitkanInvoice}
              disabled={memproses || initialBillingItems.length === 0}
              className="gap-2 bg-primary-strong text-white hover:bg-primary-strong/90"
            >
              <Receipt className="size-4" />
              Terbitkan Invoice
            </Button>
          )}

          {initialInvoice && (
            <>
              <Link href={`/work-orders/${wo.id}/invoice`} target="_blank">
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="size-4" />
                  Lihat / Cetak Invoice
                </Button>
              </Link>

              {bolehCatatBayar && (
                <Button
                  onClick={() => {
                    setJumlahBayar(sisa);
                    setDialogBayarBuka(true);
                  }}
                  className="gap-2 bg-success text-white hover:bg-success/90"
                >
                  <CreditCard className="size-4" />
                  + Catat Pembayaran
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabel Baris Tagihan */}
      <Card className="shadow-card">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Daftar Item & Jasa</CardTitle>
              <CardDescription>
                {initialInvoice
                  ? "Tagihan telah dikunci karena invoice sudah terbit."
                  : "Kepala Mekanik menambah/menghapus item saat dikerjakan. Admin/Owner dapat menyesuaikan harga."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40px] text-center">#</TableHead>
                <TableHead>Item / Jasa</TableHead>
                <TableHead className="w-[100px]">Jenis</TableHead>
                <TableHead className="w-[90px] text-center">Jumlah</TableHead>
                <TableHead className="w-[140px] text-right">Harga Master</TableHead>
                <TableHead className="w-[160px] text-right">Harga Dipakai</TableHead>
                {isOwner && <TableHead className="w-[140px] text-right">Harga Modal</TableHead>}
                {isOwner && <TableHead className="w-[140px] text-right">Laba</TableHead>}
                <TableHead className="w-[150px] text-right">Subtotal</TableHead>
                <TableHead className="w-[90px] text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialBillingItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isOwner ? 10 : 8} className="py-8 text-center text-muted-foreground">
                    Belum ada item atau jasa yang ditambahkan pada Work Order ini.
                  </TableCell>
                </TableRow>
              ) : (
                initialBillingItems.map((item, idx) => {
                  const subtotalBaris = item.jumlah * item.harga_dipakai;
                  const isDisesuaikan = item.harga_dipakai !== item.harga_master;
                  const modalBaris = item.billing_item_costs?.[0]?.harga_modal || 0;
                  const labaBaris = (item.harga_dipakai - modalBaris) * item.jumlah;

                  return (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="text-center font-medium text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-text">{item.nama_item}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={item.jenis === "part" ? "border-primary/40 text-primary" : "border-muted-foreground/40 text-muted-foreground"}>
                          {item.jenis === "part" ? "Spare Part" : "Jasa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold">{item.jumlah}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{rupiah(item.harga_master)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5 font-medium">
                          <span>{rupiah(item.harga_dipakai)}</span>
                          {isDisesuaikan && (
                            <button
                              type="button"
                              onClick={() => {
                                setItemInfo(item);
                                setDialogInfoBuka(true);
                              }}
                              title="Lihat alasan penyesuaian"
                              className="text-amber-500 hover:text-amber-600 focus:outline-none"
                            >
                              <Info className="size-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      {isOwner && (
                        <TableCell className="text-right text-muted-foreground">
                          {item.jenis === "part" ? rupiah(modalBaris) : "-"}
                        </TableCell>
                      )}
                      {isOwner && (
                        <TableCell className={`text-right font-medium ${labaBaris < 0 ? "text-danger" : "text-success"}`}>
                          {rupiah(labaBaris)}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-semibold text-text">{rupiah(subtotalBaris)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {bolehKelolaHarga && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => bukaDialogHarga(item)}
                              title="Sesuaikan Harga"
                              className="size-8 text-muted-foreground hover:text-text"
                            >
                              <Edit2 className="size-4" />
                            </Button>
                          )}
                          {bolehKelolaItem && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleHapusItem(item.id, item.nama_item)}
                              title="Hapus Item"
                              className="size-8 text-danger hover:bg-danger/10"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ringkasan Tagihan & Status Pembayaran */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kolom Kiri: Catatan & Diskon */}
        <Card className="shadow-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-semibold">Pengaturan Diskon</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text">Diskon Diterapkan:</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {diskon > 0 ? (wo.alasan_diskon ? `Alasan: ${wo.alasan_diskon}` : "Tanpa alasan tersimpan") : "Tidak ada diskon"}
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-text">{rupiah(diskon)}</span>
              </div>
            </div>

            {bolehKelolaHarga && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDiskonInput(wo.diskon || 0);
                  setAlasanDiskonInput(wo.alasan_diskon || "");
                  setDialogDiskonBuka(true);
                }}
                className="w-full"
              >
                {diskon > 0 ? "Ubah Diskon" : "+ Beri Diskon"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Kolom Kanan: Total & Sisa Tagihan */}
        <Card className="shadow-card border-border">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-semibold">Ringkasan Tagihan</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium text-text">{rupiah(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Diskon</span>
              <span className="font-medium text-danger">-{rupiah(diskon)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between text-base font-bold text-text">
              <span>Total Tagihan</span>
              <span>{rupiah(total)}</span>
            </div>
            {initialInvoice && (
              <>
                <div className="flex justify-between text-sm pt-1">
                  <span className="text-muted-foreground">Sudah Dibayar</span>
                  <span className="font-medium text-success">{rupiah(terbayar)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-base font-bold">
                  <span className="text-text">Sisa Pembayaran</span>
                  <span className={sisa > 0 ? "text-danger" : "text-success"}>{rupiah(sisa)}</span>
                </div>
              </>
            )}

            {isOwner && (
              <div className="mt-4 border-t border-dashed border-border pt-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total Biaya Modal (Part):</span>
                  <span>{rupiah(totalModal)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold mt-1">
                  <span className="text-primary-strong">Laba Kotor WO:</span>
                  <span className={labaWO >= 0 ? "text-success" : "text-danger"}>{rupiah(labaWO)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DIALOG 1: Tambah Item Tagihan */}
      <Dialog open={dialogTambahBuka} onOpenChange={setDialogTambahBuka}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Tambah Spare Part / Jasa</DialogTitle>
            <DialogDescription>Pilih item dari data master dan masukkan jumlah yang digunakan.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="itemSelect">Pilih Item *</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger id="itemSelect">
                  <SelectValue placeholder="Pilih spare part atau jasa..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {inventoryOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      [{opt.jenis === "part" ? "Part" : "Jasa"}] {opt.nama} - {rupiah(opt.harga_jual)}
                      {opt.jenis === "part" ? ` (Stok: ${opt.stok})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedItemDetail && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <div>
                  <span className="text-muted-foreground">Harga Jual Master:</span>{" "}
                  <span className="font-semibold">{rupiah(selectedItemDetail.harga_jual)}</span>
                </div>
                {selectedItemDetail.jenis === "part" && (
                  <div>
                    <span className="text-muted-foreground">Stok Tersedia:</span>{" "}
                    <span className={`font-semibold ${selectedItemDetail.stok < 1 ? "text-danger" : "text-success"}`}>
                      {selectedItemDetail.stok} unit
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="jumlahInput">Jumlah *</Label>
              <Input
                id="jumlahInput"
                type="number"
                min="1"
                value={jumlahItem}
                onChange={(e) => setJumlahItem(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTambahBuka(false)} disabled={memproses}>
              Batal
            </Button>
            <Button onClick={handleTambahItem} disabled={memproses || !selectedItemId} className="bg-primary text-primary-foreground">
              {memproses ? "Menambahkan..." : "Tambah ke Tagihan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Sesuaikan Harga Item */}
      <Dialog open={dialogHargaBuka} onOpenChange={setDialogHargaBuka}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Sesuaikan Harga Item</DialogTitle>
            <DialogDescription>Ubah harga yang dipakai untuk item: {itemToEdit?.nama_item}. Harga master tidak berubah.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="rounded-lg bg-muted/40 p-3 text-xs">
              <span className="text-muted-foreground">Harga Master Saat Ini:</span>{" "}
              <span className="font-semibold">{itemToEdit ? rupiah(itemToEdit.harga_master) : "-"}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hargaBaru">Harga Dipakai Baru (Rp) *</Label>
              <Input
                id="hargaBaru"
                type="number"
                min="0"
                value={hargaDipakaiInput}
                onChange={(e) => setHargaDipakaiInput(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alasanSelect">Alasan Penyesuaian *</Label>
              <Select value={alasanPilihan} onValueChange={setAlasanPilihan}>
                <SelectTrigger id="alasanSelect">
                  <SelectValue placeholder="Pilih alasan penyesuaian..." />
                </SelectTrigger>
                <SelectContent>
                  {ALASAN_PENYESUAIAN_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {alasanPilihan === "Lainnya" && (
              <div className="space-y-2">
                <Label htmlFor="alasanKustom">Tuliskan Alasan *</Label>
                <Input
                  id="alasanKustom"
                  placeholder="Ketikkan alasan penyesuaian..."
                  value={alasanKustom}
                  onChange={(e) => setAlasanKustom(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogHargaBuka(false)} disabled={memproses}>
              Batal
            </Button>
            <Button onClick={handleSimpanHarga} disabled={memproses} className="bg-primary text-primary-foreground">
              {memproses ? "Menyimpan..." : "Simpan Penyesuaian"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Info Penyesuaian Harga */}
      <Dialog open={dialogInfoBuka} onOpenChange={setDialogInfoBuka}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Detail Penyesuaian Harga</DialogTitle>
          </DialogHeader>
          {itemInfo && (
            <div className="space-y-3 py-2 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">Item:</span>
                <span className="font-semibold text-text">{itemInfo.nama_item}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground block text-xs">Harga Master:</span>
                  <span>{rupiah(itemInfo.harga_master)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Harga Dipakai:</span>
                  <span className="font-semibold text-primary">{rupiah(itemInfo.harga_dipakai)}</span>
                </div>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs space-y-1">
                <span className="font-semibold text-amber-700 dark:text-amber-300 block">Alasan Penyesuaian:</span>
                <p className="text-text">{itemInfo.alasan_penyesuaian || "Tidak ada keterangan"}</p>
              </div>
              {itemInfo.disesuaikan_at && (
                <div className="text-xs text-muted-foreground">
                  Disesuaikan pada: {tanggal(itemInfo.disesuaikan_at)}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDialogInfoBuka(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: Atur Diskon */}
      <Dialog open={dialogDiskonBuka} onOpenChange={setDialogDiskonBuka}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Atur Diskon Total</DialogTitle>
            <DialogDescription>Diskon akan mengurangi total tagihan Work Order ini.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="diskonInput">Nominal Diskon (Rp)</Label>
              <Input
                id="diskonInput"
                type="number"
                min="0"
                max={subtotal}
                value={diskonInput}
                onChange={(e) => setDiskonInput(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <span className="text-xs text-muted-foreground">Maksimal subtotal: {rupiah(subtotal)}</span>
            </div>

            {diskonInput > 0 && (
              <div className="space-y-2">
                <Label htmlFor="alasanDiskon">Alasan Diskon *</Label>
                <Input
                  id="alasanDiskon"
                  placeholder="Misal: Promo pelanggan setia / Kupon servis"
                  value={alasanDiskonInput}
                  onChange={(e) => setAlasanDiskonInput(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDiskonBuka(false)} disabled={memproses}>
              Batal
            </Button>
            <Button onClick={handleSimpanDiskon} disabled={memproses} className="bg-primary text-primary-foreground">
              {memproses ? "Menyimpan..." : "Terapkan Diskon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: Catat Pembayaran */}
      <Dialog open={dialogBayarBuka} onOpenChange={setDialogBayarBuka}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran</DialogTitle>
            <DialogDescription>Nomor Invoice: {initialInvoice?.nomor}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="rounded-lg bg-muted/40 p-3 text-xs flex justify-between items-center">
              <span className="text-muted-foreground">Sisa Pembayaran:</span>
              <span className="font-bold text-sm text-danger">{rupiah(sisa)}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metodeSelect">Metode Pembayaran *</Label>
              <Select value={metodeBayar} onValueChange={(val) => setMetodeBayar(val as "tunai" | "transfer" | "qris")}>
                <SelectTrigger id="metodeSelect">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tunai">Tunai</SelectItem>
                  <SelectItem value="transfer">Transfer Bank</SelectItem>
                  <SelectItem value="qris">QRIS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jumlahBayar">Jumlah Bayar (Rp) *</Label>
              <Input
                id="jumlahBayar"
                type="number"
                min="1"
                max={sisa}
                value={jumlahBayar}
                onChange={(e) => setJumlahBayar(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Status setelah bayar:</span>
                <span className="font-semibold text-text">
                  {jumlahBayar >= sisa ? "LUNAS" : "SEBAGIAN"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogBayarBuka(false)} disabled={memproses}>
              Batal
            </Button>
            <Button onClick={handleCatatPembayaran} disabled={memproses || jumlahBayar <= 0} className="bg-success text-white hover:bg-success/90">
              {memproses ? "Menyimpan..." : "Simpan Pembayaran"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
