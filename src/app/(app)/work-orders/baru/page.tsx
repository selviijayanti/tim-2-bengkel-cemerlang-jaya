import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormWorkOrderBaru } from "./FormWorkOrderBaru";

const STATUS_AKTIF = ["dikerjakan", "tertunda", "selesai"];

export default async function HalamanWorkOrderBaru() {
  const profil = await ambilProfilSaya();

  // Hanya Admin dan Owner yang boleh membuat Work Order (PRD 6.6 & 6.7)
  if (profil.peran !== "admin" && profil.peran !== "owner") {
    redirect("/work-orders");
  }

  const supabase = await createClient();

  // Ambil daftar kepala mekanik aktif dan hitung WO aktif tiap tim
  const [{ data: listKepala }, { data: woAktifRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nama")
      .eq("role", "kepala_mekanik")
      .eq("aktif", true)
      .order("nama"),
    supabase
      .from("work_orders")
      .select("kepala_mekanik_id")
      .in("status", STATUS_AKTIF),
  ]);

  const hitungAktif = new Map<string, number>();
  woAktifRows?.forEach((w) => {
    hitungAktif.set(w.kepala_mekanik_id, (hitungAktif.get(w.kepala_mekanik_id) ?? 0) + 1);
  });

  const listPilihan = (listKepala ?? []).map((k) => ({
    id: k.id,
    nama: k.nama,
    woAktif: hitungAktif.get(k.id) ?? 0,
  }));

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/work-orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-text"
        >
          <ChevronLeft className="size-4" />
          Kembali ke Daftar
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-text">Buat Work Order Baru</h1>
        <p className="text-sm text-muted-foreground">
          Penerimaan kendaraan dan pendaftaran pekerjaan servis baru (PRD 6.7)
        </p>
      </div>

      <FormWorkOrderBaru listKepala={listPilihan} userId={profil.id} />
    </div>
  );
}
