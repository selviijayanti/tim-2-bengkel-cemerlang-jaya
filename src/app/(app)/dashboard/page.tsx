import Link from "next/link";
import {
  AlertTriangle,
  Car,
  CheckCircle,
  Clock,
  DollarSign,
  Package,
  Plus,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { rupiah } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import {
  GrafikBebanMekanik,
  GrafikDonutStatus,
  GrafikTopItem,
  GrafikTrenHarian,
  KartuKPI,
  PenyaringPeriode,
  type Periode,
} from "./KomponenDashboard";

type RingkasanOwner = {
  pendapatan: number;
  pendapatan_sebelumnya: number;
  laba_kotor: number;
  laba_kotor_sebelumnya: number;
  margin_persen: number;
  wo_aktif: number;
  wo_terlambat: number;
  piutang: number;
  peran: string;
  lama_hari: number;
};

type RingkasanAdmin = {
  mobil_masuk_hari_ini: number;
  siap_diambil: number;
  perlu_ditagih: number;
  pendapatan_hari_ini: number;
  pendapatan: number;
  pendapatan_sebelumnya: number;
  peran: string;
  lama_hari: number;
};

type RingkasanMekanik = {
  menunggu_ditugaskan: number;
  sedang_dikerjakan: number;
  menunggu_qc: number;
  terlambat: number;
  selesai_periode: number;
  selesai_sebelumnya: number;
  peran: string;
  lama_hari: number;
};

function hitungRentang(periode?: string): { dari: string; sampai: string; aktif: Periode } {
  const p: Periode =
    periode === "hari_ini" || periode === "7_hari" || periode === "30_hari"
      ? (periode as Periode)
      : "bulan_ini";

  const now = new Date();
  const jakartaStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "YYYY-MM-DD"

  const [y, m, d] = jakartaStr.split("-").map(Number);
  const tglIni = new Date(Date.UTC(y, m - 1, d));

  const formatISO = (date: Date) => date.toISOString().slice(0, 10);

  if (p === "hari_ini") {
    return { dari: jakartaStr, sampai: jakartaStr, aktif: p };
  }
  if (p === "7_hari") {
    const awal = new Date(tglIni);
    awal.setUTCDate(awal.getUTCDate() - 6);
    return { dari: formatISO(awal), sampai: jakartaStr, aktif: p };
  }
  if (p === "30_hari") {
    const awal = new Date(tglIni);
    awal.setUTCDate(awal.getUTCDate() - 29);
    return { dari: formatISO(awal), sampai: jakartaStr, aktif: p };
  }

  // bulan_ini (default): 1 s/d akhir bulan
  const awalBulan = `${y}-${String(m).padStart(2, "0")}-01`;
  const akhirBulanDate = new Date(Date.UTC(y, m, 0));
  return { dari: awalBulan, sampai: formatISO(akhirBulanDate), aktif: "bulan_ini" };
}

export default async function HalamanDashboard({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const profil = await ambilProfilSaya();
  const { periode } = await searchParams;
  const { dari, sampai, aktif } = hitungRentang(periode);

  const supabase = await createClient();

  // -------------------------------------------------------------------
  // DASHBOARD OWNER (PRD 12.2)
  // -------------------------------------------------------------------
  if (profil.peran === "owner") {
    const [
      { data: rawRingkasan },
      { data: labaHarian },
      { data: statusWo },
      { data: bebanMekanik },
      { data: topItem },
    ] = await Promise.all([
      supabase.rpc("dashboard_ringkasan", { p_dari: dari, p_sampai: sampai }),
      supabase.rpc("dashboard_laba_harian", { p_dari: dari, p_sampai: sampai }),
      supabase.rpc("dashboard_wo_per_status"),
      supabase.rpc("dashboard_beban_mekanik", { p_dari: dari, p_sampai: sampai }),
      supabase.rpc("dashboard_top_item", { p_dari: dari, p_sampai: sampai, p_jenis: "part" }),
    ]);

    const ringkasan = (rawRingkasan ?? {}) as unknown as RingkasanOwner;

    const pctPendapatan =
      ringkasan.pendapatan_sebelumnya > 0
        ? ((ringkasan.pendapatan - ringkasan.pendapatan_sebelumnya) /
            ringkasan.pendapatan_sebelumnya) *
          100
        : null;

    const pctLaba =
      ringkasan.laba_kotor_sebelumnya > 0
        ? ((ringkasan.laba_kotor - ringkasan.laba_kotor_sebelumnya) /
            ringkasan.laba_kotor_sebelumnya) *
          100
        : null;

    return (
      <div className="space-y-6">
        {/* Header Dashboard */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-text">Dashboard Owner</h1>
            <p className="text-sm text-text-muted">
              Ringkasan performa bisnis dan operasional bengkel ({profil.nama})
            </p>
          </div>
          <PenyaringPeriode aktif={aktif} />
        </div>

        {/* Kartu KPI Owner (PRD 12.2) */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <KartuKPI
            judul="Pendapatan"
            nilai={rupiah(ringkasan.pendapatan ?? 0)}
            ikon={DollarSign}
            perubahanPersen={pctPendapatan}
            keteranganPerubahan="vs periode lalu"
            href="/laporan-laba"
            varianWarnaIkon="text-primary"
          />
          <KartuKPI
            judul="Laba Kotor"
            nilai={rupiah(ringkasan.laba_kotor ?? 0)}
            ikon={Wallet}
            perubahanPersen={pctLaba}
            keteranganPerubahan="vs periode lalu"
            href="/laporan-laba"
            varianWarnaIkon="text-success"
          />
          <KartuKPI
            judul="Margin Laba"
            nilai={`${ringkasan.margin_persen ?? 0}%`}
            ikon={TrendingUp}
            keteranganTambahan="terhadap omset"
            href="/laporan-laba"
            varianWarnaIkon="text-primary-strong"
          />
          <KartuKPI
            judul="WO Aktif"
            nilai={`${ringkasan.wo_aktif ?? 0}`}
            ikon={Wrench}
            keteranganTambahan="sedang proses"
            href="/work-orders"
            varianWarnaIkon="text-primary"
          />
          <KartuKPI
            judul="WO Terlambat"
            nilai={`${ringkasan.wo_terlambat ?? 0}`}
            ikon={AlertTriangle}
            keteranganTambahan="lewat estimasi"
            href="/work-orders"
            varianWarnaIkon="text-danger"
          />
          <KartuKPI
            judul="Piutang Belum Lunas"
            nilai={rupiah(ringkasan.piutang ?? 0)}
            ikon={Clock}
            keteranganTambahan="invoice tertunda"
            href="/work-orders"
            varianWarnaIkon="text-warning"
          />
        </div>

        {/* Grafik Baris 1: Tren Pendapatan & Laba (Area) + Donut Status */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GrafikTrenHarian
            data={labaHarian ?? []}
            judul="Tren Pendapatan & Laba Harian"
            keterangan="Pergerakan total pendapatan dan laba bersih per hari"
            tipe="owner"
            hrefSumber="/laporan-laba"
          />
          <GrafikDonutStatus
            data={statusWo ?? []}
            judul="Komposisi Status Work Order"
            keterangan="Distribusi unit mobil di bengkel berdasarkan status"
          />
        </div>

        {/* Grafik Baris 2: Beban Mekanik + Top 5 Item */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GrafikBebanMekanik
            data={bebanMekanik ?? []}
            judul="Beban Tim Mekanik"
            keterangan="Perbandingan WO aktif dan selesai per mekanik"
          />
          <GrafikTopItem
            data={topItem ?? []}
            judul="5 Spare Part Terlaris"
            keterangan="Item spare part dengan kuantitas pemakaian tertinggi"
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // DASHBOARD ADMIN (PRD 12.3)
  // -------------------------------------------------------------------
  if (profil.peran === "admin") {
    const [
      { data: rawRingkasan },
      { data: pendapatanHarian },
      { data: statusWo },
      { data: topItem },
    ] = await Promise.all([
      supabase.rpc("dashboard_ringkasan", { p_dari: dari, p_sampai: sampai }),
      supabase.rpc("dashboard_pendapatan_harian", { p_dari: dari, p_sampai: sampai }),
      supabase.rpc("dashboard_wo_per_status"),
      supabase.rpc("dashboard_top_item", { p_dari: dari, p_sampai: sampai, p_jenis: "part" }),
    ]);

    const ringkasan = (rawRingkasan ?? {}) as unknown as RingkasanAdmin;

    const pctPendapatan =
      ringkasan.pendapatan_sebelumnya > 0
        ? ((ringkasan.pendapatan - ringkasan.pendapatan_sebelumnya) /
            ringkasan.pendapatan_sebelumnya) *
          100
        : null;

    return (
      <div className="space-y-6">
        {/* Header Dashboard & Aksi Cepat */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-text">Dashboard Admin</h1>
            <p className="text-sm text-text-muted">
              Penerimaan kendaraan, penagihan, dan kasir meja depan
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="gap-1.5 shadow-sm">
              <Link href="/work-orders/baru">
                <Plus className="h-4 w-4" />
                Work Order Baru
              </Link>
            </Button>
            <PenyaringPeriode aktif={aktif} />
          </div>
        </div>

        {/* Kartu KPI Admin (PRD 12.3) */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KartuKPI
            judul="Mobil Masuk Hari Ini"
            nilai={`${ringkasan.mobil_masuk_hari_ini ?? 0} unit`}
            ikon={Car}
            keteranganTambahan="kunjungan hari ini"
            href="/work-orders"
            varianWarnaIkon="text-primary"
          />
          <KartuKPI
            judul="Siap Diambil"
            nilai={`${ringkasan.siap_diambil ?? 0} unit`}
            ikon={CheckCircle}
            keteranganTambahan="telah lulus QC"
            href="/work-orders?status=siap_diambil"
            varianWarnaIkon="text-success"
          />
          <KartuKPI
            judul="Perlu Ditagih"
            nilai={`${ringkasan.perlu_ditagih ?? 0} unit`}
            ikon={Clock}
            keteranganTambahan="invoice belum lunas"
            href="/work-orders?status=siap_diambil"
            varianWarnaIkon="text-warning"
          />
          <KartuKPI
            judul="Pendapatan Periode"
            nilai={rupiah(ringkasan.pendapatan ?? 0)}
            ikon={DollarSign}
            perubahanPersen={pctPendapatan}
            keteranganPerubahan="vs periode lalu"
            href="/work-orders"
            varianWarnaIkon="text-primary-strong"
          />
        </div>

        {/* Grafik Baris 1: Pendapatan Harian (Jasa vs Part) + Donut Status */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GrafikTrenHarian
            data={pendapatanHarian ?? []}
            judul="Pendapatan Harian (Jasa vs Part)"
            keterangan="Perbandingan penerimaan dari biaya jasa servis dan spare part"
            tipe="admin"
            hrefSumber="/work-orders"
          />
          <GrafikDonutStatus
            data={statusWo ?? []}
            judul="Status Work Order"
            keterangan="Sebaran seluruh pengerjaan mobil"
          />
        </div>

        {/* Grafik Baris 2: Top Item Terlaris */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GrafikTopItem
            data={topItem ?? []}
            judul="Spare Part Terlaris"
            keterangan="5 spare part paling sering dipasang pada periode ini"
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // DASHBOARD KEPALA MEKANIK (PRD 12.4)
  // -------------------------------------------------------------------
  const [
    { data: rawRingkasan },
    { data: woSelesaiHarian },
    { data: statusWo },
    { data: bebanMekanik },
  ] = await Promise.all([
    supabase.rpc("dashboard_ringkasan", { p_dari: dari, p_sampai: sampai }),
    supabase.rpc("dashboard_wo_selesai_harian", { p_dari: dari, p_sampai: sampai }),
    supabase.rpc("dashboard_wo_per_status"),
    supabase.rpc("dashboard_beban_mekanik", { p_dari: dari, p_sampai: sampai }),
  ]);

  const ringkasan = (rawRingkasan ?? {}) as unknown as RingkasanMekanik;

  const pctSelesai =
    ringkasan.selesai_sebelumnya > 0
      ? ((ringkasan.selesai_periode - ringkasan.selesai_sebelumnya) /
          ringkasan.selesai_sebelumnya) *
        100
      : null;

  return (
    <div className="space-y-6">
      {/* Header Dashboard */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text">Dashboard Tim Mekanik</h1>
          <p className="text-sm text-text-muted">
            Monitoring pengerjaan dan efisiensi tim ({profil.nama})
          </p>
        </div>
        <PenyaringPeriode aktif={aktif} />
      </div>

      {/* Kartu KPI Kepala Mekanik (PRD 12.4) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KartuKPI
          judul="Menunggu Ditugaskan"
          nilai={`${ringkasan.menunggu_ditugaskan ?? 0} WO`}
          ikon={Clock}
          keteranganTambahan="perlu penunjukan mekanik"
          href="/work-orders?status=menunggu"
          varianWarnaIkon="text-muted-foreground"
        />
        <KartuKPI
          judul="Sedang Dikerjakan"
          nilai={`${ringkasan.sedang_dikerjakan ?? 0} WO`}
          ikon={Wrench}
          keteranganTambahan="dalam pengerjaan tim"
          href="/work-orders?status=dikerjakan"
          varianWarnaIkon="text-primary"
        />
        <KartuKPI
          judul="Menunggu QC"
          nilai={`${ringkasan.menunggu_qc ?? 0} WO`}
          ikon={CheckCircle}
          keteranganTambahan="pengerjaan rampung"
          href="/work-orders?status=selesai"
          varianWarnaIkon="text-status-selesai"
        />
        <KartuKPI
          judul="Terlambat"
          nilai={`${ringkasan.terlambat ?? 0} WO`}
          ikon={AlertTriangle}
          keteranganTambahan="lewat estimasi waktu"
          href="/work-orders"
          varianWarnaIkon="text-danger"
        />
      </div>

      {/* Grafik Baris 1: WO Selesai Harian + Donut Status Tim */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GrafikTrenHarian
          data={woSelesaiHarian ?? []}
          judul="Penyelesaian WO per Hari"
          keterangan="Tren jumlah mobil yang diselesaikan oleh tim"
          tipe="kepala_mekanik"
          hrefSumber="/work-orders?status=selesai"
        />
        <GrafikDonutStatus
          data={statusWo ?? []}
          judul="Status WO Tim"
          keterangan="Distribusi penugasan pada tim Anda"
        />
      </div>

      {/* Grafik Baris 2: Beban Mekanik Tim */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GrafikBebanMekanik
          data={bebanMekanik ?? []}
          judul="Beban Mekanik Tim"
          keterangan="Persebaran pekerjaan aktif dan selesai per mekanik"
        />
      </div>
    </div>
  );
}
