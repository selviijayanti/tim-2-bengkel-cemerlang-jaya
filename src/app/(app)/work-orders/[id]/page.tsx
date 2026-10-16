import { notFound } from "next/navigation";
import { TabWorkOrder } from "@/components/TabWorkOrder";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { RincianWorkOrderClient } from "./RincianWorkOrderClient";

const STATUS_AKTIF = ["dikerjakan", "tertunda", "selesai"];

export default async function RincianWorkOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // 1. Ambil data Work Order lengkap dengan relasinya
  const { data: wo, error } = await supabase
    .from("work_orders")
    .select(`
      id,
      nomor,
      status,
      odometer,
      keluhan,
      diagnosis,
      estimasi_selesai,
      catatan_status,
      created_at,
      selesai_at,
      diambil_at,
      kepala_mekanik_id,
      vehicles!inner (
        id,
        plat,
        merek_model,
        tahun,
        warna,
        transmisi
      ),
      customers!inner (
        id,
        nama,
        telepon,
        alamat,
        tipe
      ),
      profiles!work_orders_kepala_mekanik_id_fkey (
        id,
        nama
      ),
      work_order_mekanik (
        mekanik:mekanik_id (
          id,
          nama
        )
      ),
      billing_items (count),
      invoices (
        id,
        nomor,
        status_bayar,
        total
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !wo) {
    notFound();
  }

  // 2. Ambil Foto dan Buat Signed URL (PRD 11.3)
  const { data: rawPhotos } = await supabase
    .from("work_order_photos")
    .select("id, jenis, path, created_at")
    .eq("work_order_id", id)
    .order("created_at", { ascending: true });

  const photosList = rawPhotos ?? [];
  let photosWithUrls: {
    id: string;
    jenis: string;
    path: string;
    urlPenuh: string;
    urlThumb: string;
    created_at: string;
  }[] = [];

  if (photosList.length > 0) {
    // Siapkan path ukuran penuh dan thumbnail
    const pathsToSign: string[] = [];
    photosList.forEach((p) => {
      pathsToSign.push(p.path);
      const parts = p.path.split("/");
      if (parts.length === 3) {
        pathsToSign.push(`${parts[0]}/${parts[1]}/thumb/${parts[2]}`);
      }
    });

    const { data: signedUrls } = await supabase.storage
      .from("foto-wo")
      .createSignedUrls(pathsToSign, 600);

    const urlMap = new Map<string, string>();
    signedUrls?.forEach((item) => {
      if (item.path && item.signedUrl) {
        urlMap.set(item.path, item.signedUrl);
      }
    });

    photosWithUrls = photosList.map((p) => {
      const parts = p.path.split("/");
      const thumbPath = parts.length === 3 ? `${parts[0]}/${parts[1]}/thumb/${parts[2]}` : p.path;
      return {
        id: p.id,
        jenis: p.jenis,
        path: p.path,
        urlPenuh: urlMap.get(p.path) || "",
        urlThumb: urlMap.get(thumbPath) || urlMap.get(p.path) || "",
        created_at: p.created_at,
      };
    });
  }

  // 3. Ambil Riwayat Status WO (PRD 6.8 & 7.3)
  const { data: rawHistory } = await supabase
    .from("wo_status_history")
    .select(`
      id,
      dari_status,
      ke_status,
      catatan,
      created_at,
      profiles!wo_status_history_oleh_fkey (
        nama,
        role
      )
    `)
    .eq("work_order_id", id)
    .order("created_at", { ascending: true });

  // 4. Ambil Daftar Mekanik Tim dan Beban Aktifnya
  const [{ data: mekanikTimList }, { data: penugasanAktif }, { data: listKepala }] =
    await Promise.all([
      supabase
        .from("mekanik")
        .select("id, nama")
        .eq("kepala_mekanik_id", wo.kepala_mekanik_id)
        .eq("aktif", true)
        .order("nama"),
      supabase
        .from("work_order_mekanik")
        .select("mekanik_id, work_orders!inner(status)")
        .in("work_orders.status", STATUS_AKTIF),
      supabase
        .from("profiles")
        .select("id, nama")
        .eq("role", "kepala_mekanik")
        .eq("aktif", true)
        .order("nama"),
    ]);

  const bebanMekanik = new Map<string, number>();
  penugasanAktif?.forEach((p) => {
    bebanMekanik.set(p.mekanik_id, (bebanMekanik.get(p.mekanik_id) ?? 0) + 1);
  });

  const mekanikDenganBeban = (mekanikTimList ?? [])
    .map((m) => ({
      id: m.id,
      nama: m.nama,
      woAktif: bebanMekanik.get(m.id) ?? 0,
    }))
    .sort((a, b) => a.woAktif - b.woAktif);

  // Normalisasi data untuk props client
  const invoiceData = Array.isArray(wo.invoices) ? wo.invoices[0] : wo.invoices;
  const billingCount = Array.isArray(wo.billing_items)
    ? wo.billing_items[0]?.count ?? 0
    : (wo.billing_items as unknown as { count: number })?.count ?? 0;

  const normalizedWO = {
    id: wo.id,
    nomor: wo.nomor,
    status: wo.status,
    odometer: wo.odometer,
    keluhan: wo.keluhan,
    diagnosis: wo.diagnosis,
    estimasi_selesai: wo.estimasi_selesai,
    catatan_status: wo.catatan_status,
    created_at: wo.created_at,
    selesai_at: wo.selesai_at,
    diambil_at: wo.diambil_at,
    kepala_mekanik_id: wo.kepala_mekanik_id,
    kepala_mekanik: Array.isArray(wo.profiles) ? wo.profiles[0] : wo.profiles,
    vehicle: Array.isArray(wo.vehicles) ? wo.vehicles[0] : wo.vehicles,
    customer: Array.isArray(wo.customers) ? wo.customers[0] : wo.customers,
    mekanik_terpilih: (wo.work_order_mekanik ?? []).map((m: { mekanik: { id: string; nama: string } | { id: string; nama: string }[] }) =>
      Array.isArray(m.mekanik) ? m.mekanik[0] : m.mekanik,
    ).filter(Boolean),
    jumlah_item_tagihan: billingCount,
    invoice: invoiceData || null,
    photos: photosWithUrls,
    history: (rawHistory ?? []).map((h) => ({
      id: h.id,
      dari_status: h.dari_status,
      ke_status: h.ke_status,
      catatan: h.catatan,
      created_at: h.created_at,
      pelaku: Array.isArray(h.profiles) ? h.profiles[0] : h.profiles,
    })),
  };

  return (
    <div className="space-y-6">
      <TabWorkOrder id={id} />
      <RincianWorkOrderClient
        wo={normalizedWO}
        profil={profil}
        mekanikTim={mekanikDenganBeban}
        daftarKepala={listKepala ?? []}
      />
    </div>
  );
}
