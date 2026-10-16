"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

const skemaPengguna = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi"),
  role: z.enum(["owner", "admin", "kepala_mekanik"]),
  aktif: z.boolean(),
});

type FormValues = z.infer<typeof skemaPengguna>;

export interface PenggunaItem {
  id: string;
  nama: string;
  email: string;
  role: "owner" | "admin" | "kepala_mekanik";
  aktif: boolean;
}

export function FormPengguna({ pengguna }: { pengguna: PenggunaItem }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [memproses, setMemproses] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(skemaPengguna),
    defaultValues: {
      nama: pengguna.nama,
      role: pengguna.role,
      aktif: pengguna.aktif,
    },
  });

  async function simpan(data: FormValues) {
    setMemproses(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          nama: data.nama,
          role: data.role,
          aktif: data.aktif,
        })
        .eq("id", pengguna.id);

      if (error) throw error;

      toast.success("Profil dan peran pengguna berhasil diperbarui");
      setBuka(false);
      router.refresh();
    } catch (err: unknown) {
      const pesan =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Gagal memperbarui pengguna";
      toast.error(pesan);
    } finally {
      setMemproses(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(v) => {
        setBuka(v);
        if (!v) {
          form.reset({
            nama: pengguna.nama,
            role: pengguna.role,
            aktif: pengguna.aktif,
          });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Kelola
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kelola Pengguna & Peran</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(simpan)} noValidate className="space-y-4">
          <FieldGroup className="gap-3">
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                value={pengguna.email}
                disabled
                className="bg-bg-app cursor-not-allowed opacity-80"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email terdaftar di Supabase Auth dan tidak dapat diubah di sini.
              </p>
            </div>

            <Controller
              name="nama"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="pengguna-nama">Nama Lengkap *</FieldLabel>
                  <Input {...field} id="pengguna-nama" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="role"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="pengguna-role">Peran *</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="pengguna-role" className="w-full">
                      <SelectValue placeholder="Pilih peran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner (Pemilik Bengkel)</SelectItem>
                      <SelectItem value="admin">Admin (Front Desk & Kasir)</SelectItem>
                      <SelectItem value="kepala_mekanik">Kepala Mekanik</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="aktif"
              control={form.control}
              render={({ field }) => (
                <Field className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <FieldLabel htmlFor="pengguna-aktif" className="text-sm font-medium">
                      Status Akun
                    </FieldLabel>
                    <p className="text-xs text-muted-foreground">
                      {field.value
                        ? "Akun aktif dan dapat masuk ke aplikasi."
                        : "Akun dinonaktifkan (tidak bisa login)."}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="pengguna-aktif"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBuka(false)}
              disabled={memproses}
            >
              Batal
            </Button>
            <Button type="submit" disabled={memproses}>
              {memproses ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
