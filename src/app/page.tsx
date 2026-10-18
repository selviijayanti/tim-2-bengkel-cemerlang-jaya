import Link from "next/link";
import Image from "next/image";
import {
  Wrench,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Car,
  LogIn,
  Gauge,
  Sliders,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

interface LayananItem {
  nama: string;
  kategori: string;
  deskripsi: string;
  kode?: string;
}

const LAYANAN_DEFAULT: LayananItem[] = [
  {
    nama: "Ganti Oli Mesin & Filter",
    kategori: "Perawatan Rutin",
    deskripsi:
      "Pengurasan pelumas mesin lama secara tuntas, penggantian filter oli baru berstandar pabrikan, dan pengecekan kebocoran karter.",
  },
  {
    nama: "Tune-Up & Ruang Bakar",
    kategori: "Performa Mesin",
    deskripsi:
      "Pembersihan throttle body, pemeriksaan celah busi, filter udara, dan optimalisasi rasio kompresi pembakaran bahan bakar.",
  },
  {
    nama: "Servis Sistem Rem",
    kategori: "Keamanan Berkendara",
    deskripsi:
      "Pembersihan kaliper, pengukuran ketebalan kampas rem depan-belakang, kuras minyak rem, dan kalibrasi rem tangan.",
  },
  {
    nama: "Spooring & Balancing",
    kategori: "Kaki-Kaki & Kemudi",
    deskripsi:
      "Penyelarasan sudut camber, caster, dan toe roda menggunakan sensor komputer untuk kestabilan laju dan keausan ban yang merata.",
  },
  {
    nama: "Cek & Diagnostik Kelistrikan",
    kategori: "Sistem Elektrikal",
    deskripsi:
      "Pemeriksaan tegangan alternator, pengujian beban daya aki, penelusuran modul kelistrikan, dan pemindaian sensor kendaraan.",
  },
  {
    nama: "Servis AC Mobil Lengkap",
    kategori: "Sirkulasi & Pendingin",
    deskripsi:
      "Pembersihan blower dan evaporator, penggantian filter kabin, pengurasan oli kompresor, dan isi ulang freon murni.",
  },
];

const KEUNGGULAN = [
  {
    judul: "Teknisi Khusus & Terarah",
    deskripsi:
      "Setiap pekerjaan dipimpin oleh Kepala Mekanik berpengalaman dan dikerjakan oleh teknisi sesuai bidang keahliannya.",
  },
  {
    judul: "Kontrol Kualitas (QC) Bertahap",
    deskripsi:
      "Sebelum kendaraan diserahkan kembali, dilakukan inspeksi kelayakan fisik dan uji fungsi untuk memastikan perbaikan tuntas.",
  },
  {
    judul: "Spare Part Terdata & Terpercaya",
    deskripsi:
      "Penggunaan komponen suku cadang tercatat resmi dalam sistem inventaris, menjaga keaslian dan kesesuaian spesifikasi.",
  },
  {
    judul: "Riwayat Servis Digital",
    deskripsi:
      "Seluruh catatan keluhan, pengerjaan, dan suku cadang tersimpan rapi berdasarkan nomor plat untuk kemudahan perawatan berkala.",
  },
];

const TAHAPAN_KERJA = [
  {
    nomor: "01",
    judul: "Penerimaan & Pencatatan",
    uraian:
      "Admin meja depan mencatat identitas kendaraan, keluhan pemilik, kondisi awal fisik, dan estimasi waktu selesai.",
  },
  {
    nomor: "02",
    judul: "Pemeriksaan & Eksekusi",
    uraian:
      "Kepala Mekanik memeriksa kendaraan, menugaskan mekanik, dan mencatat suku cadang serta jasa servis yang digunakan.",
  },
  {
    nomor: "03",
    judul: "Pemeriksaan Akhir (QC)",
    uraian:
      "Uji kelayakan pasca-servis dilakukan secara cermat sebelum mobil dinyatakan siap diambil oleh pemiliknya.",
  },
  {
    nomor: "04",
    judul: "Penyerahan & Transparansi",
    uraian:
      "Dokumentasi kondisi akhir diperiksa, rincian pembayaran dijelaskan tanpa biaya tersembunyi, dan kendaraan diserahterimakan.",
  },
];

export default async function Beranda() {
  const supabase = await createClient();

  // Ambil setelan bengkel (PRD 6.2 & 6.11)
  const { data: setelan } = await supabase
    .from("workshop_settings")
    .select("nama, alamat, telepon, jam_buka, logo_path, galeri_paths")
    .eq("id", 1)
    .maybeSingle();

  // Ambil daftar jasa aktif (PRD 6.2 - maksimal 8)
  const { data: dbJasa } = await supabase
    .from("inventory_items")
    .select("id, kode, nama")
    .eq("jenis", "jasa")
    .eq("aktif", true)
    .limit(8);

  const namaBengkel = setelan?.nama || "Cemerlang Jaya Motor";
  const alamatBengkel = setelan?.alamat || "Jl. Raya Cibubur No. 88, Jakarta Timur";
  const teleponBengkel = setelan?.telepon || "021-8770 1234";
  const jamBukaBengkel =
    setelan?.jam_buka || "Senin sampai Sabtu, 08.00 sampai 17.00 WIB";

  // Gabungkan jasa database dengan metadata tampilan
  const daftarLayanan: LayananItem[] =
    dbJasa && dbJasa.length > 0
      ? dbJasa.map((item) => {
          const matchDefault = LAYANAN_DEFAULT.find(
            (def) => def.nama.toLowerCase() === item.nama.toLowerCase(),
          );
          return {
            nama: item.nama,
            kode: item.kode,
            kategori: matchDefault ? matchDefault.kategori : "Layanan Teknis",
            deskripsi: matchDefault
              ? matchDefault.deskripsi
              : "Layanan perbaikan dan perawatan berkala oleh tim mekanik berpengalaman.",
          };
        })
      : LAYANAN_DEFAULT;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text)] flex flex-col font-sans selection:bg-[var(--primary-soft)] selection:text-[var(--primary-strong)]">
      {/* 1. Bar Informasi Atas */}
      <div className="bg-[var(--text)] text-white text-xs py-2 px-4 border-b border-neutral-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-4 text-neutral-300">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 text-[var(--primary)]" />
              {jamBukaBengkel}
            </span>
            <span className="hidden md:inline-block text-neutral-600">|</span>
            <span className="hidden md:inline-flex items-center gap-1.5">
              <MapPin className="size-3.5 text-[var(--primary)]" />
              {alamatBengkel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-neutral-300">
              <Phone className="size-3.5 text-[var(--primary)]" />
              {teleponBengkel}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Navigasi Utama */}
      <header className="sticky top-0 z-40 bg-[var(--bg-app)]/95 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[var(--primary-strong)] text-white flex items-center justify-center shadow-sm">
              <Wrench className="size-5" />
            </div>
            <div>
              <span className="font-semibold text-base text-[var(--text)] tracking-tight block">
                {namaBengkel}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] block -mt-0.5">
                Bengkel Perawatan & Perbaikan Mobil
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--text-body)]">
            <a
              href="#keunggulan"
              className="hover:text-[var(--primary-strong)] transition-colors"
            >
              Keunggulan
            </a>
            <a
              href="#layanan"
              className="hover:text-[var(--primary-strong)] transition-colors"
            >
              Layanan Jasa
            </a>
            <a
              href="#alur-kerja"
              className="hover:text-[var(--primary-strong)] transition-colors"
            >
              Alur Pengerjaan
            </a>
            <a
              href="#kontak"
              className="hover:text-[var(--primary-strong)] transition-colors"
            >
              Lokasi & Kontak
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-[10px] bg-[var(--primary-strong)] hover:bg-[#1565C0] text-white shadow-sm transition-all"
            >
              <LogIn className="size-3.5" />
              <span>Portal Masuk Staf</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 3. Hero Section */}
      <section className="relative overflow-hidden py-12 md:py-16 border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Kolom Teks & Aksi */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-soft)] text-[var(--primary-strong)] text-xs font-semibold mb-5">
                <ShieldCheck className="size-3.5" />
                Standar Operasional Tertata & Teruji
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--text)] leading-tight mb-4">
                Perawatan Presisi untuk Performa Kendaraan Anda
              </h1>
              <p className="text-base sm:text-lg text-[var(--text-body)] leading-relaxed mb-8">
                Pusat perbaikan dan perawatan kendaraan dengan alur kerja terstruktur. Setiap kendaraan dicatat melalui Work Order digital, ditangani langsung oleh tim mekanik berpengalaman, dan melalui uji kelayakan Quality Control sebelum diserahkan kembali.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="#layanan"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[var(--primary-strong)] hover:bg-[#1565C0] text-white text-sm font-medium shadow-sm transition-all"
                >
                  Lihat Daftar Layanan
                  <ArrowRight className="size-4" />
                </a>
                <a
                  href="#kontak"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[var(--bg-panel)] hover:bg-neutral-50 text-[var(--text)] border border-neutral-200 text-sm font-medium shadow-sm transition-all"
                >
                  <Phone className="size-4 text-[var(--text-muted)]" />
                  Hubungi Bengkel
                </a>
              </div>
            </div>

            {/* Kolom Foto Pengerjaan Mekanik */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                <div className="overflow-hidden rounded-2xl border border-neutral-200/90 shadow-[0_4px_24px_rgba(16,24,40,0.08)] bg-neutral-100">
                  <Image
                    src="/hero-mechanic.jpg"
                    alt="Mekanik profesional sedang memperbaiki mesin kendaraan di bengkel Cemerlang Jaya Motor"
                    width={800}
                    height={600}
                    priority
                    className="w-full h-auto object-cover aspect-[4/3] hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Kartu Ringkasan Indikator Kualitas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-12 pt-8 border-t border-neutral-200/80">
            <div className="bg-[var(--bg-panel)] p-4 rounded-xl border border-neutral-200/60 shadow-[0_1px_4px_rgba(16,24,40,0.04)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">
                Pemeriksaan Kendaraan
              </div>
              <div className="text-sm font-semibold text-[var(--text)] mt-1">
                Kondisi Awal & Akhir
              </div>
            </div>
            <div className="bg-[var(--bg-panel)] p-4 rounded-xl border border-neutral-200/60 shadow-[0_1px_4px_rgba(16,24,40,0.04)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">
                Sistem Pengerjaan
              </div>
              <div className="text-sm font-semibold text-[var(--text)] mt-1">
                Dua Tim Mekanik Terarah
              </div>
            </div>
            <div className="bg-[var(--bg-panel)] p-4 rounded-xl border border-neutral-200/60 shadow-[0_1px_4px_rgba(16,24,40,0.04)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">
                Uji Akhir Kerja
              </div>
              <div className="text-sm font-semibold text-[var(--text)] mt-1">
                Verifikasi Quality Control
              </div>
            </div>
            <div className="bg-[var(--bg-panel)] p-4 rounded-xl border border-neutral-200/60 shadow-[0_1px_4px_rgba(16,24,40,0.04)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">
                Suku Cadang
              </div>
              <div className="text-sm font-semibold text-[var(--text)] mt-1">
                Transparan & Terinventarisir
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Keunggulan Sistem Bengkel */}
      <section id="keunggulan" className="py-16 border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-xl mb-10">
            <div className="text-xs font-semibold text-[var(--primary-strong)] uppercase tracking-wider mb-2">
              Standar Profesional
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">
              Mengapa Mempercayakan Kendaraan di Bengkel Kami
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {KEUNGGULAN.map((item, idx) => (
              <div
                key={idx}
                className="bg-[var(--bg-panel)] rounded-xl p-5 border border-neutral-200 shadow-[0_1px_4px_rgba(16,24,40,0.06)] flex flex-col justify-between"
              >
                <div>
                  <div className="size-9 rounded-lg bg-[var(--primary-soft)] text-[var(--primary-strong)] flex items-center justify-center mb-4">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <h3 className="font-semibold text-base text-[var(--text)] mb-2">
                    {item.judul}
                  </h3>
                  <p className="text-xs leading-relaxed text-[var(--text-body)]">
                    {item.deskripsi}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Layanan Servis Unggulan (PRD 6.2 - Maksimal 8 Layanan) */}
      <section id="layanan" className="py-16 border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <div className="text-xs font-semibold text-[var(--primary-strong)] uppercase tracking-wider mb-2">
                Pilihan Perawatan
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">
                Layanan Teknis Kendaraan
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-md">
              Daftar jasa perbaikan yang ditangani langsung oleh teknisi
              berpengalaman menggunakan peralatan bengkel terstandarisasi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {daftarLayanan.map((layanan, idx) => (
              <div
                key={idx}
                className="group p-5 rounded-xl border border-neutral-200 bg-[var(--bg-panel)] hover:border-[var(--primary-strong)]/60 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-semibold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-[var(--bg-app)] border border-neutral-200 text-[var(--primary-strong)]">
                    {layanan.kategori}
                  </span>
                  {layanan.kode && (
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {layanan.kode}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-base text-[var(--text)] mb-2 group-hover:text-[var(--primary-strong)] transition-colors">
                  {layanan.nama}
                </h3>
                <p className="text-xs text-[var(--text-body)] leading-relaxed">
                  {layanan.deskripsi}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Alur Pengerjaan Tertib */}
      <section id="alur-kerja" className="py-16 border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-semibold text-[var(--primary-strong)] uppercase tracking-wider mb-2">
              Transparansi Proses
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)] mb-3">
              Alur Perjalanan Kendaraan di Bengkel
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-body)]">
              Setiap langkah terdata dalam sistem Work Order terpadu untuk
              memastikan tidak ada perbaikan yang terlewat.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {TAHAPAN_KERJA.map((tahap, idx) => (
              <div
                key={idx}
                className="bg-[var(--bg-panel)] p-5 rounded-xl border border-neutral-200 shadow-sm relative flex flex-col justify-between"
              >
                <div>
                  <div className="text-2xl font-black font-mono text-[var(--primary-strong)] mb-3">
                    {tahap.nomor}
                  </div>
                  <h3 className="font-semibold text-sm text-[var(--text)] mb-2">
                    {tahap.judul}
                  </h3>
                  <p className="text-xs text-[var(--text-body)] leading-relaxed">
                    {tahap.uraian}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Fasilitas & Galeri Bengkel (PRD 6.2 - Galeri Foto Bengkel) */}
      <section className="py-16 border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <div className="text-xs font-semibold text-[var(--primary-strong)] uppercase tracking-wider mb-2">
                Fasilitas Fisik
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">
                Area Kerja & Peralatan
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-md">
              Fasilitas bengkel bersih dan tertata untuk mendukung proses servis
              yang akurat dan nyaman bagi pemilik mobil.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl border border-neutral-200 bg-[var(--bg-panel)] shadow-sm flex flex-col justify-between h-44">
              <div className="size-8 rounded-lg bg-[var(--primary-soft)] text-[var(--primary-strong)] flex items-center justify-center">
                <Car className="size-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-[var(--text)] mb-1">
                  Area Servis & Lift Hidrolik
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Stall pengerjaan kolong mobil berstandar keamanan industri.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-neutral-200 bg-[var(--bg-panel)] shadow-sm flex flex-col justify-between h-44">
              <div className="size-8 rounded-lg bg-[var(--primary-soft)] text-[var(--primary-strong)] flex items-center justify-center">
                <Gauge className="size-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-[var(--text)] mb-1">
                  Alat Diagnostik Komputer
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Scanner kelistrikan dan ECU untuk mendeteksi malfungsi sistem.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-neutral-200 bg-[var(--bg-panel)] shadow-sm flex flex-col justify-between h-44">
              <div className="size-8 rounded-lg bg-[var(--primary-soft)] text-[var(--primary-strong)] flex items-center justify-center">
                <Sliders className="size-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-[var(--text)] mb-1">
                  Peralatan Khusus Spooring
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Kalibrasi sudut roda dengan laser presisi untuk kestabilan.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-neutral-200 bg-[var(--bg-panel)] shadow-sm flex flex-col justify-between h-44">
              <div className="size-8 rounded-lg bg-[var(--primary-soft)] text-[var(--primary-strong)] flex items-center justify-center">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-[var(--text)] mb-1">
                  Ruang Suku Cadang Teratur
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Penyimpanan komponen kering, teratur, dan terhindar dari debu.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Informasi Lokasi, Jam Operasional & Kontak */}
      <section id="kontak" className="py-16 border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="bg-[var(--bg-panel)] rounded-2xl border border-neutral-200 shadow-sm p-6 sm:p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="text-xs font-semibold text-[var(--primary-strong)] uppercase tracking-wider mb-2">
                  Kunjungan & Konsultasi
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)] mb-4">
                  Informasi Kontak Bengkel
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-body)] leading-relaxed mb-6">
                  Silakan datang langsung ke lokasi bengkel kami atau hubungi
                  nomor layanan operasional untuk menanyakan jadwal servis dan
                  pemeriksaan kendaraan.
                </p>

                <div className="space-y-4 text-xs sm:text-sm">
                  <div className="flex items-start gap-3">
                    <MapPin className="size-5 text-[var(--primary-strong)] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-[var(--text)]">
                        Alamat Bengkel
                      </div>
                      <div className="text-[var(--text-body)] mt-0.5">
                        {alamatBengkel}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="size-5 text-[var(--primary-strong)] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-[var(--text)]">
                        Nomor Telepon
                      </div>
                      <div className="text-[var(--text-body)] mt-0.5">
                        {teleponBengkel}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="size-5 text-[var(--primary-strong)] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-[var(--text)]">
                        Jam Operasional
                      </div>
                      <div className="text-[var(--text-body)] mt-0.5">
                        {jamBukaBengkel}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--bg-app)] rounded-xl p-6 border border-neutral-200 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-base text-[var(--text)] mb-2">
                    Akses Sistem Manajemen Bengkel
                  </h3>
                  <p className="text-xs text-[var(--text-body)] leading-relaxed mb-6">
                    Aplikasi ini digunakan oleh Admin meja depan, Kepala Mekanik,
                    dan Pemilik Bengkel untuk mengelola alur penerimaan mobil,
                    pengerjaan Work Order, tagihan, serta stok suku cadang.
                  </p>
                </div>
                <div className="pt-4 border-t border-neutral-200">
                  <Link
                    href="/login"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-[var(--primary-strong)] hover:bg-[#1565C0] text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    <LogIn className="size-4" />
                    <span>Masuk ke Akun Staf Bengkel</span>
                  </Link>
                  <p className="text-[11px] text-center text-[var(--text-muted)] mt-2">
                    Hanya untuk pengguna terdaftar (Owner, Admin, Kepala Mekanik)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="mt-auto bg-[var(--bg-app)] py-8 border-t border-neutral-200 text-xs text-[var(--text-muted)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md bg-[var(--primary-strong)] text-white flex items-center justify-center">
              <Wrench className="size-3.5" />
            </div>
            <span className="font-medium text-[var(--text)]">
              {namaBengkel}
            </span>
          </div>

          <p className="text-center sm:text-right">
            Hak Cipta &copy; 2026 {namaBengkel}. Seluruh hak dilindungi.
          </p>
        </div>
      </footer>
    </div>
  );
}
