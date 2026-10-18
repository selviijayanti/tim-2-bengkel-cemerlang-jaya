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

const skemaSparePart = z.object({
  nama: z.string().trim().min(1, "Nama spare part wajib diisi"),
  kode: z.string().trim(),
  harga_jual: z.number().min(0, "Harga jual minimal Rp0"),
  stok_minimum: z.number().min(0, "Stok minimum minimal 0"),
  harga_modal: z.number().min(0, "Harga modal minimal Rp0").optional(),
});

type FormValues = z.infer<typeof skemaSparePart>;

export interface SparePartItem {
  id: string;
  kode: string;
  nama: string;
  stok: number;
  harga_jual: number;
  stok_minimum: number;
  aktif: boolean;
  harga_modal?: number | null;
}


export function FormSparePart({
  item,
  isOwner,
}: {
  item?: SparePartItem;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [memproses, setMemproses] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(skemaSparePart),
    defaultValues: {
      nama: item?.nama ?? "",
      kode: item?.kode ?? "",
      harga_jual: item?.harga_jual ?? 0,
      stok_minimum: item?.stok_minimum ?? 5,
      harga_modal: item?.harga_modal ?? 0,
    },
  });

  async function simpan(data: FormValues) {
    setMemproses(true);
    const supabase = createClient();

    try {
      if (item) {
        // Mode Ubah
        const { error: errItem } = await supabase
          .from("inventory_items")
          .update({
            nama: data.nama,
            harga_jual: data.harga_jual,
            stok_minimum: data.stok_minimum,
          })
          .eq("id", item.id);

        if (errItem) throw errItem;

        // Jika Owner, perbarui harga modal di tabel inventory_costs
        if (isOwner && data.harga_modal !== undefined) {
          const { error: errModal } = await supabase
            .from("inventory_costs")
            .upsert({
              item_id: item.id,
              harga_modal: data.harga_modal,
              updated_at: new Date().toISOString(),
            });
          if (errModal) throw errModal;
        }

        toast.success("Spare part berhasil diperbarui");
      } else {
        // Mode Tambah Baru (Stok awal selalu 0, kode kosong otomatis SP-xxxx via trigger)
        const { data: itemBaru, error: errItem } = await supabase
          .from("inventory_items")
          .insert({
            jenis: "part",
            nama: data.nama,
            harga_jual: data.harga_jual,
            stok_minimum: data.stok_minimum,
            kode: data.kode.trim() || "",
          })
          .select("id")
          .single();

        if (errItem) {
          if (errItem.code === "23505") {
            form.setError("kode", { message: "Kode/SKU ini sudah digunakan" });
            return;
          }
          throw errItem;
        }

        // Jika Owner dan harga modal diisi, simpan ke inventory_costs
        if (isOwner && data.harga_modal !== undefined && itemBaru) {
          const { error: errModal } = await supabase
            .from("inventory_costs")
            .insert({
              item_id: itemBaru.id,
              harga_modal: data.harga_modal,
            });
          if (errModal) throw errModal;
        }

        toast.success("Spare part baru berhasil ditambahkan");
      }

      setBuka(false);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menyimpan spare part";
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
            Spare Part
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Ubah Spare Part" : "Tambah Spare Part"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(simpan)} noValidate className="space-y-4">
          <FieldGroup className="gap-3">
            <Controller
              name="nama"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="part-nama">Nama Spare Part *</FieldLabel>
                  <Input {...field} id="part-nama" placeholder="Contoh: Oli Mesin 4L" />
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
                    <FieldLabel htmlFor="part-kode">Kode / SKU (Opsional)</FieldLabel>
                    <Input {...field} id="part-kode" placeholder="Kosongkan untuk otomatis (SP-0001)" />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="harga_jual"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="part-harga-jual">Harga Jual (Rp) *</FieldLabel>
                    <Input
                      {...field}
                      id="part-harga-jual"
                      type="number"
                      min={0}
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="stok_minimum"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="part-stok-min">Stok Minimum</FieldLabel>
                    <Input
                      {...field}
                      id="part-stok-min"
                      type="number"
                      min={0}
                      value={field.value ?? 5}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>

            {isOwner && (
              <Controller
                name="harga_modal"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="part-harga-modal">Harga Modal (Rp) *</FieldLabel>
                    <Input
                      {...field}
                      id="part-harga-modal"
                      type="number"
                      min={0}
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    />
                    <FieldError errors={[fieldState.error]} />
                    <p className="text-xs text-muted-foreground mt-1">
                      Hanya terlihat oleh Owner.
                    </p>
                  </Field>
                )}
              />
            )}
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
