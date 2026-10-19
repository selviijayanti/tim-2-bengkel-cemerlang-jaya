import { notFound } from "next/navigation";
import { TabWorkOrder } from "@/components/TabWorkOrder";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { ClientTagihanView } from "./ClientTagihanView";
import type { BillingItem, InventoryItem, Invoice, WorkOrder } from "./types";

export default async function TagihanWorkOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // 1. Ambil Data Work Order
  const { data: woData, error: woError } = await supabase
    .from("work_orders")
    .select(`
      id,
      nomor,
      status,
      kepala_mekanik_id,
      diskon,
      alasan_diskon,
      vehicle:vehicles(plat, merek_model),
      customer:customers(nama, telepon)
    `)
    .eq("id", id)
    .maybeSingle();

  if (woError || !woData) {
    notFound();
  }

  const wo: WorkOrder = {
    id: woData.id,
    nomor: woData.nomor,
    status: woData.status,
    kepala_mekanik_id: woData.kepala_mekanik_id,
    diskon: woData.diskon,
    alasan_diskon: woData.alasan_diskon,
    vehicle: woData.vehicle ? { plat: woData.vehicle.plat, merek_model: woData.vehicle.merek_model } : null,
    customer: woData.customer ? { nama: woData.customer.nama, telepon: woData.customer.telepon } : null,
  };

  // 2. Ambil Baris Tagihan (billing_items)
  let itemsFormatted: BillingItem[] = [];

  if (profil.peran === "owner") {
    const { data: rawBillingOwner } = await supabase
      .from("billing_items")
      .select(`
        id,
        item_id,
        nama_item,
        jenis,
        jumlah,
        harga_master,
        harga_dipakai,
        alasan_penyesuaian,
        disesuaikan_oleh,
        disesuaikan_at,
        ditambah_oleh,
        created_at,
        billing_item_costs(harga_modal)
      `)
      .eq("work_order_id", id)
      .order("created_at", { ascending: true });

    itemsFormatted = (rawBillingOwner ?? []).map((b) => ({
      id: b.id,
      item_id: b.item_id,
      nama_item: b.nama_item,
      jenis: b.jenis as "part" | "jasa",
      jumlah: b.jumlah,
      harga_master: b.harga_master,
      harga_dipakai: b.harga_dipakai,
      alasan_penyesuaian: b.alasan_penyesuaian,
      disesuaikan_oleh: b.disesuaikan_oleh,
      disesuaikan_at: b.disesuaikan_at,
      ditambah_oleh: b.ditambah_oleh,
      created_at: b.created_at,
      billing_item_costs: b.billing_item_costs ? [{ harga_modal: b.billing_item_costs.harga_modal }] : null,
    }));
  } else {
    const { data: rawBilling } = await supabase
      .from("billing_items")
      .select(`
        id,
        item_id,
        nama_item,
        jenis,
        jumlah,
        harga_master,
        harga_dipakai,
        alasan_penyesuaian,
        disesuaikan_oleh,
        disesuaikan_at,
        ditambah_oleh,
        created_at
      `)
      .eq("work_order_id", id)
      .order("created_at", { ascending: true });

    itemsFormatted = (rawBilling ?? []).map((b) => ({
      id: b.id,
      item_id: b.item_id,
      nama_item: b.nama_item,
      jenis: b.jenis as "part" | "jasa",
      jumlah: b.jumlah,
      harga_master: b.harga_master,
      harga_dipakai: b.harga_dipakai,
      alasan_penyesuaian: b.alasan_penyesuaian,
      disesuaikan_oleh: b.disesuaikan_oleh,
      disesuaikan_at: b.disesuaikan_at,
      ditambah_oleh: b.ditambah_oleh,
      created_at: b.created_at,
    }));
  }

  // 3. Ambil Invoice jika ada
  const { data: rawInvoice } = await supabase
    .from("invoices")
    .select("id, nomor, subtotal, diskon, total, terbayar, status_bayar, diterbitkan_at")
    .eq("work_order_id", id)
    .maybeSingle();

  const invoice: Invoice | null = rawInvoice
    ? {
        id: rawInvoice.id,
        nomor: rawInvoice.nomor,
        subtotal: rawInvoice.subtotal,
        diskon: rawInvoice.diskon,
        total: rawInvoice.total,
        terbayar: rawInvoice.terbayar,
        status_bayar: rawInvoice.status_bayar as "belum_bayar" | "sebagian" | "lunas",
        diterbitkan_at: rawInvoice.diterbitkan_at,
      }
    : null;

  // 4. Ambil Pilihan Inventory (Spare Part & Jasa aktif)
  const { data: rawInventory } = await supabase
    .from("inventory_items")
    .select("id, kode, nama, jenis, harga_jual, stok")
    .eq("aktif", true)
    .order("nama", { ascending: true });

  const inventoryOptions: InventoryItem[] = (rawInventory ?? []).map((i) => ({
    id: i.id,
    kode: i.kode,
    nama: i.nama,
    jenis: i.jenis as "part" | "jasa",
    harga_jual: i.harga_jual,
    stok: i.stok,
  }));

  return (
    <div className="space-y-6">
      <TabWorkOrder id={id} />

      <ClientTagihanView
        wo={wo}
        billingItems={itemsFormatted}
        invoice={invoice}
        inventoryOptions={inventoryOptions}
        peran={profil.peran}
        userId={profil.id}
      />
    </div>
  );
}
