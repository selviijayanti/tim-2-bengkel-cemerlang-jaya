"use client";

import { useState } from "react";
import { ArrowRight, Eye, FileDiff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tanggalWaktu } from "@/lib/format";
import type { Json } from "@/types/database";

type Props = {
  id: number;
  waktu: string;
  pelakuNama: string;
  pelakuPeran: string | null;
  aksi: string;
  tabel: string;
  dataId: string | null;
  alasan: string | null;
  sebelum: Json | null;
  sesudah: Json | null;
};

function formatJsonValue(val: unknown): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export function DialogDetailAudit({
  waktu,
  pelakuNama,
  pelakuPeran,
  aksi,
  tabel,
  dataId,
  alasan,
  sebelum,
  sesudah,
}: Props) {
  const [hanyaBerubah, setHanyaBerubah] = useState(true);

  const objSebelum = (sebelum && typeof sebelum === "object" && !Array.isArray(sebelum)
    ? (sebelum as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const objSesudah = (sesudah && typeof sesudah === "object" && !Array.isArray(sesudah)
    ? (sesudah as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const semuaKunci = Array.from(
    new Set([...Object.keys(objSebelum), ...Object.keys(objSesudah)]),
  ).sort();

  const daftarKunci = semuaKunci.filter((k) => {
    if (!hanyaBerubah) return true;
    const v1 = JSON.stringify(objSebelum[k]);
    const v2 = JSON.stringify(objSesudah[k]);
    return v1 !== v2;
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary hover:text-primary-strong">
          <Eye className="h-3.5 w-3.5" />
          Detail
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                aksi === "INSERT" ? "default" : aksi === "DELETE" ? "destructive" : "secondary"
              }
            >
              {aksi}
            </Badge>
            <DialogTitle className="text-lg">
              Perubahan pada <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{tabel}</code>
            </DialogTitle>
          </div>
          <DialogDescription>
            {tanggalWaktu(waktu)} oleh <span className="font-medium text-foreground">{pelakuNama}</span>
            {pelakuPeran && (
              <Badge variant="outline" className="ml-1.5 capitalize text-xs">
                {pelakuPeran.replace("_", " ")}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">ID / Nomor Data</p>
              <p className="font-mono font-medium text-foreground">{dataId || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aksi</p>
              <p className="font-medium text-foreground">{aksi}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-muted-foreground">Alasan / Catatan</p>
              <p className="font-medium text-foreground">{alasan || "-"}</p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 font-semibold text-foreground">
                <FileDiff className="h-4 w-4 text-primary" />
                Perbandingan Nilai
              </h4>
              {aksi === "UPDATE" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setHanyaBerubah(!hanyaBerubah)}
                >
                  {hanyaBerubah ? "Tampilkan Semua Kolom" : "Hanya Kolom Berubah"}
                </Button>
              )}
            </div>

            {aksi === "UPDATE" && (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-1/3">Kolom</TableHead>
                      <TableHead className="w-1/3">Sebelum</TableHead>
                      <TableHead className="w-1/3">Sesudah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daftarKunci.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                          Tidak ada perbedaan nilai yang terdeteksi.
                        </TableCell>
                      </TableRow>
                    ) : (
                      daftarKunci.map((kunci) => {
                        const valSebelum = objSebelum[kunci];
                        const valSesudah = objSesudah[kunci];
                        const berbeda = JSON.stringify(valSebelum) !== JSON.stringify(valSesudah);

                        return (
                          <TableRow key={kunci} className={berbeda ? "bg-amber-500/5 font-medium" : undefined}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{kunci}</TableCell>
                            <TableCell className={berbeda ? "text-danger" : "text-foreground"}>
                              <span className={berbeda ? "line-through opacity-80" : ""}>
                                {formatJsonValue(valSebelum)}
                              </span>
                            </TableCell>
                            <TableCell className={berbeda ? "text-success font-semibold" : "text-foreground"}>
                              {formatJsonValue(valSesudah)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {aksi === "INSERT" && (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-1/3">Kolom</TableHead>
                      <TableHead className="w-2/3">Nilai Baru</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(objSesudah).map(([kunci, nilai]) => (
                      <TableRow key={kunci}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{kunci}</TableCell>
                        <TableCell className="text-foreground">{formatJsonValue(nilai)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {aksi === "DELETE" && (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-1/3">Kolom</TableHead>
                      <TableHead className="w-2/3">Nilai yang Dihapus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(objSebelum).map(([kunci, nilai]) => (
                      <TableRow key={kunci}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{kunci}</TableCell>
                        <TableCell className="text-danger">{formatJsonValue(nilai)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
