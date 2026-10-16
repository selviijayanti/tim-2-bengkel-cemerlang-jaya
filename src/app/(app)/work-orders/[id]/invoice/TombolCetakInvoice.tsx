"use client";

import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function TombolCetakInvoice() {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 print:hidden mb-6">
      <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-2">
        <ArrowLeft className="size-4" />
        Kembali
      </Button>
      <Button onClick={() => window.print()} size="sm" className="gap-2 bg-primary text-primary-foreground">
        <Printer className="size-4" />
        Cetak Invoice (PDF)
      </Button>
    </div>
  );
}
