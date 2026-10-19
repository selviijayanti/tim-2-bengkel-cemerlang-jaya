import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ExternalLink, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Kartu KPI (Server Component) dengan angka besar, perbandingan periode sebelumnya,
 * dan tautan klik ke data sumber.
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
