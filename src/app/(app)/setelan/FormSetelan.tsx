"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { kompresFoto } from "@/lib/kompresi";
import { createClient } from "@/lib/supabase/client";

const skemaSetelan = z.object({
  nama: z.string().trim().min(1, "Nama bengkel wajib diisi"),
  alamat: z.string().trim().min(1, "Alamat bengkel wajib diisi"),
  telepon: z.string().trim().min(1, "Nomor telepon wajib diisi"),
  jam_buka: z.string().trim().optional(),
});

type FormValues = z.infer<typeof skemaSetelan>;

interface SetelanBengkel {
  id: number;
  nama: string;
  alamat: string;
  telepon: string;
  jam_buka: string | null;
  logo_path: string | null;
  galeri_paths: string[];
}

export function FormSetelan({ setelan }: { setelan: SetelanBengkel }) {
  const router = useRouter();
  const supabase = createClient();

  const [memprosesData, setMemprosesData] = useState(false);
  const [mengunggahLogo, setMengunggahLogo] = useState(false);
  const [mengunggahGaleri, setMengunggahGaleri] = useState(false);
  const [logoPath, setLogoPath] = useState<string | null>(setelan.logo_path);
  const [galeriPaths, setGaleriPaths] = useState<string[]>(setelan.galeri_paths || []);

  const form = useForm<FormValues>({
    resolver: zodResolver(skemaSetelan),
    defaultValues: {
      nama: setelan.nama || "Cemerlang Jaya Motor",
      alamat: setelan.alamat || "",
      telepon: setelan.telepon || "",
      jam_buka: setelan.jam_buka || "",
    },
  });

  // Ambil Public URL untuk file di bucket publik
  function urlPublik(path: string | null) {
    if (!path) return null;
    const { data } = supabase.storage.from("publik").getPublicUrl(path);
    return data.publicUrl;
  }

  // 1. Simpan Identitas Bengkel
  async function simpanDataBengkel(data: FormValues) {
    setMemprosesData(true);
    try {
      const { error } = await supabase
        .from("workshop_settings")
        .update({
          nama: data.nama,
          alamat: data.alamat,
          telepon: data.telepon,
          jam_buka: data.jam_buka || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) throw error;
      toast.success("Informasi bengkel berhasil disimpan");
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menyimpan data bengkel";
      toast.error(pesan);
    } finally {
      setMemprosesData(false);
    }
  }

  // 2. Unggah Logo Bengkel
  async function handleUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMengunggahLogo(true);
    try {
      toast.info("Mengompresi logo...");
      const fileTerkonpresi = await kompresFoto(file);

      const timestamp = Date.now();
      const pathBaru = `logo/logo_${timestamp}.webp`;

      toast.info("Mengunggah logo ke bucket publik...");
      const { error: errUpload } = await supabase.storage
        .from("publik")
        .upload(pathBaru, fileTerkonpresi, {
          cacheControl: "31536000",
          upsert: true,
        });

      if (errUpload) throw errUpload;

      // Update di workshop_settings
      const { error: errDb } = await supabase
        .from("workshop_settings")
        .update({
          logo_path: pathBaru,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (errDb) throw errDb;

      setLogoPath(pathBaru);
      toast.success("Logo bengkel berhasil diperbarui");
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal mengunggah logo";
      toast.error(pesan);
    } finally {
      setMengunggahLogo(false);
      e.target.value = "";
    }
  }

  // 3. Unggah Foto Galeri
  async function handleUploadGaleri(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (galeriPaths.length + files.length > 6) {
      toast.error("Maksimal 6 foto pada galeri bengkel");
      return;
    }

    setMengunggahGaleri(true);
    try {
      const pathsBaru: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        toast.info(`Mengompresi foto ${i + 1} dari ${files.length}...`);
        const fileTerkonpresi = await kompresFoto(file);

        const timestamp = Date.now();
        const path = `galeri/galeri_${timestamp}_${i}.webp`;

        const { error: errUpload } = await supabase.storage
          .from("publik")
          .upload(path, fileTerkonpresi, {
            cacheControl: "31536000",
            upsert: true,
          });

        if (errUpload) throw errUpload;
        pathsBaru.push(path);
      }

      const galeriGabungan = [...galeriPaths, ...pathsBaru];

      const { error: errDb } = await supabase
        .from("workshop_settings")
        .update({
          galeri_paths: galeriGabungan,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (errDb) throw errDb;

      setGaleriPaths(galeriGabungan);
      toast.success(`${pathsBaru.length} foto berhasil ditambahkan ke galeri`);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal mengunggah foto galeri";
      toast.error(pesan);
    } finally {
      setMengunggahGaleri(false);
      e.target.value = "";
    }
  }

  // 4. Hapus Foto Galeri
  async function handleHapusGaleri(indexHapus: number) {
    const pathDihapus = galeriPaths[indexHapus];
    const sisaGaleri = galeriPaths.filter((_, idx) => idx !== indexHapus);

    try {
      const { error: errDb } = await supabase
        .from("workshop_settings")
        .update({
          galeri_paths: sisaGaleri,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (errDb) throw errDb;

      // Hapus file dari storage
      await supabase.storage.from("publik").remove([pathDihapus]);

      setGaleriPaths(sisaGaleri);
      toast.success("Foto galeri dihapus");
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menghapus foto galeri";
      toast.error(pesan);
    }
  }

  const logoUrl = urlPublik(logoPath);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Kolom Kiri: Informasi Bengkel */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi Bengkel</CardTitle>
          <CardDescription>
            Nama, alamat, dan kontak yang tampil pada invoice dan halaman publik bengkel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(simpanDataBengkel)}
            noValidate
            className="space-y-4"
          >
            <FieldGroup className="gap-3">
              <Controller
                name="nama"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="setelan-nama">Nama Bengkel *</FieldLabel>
                    <Input {...field} id="setelan-nama" />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="telepon"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="setelan-telepon">Nomor Telepon *</FieldLabel>
                    <Input {...field} id="setelan-telepon" />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="jam_buka"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="setelan-jam">Jam Operasional</FieldLabel>
                    <Input
                      {...field}
                      id="setelan-jam"
                      placeholder="Contoh: Senin - Sabtu: 08.00 - 17.00"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="alamat"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="setelan-alamat">Alamat Lengkap *</FieldLabel>
                    <Textarea {...field} id="setelan-alamat" rows={3} />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </FieldGroup>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={memprosesData}>
                {memprosesData ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Kolom Kanan: Logo & Galeri Bucket Publik */}
      <div className="space-y-6">
        {/* Card Logo Bengkel */}
        <Card>
          <CardHeader>
            <CardTitle>Logo Bengkel</CardTitle>
            <CardDescription>
              Logo ditampilkan di sidebar, halaman depan, dan cetak invoice. Format WebP/JPEG/PNG, maksimal 1 MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-bg-app">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Logo Bengkel"
                    fill
                    className="object-contain p-2"
                    unoptimized
                  />
                ) : (
                  <span className="text-xs text-muted-foreground text-center px-1">
                    Belum ada logo
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-strong transition-colors">
                  <UploadCloud className="h-4 w-4" />
                  <span>{mengunggahLogo ? "Mengunggah..." : "Pilih Logo Baru"}</span>
                  <input
                    type="file"
                    accept="image/webp,image/jpeg,image/png"
                    onChange={handleUploadLogo}
                    disabled={mengunggahLogo}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Otomatis diperkecil (1600px, WebP mutu 0.8) sebelum diunggah ke bucket publik.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Galeri Halaman Depan */}
        <Card>
          <CardHeader>
            <CardTitle>Galeri Foto Bengkel</CardTitle>
            <CardDescription>
              Menampilkan 3 sampai 6 foto fasilitas bengkel untuk halaman depan publik.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Jumlah foto tersimpan: <strong>{galeriPaths.length}</strong> / 6</span>
              {galeriPaths.length < 3 && (
                <span className="text-amber-600 font-medium">Disarankan minimal 3 foto</span>
              )}
            </div>

            {/* Kisi Galeri Foto */}
            <div className="grid grid-cols-3 gap-3">
              {galeriPaths.map((path, idx) => {
                const url = urlPublik(path);
                return (
                  <div
                    key={path}
                    className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-bg-app"
                  >
                    {url && (
                      <Image
                        src={url}
                        alt={`Galeri ${idx + 1}`}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        unoptimized
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleHapusGaleri(idx)}
                      title="Hapus foto"
                      className="absolute right-1.5 top-1.5 rounded-full bg-danger/90 p-1 text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 hover:bg-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}

              {/* Tombol Tambah Foto */}
              {galeriPaths.length < 6 && (
                <label className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-bg-app transition-colors text-muted-foreground hover:text-primary">
                  <ImagePlus className="h-6 w-6 mb-1" />
                  <span className="text-xs font-medium">
                    {mengunggahGaleri ? "Mengunggah..." : "+ Foto"}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/webp,image/jpeg,image/png"
                    onChange={handleUploadGaleri}
                    disabled={mengunggahGaleri}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
