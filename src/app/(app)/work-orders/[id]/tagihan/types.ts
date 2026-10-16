export interface InventoryItem {
  id: string;
  kode: string;
  nama: string;
  jenis: "part" | "jasa";
  harga_jual: number;
  stok: number;
}

export interface BillingItemCost {
  harga_modal: number;
}

export interface BillingItem {
  id: string;
  item_id: string;
  nama_item: string;
  jenis: "part" | "jasa";
  jumlah: number;
  harga_master: number;
  harga_dipakai: number;
  alasan_penyesuaian: string | null;
  disesuaikan_oleh: string | null;
  disesuaikan_at: string | null;
  ditambah_oleh: string | null;
  created_at: string;
  billing_item_costs?: BillingItemCost[] | null;
}

export interface Invoice {
  id: string;
  nomor: string;
  subtotal: number;
  diskon: number;
  total: number;
  terbayar: number;
  status_bayar: "belum_bayar" | "sebagian" | "lunas";
  diterbitkan_at: string;
}

export interface WorkOrder {
  id: string;
  nomor: string;
  status: string;
  kepala_mekanik_id: string;
  diskon: number;
  alasan_diskon: string | null;
  vehicle: {
    plat: string;
    merek_model: string;
  } | null;
  customer: {
    nama: string;
    telepon: string;
  } | null;
}
