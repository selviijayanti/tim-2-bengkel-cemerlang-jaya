"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SlidersHorizontal } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

const skemaSesuaikanStok = z.object({
  stok_fisik: z.number().int().min(0, "Stok fisik minimal 0"),
  alasan: z.string().trim().min(1, "Alasan penyesuaian stok wajib diisi"),
});

type FormValues = z.infer<typeof skemaSesuaikanStok>;

export function FormSesuaikanStok({
  item,
}: {
  item: { id: string; nama: string; kode: string; stok: number };
}) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [memproses, setMemproses] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(skemaSesuaikanStok),
    defaultValues: {
      stok_fisik: item.stok,
      alasan: "",
    },
  });

  const stokFisikInput = form.watch("stok_fisik");
  const selisih = (Number(stokFisikInput) || 0) - item.stok;

  async function simpan(data: FormValues) {
    setMemproses(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.rpc("sesuaikan_stok", {
        p_item: item.id,
        p_stok_fisik: data.stok_fisik,
        p_alasan: data.alasan,
      });

      if (error) throw error;

      toast.success("Penyesuaian stok berhasil disimpan");
      setBuka(false);
      form.reset({ stok_fisik: data.stok_fisik, alasan: "" });
      router.refresh();
    } catch (err: unknown) {
      const pesan =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Gagal menyesuaikan stok";
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
        if (!v) form.reset({ stok_fisik: item.stok, alasan: "" });
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-warning" />
          Sesuaikan Stok
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Penyesuaian Stok (Hanya Owner)</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-bg-app p-3 text-sm">
          <p className="font-semibold text-text">{item.nama}</p>
          <div className="flex justify-between text-muted-foreground mt-1">
            <span>Kode: <span className="font-mono">{item.kode}</span></span>
            <span>Stok di Sistem: <strong className="text-text">{item.stok}</strong></span>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(simpan)} noValidate className="space-y-4">
          <FieldGroup className="gap-3">
            <Controller
              name="stok_fisik"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="stok-fisik">Stok Hasil Hitung Fisik *</FieldLabel>
                  <Input
                    {...field}
                    id="stok-fisik"
                    type="number"
                    min={0}
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                  />
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Selisih dengan sistem:</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        selisih > 0
                          ? "text-success"
                          : selisih < 0
                          ? "text-danger"
                          : "text-muted-foreground"
                      }`}
                    >
                      {selisih > 0 ? `+${selisih}` : selisih}
                    </span>
                  </div>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="alasan"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="alasan-penyesuaian">Alasan Penyesuaian *</FieldLabel>
                  <Textarea
                    {...field}
                    id="alasan-penyesuaian"
                    rows={3}
                    placeholder="Contoh: Selisih opname fisik bulanan / barang rusak"
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
              {memproses ? "Menyimpan..." : "Simpan Penyesuaian"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
