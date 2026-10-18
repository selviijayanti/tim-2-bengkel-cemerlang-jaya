-- ============================================================================
-- Fitur C: Inventory & Storage Publik
-- 1. catat_stok_masuk(p_item, p_jumlah, p_keterangan)
-- 2. sesuaikan_stok(p_item, p_stok_fisik, p_alasan)
-- 3. Bucket publik & Storage Policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fungsi catat_stok_masuk (PRD 9.2)
-- Dipanggil oleh: Admin, Owner
-- Item: jenis 'part', jumlah minimal 1
-- Mengunci baris item dengan FOR UPDATE, menambah stok, dan mencatat stock_movements
-- ----------------------------------------------------------------------------
create or replace function public.catat_stok_masuk(
  p_item uuid,
  p_jumlah int,
  p_keterangan text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_item record;
  v_stok_baru int;
begin
  -- Periksa peran pemanggil
  v_peran := private.peran_saya();
  if v_peran is null or v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh mencatat stok masuk';
  end if;

  -- Validasi jumlah
  if p_jumlah is null or p_jumlah < 1 then
    raise exception 'Jumlah stok masuk harus minimal 1';
  end if;

  -- Kunci baris item dengan FOR UPDATE
  select id, jenis, stok into v_item
  from public.inventory_items
  where id = p_item
  for update;

  if not found then
    raise exception 'Item tidak ditemukan';
  end if;

  if v_item.jenis <> 'part' then
    raise exception 'Hanya spare part yang memiliki stok';
  end if;

  -- Tambah stok
  update public.inventory_items
  set stok = stok + p_jumlah,
      updated_at = now()
  where id = p_item
  returning stok into v_stok_baru;

  -- Catat riwayat pergerakan stok
  insert into public.stock_movements (
    item_id,
    jenis,
    jumlah,
    stok_sesudah,
    keterangan,
    dicatat_oleh
  ) values (
    p_item,
    'masuk',
    p_jumlah,
    v_stok_baru,
    p_keterangan,
    auth.uid()
  );
end;
$$;

revoke all on function public.catat_stok_masuk(uuid, int, text) from public, anon;
grant execute on function public.catat_stok_masuk(uuid, int, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 2. Fungsi sesuaikan_stok (PRD 9.2)
-- Dipanggil oleh: Owner
-- Item: jenis 'part', stok fisik >= 0, alasan wajib diisi
-- Mengunci baris item dengan FOR UPDATE, menghitung selisih, mengubah stok,
-- dan mencatat stock_movements (jenis 'penyesuaian')
-- ----------------------------------------------------------------------------
create or replace function public.sesuaikan_stok(
  p_item uuid,
  p_stok_fisik int,
  p_alasan text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_item record;
  v_selisih int;
begin
  -- Periksa peran pemanggil (hanya Owner)
  v_peran := private.peran_saya();
  if v_peran is null or v_peran <> 'owner' then
    raise exception 'Hanya Owner yang boleh menyesuaikan stok';
  end if;

  -- Validasi stok fisik dan alasan
  if p_stok_fisik is null or p_stok_fisik < 0 then
    raise exception 'Stok fisik tidak boleh kurang dari 0';
  end if;

  if p_alasan is null or trim(p_alasan) = '' then
    raise exception 'Alasan penyesuaian stok wajib diisi';
  end if;

  -- Kunci baris item dengan FOR UPDATE
  select id, jenis, stok into v_item
  from public.inventory_items
  where id = p_item
  for update;

  if not found then
    raise exception 'Item tidak ditemukan';
  end if;

  if v_item.jenis <> 'part' then
    raise exception 'Hanya spare part yang memiliki stok';
  end if;

  -- Hitung selisih stok fisik terhadap stok sistem
  v_selisih := p_stok_fisik - v_item.stok;

  -- Perbarui stok item
  update public.inventory_items
  set stok = p_stok_fisik,
      updated_at = now()
  where id = p_item;

  -- Catat riwayat pergerakan stok
  insert into public.stock_movements (
    item_id,
    jenis,
    jumlah,
    stok_sesudah,
    keterangan,
    dicatat_oleh
  ) values (
    p_item,
    'penyesuaian',
    v_selisih,
    p_stok_fisik,
    p_alasan,
    auth.uid()
  );
end;
$$;

revoke all on function public.sesuaikan_stok(uuid, int, text) from public, anon;
grant execute on function public.sesuaikan_stok(uuid, int, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Bucket Storage Publik & Policy (PRD Bab 11)
-- Bucket: publik (1 MB, webp/jpeg/png)
-- Policy: Unduh/tampil publik tanpa policy select; Unggah/Ganti/Hapus hanya Owner
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'publik',
  'publik',
  true,
  1048576,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists "publik_unggah_owner" on storage.objects;
drop policy if exists "publik_ganti_owner" on storage.objects;
drop policy if exists "publik_hapus_owner" on storage.objects;

create policy "publik_unggah_owner" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'publik'
  and (select private.peran_saya()) = 'owner'
);

create policy "publik_ganti_owner" on storage.objects
for update to authenticated
using (
  bucket_id = 'publik'
  and (select private.peran_saya()) = 'owner'
)
with check (
  bucket_id = 'publik'
  and (select private.peran_saya()) = 'owner'
);

create policy "publik_hapus_owner" on storage.objects
for delete to authenticated
using (
  bucket_id = 'publik'
  and (select private.peran_saya()) = 'owner'
);
