import { redirect } from "next/navigation";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormSetelan } from "./FormSetelan";

export default async function HalamanSetelan() {
  const profil = await ambilProfilSaya();

  // Hanya Owner yang berhak mengakses halaman setelan (PRD 6.11)
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  // Ambil hanya kolom yang ditampilkan dan diatur (hemat egress)
  const { data: setelan, error } = await supabase
    .from("workshop_settings")
    .select("id, nama, alamat, telepon, jam_buka, logo_path, galeri_paths")
    .eq("id", 1)
    .single();

  if (error || !setelan) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-text">Setelan Bengkel</h1>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Gagal memuat pengaturan bengkel. Pastikan data pengaturan awal sudah terpasang.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Setelan Bengkel</h1>
        <p className="text-sm text-muted-foreground">
          Atur identitas bengkel, logo untuk invoice dan sidebar, serta galeri foto untuk halaman depan publik.
        </p>
      </div>

      <FormSetelan setelan={setelan} />
    </div>
  );
}
