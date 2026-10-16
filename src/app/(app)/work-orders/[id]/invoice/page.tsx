import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rupiah, tanggal } from "@/lib/format";
import { TombolCetakInvoice } from "./TombolCetakInvoice";

export default async function InvoiceWorkOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Ambil data Invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(`
      id,
      nomor,
      subtotal,
      diskon,
      total,
      terbayar,
      status_bayar,
      diterbitkan_at,
      work_order_id
    `)
    .eq("work_order_id", id)
    .maybeSingle();

  if (invoiceError || !invoice) {
    notFound();
  }

  // 2. Ambil data Work Order, Pelanggan, dan Kendaraan
  const { data: wo } = await supabase
    .from("work_orders")
    .select(`
      id,
      nomor,
      odometer,
      created_at,
      vehicle:vehicles(plat, merek_model, tahun, warna),
      customer:customers(nama, telepon, alamat)
    `)
    .eq("id", id)
    .maybeSingle();

  // 3. Ambil data baris tagihan (Item, Jumlah, Harga Dipakai, Subtotal)
  // PRD 6.9: Tidak memuat penanda penyesuaian harga, harga master, maupun harga modal
  const { data: billingItems } = await supabase
    .from("billing_items")
    .select(`
      id,
      nama_item,
      jenis,
      jumlah,
      harga_dipakai
    `)
    .eq("work_order_id", id)
    .order("created_at", { ascending: true });

  // 4. Ambil Setelan Bengkel (id = 1)
  const { data: setelan } = await supabase
    .from("workshop_settings")
    .select("nama, alamat, telepon")
    .eq("id", 1)
    .maybeSingle();

  const items = billingItems ?? [];
  const statusLabel =
    invoice.status_bayar === "lunas"
      ? "LUNAS"
      : invoice.status_bayar === "sebagian"
      ? "DIBAYAR SEBAGIAN"
      : "BELUM DIBAYAR";

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background print:p-0 print:max-w-none text-slate-900">
      <TombolCetakInvoice />

      {/* Lembar Invoice A4 */}
      <div className="border border-border print:border-none p-8 sm:p-12 rounded-xl bg-card shadow-sm print:shadow-none print:p-0">
        {/* Header Bengkel & Info Invoice */}
        <div className="flex justify-between items-start border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-primary">
              {setelan?.nama || "Cemerlang Jaya Motor"}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {setelan?.alamat || "Bengkel Mobil & Spesialis Perawatan Mesin"}
            </p>
            <p className="text-xs text-muted-foreground">Telp: {setelan?.telepon || "-"}</p>
          </div>

          <div className="text-right">
            <span className="inline-block px-3 py-1 text-xs font-bold uppercase rounded-md bg-muted text-muted-foreground mb-2">
              Invoice Tagihan
            </span>
            <p className="text-lg font-black text-text">{invoice.nomor}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tanggal: {tanggal(invoice.diterbitkan_at)}
            </p>
            <p className="text-xs text-muted-foreground">No. WO: {wo?.nomor || "-"}</p>
          </div>
        </div>

        {/* Informasi Pelanggan & Kendaraan */}
        <div className="grid grid-cols-2 gap-8 py-6 border-b border-border text-xs">
          <div>
            <span className="font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Ditagihkan Kepada:
            </span>
            <p className="text-sm font-bold text-text">{wo?.customer?.nama || "-"}</p>
            <p className="text-muted-foreground mt-0.5">{wo?.customer?.telepon || "-"}</p>
            {wo?.customer?.alamat && (
              <p className="text-muted-foreground mt-0.5">{wo?.customer.alamat}</p>
            )}
          </div>

          <div>
            <span className="font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Detail Kendaraan:
            </span>
            <p className="text-sm font-bold text-text">{wo?.vehicle?.plat || "-"}</p>
            <p className="text-muted-foreground mt-0.5">
              {wo?.vehicle?.merek_model || "-"} {wo?.vehicle?.tahun ? `(${wo.vehicle.tahun})` : ""}
            </p>
            <p className="text-muted-foreground mt-0.5">
              Odometer: {wo?.odometer ? `${wo.odometer.toLocaleString("id-ID")} km` : "-"}
            </p>
          </div>
        </div>

        {/* Tabel Rincian Item */}
        <div className="py-6">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="py-2.5 px-3 font-semibold text-center w-12">#</th>
                <th className="py-2.5 px-3 font-semibold">Deskripsi Item / Jasa</th>
                <th className="py-2.5 px-3 font-semibold text-center w-24">Jumlah</th>
                <th className="py-2.5 px-3 font-semibold text-right w-36">Harga Satuan</th>
                <th className="py-2.5 px-3 font-semibold text-right w-40">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="py-3 px-3 text-center text-muted-foreground">{idx + 1}</td>
                  <td className="py-3 px-3 font-medium text-text">
                    {item.nama_item}
                    <span className="text-[10px] text-muted-foreground ml-2 capitalize">
                      ({item.jenis === "part" ? "Part" : "Jasa"})
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-semibold">{item.jumlah}</td>
                  <td className="py-3 px-3 text-right">{rupiah(item.harga_dipakai)}</td>
                  <td className="py-3 px-3 text-right font-semibold text-text">
                    {rupiah(item.jumlah * item.harga_dipakai)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Perhitungan Total & Pembayaran */}
        <div className="flex justify-between items-start pt-4 border-t border-border">
          <div className="space-y-2">
            <div className="inline-block border border-border px-3 py-1.5 rounded-lg">
              <span className="text-[11px] text-muted-foreground block">Status Pembayaran:</span>
              <span
                className={`text-sm font-black tracking-wide ${
                  invoice.status_bayar === "lunas"
                    ? "text-success"
                    : invoice.status_bayar === "sebagian"
                    ? "text-primary"
                    : "text-danger"
                }`}
              >
                {statusLabel}
              </span>
            </div>
            {invoice.terbayar > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Telah dibayar: <span className="font-semibold">{rupiah(invoice.terbayar)}</span>
              </p>
            )}
          </div>

          <div className="w-64 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium text-text">{rupiah(invoice.subtotal)}</span>
            </div>
            {invoice.diskon > 0 && (
              <div className="flex justify-between text-danger">
                <span>Diskon:</span>
                <span>-{rupiah(invoice.diskon)}</span>
              </div>
            )}
            <div className="border-t border-border pt-2 flex justify-between text-sm font-black text-text">
              <span>Total Tagihan:</span>
              <span>{rupiah(invoice.total)}</span>
            </div>
            {invoice.terbayar > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Sudah Dibayar:</span>
                <span>{rupiah(invoice.terbayar)}</span>
              </div>
            )}
            {invoice.status_bayar !== "lunas" && (
              <div className="border-t border-dashed border-border pt-1 flex justify-between font-bold text-danger">
                <span>Sisa Pembayaran:</span>
                <span>{rupiah(Math.max(0, invoice.total - invoice.terbayar))}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tanda Tangan */}
        <div className="grid grid-cols-2 gap-12 mt-16 text-center text-xs">
          <div>
            <p className="text-muted-foreground">Tanda Tangan Pelanggan,</p>
            <div className="h-20" />
            <p className="font-semibold text-text border-t border-border inline-block px-8 pt-1">
              ( {wo?.customer?.nama || "Pelanggan"} )
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Kasir / Admin Bengkel,</p>
            <div className="h-20" />
            <p className="font-semibold text-text border-t border-border inline-block px-8 pt-1">
              ( {setelan?.nama || "Cemerlang Jaya Motor"} )
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
