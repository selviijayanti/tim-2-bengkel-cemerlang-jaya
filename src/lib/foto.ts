import imageCompression from "browser-image-compression";
import type { createClient } from "@/lib/supabase/client";

export type JenisFoto = "stnk" | "kondisi_awal" | "kondisi_akhir" | "pengerjaan";

/**
 * Kompres foto sesuai ketentuan PRD 11.4:
 * - Foto penuh: sisi terpanjang maksimal 1600 px, format WebP, mutu 0,8, target < 400 KB.
 * - Thumbnail: lebar maksimal 320 px, format WebP, disimpan di subfolder thumb/.
 */
export async function kompresFoto(file: File): Promise<{ fotoPenuh: File; thumb: File }> {
  const opsiPenuh = {
    maxSizeMB: 0.4,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.8,
  };

  const opsiThumb = {
    maxSizeMB: 0.1,
    maxWidthOrHeight: 320,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.7,
  };

  const [fotoPenuhBlob, thumbBlob] = await Promise.all([
    imageCompression(file, opsiPenuh),
    imageCompression(file, opsiThumb),
  ]);

  const fotoPenuh = new File([fotoPenuhBlob], "foto.webp", { type: "image/webp" });
  const thumb = new File([thumbBlob], "thumb.webp", { type: "image/webp" });

  return { fotoPenuh, thumb };
}

/**
 * Unggah foto dan thumbnail-nya ke bucket private foto-wo,
 * lalu catat barisnya di tabel work_order_photos (PRD 11.1 & 11.2).
 */
export async function unggahFotoWO(
  supabase: ReturnType<typeof createClient>,
  workOrderId: string,
  jenis: JenisFoto,
  file: File,
  userId: string,
) {
  const { fotoPenuh, thumb } = await kompresFoto(file);
  const fileId = crypto.randomUUID();

  const pathPenuh = `${workOrderId}/${jenis}/${fileId}.webp`;
  const pathThumb = `${workOrderId}/${jenis}/thumb/${fileId}.webp`;

  // Unggah foto ukuran penuh
  const { error: errPenuh } = await supabase.storage
    .from("foto-wo")
    .upload(pathPenuh, fotoPenuh, {
      contentType: "image/webp",
      upsert: false,
    });

  if (errPenuh) throw errPenuh;

  // Unggah thumbnail
  const { error: errThumb } = await supabase.storage
    .from("foto-wo")
    .upload(pathThumb, thumb, {
      contentType: "image/webp",
      upsert: false,
    });

  if (errThumb) throw errThumb;

  // Catat path ukuran penuh ke database
  const { error: errDb } = await supabase.from("work_order_photos").insert({
    work_order_id: workOrderId,
    jenis,
    path: pathPenuh,
    diunggah_oleh: userId,
  });

  if (errDb) throw errDb;

  return { pathPenuh, pathThumb };
}
