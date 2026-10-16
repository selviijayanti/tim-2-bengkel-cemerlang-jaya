"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PackagePlus } from "lucide-react";
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

const skemaStokMasuk = z.object({
  jumlah: z.number().int().min(1, "Jumlah stok masuk minimal 1"),
  keterangan: z.string().trim().optional(),
});

type FormValues = z.infer<typeof skemaStokMasuk>;

export function FormStokMasuk({
  item,
}: {
  item: { id: string; nama: string; kode: string; stok: number };
}) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [memproses, setMemproses] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(skemaStokMasuk),
    defaultValues: {
      jumlah: 1,
      keterangan: "",
    },
  });

  async function simpan(data: FormValues) {
    setMemproses(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.rpc("catat_stok_masuk", {
        p_item: item.id,
        p_jumlah: data.jumlah,
        p_keterangan: data.keterangan || undefined,
      });

      if (error) throw error;

      toast.success(`Stok masuk berhasil dicatat (+${data.jumlah})`);
      setBuka(false);
      form.reset({ jumlah: 1, keterangan: "" });
      router.refresh();
    } catch (err: unknown) {
      const pesan =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Gagal mencatat stok masuk";
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
        if (!v) form.reset({ jumlah: 1, keterangan: "" });
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <PackagePlus className="h-3.5 w-3.5 text-primary" />
          Stok Masuk
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat Stok Masuk</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-bg-app p-3 text-sm">
          <p className="font-semibold text-text">{item.nama}</p>
          <div className="flex justify-between text-muted-foreground mt-1">
            <span>Kode: <span className="font-mono">{item.kode}</span></span>
            <span>Stok saat ini: <strong className="text-text">{item.stok}</strong></span>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(simpan)} noValidate className="space-y-4">
          <FieldGroup className="gap-3">
            <Controller
              name="jumlah"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="jumlah-masuk">Jumlah Masuk *</FieldLabel>
                  <Input
                    {...field}
                    id="jumlah-masuk"
                    type="number"
                    min={1}
                    value={field.value ?? 1}
                    onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="keterangan"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="keterangan-masuk">Keterangan / Sumber</FieldLabel>
                  <Input
                    {...field}
                    id="keterangan-masuk"
                    placeholder="Contoh: Pembelian dari Toko Sinar"
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
