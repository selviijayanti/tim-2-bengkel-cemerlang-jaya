"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";

const skemaJasa = z.object({
  nama: z.string().trim().min(1, "Nama jasa wajib diisi"),
  kode: z.string().trim(),
  harga_jual: z.number().min(0, "Tarif jasa minimal Rp0"),
});

type FormValues = z.infer<typeof skemaJasa>;

export interface JasaItem {
  id: string;
  kode: string;
  nama: string;
  harga_jual: number;
  aktif: boolean;
}

export function FormJasa({ item }: { item?: JasaItem }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [memproses, setMemproses] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(skemaJasa),
    defaultValues: {
      nama: item?.nama ?? "",
      kode: item?.kode ?? "",
      harga_jual: item?.harga_jual ?? 0,
    },
  });

  async function simpan(data: FormValues) {
    setMemproses(true);
    const supabase = createClient();

    try {
      if (item) {
        // Ubah Jasa
        const { error } = await supabase
          .from("inventory_items")
          .update({
            nama: data.nama,
            harga_jual: data.harga_jual,
          })
          .eq("id", item.id);

        if (error) throw error;
        toast.success("Jasa berhasil diperbarui");
      } else {
        // Tambah Jasa Baru (kode kosong otomatis JS-xxxx via trigger)
        const { error } = await supabase.from("inventory_items").insert({
          jenis: "jasa",
          nama: data.nama,
          harga_jual: data.harga_jual,
          stok: 0,
          kode: data.kode.trim() || "",
        });

        if (error) {
          if (error.code === "23505") {
            form.setError("kode", { message: "Kode jasa ini sudah digunakan" });
            return;
          }
          throw error;
        }

        toast.success("Jasa baru berhasil ditambahkan");
      }

      setBuka(false);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menyimpan jasa";
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
        if (!v) form.reset();
      }}
    >
      <DialogTrigger asChild>
        {item ? (
          <Button variant="outline" size="sm">
            <Pencil className="h-3.5 w-3.5" />
            Ubah
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4" />
            Jasa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Ubah Jasa" : "Tambah Jasa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(simpan)} noValidate className="space-y-4">
          <FieldGroup className="gap-3">
            <Controller
              name="nama"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="jasa-nama">Nama Jasa *</FieldLabel>
                  <Input {...field} id="jasa-nama" placeholder="Contoh: Ganti Oli / Tune-up" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            {!item && (
              <Controller
                name="kode"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="jasa-kode">Kode (Opsional)</FieldLabel>
                    <Input {...field} id="jasa-kode" placeholder="Kosongkan untuk otomatis (JS-0001)" />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            )}

            <Controller
              name="harga_jual"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="jasa-tarif">Tarif Jasa (Rp) *</FieldLabel>
                  <Input
                    {...field}
                    id="jasa-tarif"
                    type="number"
                    min={0}
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                  />
                  <FieldError errors={[fieldState.error]} />
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
              {memproses ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
