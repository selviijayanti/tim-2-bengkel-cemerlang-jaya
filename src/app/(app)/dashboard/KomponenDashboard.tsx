"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ExternalLink,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { rupiah, rupiahRingkas, tanggal } from "@/lib/format";

export type Periode = "hari_ini" | "7_hari" | "30_hari" | "bulan_ini";

const OPSI_PERIODE: { key: Periode; label: string }[] = [
  { key: "hari_ini", label: "Hari ini" },
  { key: "7_hari", label: "7 hari" },
  { key: "30_hari", label: "30 hari" },
  { key: "bulan_ini", label: "Bulan ini" },
];

/**
 * Pemilih periode dashboard di kanan atas
 */
export function PenyaringPeriode({ aktif }: { aktif: Periode }) {
  const router = useRouter();

  const gantiPeriode = (p: Periode) => {
    router.push(`/dashboard?periode=${p}`);
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 text-xs">
      <Calendar className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
      {OPSI_PERIODE.map((opsi) => {
        const isAktif = aktif === opsi.key;
        return (
          <button
            key={opsi.key}
            type="button"
            onClick={() => gantiPeriode(opsi.key)}
            className={`rounded-md px-3 py-1.5 font-medium transition-all ${
              isAktif
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opsi.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Kartu KPI dengan angka besar, perbandingan periode sebelumnya, dan klik data sumber
 */
export function KartuKPI({
  judul,
  nilai,
  ikon: Ikon,
  perubahanPersen,
  keteranganPerubahan,
  keteranganTambahan,
  href,
  varianWarnaIkon = "text-primary",
}: {
  judul: string;
  nilai: string | number;
  ikon: LucideIcon;
  perubahanPersen?: number | null;
  keteranganPerubahan?: string;
  keteranganTambahan?: string;
  href?: string;
  varianWarnaIkon?: string;
}) {
  const adaPerubahan = typeof perubahanPersen === "number" && !isNaN(perubahanPersen);
  const naik = adaPerubahan && perubahanPersen >= 0;

  const content = (
    <Card className="group relative transition-all hover:border-primary/50 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-text-muted">{judul}</CardTitle>
        <div className="flex items-center gap-1">
          <Ikon className={`h-4 w-4 ${varianWarnaIkon}`} />
          {href && (
            <ExternalLink className="h-3 w-3 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums text-text">{nilai}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
          {adaPerubahan ? (
            <span
              className={`inline-flex items-center font-medium ${
                naik ? "text-success" : "text-danger"
              }`}
            >
              {naik ? (
                <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
              )}
              {Math.abs(Math.round(perubahanPersen))}%
            </span>
          ) : null}
          {keteranganPerubahan && <span>{keteranganPerubahan}</span>}
          {keteranganTambahan && <span>{keteranganTambahan}</span>}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block cursor-pointer">
        {content}
      </Link>
    );
  }

  return content;
}

/**
 * Tampilan kosong ketika data grafik tidak tersedia
 */
function TampilanKosong({ pesan = "Belum ada data untuk periode ini" }: { pesan?: string }) {
  return (
    <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <Inbox className="h-8 w-8 stroke-1 text-muted-foreground/60" />
      <p className="text-xs">{pesan}</p>
    </div>
  );
}

// -------------------------------------------------------------
// 1. GRAFIK TREN HARIAN (Area Chart)
// -------------------------------------------------------------
export type DataTrenHarian = {
  tanggal: string;
  pendapatan?: number;
  modal?: number;
  laba?: number;
  pendapatan_jasa?: number;
  pendapatan_part?: number;
  jumlah?: number;
};

export function GrafikTrenHarian({
  data,
  judul,
  keterangan,
  tipe,
  hrefSumber,
}: {
  data: DataTrenHarian[];
  judul: string;
  keterangan: string;
  tipe: "owner" | "admin" | "kepala_mekanik";
  hrefSumber?: string;
}) {
  const router = useRouter();
  const adaData = data.some((d) => (d.pendapatan ?? d.pendapatan_jasa ?? d.jumlah ?? 0) > 0);

  const chartConfig: ChartConfig = {
    pendapatan: { label: "Pendapatan", color: "var(--primary)" },
    modal: { label: "Modal", color: "var(--warning)" },
    laba: { label: "Laba", color: "var(--success)" },
    pendapatan_jasa: { label: "Jasa", color: "var(--primary-strong)" },
    pendapatan_part: { label: "Spare Part", color: "var(--primary)" },
    jumlah: { label: "WO Selesai", color: "var(--status-selesai)" },
  };

  const formatTgl = (tglStr: string) => {
    try {
      const d = new Date(tglStr);
      return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d);
    } catch {
      return tglStr;
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold text-text">{judul}</CardTitle>
          <CardDescription className="text-xs text-text-muted">{keterangan}</CardDescription>
        </div>
        {hrefSumber && (
          <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-primary">
            <Link href={hrefSumber}>
              Lihat Rincian <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {!adaData ? (
          <TampilanKosong pesan="Belum ada transaksi pendapatan pada periode ini." />
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              onClick={() => hrefSumber && router.push(hrefSumber)}
              className="cursor-pointer"
            >
              <defs>
                <linearGradient id="gradPendapatan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradLaba" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--success)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--success)" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradJasa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary-strong)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--primary-strong)" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradPart" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradJumlah" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--status-selesai)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--status-selesai)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="tanggal" tickFormatter={formatTgl} tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v) => (tipe === "kepala_mekanik" ? v : rupiahRingkas(v))}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as DataTrenHarian;
                  return (
                    <div className="rounded-lg border bg-background p-2.5 text-xs shadow-md">
                      <p className="font-semibold">{tanggal(item.tanggal)}</p>
                      <div className="mt-1.5 space-y-1">
                        {tipe === "owner" && (
                          <>
                            <p className="text-primary">
                              Pendapatan: {rupiah(item.pendapatan ?? 0)}
                            </p>
                            <p className="text-warning">Modal: {rupiah(item.modal ?? 0)}</p>
                            <p className="font-medium text-success">
                              Laba: {rupiah(item.laba ?? 0)}
                            </p>
                          </>
                        )}
                        {tipe === "admin" && (
                          <>
                            <p className="text-primary-strong">
                              Jasa: {rupiah(item.pendapatan_jasa ?? 0)}
                            </p>
                            <p className="text-primary">
                              Part: {rupiah(item.pendapatan_part ?? 0)}
                            </p>
                            <p className="font-medium text-foreground">
                              Total:{" "}
                              {rupiah((item.pendapatan_jasa ?? 0) + (item.pendapatan_part ?? 0))}
                            </p>
                          </>
                        )}
                        {tipe === "kepala_mekanik" && (
                          <p className="text-primary font-medium">
                            WO Selesai: {item.jumlah ?? 0} unit
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
              {tipe === "owner" && (
                <>
                  <Area
                    type="monotone"
                    dataKey="pendapatan"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradPendapatan)"
                  />
                  <Area
                    type="monotone"
                    dataKey="laba"
                    stroke="var(--success)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradLaba)"
                  />
                </>
              )}
              {tipe === "admin" && (
                <>
                  <Area
                    type="monotone"
                    dataKey="pendapatan_jasa"
                    stroke="var(--primary-strong)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradJasa)"
                  />
                  <Area
                    type="monotone"
                    dataKey="pendapatan_part"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradPart)"
                  />
                </>
              )}
              {tipe === "kepala_mekanik" && (
                <Area
                  type="monotone"
                  dataKey="jumlah"
                  stroke="var(--status-selesai)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gradJumlah)"
                />
              )}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 2. GRAFIK DONUT STATUS WO (PRD 7.1)
// -------------------------------------------------------------
const WARNA_STATUS: Record<string, string> = {
  menunggu: "#9E9E9E",
  dikerjakan: "#2196F3",
  tertunda: "#F59E0B",
  selesai: "#7E57C2",
  siap_diambil: "#4CAF50",
  diambil: "#2E7D32",
  dibatalkan: "#E53935",
};

const LABEL_STATUS: Record<string, string> = {
  menunggu: "Menunggu",
  dikerjakan: "Dikerjakan",
  tertunda: "Tertunda",
  selesai: "Selesai",
  siap_diambil: "Siap Diambil",
  diambil: "Diambil",
  dibatalkan: "Dibatalkan",
};

export function GrafikDonutStatus({
  data,
  judul = "Status Work Order",
  keterangan = "Komposisi status kunjungan mobil",
}: {
  data: { status: string; jumlah: number }[];
  judul?: string;
  keterangan?: string;
}) {
  const router = useRouter();
  const total = data.reduce((acc, curr) => acc + curr.jumlah, 0);
  const dataAktif = data.filter((d) => d.jumlah > 0);

  const chartConfig: ChartConfig = Object.fromEntries(
    Object.entries(WARNA_STATUS).map(([status, warna]) => [
      status,
      { label: LABEL_STATUS[status] ?? status, color: warna },
    ]),
  );

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold text-text">{judul}</CardTitle>
          <CardDescription className="text-xs text-text-muted">{keterangan}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-primary">
          <Link href="/work-orders">
            Lihat Semua <ExternalLink className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {total === 0 ? (
          <TampilanKosong pesan="Belum ada Work Order pada periode ini." />
        ) : (
          <div className="relative flex h-[280px] w-full flex-col items-center justify-center">
            {/* Donut Chart */}
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataAktif}
                  dataKey="jumlah"
                  nameKey="status"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  onClick={(_, index) => {
                    const item = dataAktif[index];
                    if (item?.status) {
                      router.push(`/work-orders?status=${item.status}`);
                    }
                  }}
                  className="cursor-pointer focus:outline-hidden"
                >
                  {dataAktif.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={WARNA_STATUS[entry.status] ?? "var(--primary)"}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as { status: string; jumlah: number };
                    const persen = total > 0 ? Math.round((item.jumlah / total) * 100) : 0;
                    return (
                      <div className="rounded-lg border bg-background p-2 text-xs shadow-md">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: WARNA_STATUS[item.status] }}
                          />
                          {LABEL_STATUS[item.status] ?? item.status}
                        </div>
                        <p className="mt-1 text-text-muted">
                          {item.jumlah} WO ({persen}%)
                        </p>
                        <p className="text-[10px] text-primary italic">Klik untuk buka daftar</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Total Text in Donut Center */}
            <div className="pointer-events-none absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold tabular-nums text-text">{total}</span>
              <span className="text-[11px] text-text-muted">Total WO</span>
            </div>

            {/* Legend Sederhana di Bawah */}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {dataAktif.map((item) => (
                <button
                  key={item.status}
                  type="button"
                  onClick={() => router.push(`/work-orders?status=${item.status}`)}
                  className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-foreground"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: WARNA_STATUS[item.status] }}
                  />
                  <span>{LABEL_STATUS[item.status] ?? item.status}:</span>
                  <span className="font-semibold tabular-nums text-foreground">{item.jumlah}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 3. GRAFIK BEBAN MEKANIK (Bar Chart)
// -------------------------------------------------------------
export function GrafikBebanMekanik({
  data,
  judul = "Beban Mekanik",
  keterangan = "Jumlah pengerjaan aktif dan selesai per mekanik",
}: {
  data: { mekanik: string; tim: string; wo_aktif: number; wo_selesai: number }[];
  judul?: string;
  keterangan?: string;
}) {
  const router = useRouter();
  const adaData = data.length > 0;

  const chartConfig: ChartConfig = {
    wo_aktif: { label: "WO Aktif", color: "var(--primary)" },
    wo_selesai: { label: "WO Selesai", color: "var(--success)" },
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold text-text">{judul}</CardTitle>
          <CardDescription className="text-xs text-text-muted">{keterangan}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-primary">
          <Link href="/tim-mekanik">
            Kelola Tim <ExternalLink className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {!adaData ? (
          <TampilanKosong pesan="Belum ada data mekanik aktif." />
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              onClick={() => router.push("/tim-mekanik")}
              className="cursor-pointer"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="mekanik" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as {
                    mekanik: string;
                    tim: string;
                    wo_aktif: number;
                    wo_selesai: number;
                  };
                  return (
                    <div className="rounded-lg border bg-background p-2 text-xs shadow-md">
                      <p className="font-semibold text-foreground">{item.mekanik}</p>
                      <p className="text-muted-foreground">Tim {item.tim}</p>
                      <div className="mt-1.5 space-y-0.5">
                        <p className="text-primary font-medium">WO Aktif: {item.wo_aktif}</p>
                        <p className="text-success font-medium">WO Selesai: {item.wo_selesai}</p>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                formatter={(val) => (val === "wo_aktif" ? "WO Aktif" : "WO Selesai")}
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
              <Bar dataKey="wo_aktif" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="wo_selesai" fill="var(--success)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 4. GRAFIK ITEM TERLARIS (Bar Chart Horizontal)
// -------------------------------------------------------------
export function GrafikTopItem({
  data,
  judul = "5 Item Terlaris",
  keterangan = "Spare part & jasa terbanyak terjual pada periode ini",
}: {
  data: { nama: string; jumlah: number; pendapatan: number }[];
  judul?: string;
  keterangan?: string;
}) {
  const router = useRouter();
  const adaData = data.length > 0;

  const chartConfig: ChartConfig = {
    jumlah: { label: "Kuantitas Terjual", color: "var(--primary-strong)" },
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold text-text">{judul}</CardTitle>
          <CardDescription className="text-xs text-text-muted">{keterangan}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-primary">
          <Link href="/inventory">
            Buka Inventory <ExternalLink className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {!adaData ? (
          <TampilanKosong pesan="Belum ada item yang terjual pada periode ini." />
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
              onClick={() => router.push("/inventory")}
              className="cursor-pointer"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="nama"
                tickLine={false}
                axisLine={false}
                width={100}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as {
                    nama: string;
                    jumlah: number;
                    pendapatan: number;
                  };
                  return (
                    <div className="rounded-lg border bg-background p-2 text-xs shadow-md">
                      <p className="font-semibold text-foreground">{item.nama}</p>
                      <p className="mt-1 text-primary">Terjual: {item.jumlah} unit</p>
                      <p className="font-medium text-success">
                        Pendapatan: {rupiah(item.pendapatan)}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="jumlah" fill="var(--primary-strong)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
