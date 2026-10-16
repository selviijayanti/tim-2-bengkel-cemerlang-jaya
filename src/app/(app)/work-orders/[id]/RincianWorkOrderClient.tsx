"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Wrench,
  User,
  Car,
  Clock,
  CheckCircle,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  XCircle,
  Send,
  Upload,
  Loader2,
  Calendar,
  Phone,
  MessageCircle,
  Edit2,
  X,
  Camera,
} from "lucide-react";
import { BadgeStatus } from "@/components/BadgeStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { tanggal } from "@/lib/format";
import { unggahFotoWO } from "@/lib/foto";
import type { Peran } from "@/lib/peran";
import { createClient } from "@/lib/supabase/client";

interface FotoInfo {
  id: string;
  jenis: string;
  path: string;
  urlPenuh: string;
  urlThumb: string;
  created_at: string;
}

interface MekanikItem {
  id: string;
  nama: string;
  woAktif: number;
}

interface RiwayatItem {
  id: number;
  dari_status: string | null;
  ke_status: string;
  catatan: string | null;
  created_at: string;
  pelaku: {
    nama: string;
    role: string;
  } | null;
}

interface WorkOrderData {
  id: string;
  nomor: string;
  status: string;
  odometer: number;
  keluhan: string;
  diagnosis: string | null;
  estimasi_selesai: string | null;
  catatan_status: string | null;
  created_at: string;
  selesai_at: string | null;
  diambil_at: string | null;
  kepala_mekanik_id: string;
  kepala_mekanik: { id: string; nama: string };
  vehicle: {
    id: string;
    plat: string;
    merek_model: string;
    tahun: number | null;
    warna: string | null;
    transmisi: string | null;
  };
  customer: {
    id: string;
    nama: string;
    telepon: string;
    alamat: string | null;
    tipe: string;
  };
  mekanik_terpilih: { id: string; nama: string }[];
  jumlah_item_tagihan: number;
  invoice: { id: string; nomor: string; status_bayar: string; total: number } | null;
  photos: FotoInfo[];
  history: RiwayatItem[];
}

export function RincianWorkOrderClient({
  wo,
  profil,
  mekanikTim,
  daftarKepala,
}: {
  wo: WorkOrderData;
  profil: { id: string; nama: string; peran: Peran };
  mekanikTim: MekanikItem[];
  daftarKepala: { id: string; nama: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  // State untuk modal dialog aksi status
  const [modalStatus, setModalStatus] = useState<string | null>(null);
  const [catatanAksi, setCatatanAksi] = useState("");
  const [errorPesan, setErrorPesan] = useState<string | null>(null);

  // State untuk zoom foto
  const [fotoZoom, setFotoZoom] = useState<string | null>(null);

  // State untuk penugasan mekanik (saat menunggu)
  const [selectedMekanik, setSelectedMekanik] = useState<string[]>(
    wo.mekanik_terpilih.map((m) => m.id),
  );
  const [estimasiSelesai, setEstimasiSelesai] = useState<string>(
    wo.estimasi_selesai ? wo.estimasi_selesai.split("T")[0] : "",
  );

  // State untuk edit data masuk (Admin/Owner saat menunggu)
  const [bukaEditMasuk, setBukaEditMasuk] = useState(false);
  const [editOdometer, setEditOdometer] = useState<number>(wo.odometer);
  const [editKeluhan, setEditKeluhan] = useState<string>(wo.keluhan);
  const [editKepalaId, setEditKepalaId] = useState<string>(wo.kepala_mekanik_id);

  // State untuk diagnosis (Kepala Mekanik tim / Owner saat dikerjakan/tertunda)
  const [bukaEditDiagnosis, setBukaEditDiagnosis] = useState(false);
  const [editDiagnosis, setEditDiagnosis] = useState<string>(wo.diagnosis || "");

  // State untuk upload foto pengerjaan & foto kondisi akhir
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [fotoKondisiAkhirFile, setFotoKondisiAkhirFile] = useState<File | null>(null);

  // Evaluasi hak akses peran
  const isOwner = profil.peran === "owner";
  const isAdmin = profil.peran === "admin";
  const isKepalaMekanikTim =
    profil.peran === "kepala_mekanik" && profil.id === wo.kepala_mekanik_id;

  const bolehAksiTim = isOwner || isKepalaMekanikTim;
  const bolehAksiAdmin = isOwner || isAdmin;

  // Status Terlambat
  const tglEstimasi = wo.estimasi_selesai ? new Date(wo.estimasi_selesai) : null;
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);
  const terlambat =
    tglEstimasi &&
    tglEstimasi < hariIni &&
    !["selesai", "siap_diambil", "diambil", "dibatalkan"].includes(wo.status);

  // Foto dikelompokkan berdasarkan jenis
  const fotoStnk = wo.photos.find((p) => p.jenis === "stnk");
  const fotoKondisiAwal = wo.photos.filter((p) => p.jenis === "kondisi_awal");
  const fotoPengerjaan = wo.photos.filter((p) => p.jenis === "pengerjaan");
  const fotoKondisiAkhir = wo.photos.filter((p) => p.jenis === "kondisi_akhir");

  // Helper WhatsApp Link
  const nomorWa = wo.customer.telepon.replace(/^0/, "62").replace(/[^0-9]/g, "");

  // Handler: Ubah Status WO lewat RPC
  async function eksekusiUbahStatus(targetStatus: string, catatan?: string) {
    setErrorPesan(null);
    startTransition(async () => {
      try {
        const { error } = await supabase.rpc("ubah_status_wo", {
          p_wo: wo.id,
          p_status: targetStatus,
          p_catatan: catatan?.trim() || undefined,
        });

        if (error) throw error;

        setModalStatus(null);
        setCatatanAksi("");
        router.refresh();
      } catch (err: unknown) {
        setErrorPesan(err instanceof Error ? err.message : "Gagal mengubah status Work Order");
      }
    });
  }

  // Handler: Mulai Kerjakan (Tugaskan Mekanik + Ubah Status ke Dikerjakan)
  async function handleMulaiKerjakan() {
    if (selectedMekanik.length === 0) {
      setErrorPesan("Pilih minimal satu mekanik untuk pengerjaan.");
      return;
    }
    if (!estimasiSelesai) {
      setErrorPesan("Tentukan estimasi tanggal selesai.");
      return;
    }

    setErrorPesan(null);
    startTransition(async () => {
      try {
        // 1. Panggil tugaskan_mekanik
        const { error: errTugas } = await supabase.rpc("tugaskan_mekanik", {
          p_wo: wo.id,
          p_mekanik: selectedMekanik,
          p_estimasi: estimasiSelesai,
        });
        if (errTugas) throw errTugas;

        // 2. Ubah status ke dikerjakan
        const { error: errStatus } = await supabase.rpc("ubah_status_wo", {
          p_wo: wo.id,
          p_status: "dikerjakan",
        });
        if (errStatus) throw errStatus;

        router.refresh();
      } catch (err: unknown) {
        setErrorPesan(err instanceof Error ? err.message : "Gagal memulai pengerjaan");
      }
    });
  }

  // Handler: Simpan Edit Data Masuk (Admin/Owner saat menunggu)
  async function handleSimpanDataMasuk() {
    setErrorPesan(null);
    startTransition(async () => {
      try {
        const { error } = await supabase
          .from("work_orders")
          .update({
            odometer: editOdometer,
            keluhan: editKeluhan.trim(),
            kepala_mekanik_id: editKepalaId,
          })
          .eq("id", wo.id);

        if (error) throw error;
        setBukaEditMasuk(false);
        router.refresh();
      } catch (err: unknown) {
        setErrorPesan(err instanceof Error ? err.message : "Gagal memperbarui data masuk");
      }
    });
  }

  // Handler: Simpan Diagnosis (Kepala Mekanik tim / Owner saat dikerjakan/tertunda)
  async function handleSimpanDiagnosis() {
    setErrorPesan(null);
    startTransition(async () => {
      try {
        const { error } = await supabase
          .from("work_orders")
          .update({
            diagnosis: editDiagnosis.trim() || null,
          })
          .eq("id", wo.id);

        if (error) throw error;
        setBukaEditDiagnosis(false);
        router.refresh();
      } catch (err: unknown) {
        setErrorPesan(err instanceof Error ? err.message : "Gagal memperbarui diagnosis");
      }
    });
  }

  // Handler: Unggah Foto Pengerjaan
  async function handleUploadPengerjaan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFoto(true);
    setErrorPesan(null);
    try {
      await unggahFotoWO(supabase, wo.id, "pengerjaan", file, profil.id);
      router.refresh();
    } catch (err: unknown) {
      setErrorPesan(err instanceof Error ? err.message : "Gagal mengunggah foto pengerjaan");
    } finally {
      setUploadingFoto(false);
      e.target.value = "";
    }
  }

  // Handler: Serahkan Mobil (upload foto kondisi akhir jika baru, lalu panggil ubah_status_wo 'diambil')
  async function handleSerahkanMobil() {
    setErrorPesan(null);
    startTransition(async () => {
      try {
        // Jika ada file foto kondisi akhir yang dipilih pada dialog
        if (fotoKondisiAkhirFile) {
          await unggahFotoWO(supabase, wo.id, "kondisi_akhir", fotoKondisiAkhirFile, profil.id);
        }

        // Jalankan serahkan mobil (status -> diambil)
        const { error } = await supabase.rpc("ubah_status_wo", {
          p_wo: wo.id,
          p_status: "diambil",
        });

        if (error) throw error;

        setModalStatus(null);
        setFotoKondisiAkhirFile(null);
        router.refresh();
      } catch (err: unknown) {
        setErrorPesan(err instanceof Error ? err.message : "Gagal menyerahkan mobil");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Pesan Kesalahan Global */}
      {errorPesan && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger flex items-start gap-2">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Terjadi kendala</p>
            <p>{errorPesan}</p>
          </div>
          <button onClick={() => setErrorPesan(null)} className="text-danger hover:opacity-75">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Header Work Order */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-mono tracking-tight text-text">{wo.nomor}</h1>
            <BadgeStatus status={wo.status} />
            {terlambat && (
              <Badge variant="destructive" className="gap-1 text-xs">
                <AlertCircle className="size-3" />
                Terlambat
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Didaftarkan pada {tanggal(wo.created_at)} · Penanggung Jawab:{" "}
            <span className="font-medium text-text">Tim {wo.kepala_mekanik.nama}</span>
          </p>
        </div>

        {/* Tombol-Tombol Aksi Status Utama (PRD 7.2 & 6.8) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Batalkan WO (Admin / Owner saat menunggu, dikerjakan, tertunda) */}
          {bolehAksiAdmin && ["menunggu", "dikerjakan", "tertunda"].includes(wo.status) && (
            <Button
              variant="outline"
              size="sm"
              className="text-danger border-danger/30 hover:bg-danger/10"
              onClick={() => {
                setModalStatus("dibatalkan");
                setCatatanAksi("");
              }}
            >
              <XCircle className="size-4" />
              Batalkan WO
            </Button>
          )}

          {/* Tunda Pengerjaan (Kepala Mekanik tim / Owner saat dikerjakan) */}
          {bolehAksiTim && wo.status === "dikerjakan" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setModalStatus("tertunda");
                setCatatanAksi("");
              }}
            >
              <PauseCircle className="size-4" />
              Tunda Pengerjaan
            </Button>
          )}

          {/* Lanjutkan Pengerjaan (Kepala Mekanik tim / Owner saat tertunda) */}
          {bolehAksiTim && wo.status === "tertunda" && (
            <Button
              variant="default"
              size="sm"
              disabled={isPending}
              onClick={() => eksekusiUbahStatus("dikerjakan")}
            >
              <PlayCircle className="size-4" />
              Lanjutkan Pengerjaan
            </Button>
          )}

          {/* Selesai Dikerjakan (Kepala Mekanik tim / Owner saat dikerjakan) */}
          {bolehAksiTim && wo.status === "dikerjakan" && (
            <Button
              variant="default"
              size="sm"
              disabled={isPending || wo.jumlah_item_tagihan === 0}
              title={
                wo.jumlah_item_tagihan === 0
                  ? "Catat minimal 1 jasa atau spare part di tagihan sebelum menyelesaikan"
                  : ""
              }
              onClick={() => eksekusiUbahStatus("selesai")}
            >
              <CheckCircle className="size-4" />
              Selesai Dikerjakan
            </Button>
          )}

          {/* QC Lulus / Gagal (Kepala Mekanik tim / Owner saat selesai) */}
          {bolehAksiTim && wo.status === "selesai" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-danger border-danger/30 hover:bg-danger/10"
                onClick={() => {
                  setModalStatus("qc_gagal");
                  setCatatanAksi("");
                }}
              >
                <XCircle className="size-4" />
                QC Gagal
              </Button>
              <Button
                variant="default"
                size="sm"
                className="bg-success text-white hover:bg-success/90"
                disabled={isPending}
                onClick={() => eksekusiUbahStatus("siap_diambil")}
              >
                <CheckCircle className="size-4" />
                QC Lulus (Siap Diambil)
              </Button>
            </>
          )}

          {/* Serahkan Mobil (Admin / Owner saat siap_diambil) */}
          {bolehAksiAdmin && wo.status === "siap_diambil" && (
            <Button
              variant="default"
              size="sm"
              className="bg-success text-white hover:bg-success/90"
              onClick={() => setModalStatus("serahkan")}
            >
              <Send className="size-4" />
              Serahkan Mobil
            </Button>
          )}
        </div>
      </div>

      {/* Bagian A: Data Masuk (PRD 6.8) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Kartu Pelanggan */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="size-4 text-primary" />
              Pelanggan
            </CardTitle>
            <Badge variant="outline" className="capitalize text-xs">
              {wo.customer.tipe}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-lg font-semibold">{wo.customer.nama}</p>
              <p className="text-xs text-muted-foreground">{wo.customer.alamat || "Alamat tidak dicatat"}</p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <a
                href={`tel:${wo.customer.telepon}`}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-mono font-medium hover:bg-muted"
              >
                <Phone className="size-3.5 text-muted-foreground" />
                {wo.customer.telepon}
              </a>
              <a
                href={`https://wa.me/${nomorWa}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-success/15 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/25"
              >
                <MessageCircle className="size-3.5" />
                WhatsApp
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Kartu Kendaraan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="size-4 text-primary" />
              Kendaraan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-mono text-xl font-bold tracking-tight text-text">{wo.vehicle.plat}</p>
            <p className="text-sm font-semibold">{wo.vehicle.merek_model}</p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
              <span>Tahun {wo.vehicle.tahun || "-"}</span>
              <span>•</span>
              <span>Warna {wo.vehicle.warna || "-"}</span>
              <span>•</span>
              <span>Transmisi {wo.vehicle.transmisi || "-"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rincian Kunjungan, Keluhan & Diagnosis */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Data Kunjungan & Keluhan</CardTitle>
          {bolehAksiAdmin && wo.status === "menunggu" && (
            <Button variant="ghost" size="sm" onClick={() => setBukaEditMasuk(true)}>
              <Edit2 className="size-3.5 mr-1" />
              Ubah Data Masuk
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3 border-b pb-4">
            <div>
              <p className="text-xs text-muted-foreground">Odometer Masuk</p>
              <p className="font-mono text-base font-semibold">{wo.odometer.toLocaleString()} km</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tim Penanggung Jawab</p>
              <p className="text-sm font-semibold">Tim {wo.kepala_mekanik.nama}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Waktu Masuk</p>
              <p className="text-sm font-semibold">{tanggal(wo.created_at)}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Keluhan Pelanggan</p>
            <p className="mt-1 text-sm bg-muted/30 p-3 rounded-lg border">{wo.keluhan}</p>
          </div>

          {/* Diagnosis (Kepala Mekanik tim / Owner) */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Diagnosis Mekanik
              </p>
              {bolehAksiTim && ["dikerjakan", "tertunda"].includes(wo.status) && (
                <Button variant="ghost" size="sm" onClick={() => setBukaEditDiagnosis(true)}>
                  <Edit2 className="size-3.5 mr-1" />
                  {wo.diagnosis ? "Ubah Diagnosis" : "Isi Diagnosis"}
                </Button>
              )}
            </div>
            <p className="text-sm bg-muted/30 p-3 rounded-lg border text-text">
              {wo.diagnosis || <span className="text-muted-foreground italic">Belum ada diagnosis yang dicatat.</span>}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bagian B: Penugasan Mekanik (PRD 6.8) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="size-4 text-primary" />
            Bagian B: Penugasan Mekanik & Estimasi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {wo.status === "menunggu" && bolehAksiTim ? (
            <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="space-y-1">
                <Label className="font-semibold text-sm">
                  Pilih Mekanik Pelaksana (1 sampai 3 orang dari Tim {wo.kepala_mekanik.nama}) *
                </Label>
                <p className="text-xs text-muted-foreground">
                  Daftar diurutkan dari beban paling ringan untuk pemerataan pekerjaan.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {mekanikTim.map((m, idx) => {
                  const terpilih = selectedMekanik.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                        terpilih ? "border-primary bg-card shadow-sm" : "border-border bg-card/60 hover:bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={terpilih}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (selectedMekanik.length >= 3) {
                                setErrorPesan("Maksimal 3 mekanik yang dapat ditugaskan.");
                                return;
                              }
                              setSelectedMekanik([...selectedMekanik, m.id]);
                            } else {
                              setSelectedMekanik(selectedMekanik.filter((id) => id !== m.id));
                            }
                          }}
                        />
                        <span className="font-medium text-sm">{m.nama}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {m.woAktif} WO aktif
                        </Badge>
                        {idx === 0 && (
                          <span className="text-xs font-medium text-warning" title="Beban paling ringan">
                            ★ Disarankan
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="estimasiSelesai" className="text-sm font-semibold">
                    Estimasi Selesai *
                  </Label>
                  <Input
                    id="estimasiSelesai"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={estimasiSelesai}
                    onChange={(e) => setEstimasiSelesai(e.target.value)}
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={handleMulaiKerjakan}
                    disabled={isPending || selectedMekanik.length === 0 || !estimasiSelesai}
                    className="w-full"
                  >
                    {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    <PlayCircle className="size-4" />
                    Mulai Kerjakan (Status → Dikerjakan)
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Mekanik yang Ditugaskan</p>
                {wo.mekanik_terpilih.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {wo.mekanik_terpilih.map((m) => (
                      <Badge key={m.id} variant="secondary">
                        {m.nama}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Belum ada mekanik yang ditugaskan</p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Estimasi Selesai</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="size-4 text-muted-foreground" />
                  {wo.estimasi_selesai ? tanggal(wo.estimasi_selesai) : "-"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bagian C: Dokumentasi Foto (STNK, Kondisi Awal, Pengerjaan, Kondisi Akhir) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="size-4 text-primary" />
            Dokumentasi Foto Kendaraan
          </CardTitle>
          {bolehAksiTim && wo.status === "dikerjakan" && (
            <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer rounded-md bg-secondary px-3 py-1.5 hover:bg-secondary/80">
              {uploadingFoto ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              <span>Tambah Foto Pengerjaan</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUploadPengerjaan}
                disabled={uploadingFoto}
                className="hidden"
              />
            </label>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Foto STNK */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Foto STNK</p>
            {fotoStnk ? (
              <div
                className="relative h-28 w-44 overflow-hidden rounded-lg border cursor-pointer hover:opacity-90 transition"
                onClick={() => setFotoZoom(fotoStnk.urlPenuh)}
              >
                <Image
                  src={fotoStnk.urlThumb || fotoStnk.urlPenuh}
                  alt="STNK"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Tidak ada foto STNK.</p>
            )}
          </div>

          {/* Foto Kondisi Awal */}
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              Foto Kondisi Awal ({fotoKondisiAwal.length} foto)
            </p>
            {fotoKondisiAwal.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {fotoKondisiAwal.map((f, i) => (
                  <div
                    key={f.id}
                    className="relative h-24 overflow-hidden rounded-lg border cursor-pointer hover:opacity-90 transition"
                    onClick={() => setFotoZoom(f.urlPenuh)}
                  >
                    <Image
                      src={f.urlThumb || f.urlPenuh}
                      alt={`Kondisi Awal ${i + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Belum ada foto kondisi awal.</p>
            )}
          </div>

          {/* Foto Pengerjaan */}
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              Foto Pengerjaan Mekanik ({fotoPengerjaan.length} foto)
            </p>
            {fotoPengerjaan.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {fotoPengerjaan.map((f, i) => (
                  <div
                    key={f.id}
                    className="relative h-24 overflow-hidden rounded-lg border cursor-pointer hover:opacity-90 transition"
                    onClick={() => setFotoZoom(f.urlPenuh)}
                  >
                    <Image
                      src={f.urlThumb || f.urlPenuh}
                      alt={`Pengerjaan ${i + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Belum ada foto proses pengerjaan.
              </p>
            )}
          </div>

          {/* Foto Kondisi Akhir */}
          {fotoKondisiAkhir.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Foto Kondisi Akhir ({fotoKondisiAkhir.length} foto)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {fotoKondisiAkhir.map((f, i) => (
                  <div
                    key={f.id}
                    className="relative h-24 overflow-hidden rounded-lg border cursor-pointer hover:opacity-90 transition"
                    onClick={() => setFotoZoom(f.urlPenuh)}
                  >
                    <Image
                      src={f.urlThumb || f.urlPenuh}
                      alt={`Kondisi Akhir ${i + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linimasa Riwayat Status WO (PRD 6.8) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            Riwayat Perjalanan Work Order
          </CardTitle>
        </CardHeader>
        <CardContent>
          {wo.history.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Belum ada catatan riwayat status.</p>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {wo.history.map((h) => (
                <div key={h.id} className="relative space-y-1">
                  <div className="absolute -left-6 top-1 size-2.5 rounded-full bg-primary ring-4 ring-card" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm">
                      {h.dari_status ? `${h.dari_status} → ${h.ke_status}` : `Status Awal: ${h.ke_status}`}
                    </span>
                    <span className="text-xs text-muted-foreground">· {tanggal(h.created_at)}</span>
                    {h.pelaku && (
                      <Badge variant="outline" className="text-[11px] py-0">
                        {h.pelaku.nama} ({h.pelaku.role})
                      </Badge>
                    )}
                  </div>
                  {h.catatan && <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded">{h.catatan}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Dialog: Catatan Aksi Status (Tunda, QC Gagal, Batalkan) */}
      <Dialog open={modalStatus !== null && modalStatus !== "serahkan"} onOpenChange={() => setModalStatus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modalStatus === "tertunda" && "Tunda Pengerjaan Work Order"}
              {modalStatus === "qc_gagal" && "Hasil QC Gagal"}
              {modalStatus === "dibatalkan" && "Batalkan Work Order"}
            </DialogTitle>
            <DialogDescription>
              {modalStatus === "tertunda" && "Tuliskan alasan penundaan (misalnya: Menunggu spare part tiba)."}
              {modalStatus === "qc_gagal" && "Tuliskan catatan perbaikan yang harus diselesaikan kembali oleh mekanik."}
              {modalStatus === "dibatalkan" && "Alasan pembatalan wajib diisi. Stok spare part terpasang akan dikembalikan."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="catatanModal">Alasan / Catatan *</Label>
            <Textarea
              id="catatanModal"
              rows={3}
              placeholder="Tulis alasan lengkap..."
              value={catatanAksi}
              onChange={(e) => setCatatanAksi(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalStatus(null)}>
              Batal
            </Button>
            <Button
              variant={modalStatus === "dibatalkan" ? "destructive" : "default"}
              disabled={isPending || !catatanAksi.trim()}
              onClick={() => {
                if (modalStatus === "tertunda") eksekusiUbahStatus("tertunda", catatanAksi);
                if (modalStatus === "qc_gagal") eksekusiUbahStatus("dikerjakan", catatanAksi);
                if (modalStatus === "dibatalkan") eksekusiUbahStatus("dibatalkan", catatanAksi);
              }}
            >
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Serahkan Mobil (Admin / Owner saat siap_diambil) */}
      <Dialog open={modalStatus === "serahkan"} onOpenChange={() => setModalStatus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Serahkan Mobil ke Pelanggan</DialogTitle>
            <DialogDescription>
              Syarat penyerahan mobil: invoice harus lunas dan terdapat minimal 1 foto kondisi akhir kendaraan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Status Pembayaran Invoice */}
            <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Status Tagihan</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Invoice: {wo.invoice?.nomor || "Belum Terbit"}</span>
                <Badge
                  variant={wo.invoice?.status_bayar === "lunas" ? "default" : "destructive"}
                  className={wo.invoice?.status_bayar === "lunas" ? "bg-success" : ""}
                >
                  {wo.invoice?.status_bayar ? wo.invoice.status_bayar.toUpperCase() : "BELUM LUNAS"}
                </Badge>
              </div>
              {wo.invoice?.status_bayar !== "lunas" && (
                <p className="text-xs text-danger pt-1">
                  Tagihan belum lunas. Selesaikan pembayaran di tab Tagihan terlebih dahulu.
                </p>
              )}
            </div>

            {/* Foto Kondisi Akhir */}
            <div className="space-y-2">
              <Label className="text-xs uppercase font-semibold text-muted-foreground">
                Foto Kondisi Akhir {fotoKondisiAkhir.length > 0 ? "✓ Sudah Ada" : "* Wajib Diunggah"}
              </Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFotoKondisiAkhirFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalStatus(null)}>
              Tutup
            </Button>
            <Button
              className="bg-success text-white hover:bg-success/90"
              disabled={
                isPending ||
                wo.invoice?.status_bayar !== "lunas" ||
                (fotoKondisiAkhir.length === 0 && !fotoKondisiAkhirFile)
              }
              onClick={handleSerahkanMobil}
            >
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Serahkan Mobil (Status → Diambil)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Edit Data Masuk (Keluhan, Odometer, Tim) saat menunggu */}
      <Dialog open={bukaEditMasuk} onOpenChange={setBukaEditMasuk}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Data Masuk Work Order</DialogTitle>
            <DialogDescription>
              Admin dan Owner dapat mengoreksi keluhan, odometer, dan tim kepala mekanik saat status menunggu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="editOdo">Odometer (km)</Label>
              <Input
                id="editOdo"
                type="number"
                value={editOdometer}
                onChange={(e) => setEditOdometer(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="editTim">Tim Kepala Mekanik</Label>
              <select
                id="editTim"
                value={editKepalaId}
                onChange={(e) => setEditKepalaId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
              >
                {daftarKepala.map((k) => (
                  <option key={k.id} value={k.id}>
                    Tim {k.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="editKel">Keluhan Pelanggan</Label>
              <Textarea
                id="editKel"
                rows={3}
                value={editKeluhan}
                onChange={(e) => setEditKeluhan(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBukaEditMasuk(false)}>
              Batal
            </Button>
            <Button disabled={isPending || !editKeluhan.trim()} onClick={handleSimpanDataMasuk}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Edit Diagnosis */}
      <Dialog open={bukaEditDiagnosis} onOpenChange={setBukaEditDiagnosis}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Diagnosis Mekanik</DialogTitle>
            <DialogDescription>
              Catatan hasil analisa mekanik mengenai kondisi kerusakan dan komponen yang perlu diperbaiki.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="diagInput">Hasil Diagnosis</Label>
            <Textarea
              id="diagInput"
              rows={4}
              placeholder="Contoh: Kampas rem depan tipis, minyak rem keruh dan perlu dikuras..."
              value={editDiagnosis}
              onChange={(e) => setEditDiagnosis(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBukaEditDiagnosis(false)}>
              Batal
            </Button>
            <Button disabled={isPending} onClick={handleSimpanDiagnosis}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Simpan Diagnosis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Zoom Foto */}
      {fotoZoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setFotoZoom(null)}
        >
          <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-xl bg-card p-2">
            <button
              onClick={() => setFotoZoom(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black"
            >
              <X className="size-5" />
            </button>
            <div className="relative h-[80vh] w-[80vw] max-w-3xl">
              <Image src={fotoZoom} alt="Foto zoom" fill className="object-contain" unoptimized />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
