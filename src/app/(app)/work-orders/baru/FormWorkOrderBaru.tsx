"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Car,
  User,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { unggahFotoWO } from "@/lib/foto";
import { createClient } from "@/lib/supabase/client";

interface KepalaMekanikOption {
  id: string;
  nama: string;
  woAktif: number;
}

interface KendaraanDitemukan {
  id: string;
  plat: string;
  merek_model: string;
  tahun: number | null;
  warna: string | null;
  transmisi: string | null;
  customer: {
    id: string;
    nama: string;
    telepon: string;
    alamat: string | null;
    tipe: string;
  };
}

export function FormWorkOrderBaru({
  listKepala,
  userId,
}: {
  listKepala: KepalaMekanikOption[];
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  // Input Plat & Status Pencarian
  const [inputPlat, setInputPlat] = useState("");
  const [sedangMencariPlat, setSedangMencariPlat] = useState(false);
  const [statusPlat, setStatusPlat] = useState<"idle" | "ditemukan" | "baru">("idle");
  const [kendaraanTerpilih, setKendaraanTerpilih] = useState<KendaraanDitemukan | null>(null);

  // Form Pelanggan Baru (jika plat belum terdaftar)
  const [pelangganNama, setPelangganNama] = useState("");
  const [pelangganTelepon, setPelangganTelepon] = useState("");
  const [pelangganAlamat, setPelangganAlamat] = useState("");
  const [pelangganTipe, setPelangganTipe] = useState<"perorangan" | "perusahaan">("perorangan");
  const [pelangganExistingId, setPelangganExistingId] = useState<string | null>(null);

  // Form Kendaraan Baru (jika plat belum terdaftar)
  const [kendaraanMerekModel, setKendaraanMerekModel] = useState("");
  const [kendaraanTahun, setKendaraanTahun] = useState<number | "">("");
  const [kendaraanWarna, setKendaraanWarna] = useState("");
  const [kendaraanTransmisi, setKendaraanTransmisi] = useState<"AT" | "MT">("AT");

  // Bagian Data Masuk WO
  const [odometer, setOdometer] = useState<number | "">("");
  const [keluhan, setKeluhan] = useState("");
  const [kepalaMekanikId, setKepalaMekanikId] = useState(listKepala[0]?.id || "");

  // Foto STNK (1 foto) & Foto Kondisi Awal (1 - 6 foto)
  const [fotoStnk, setFotoStnk] = useState<File | null>(null);
  const [previewStnk, setPreviewStnk] = useState<string | null>(null);

  const [fotoKondisiAwal, setFotoKondisiAwal] = useState<File[]>([]);
  const [previewKondisiAwal, setPreviewKondisiAwal] = useState<string[]>([]);

  // Pesan Error & Progress
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [statusProses, setStatusProses] = useState<string | null>(null);

  // 1. Pencarian Plat Nomor (PRD 6.7)
  async function cariPlat() {
    const platBersih = inputPlat.trim().toUpperCase();
    if (!platBersih) return;

    setSedangMencariPlat(true);
    setErrorPesan(null);

    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select(`
          id,
          plat,
          merek_model,
          tahun,
          warna,
          transmisi,
          customers!inner (
            id,
            nama,
            telepon,
            alamat,
            tipe
          )
        `)
        .eq("plat", platBersih)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setKendaraanTerpilih({
          id: data.id,
          plat: data.plat,
          merek_model: data.merek_model,
          tahun: data.tahun,
          warna: data.warna,
          transmisi: data.transmisi,
          customer: Array.isArray(data.customers) ? data.customers[0] : data.customers,
        });
        setStatusPlat("ditemukan");
      } else {
        setKendaraanTerpilih(null);
        setStatusPlat("baru");
      }
    } catch (err: unknown) {
      setErrorPesan(err instanceof Error ? err.message : "Gagal mencari data kendaraan");
    } finally {
      setSedangMencariPlat(false);
    }
  }

  // 2. Pencarian Pelanggan Berdasarkan Nomor Telepon (jika mobil baru)
  async function cekTeleponPelanggan(tel: string) {
    setPelangganTelepon(tel);
    if (tel.length >= 10 && tel.length <= 14) {
      const { data } = await supabase
        .from("customers")
        .select("id, nama, alamat, tipe")
        .eq("telepon", tel)
        .maybeSingle();

      if (data) {
        setPelangganExistingId(data.id);
        setPelangganNama(data.nama);
        setPelangganAlamat(data.alamat || "");
        setPelangganTipe(data.tipe as "perorangan" | "perusahaan");
      } else {
        setPelangganExistingId(null);
      }
    } else {
      setPelangganExistingId(null);
    }
  }

  // 3. Handler File Upload Foto STNK
  function handlePilihStnk(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoStnk(file);
    setPreviewStnk(URL.createObjectURL(file));
  }

  // 4. Handler File Upload Foto Kondisi Awal (1–6 foto)
  function handlePilihKondisiAwal(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const gabungFiles = [...fotoKondisiAwal, ...files].slice(0, 6);
    setFotoKondisiAwal(gabungFiles);
    setPreviewKondisiAwal(gabungFiles.map((f) => URL.createObjectURL(f)));
  }

  function hapusFotoKondisiAwal(index: number) {
    const updateFiles = fotoKondisiAwal.filter((_, i) => i !== index);
    setFotoKondisiAwal(updateFiles);
    setPreviewKondisiAwal(updateFiles.map((f) => URL.createObjectURL(f)));
  }

  // Validasi Kelengkapan Data Sesuai PRD 6.7
  const validPlat =
    statusPlat === "ditemukan" ||
    (statusPlat === "baru" &&
      pelangganNama.trim() !== "" &&
      pelangganTelepon.trim() !== "" &&
      kendaraanMerekModel.trim() !== "");

  const validOdo = odometer !== "" && Number(odometer) >= 0;
  const validKeluhan = keluhan.trim() !== "";
  const validFoto = fotoStnk !== null && fotoKondisiAwal.length >= 1;
  const validTim = kepalaMekanikId !== "";

  const bolehSimpan = validPlat && validOdo && validKeluhan && validFoto && validTim;

  // Pesan Kekurangan Validasi
  const daftarKekurangan: string[] = [];
  if (statusPlat === "idle") daftarKekurangan.push("Cari atau tentukan plat kendaraan");
  if (statusPlat === "baru") {
    if (!pelangganNama.trim()) daftarKekurangan.push("Nama pelanggan");
    if (!pelangganTelepon.trim()) daftarKekurangan.push("Nomor telepon pelanggan (10-14 digit)");
    if (!kendaraanMerekModel.trim()) daftarKekurangan.push("Merek dan model kendaraan");
  }
  if (!validOdo) daftarKekurangan.push("Odometer (angka ≥ 0)");
  if (!validKeluhan) daftarKekurangan.push("Keluhan kendaraan");
  if (!fotoStnk) daftarKekurangan.push("Foto STNK (1 foto)");
  if (fotoKondisiAwal.length === 0) daftarKekurangan.push("Minimal 1 Foto Kondisi Awal");
  if (!validTim) daftarKekurangan.push("Pilih Tim Kepala Mekanik");

  // 5. Submit Pembuatan Work Order
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bolehSimpan) return;

    setErrorPesan(null);

    startTransition(async () => {
      try {
        let vehicleId = kendaraanTerpilih?.id;

        // Jika kendaraan baru, simpan pelanggan & kendaraan dulu
        if (!vehicleId) {
          setStatusProses("Menyimpan data pelanggan dan kendaraan...");

          let customerId = pelangganExistingId;
          if (!customerId) {
            const { data: newCust, error: errCust } = await supabase
              .from("customers")
              .insert({
                nama: pelangganNama.trim(),
                telepon: pelangganTelepon.trim(),
                alamat: pelangganAlamat.trim() || null,
                tipe: pelangganTipe,
              })
              .select("id")
              .single();

            if (errCust) throw errCust;
            customerId = newCust.id;
          }

          const { data: newVeh, error: errVeh } = await supabase
            .from("vehicles")
            .insert({
              customer_id: customerId,
              plat: inputPlat.trim().toUpperCase(),
              merek_model: kendaraanMerekModel.trim(),
              tahun: kendaraanTahun ? Number(kendaraanTahun) : null,
              warna: kendaraanWarna.trim() || null,
              transmisi: kendaraanTransmisi,
            })
            .select("id")
            .single();

          if (errVeh) throw errVeh;
          vehicleId = newVeh.id;
        }

        // Panggil RPC buat_work_order
        setStatusProses("Membuat Work Order...");
        const { data: woId, error: errWo } = await supabase.rpc("buat_work_order", {
          p_vehicle_id: vehicleId,
          p_kepala_mekanik_id: kepalaMekanikId,
          p_odometer: Number(odometer),
          p_keluhan: keluhan.trim(),
        });

        if (errWo) throw errWo;
        if (!woId) throw new Error("Gagal mendapatkan ID Work Order");

        // Unggah Foto STNK
        setStatusProses("Mengompresi dan mengunggah foto STNK...");
        if (fotoStnk) {
          await unggahFotoWO(supabase, woId, "stnk", fotoStnk, userId);
        }

        // Unggah Foto Kondisi Awal
        for (let i = 0; i < fotoKondisiAwal.length; i++) {
          setStatusProses(
            `Mengompresi dan mengunggah foto kondisi awal (${i + 1}/${fotoKondisiAwal.length})...`,
          );
          await unggahFotoWO(supabase, woId, "kondisi_awal", fotoKondisiAwal[i], userId);
        }

        setStatusProses("Selesai! Mengalihkan ke rincian Work Order...");
        router.push(`/work-orders/${woId}`);
      } catch (err: unknown) {
        console.error("Gagal membuat WO:", err);
        setErrorPesan(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan WO");
        setStatusProses(null);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorPesan && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger flex items-start gap-2">
          <AlertTriangle className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Penyimpanan gagal</p>
            <p>{errorPesan}</p>
          </div>
        </div>
      )}

      {/* Bagian 1: Plat Nomor & Pelanggan / Kendaraan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Car className="size-5 text-primary" />
            1. Data Kendaraan & Pelanggan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-xs space-y-1.5">
              <Label htmlFor="plat">Plat Nomor Kendaraan *</Label>
              <Input
                id="plat"
                placeholder="Contoh: B 1234 ABC"
                value={inputPlat}
                onChange={(e) => {
                  setInputPlat(e.target.value);
                  if (statusPlat !== "idle") setStatusPlat("idle");
                }}
                disabled={statusPlat === "ditemukan"}
                className="font-mono uppercase font-semibold text-base"
                autoFocus
              />
            </div>

            {statusPlat !== "ditemukan" ? (
              <Button
                type="button"
                onClick={cariPlat}
                disabled={!inputPlat.trim() || sedangMencariPlat}
                variant="secondary"
              >
                {sedangMencariPlat ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Periksa Plat
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStatusPlat("idle");
                  setKendaraanTerpilih(null);
                }}
              >
                Ubah Plat
              </Button>
            )}
          </div>

          {/* Kondisi 1: Plat Terdaftar */}
          {statusPlat === "ditemukan" && kendaraanTerpilih && (
            <div className="grid gap-4 rounded-xl border border-success/30 bg-success/5 p-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-success">
                  <CheckCircle2 className="size-4" /> Kendaraan Terdaftar
                </div>
                <p className="font-mono text-lg font-bold">{kendaraanTerpilih.plat}</p>
                <p className="text-sm font-medium">{kendaraanTerpilih.merek_model}</p>
                <p className="text-xs text-muted-foreground">
                  Tahun {kendaraanTerpilih.tahun || "-"} · Warna {kendaraanTerpilih.warna || "-"} · Transmisi {kendaraanTerpilih.transmisi || "-"}
                </p>
              </div>

              <div className="space-y-1.5 border-t pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  Data Pelanggan
                </div>
                <p className="font-semibold">{kendaraanTerpilih.customer.nama}</p>
                <p className="font-mono text-sm">{kendaraanTerpilih.customer.telepon}</p>
                <p className="text-xs text-muted-foreground">{kendaraanTerpilih.customer.alamat || "-"}</p>
              </div>
            </div>
          )}

          {/* Kondisi 2: Plat Belum Terdaftar */}
          {statusPlat === "baru" && (
            <div className="space-y-4 rounded-xl border border-warning/30 bg-warning/5 p-4">
              <div className="flex items-center gap-1.5 text-sm font-medium text-warning">
                <AlertTriangle className="size-4" /> Plat belum terdaftar. Silakan lengkapi data pelanggan dan kendaraan:
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Form Pelanggan */}
                <div className="space-y-3 rounded-lg border bg-card p-3">
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                    <User className="size-4 text-primary" /> Data Pelanggan Baru / Lama
                  </h4>

                  <div className="space-y-1">
                    <Label htmlFor="custTel" className="text-xs">Nomor Telepon WhatsApp *</Label>
                    <Input
                      id="custTel"
                      placeholder="08123456789"
                      value={pelangganTelepon}
                      onChange={(e) => cekTeleponPelanggan(e.target.value)}
                    />
                    {pelangganExistingId && (
                      <p className="text-xs text-success">Pelanggan lama ditemukan! Data terisi otomatis.</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="custNama" className="text-xs">Nama Pelanggan *</Label>
                    <Input
                      id="custNama"
                      placeholder="Nama lengkap"
                      value={pelangganNama}
                      onChange={(e) => setPelangganNama(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="custAlamat" className="text-xs">Alamat (Opsional)</Label>
                    <Input
                      id="custAlamat"
                      placeholder="Alamat domisili"
                      value={pelangganAlamat}
                      onChange={(e) => setPelangganAlamat(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Tipe Pelanggan</Label>
                    <div className="flex gap-4 pt-1">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="tipe"
                          checked={pelangganTipe === "perorangan"}
                          onChange={() => setPelangganTipe("perorangan")}
                        />
                        Perorangan
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="tipe"
                          checked={pelangganTipe === "perusahaan"}
                          onChange={() => setPelangganTipe("perusahaan")}
                        />
                        Perusahaan
                      </label>
                    </div>
                  </div>
                </div>

                {/* Form Kendaraan */}
                <div className="space-y-3 rounded-lg border bg-card p-3">
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Car className="size-4 text-primary" /> Rincian Kendaraan
                  </h4>

                  <div className="space-y-1">
                    <Label htmlFor="vehModel" className="text-xs">Merek & Model Mobil *</Label>
                    <Input
                      id="vehModel"
                      placeholder="Contoh: Toyota Avanza 1.3 G"
                      value={kendaraanMerekModel}
                      onChange={(e) => setKendaraanMerekModel(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="vehTahun" className="text-xs">Tahun</Label>
                      <Input
                        id="vehTahun"
                        type="number"
                        placeholder="2020"
                        value={kendaraanTahun}
                        onChange={(e) => setKendaraanTahun(e.target.value === "" ? "" : Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="vehWarna" className="text-xs">Warna</Label>
                      <Input
                        id="vehWarna"
                        placeholder="Hitam Metalik"
                        value={kendaraanWarna}
                        onChange={(e) => setKendaraanWarna(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Transmisi</Label>
                    <div className="flex gap-4 pt-1">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="transmisi"
                          checked={kendaraanTransmisi === "AT"}
                          onChange={() => setKendaraanTransmisi("AT")}
                        />
                        Automatic (AT)
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="transmisi"
                          checked={kendaraanTransmisi === "MT"}
                          onChange={() => setKendaraanTransmisi("MT")}
                        />
                        Manual (MT)
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bagian 2: Data Masuk Work Order */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Rincian Kunjungan & Keluhan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="odometer">Odometer (Kilometer) *</Label>
              <Input
                id="odometer"
                type="number"
                min="0"
                placeholder="Contoh: 45000"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tim">Tim Kepala Mekanik *</Label>
              <select
                id="tim"
                value={kepalaMekanikId}
                onChange={(e) => setKepalaMekanikId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
              >
                {listKepala.map((k) => (
                  <option key={k.id} value={k.id}>
                    Tim {k.nama} ({k.woAktif} WO aktif)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="keluhan">Keluhan Pelanggan *</Label>
            <Textarea
              id="keluhan"
              rows={3}
              placeholder="Tuliskan keluhan atau permintaan servis dari pelanggan..."
              value={keluhan}
              onChange={(e) => setKeluhan(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bagian 3: Foto STNK & Foto Kondisi Awal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">3. Foto STNK & Kondisi Awal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Foto STNK (1 Foto) */}
          <div className="space-y-2">
            <Label className="font-medium">Foto STNK (Wajib 1 foto) *</Label>
            <p className="text-xs text-muted-foreground">
              Digunakan untuk verifikasi data kendaraan (foto diperkecil otomatis sebelum diunggah).
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex h-28 w-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition hover:bg-muted/60">
                <Upload className="size-6 text-muted-foreground" />
                <span className="mt-1 text-xs text-muted-foreground">Pilih Foto STNK</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePilihStnk}
                  className="hidden"
                />
              </label>

              {previewStnk && (
                <div className="relative h-28 w-44 overflow-hidden rounded-lg border">
                  <Image
                    src={previewStnk}
                    alt="Foto STNK"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFotoStnk(null);
                      setPreviewStnk(null);
                    }}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Foto Kondisi Awal (1 - 6 Foto) */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Foto Kondisi Awal (Wajib minimal 1, maks 6) *</Label>
                <p className="text-xs text-muted-foreground">
                  Foto bodi mobil sebelum dikerjakan untuk bukti fisik kendaraan saat masuk.
                </p>
              </div>
              <Badge variant="outline">{fotoKondisiAwal.length} / 6 foto</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {fotoKondisiAwal.length < 6 && (
                <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition hover:bg-muted/60">
                  <Upload className="size-5 text-muted-foreground" />
                  <span className="mt-1 text-[11px] text-muted-foreground">Tambah Foto</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handlePilihKondisiAwal}
                    className="hidden"
                  />
                </label>
              )}

              {previewKondisiAwal.map((url, idx) => (
                <div key={idx} className="relative h-24 overflow-hidden rounded-lg border">
                  <Image
                    src={url}
                    alt={`Kondisi awal ${idx + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => hapusFotoKondisiAwal(idx)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bagian Bawah: Validasi & Tombol Simpan */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {!bolehSimpan ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-warning">Belum lengkap:</span>{" "}
              {daftarKekurangan.join(", ")}
            </p>
          ) : (
            <p className="text-xs text-success font-medium flex items-center gap-1.5">
              <CheckCircle2 className="size-4" /> Seluruh data masuk siap disimpan.
            </p>
          )}
          {statusProses && (
            <p className="text-xs text-primary font-medium animate-pulse mt-1">
              {statusProses}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={!bolehSimpan || isPending}
          className="shrink-0"
        >
          {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Simpan Work Order
        </Button>
      </div>
    </form>
  );
}
