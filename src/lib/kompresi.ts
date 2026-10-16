import imageCompression from "browser-image-compression";

/**
 * Memperkecil foto sebelum diunggah sesuai PRD 11.4:
 * Sisi terpanjang maksimal 1600 px, format WebP, mutu 0,8. Target di bawah 400 KB.
 */
export async function kompresFoto(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.4,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.8,
  };
  try {
    const hasil = await imageCompression(file, options);
    // Pastikan nama file berakhiran .webp
    const namaWebp = file.name.replace(/\.[^/.]+$/, "") + ".webp";
    return new File([hasil], namaWebp, { type: "image/webp" });
  } catch {
    // Bila kompresi gagal, kembalikan file asli sebagai fallback
    return file;
  }
}
