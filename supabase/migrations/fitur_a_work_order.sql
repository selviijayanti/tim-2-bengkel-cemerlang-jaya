-- =============================================================
-- App 4 Cemerlang Jaya Motor · Fitur A: Work Order
-- Sesuai PRD Bab 7.2, 9.2, 9.4, 10.2, dan 11
-- =============================================================

-- ---------- 1. Fungsi buat_work_order ----------
create or replace function public.buat_work_order(
  p_vehicle_id uuid,
  p_kepala_mekanik_id uuid,
  p_odometer int,
  p_keluhan text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_customer_id uuid;
  v_nomor_urut int;
  v_nomor text;
  v_wo_id uuid;
begin
  -- 1. Periksa peran di awal
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh membuat Work Order';
  end if;

  -- 2. Validasi input
  if p_odometer is null or p_odometer < 0 then
    raise exception 'Odometer harus berupa angka positif atau nol';
  end if;

  if p_keluhan is null or trim(p_keluhan) = '' then
    raise exception 'Keluhan wajib diisi';
  end if;

  -- Cari customer_id dari kendaraan
  select customer_id into v_customer_id
  from public.vehicles
  where id = p_vehicle_id;

  if v_customer_id is null then
    raise exception 'Kendaraan tidak ditemukan';
  end if;

  -- Pastikan kepala mekanik valid dan aktif
  if not exists (
    select 1 from public.profiles
    where id = p_kepala_mekanik_id and role = 'kepala_mekanik' and aktif
  ) then
    raise exception 'Kepala mekanik tidak valid atau tidak aktif';
  end if;

  -- 3. Generate nomor WO otomatis (WO-YYMM-XXXX) dengan lock counter
  v_nomor_urut := private.nomor_berikut('WO', to_char(now(), 'YYMM'));
  v_nomor := 'WO-' || to_char(now(), 'YYMM') || '-' || lpad(v_nomor_urut::text, 4, '0');

  -- 4. Buat Work Order baru dengan status 'menunggu'
  insert into public.work_orders (
    nomor,
    vehicle_id,
    customer_id,
    kepala_mekanik_id,
    odometer,
    keluhan,
    status,
    dibuat_oleh
  ) values (
    v_nomor,
    p_vehicle_id,
    v_customer_id,
    p_kepala_mekanik_id,
    p_odometer,
    trim(p_keluhan),
    'menunggu',
    auth.uid()
  )
  returning id into v_wo_id;

  -- 5. Catat riwayat status awal
  insert into public.wo_status_history (
    work_order_id,
    dari_status,
    ke_status,
    catatan,
    oleh
  ) values (
    v_wo_id,
    null,
    'menunggu',
    'Work Order dibuat',
    auth.uid()
  );

  return v_wo_id;
end $$;

revoke all on function public.buat_work_order(uuid, uuid, int, text) from public, anon;
grant execute on function public.buat_work_order(uuid, uuid, int, text) to authenticated;


-- ---------- 2. Fungsi tugaskan_mekanik ----------
create or replace function public.tugaskan_mekanik(
  p_wo uuid,
  p_mekanik uuid[],
  p_estimasi date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo public.work_orders%rowtype;
begin
  -- 1. Periksa peran di awal
  v_peran := private.peran_saya();
  if v_peran not in ('kepala_mekanik', 'owner') then
    raise exception 'Hanya Kepala Mekanik atau Owner yang boleh menugaskan mekanik';
  end if;

  -- 2. Kunci baris WO untuk mencegah rebutan
  select * into v_wo
  from public.work_orders
  where id = p_wo
  for update;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- 3. Periksa kepemilikan tim bagi Kepala Mekanik
  if v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid() then
    raise exception 'Hanya Kepala Mekanik tim yang ditugaskan yang boleh memilih mekanik untuk WO ini';
  end if;

  -- 4. Status WO harus 'menunggu'
  if v_wo.status <> 'menunggu' then
    raise exception 'Penugasan mekanik hanya dapat dilakukan saat status WO masih menunggu';
  end if;

  -- 5. Validasi mekanik (1 sampai 3 orang, aktif, dan anggota tim tersebut)
  if p_mekanik is null or array_length(p_mekanik, 1) is null or array_length(p_mekanik, 1) < 1 then
    raise exception 'Pilih minimal satu mekanik untuk pengerjaan';
  end if;

  if array_length(p_mekanik, 1) > 3 then
    raise exception 'Maksimal 3 mekanik yang dapat ditugaskan pada satu Work Order';
  end if;

  if exists (
    select 1 from unnest(p_mekanik) m_id
    where not exists (
      select 1 from public.mekanik m
      where m.id = m_id and m.kepala_mekanik_id = v_wo.kepala_mekanik_id and m.aktif
    )
  ) then
    raise exception 'Semua mekanik harus berasal dari tim Kepala Mekanik yang bersangkutan dan berstatus aktif';
  end if;

  -- 6. Validasi tanggal estimasi selesai
  if p_estimasi is null then
    raise exception 'Estimasi tanggal selesai wajib diisi';
  end if;

  if p_estimasi < current_date then
    raise exception 'Estimasi tanggal selesai tidak boleh sebelum hari ini';
  end if;

  -- 7. Simpan daftar mekanik
  delete from public.work_order_mekanik where work_order_id = p_wo;

  insert into public.work_order_mekanik (work_order_id, mekanik_id)
  select p_wo, unnest(p_mekanik);

  -- 8. Simpan estimasi selesai
  update public.work_orders
  set estimasi_selesai = p_estimasi
  where id = p_wo;

end $$;

revoke all on function public.tugaskan_mekanik(uuid, uuid[], date) from public, anon;
grant execute on function public.tugaskan_mekanik(uuid, uuid[], date) to authenticated;


-- ---------- 3. Fungsi ubah_status_wo ----------
create or replace function public.ubah_status_wo(
  p_wo uuid,
  p_status text,
  p_catatan text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo public.work_orders%rowtype;
  v_inv_status text;
  r_part record;
  v_stok_sesudah int;
begin
  -- 1. Periksa peran di awal
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Pengguna tidak memiliki hak akses atau akun belum aktif';
  end if;

  -- 2. Kunci baris WO untuk mencegah perebutan status bersamaan
  select * into v_wo
  from public.work_orders
  where id = p_wo
  for update;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  if v_wo.status = p_status then
    raise exception 'Status Work Order sudah %', p_status;
  end if;

  -- 3. Validasi aturan perpindahan status (PRD Bab 7.2)
  -- Kasus A: menunggu -> dikerjakan
  if v_wo.status = 'menunggu' and p_status = 'dikerjakan' then
    if v_peran not in ('kepala_mekanik', 'owner') then
      raise exception 'Hanya Kepala Mekanik tim WO ini atau Owner yang boleh memulai pengerjaan';
    end if;
    if v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid() then
      raise exception 'Hanya Kepala Mekanik tim WO ini yang boleh memulai pengerjaan';
    end if;
    if v_wo.estimasi_selesai is null then
      raise exception 'Estimasi selesai harus diisi sebelum memulai pengerjaan';
    end if;
    if not exists (select 1 from public.work_order_mekanik where work_order_id = p_wo) then
      raise exception 'Minimal satu mekanik harus ditugaskan sebelum memulai pengerjaan';
    end if;

  -- Kasus B: dikerjakan -> tertunda
  elsif v_wo.status = 'dikerjakan' and p_status = 'tertunda' then
    if v_peran not in ('kepala_mekanik', 'owner') then
      raise exception 'Hanya Kepala Mekanik tim WO ini atau Owner yang boleh menunda pengerjaan';
    end if;
    if v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid() then
      raise exception 'Hanya Kepala Mekanik tim WO ini yang boleh menunda pengerjaan';
    end if;
    if p_catatan is null or trim(p_catatan) = '' then
      raise exception 'Catatan alasan penundaan wajib diisi';
    end if;

  -- Kasus C: tertunda -> dikerjakan
  elsif v_wo.status = 'tertunda' and p_status = 'dikerjakan' then
    if v_peran not in ('kepala_mekanik', 'owner') then
      raise exception 'Hanya Kepala Mekanik tim WO ini atau Owner yang boleh melanjutkan pengerjaan';
    end if;
    if v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid() then
      raise exception 'Hanya Kepala Mekanik tim WO ini yang boleh melanjutkan pengerjaan';
    end if;

  -- Kasus D: dikerjakan -> selesai
  elsif v_wo.status = 'dikerjakan' and p_status = 'selesai' then
    if v_peran not in ('kepala_mekanik', 'owner') then
      raise exception 'Hanya Kepala Mekanik tim WO ini atau Owner yang boleh menyelesaikan pengerjaan';
    end if;
    if v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid() then
      raise exception 'Hanya Kepala Mekanik tim WO ini yang boleh menyelesaikan pengerjaan';
    end if;
    if not exists (select 1 from public.billing_items where work_order_id = p_wo) then
      raise exception 'Catat minimal 1 jasa atau spare part sebelum menyelesaikan pengerjaan';
    end if;
    v_wo.selesai_at := now();

  -- Kasus E: selesai -> siap_diambil (QC Lulus)
  elsif v_wo.status = 'selesai' and p_status = 'siap_diambil' then
    if v_peran not in ('kepala_mekanik', 'owner') then
      raise exception 'Hanya Kepala Mekanik tim WO ini atau Owner yang boleh melakukan QC';
    end if;
    if v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid() then
      raise exception 'Hanya Kepala Mekanik tim WO ini yang boleh melakukan QC';
    end if;

  -- Kasus F: selesai -> dikerjakan (QC Gagal)
  elsif v_wo.status = 'selesai' and p_status = 'dikerjakan' then
    if v_peran not in ('kepala_mekanik', 'owner') then
      raise exception 'Hanya Kepala Mekanik tim WO ini atau Owner yang boleh mengembalikan status pengerjaan';
    end if;
    if v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid() then
      raise exception 'Hanya Kepala Mekanik tim WO ini yang boleh mengembalikan status pengerjaan';
    end if;
    if p_catatan is null or trim(p_catatan) = '' then
      raise exception 'Catatan alasan QC gagal wajib diisi';
    end if;
    v_wo.selesai_at := null;

  -- Kasus G: siap_diambil -> diambil
  elsif v_wo.status = 'siap_diambil' and p_status = 'diambil' then
    if v_peran not in ('admin', 'owner') then
      raise exception 'Hanya Admin atau Owner yang boleh menyerahkan kendaraan';
    end if;

    select status_bayar into v_inv_status
    from public.invoices
    where work_order_id = p_wo;

    if v_inv_status is null or v_inv_status <> 'lunas' then
      raise exception 'Kendaraan hanya dapat diambil setelah invoice berstatus lunas';
    end if;

    if not exists (
      select 1 from public.work_order_photos
      where work_order_id = p_wo and jenis = 'kondisi_akhir'
    ) then
      raise exception 'Unggah minimal satu foto kondisi akhir sebelum menyerahkan kendaraan';
    end if;

    v_wo.diambil_at := now();

  -- Kasus H: menunggu / dikerjakan / tertunda -> dibatalkan
  elsif v_wo.status in ('menunggu', 'dikerjakan', 'tertunda') and p_status = 'dibatalkan' then
    if v_peran not in ('admin', 'owner') then
      raise exception 'Hanya Admin atau Owner yang boleh membatalkan Work Order';
    end if;
    if p_catatan is null or trim(p_catatan) = '' then
      raise exception 'Alasan pembatalan Work Order wajib diisi';
    end if;

    -- Kembalikan semua spare part yang sudah terpasang ke stok
    for r_part in
      select item_id, jumlah
      from public.billing_items
      where work_order_id = p_wo and jenis = 'part'
    loop
      update public.inventory_items
      set stok = stok + r_part.jumlah
      where id = r_part.item_id
      returning stok into v_stok_sesudah;

      insert into public.stock_movements (
        item_id,
        jenis,
        jumlah,
        stok_sesudah,
        keterangan,
        work_order_id,
        dicatat_oleh
      ) values (
        r_part.item_id,
        'kembali',
        r_part.jumlah,
        v_stok_sesudah,
        'WO dibatalkan: ' || trim(p_catatan),
        p_wo,
        auth.uid()
      );
    end loop;

  else
    raise exception 'Perpindahan status dari % ke % tidak diizinkan', v_wo.status, p_status;
  end if;

  -- 4. Update data Work Order
  update public.work_orders
  set
    status = p_status,
    catatan_status = case when p_catatan is not null and trim(p_catatan) <> '' then trim(p_catatan) else catatan_status end,
    selesai_at = v_wo.selesai_at,
    diambil_at = v_wo.diambil_at
  where id = p_wo;

  -- 5. Catat riwayat status WO
  insert into public.wo_status_history (
    work_order_id,
    dari_status,
    ke_status,
    catatan,
    oleh
  ) values (
    p_wo,
    v_wo.status,
    p_status,
    case when p_catatan is not null and trim(p_catatan) <> '' then trim(p_catatan) else null end,
    auth.uid()
  );

end $$;

revoke all on function public.ubah_status_wo(uuid, text, text) from public, anon;
grant execute on function public.ubah_status_wo(uuid, text, text) to authenticated;


-- ---------- 4. Trigger jaga_wo ----------
create or replace function private.jaga_wo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_peran text;
begin
  if current_user = 'authenticated' then
    v_peran := private.peran_saya();

    -- Status hanya dapat diubah melalui ubah_status_wo
    if new.status is distinct from old.status then
      raise exception 'Status Work Order hanya dapat diubah melalui fungsi ubah_status_wo';
    end if;

    -- Nomor, kendaraan, dan pelanggan tidak boleh diubah
    if new.nomor is distinct from old.nomor then
      raise exception 'Nomor Work Order tidak boleh diubah';
    end if;

    if new.vehicle_id is distinct from old.vehicle_id or new.customer_id is distinct from old.customer_id then
      raise exception 'Kendaraan dan pelanggan Work Order tidak boleh diubah';
    end if;

    -- Estimasi selesai hanya melalui fungsi penugasan
    if new.estimasi_selesai is distinct from old.estimasi_selesai then
      raise exception 'Estimasi selesai hanya dapat diatur melalui fungsi penugasan mekanik';
    end if;

    -- Diskon hanya melalui fungsi atur_diskon
    if new.diskon is distinct from old.diskon or new.alasan_diskon is distinct from old.alasan_diskon then
      raise exception 'Diskon hanya dapat diatur melalui fungsi atur_diskon';
    end if;

    -- Waktu selesai dan diambil hanya melalui fungsi ubah_status_wo
    if new.selesai_at is distinct from old.selesai_at or new.diambil_at is distinct from old.diambil_at then
      raise exception 'Waktu selesai atau diambil hanya dapat diperbarui melalui fungsi status';
    end if;

    -- Keluhan, odometer, dan kepala_mekanik_id hanya oleh Admin/Owner saat menunggu
    if (new.keluhan is distinct from old.keluhan
        or new.odometer is distinct from old.odometer
        or new.kepala_mekanik_id is distinct from old.kepala_mekanik_id) then
      if v_peran not in ('admin', 'owner') then
        raise exception 'Hanya Admin atau Owner yang boleh mengubah data keluhan, odometer, atau tim';
      end if;
      if old.status <> 'menunggu' then
        raise exception 'Keluhan, odometer, dan tim hanya dapat diubah saat status WO masih menunggu';
      end if;
    end if;

    -- Diagnosis hanya oleh Kepala Mekanik tim WO atau Owner saat dikerjakan/tertunda
    if (new.diagnosis is distinct from old.diagnosis) then
      if not (v_peran = 'owner' or (v_peran = 'kepala_mekanik' and old.kepala_mekanik_id = auth.uid())) then
        raise exception 'Hanya Kepala Mekanik tim WO ini atau Owner yang boleh mengisi diagnosis';
      end if;
      if old.status not in ('dikerjakan', 'tertunda') then
        raise exception 'Diagnosis hanya dapat diisi saat status WO dikerjakan atau tertunda';
      end if;
    end if;

  end if;

  return new;
end $$;

drop trigger if exists jaga_wo on public.work_orders;
create trigger jaga_wo
  before update on public.work_orders
  for each row execute function private.jaga_wo();


-- ---------- 5. Storage Bucket foto-wo dan Policy ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'foto-wo',
  'foto-wo',
  false,
  1048576,
  array['image/webp', 'image/jpeg']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/webp', 'image/jpeg'];

drop policy if exists "foto_wo_lihat" on storage.objects;
drop policy if exists "foto_wo_unggah" on storage.objects;
drop policy if exists "foto_wo_hapus" on storage.objects;

-- Policy 1: Lihat foto oleh semua pengguna login yang aktif
create policy "foto_wo_lihat"
on storage.objects for select to authenticated
using (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) is not null
);

-- Policy 2: Unggah foto sesuai peran, folder jenis, dan status WO
create policy "foto_wo_unggah"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'foto-wo'
  and (
    -- Admin/Owner unggah stnk dan kondisi_awal saat status menunggu
    (
      (select private.peran_saya()) in ('admin', 'owner')
      and (storage.foldername(name))[2] in ('stnk', 'kondisi_awal')
      and exists (
        select 1 from public.work_orders w
        where w.id = (storage.foldername(name))[1]::uuid
        and w.status = 'menunggu'
      )
    )
    or
    -- Admin/Owner unggah kondisi_akhir saat status siap_diambil
    (
      (select private.peran_saya()) in ('admin', 'owner')
      and (storage.foldername(name))[2] = 'kondisi_akhir'
      and exists (
        select 1 from public.work_orders w
        where w.id = (storage.foldername(name))[1]::uuid
        and w.status = 'siap_diambil'
      )
    )
    or
    -- Kepala Mekanik tim WO unggah foto pengerjaan saat status dikerjakan
    (
      (select private.peran_saya()) = 'kepala_mekanik'
      and (storage.foldername(name))[2] = 'pengerjaan'
      and exists (
        select 1 from public.work_orders w
        where w.id = (storage.foldername(name))[1]::uuid
        and w.status = 'dikerjakan'
        and w.kepala_mekanik_id = (select auth.uid())
      )
    )
    or
    -- Owner unggah foto pengerjaan saat status dikerjakan
    (
      (select private.peran_saya()) = 'owner'
      and (storage.foldername(name))[2] = 'pengerjaan'
      and exists (
        select 1 from public.work_orders w
        where w.id = (storage.foldername(name))[1]::uuid
        and w.status = 'dikerjakan'
      )
    )
  )
);

-- Policy 3: Hapus foto hanya oleh Owner
create policy "foto_wo_hapus"
on storage.objects for delete to authenticated
using (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) = 'owner'
);
