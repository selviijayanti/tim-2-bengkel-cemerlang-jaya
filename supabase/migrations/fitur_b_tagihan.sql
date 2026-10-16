-- ============================================================================
-- Fitur B: Tagihan dan Invoice (PRD 9.2)
-- ============================================================================

-- 1. tambah_item_tagihan
create or replace function public.tambah_item_tagihan(
  p_wo uuid,
  p_item uuid,
  p_jumlah int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo_status text;
  v_wo_tim uuid;
  v_item record;
  v_harga_modal bigint;
  v_billing_id uuid;
begin
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Tidak memiliki akses atau akun nonaktif';
  end if;

  select status, kepala_mekanik_id into v_wo_status, v_wo_tim
  from public.work_orders
  where id = p_wo;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  if v_peran = 'kepala_mekanik' and v_wo_tim != auth.uid() then
    raise exception 'Hanya Kepala Mekanik tim yang menangani WO ini atau Owner yang boleh menambah item';
  end if;

  if v_peran not in ('kepala_mekanik', 'owner') then
    raise exception 'Hanya Kepala Mekanik atau Owner yang dapat menambah item tagihan';
  end if;

  if v_wo_status != 'dikerjakan' then
    raise exception 'Item tagihan hanya dapat ditambahkan saat WO berstatus dikerjakan';
  end if;

  if p_jumlah is null or p_jumlah < 1 then
    raise exception 'Jumlah item minimal 1';
  end if;

  -- Kunci baris item inventory untuk update
  select id, kode, jenis, nama, harga_jual, stok, aktif
  into v_item
  from public.inventory_items
  where id = p_item
  for update;

  if not found then
    raise exception 'Item inventory tidak ditemukan';
  end if;

  if not v_item.aktif then
    raise exception 'Item % sedang tidak aktif', v_item.nama;
  end if;

  -- Jika jenis part, periksa stok dan kurangi
  if v_item.jenis = 'part' then
    if v_item.stok < p_jumlah then
      raise exception 'Stok % hanya %', v_item.nama, v_item.stok;
    end if;

    update public.inventory_items
    set stok = stok - p_jumlah,
        updated_at = now()
    where id = v_item.id;

    insert into public.stock_movements (
      item_id,
      jenis,
      jumlah,
      stok_sesudah,
      keterangan,
      work_order_id,
      dicatat_oleh
    ) values (
      v_item.id,
      'keluar',
      -p_jumlah,
      v_item.stok - p_jumlah,
      'Dipakai pada WO',
      p_wo,
      auth.uid()
    );
  end if;

  -- Dapatkan harga modal dari inventory_costs
  if v_item.jenis = 'part' then
    select coalesce(harga_modal, 0) into v_harga_modal
    from public.inventory_costs
    where item_id = v_item.id;
    if not found then
      v_harga_modal := 0;
    end if;
  else
    v_harga_modal := 0;
  end if;

  -- Tambahkan ke billing_items
  insert into public.billing_items (
    work_order_id,
    item_id,
    nama_item,
    jenis,
    jumlah,
    harga_master,
    harga_dipakai,
    ditambah_oleh
  ) values (
    p_wo,
    v_item.id,
    v_item.nama,
    v_item.jenis,
    p_jumlah,
    v_item.harga_jual,
    v_item.harga_jual,
    auth.uid()
  )
  returning id into v_billing_id;

  -- Simpan riwayat biaya modal rahasia
  insert into public.billing_item_costs (
    billing_item_id,
    harga_modal
  ) values (
    v_billing_id,
    v_harga_modal
  );

  return v_billing_id;
end;
$$;


-- 2. hapus_item_tagihan
create or replace function public.hapus_item_tagihan(
  p_billing_item uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_item record;
  v_wo record;
  v_stok_sekarang int;
begin
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Tidak memiliki akses atau akun nonaktif';
  end if;

  select id, work_order_id, item_id, jenis, jumlah, nama_item
  into v_item
  from public.billing_items
  where id = p_billing_item;

  if not found then
    raise exception 'Item tagihan tidak ditemukan';
  end if;

  select id, status, kepala_mekanik_id
  into v_wo
  from public.work_orders
  where id = v_item.work_order_id;

  if v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id != auth.uid() then
    raise exception 'Hanya Kepala Mekanik tim yang menangani WO ini atau Owner yang boleh menghapus item';
  end if;

  if v_peran not in ('kepala_mekanik', 'owner') then
    raise exception 'Hanya Kepala Mekanik atau Owner yang dapat menghapus item tagihan';
  end if;

  if v_wo.status != 'dikerjakan' then
    raise exception 'Item tagihan hanya dapat dihapus saat WO berstatus dikerjakan';
  end if;

  -- Bila spare part, kembalikan stok
  if v_item.jenis = 'part' then
    select stok into v_stok_sekarang
    from public.inventory_items
    where id = v_item.item_id
    for update;

    update public.inventory_items
    set stok = stok + v_item.jumlah,
        updated_at = now()
    where id = v_item.item_id;

    insert into public.stock_movements (
      item_id,
      jenis,
      jumlah,
      stok_sesudah,
      keterangan,
      work_order_id,
      dicatat_oleh
    ) values (
      v_item.item_id,
      'kembali',
      v_item.jumlah,
      v_stok_sekarang + v_item.jumlah,
      'Pengembalian dari pembatalan item WO',
      v_wo.id,
      auth.uid()
    );
  end if;

  -- Hapus billing item (billing_item_costs ikut terhapus karena cascade)
  delete from public.billing_items where id = p_billing_item;
end;
$$;


-- 3. sesuaikan_harga_item
create or replace function public.sesuaikan_harga_item(
  p_billing_item uuid,
  p_harga bigint,
  p_alasan text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_item record;
  v_invoice_exists boolean;
  v_harga_modal bigint;
  v_di_bawah_modal boolean := false;
begin
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang dapat menyesuaikan harga item';
  end if;

  if p_harga is null or p_harga < 0 then
    raise exception 'Harga baru tidak valid (harus lebih besar atau sama dengan 0)';
  end if;

  if p_alasan is null or trim(p_alasan) = '' then
    raise exception 'Alasan penyesuaian harga wajib diisi';
  end if;

  select id, work_order_id, harga_master, harga_dipakai
  into v_item
  from public.billing_items
  where id = p_billing_item;

  if not found then
    raise exception 'Item tagihan tidak ditemukan';
  end if;

  -- Periksa apakah invoice sudah terbit
  select exists(
    select 1 from public.invoices where work_order_id = v_item.work_order_id
  ) into v_invoice_exists;

  if v_invoice_exists then
    raise exception 'Harga item tidak dapat diubah karena invoice sudah diterbitkan';
  end if;

  -- Cek harga modal untuk peringatan di bawah modal
  select harga_modal into v_harga_modal
  from public.billing_item_costs
  where billing_item_id = p_billing_item;

  if coalesce(v_harga_modal, 0) > p_harga then
    v_di_bawah_modal := true;
  end if;

  -- Update harga dipakai dan alasan
  update public.billing_items
  set harga_dipakai = p_harga,
      alasan_penyesuaian = trim(p_alasan),
      disesuaikan_oleh = auth.uid(),
      disesuaikan_at = now()
  where id = p_billing_item;

  return v_di_bawah_modal;
end;
$$;


-- 4. atur_diskon
create or replace function public.atur_diskon(
  p_wo uuid,
  p_diskon bigint,
  p_alasan text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_invoice_exists boolean;
  v_subtotal bigint;
begin
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang dapat mengatur diskon';
  end if;

  if p_diskon is null or p_diskon < 0 then
    raise exception 'Nilai diskon tidak valid (harus >= 0)';
  end if;

  if p_diskon > 0 and (p_alasan is null or trim(p_alasan) = '') then
    raise exception 'Alasan diskon wajib diisi jika diskon lebih besar dari 0';
  end if;

  select exists(
    select 1 from public.invoices where work_order_id = p_wo
  ) into v_invoice_exists;

  if v_invoice_exists then
    raise exception 'Diskon tidak dapat diubah karena invoice sudah diterbitkan';
  end if;

  -- Hitung subtotal saat ini
  select coalesce(sum(jumlah * harga_dipakai), 0) into v_subtotal
  from public.billing_items
  where work_order_id = p_wo;

  if p_diskon > v_subtotal then
    raise exception 'Diskon (Rp%) tidak boleh melebihi subtotal tagihan (Rp%)', p_diskon, v_subtotal;
  end if;

  update public.work_orders
  set diskon = p_diskon,
      alasan_diskon = trim(p_alasan),
      updated_at = now()
  where id = p_wo;
end;
$$;


-- 5. terbitkan_invoice
create or replace function public.terbitkan_invoice(
  p_wo uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo record;
  v_subtotal bigint;
  v_total bigint;
  v_periode text;
  v_nomor_urut int;
  v_nomor_inv text;
  v_invoice_id uuid;
begin
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang dapat menerbitkan invoice';
  end if;

  select id, status, diskon
  into v_wo
  from public.work_orders
  where id = p_wo;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  if v_wo.status != 'siap_diambil' then
    raise exception 'Invoice hanya dapat diterbitkan bila status WO siap_diambil';
  end if;

  if exists(select 1 from public.invoices where work_order_id = p_wo) then
    raise exception 'Invoice untuk Work Order ini sudah diterbitkan';
  end if;

  -- Hitung subtotal
  select coalesce(sum(jumlah * harga_dipakai), 0) into v_subtotal
  from public.billing_items
  where work_order_id = p_wo;

  if v_subtotal = 0 then
    raise exception 'Tagihan masih kosong, tidak dapat menerbitkan invoice';
  end if;

  if v_wo.diskon > v_subtotal then
    raise exception 'Diskon melebihi subtotal tagihan';
  end if;

  v_total := v_subtotal - v_wo.diskon;

  -- Generate nomor invoice INV-YYYYMM-0001 dengan lock number_counters
  v_periode := to_char(now(), 'YYYYMM');
  v_nomor_urut := private.nomor_berikut('INV', v_periode);
  v_nomor_inv := 'INV-' || v_periode || '-' || lpad(v_nomor_urut::text, 4, '0');

  insert into public.invoices (
    work_order_id,
    nomor,
    subtotal,
    diskon,
    total,
    terbayar,
    status_bayar,
    diterbitkan_oleh,
    diterbitkan_at
  ) values (
    p_wo,
    v_nomor_inv,
    v_subtotal,
    v_wo.diskon,
    v_total,
    0,
    'belum_bayar',
    auth.uid(),
    now()
  )
  returning id into v_invoice_id;

  return v_invoice_id;
end;
$$;


-- 6. catat_pembayaran
create or replace function public.catat_pembayaran(
  p_invoice uuid,
  p_metode text,
  p_jumlah bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_inv record;
  v_sisa bigint;
  v_terbayar_baru bigint;
  v_status_baru text;
begin
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang dapat mencatat pembayaran';
  end if;

  if p_metode not in ('tunai', 'transfer', 'qris') then
    raise exception 'Metode pembayaran harus berupa tunai, transfer, atau qris';
  end if;

  if p_jumlah is null or p_jumlah <= 0 then
    raise exception 'Jumlah pembayaran harus lebih besar dari 0';
  end if;

  -- Kunci baris invoice untuk mencegah update bersamaan
  select id, total, terbayar, status_bayar
  into v_inv
  from public.invoices
  where id = p_invoice
  for update;

  if not found then
    raise exception 'Invoice tidak ditemukan';
  end if;

  if v_inv.status_bayar = 'lunas' then
    raise exception 'Invoice ini sudah lunas';
  end if;

  v_sisa := v_inv.total - v_inv.terbayar;
  if p_jumlah > v_sisa then
    raise exception 'Jumlah pembayaran (Rp%) melebihi sisa tagihan (Rp%)', p_jumlah, v_sisa;
  end if;

  v_terbayar_baru := v_inv.terbayar + p_jumlah;
  if v_terbayar_baru >= v_inv.total then
    v_status_baru := 'lunas';
  else
    v_status_baru := 'sebagian';
  end if;

  -- Simpan riwayat pembayaran
  insert into public.payments (
    invoice_id,
    metode,
    jumlah,
    dicatat_oleh
  ) values (
    p_invoice,
    p_metode,
    p_jumlah,
    auth.uid()
  );

  -- Update invoice
  update public.invoices
  set terbayar = v_terbayar_baru,
      status_bayar = v_status_baru
  where id = p_invoice;
end;
$$;


-- ---------- Hak Akses Eksekusi ----------
revoke all on function public.tambah_item_tagihan(uuid, uuid, int) from public, anon;
grant execute on function public.tambah_item_tagihan(uuid, uuid, int) to authenticated;

revoke all on function public.hapus_item_tagihan(uuid) from public, anon;
grant execute on function public.hapus_item_tagihan(uuid) to authenticated;

revoke all on function public.sesuaikan_harga_item(uuid, bigint, text) from public, anon;
grant execute on function public.sesuaikan_harga_item(uuid, bigint, text) to authenticated;

revoke all on function public.atur_diskon(uuid, bigint, text) from public, anon;
grant execute on function public.atur_diskon(uuid, bigint, text) to authenticated;

revoke all on function public.terbitkan_invoice(uuid) from public, anon;
grant execute on function public.terbitkan_invoice(uuid) to authenticated;

revoke all on function public.catat_pembayaran(uuid, text, bigint) from public, anon;
grant execute on function public.catat_pembayaran(uuid, text, bigint) to authenticated;
