-- =============================================================
-- App 4 Cemerlang Jaya Motor · Fitur D: Audit Log & Triggers (PRD 9.4)
-- =============================================================

-- 1. Fungsi trigger untuk mencatat audit log
create or replace function public.catat_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  v_data_id text := coalesce(v_row ->> 'id', v_row ->> 'billing_item_id', v_row ->> 'item_id');
  v_sebelum jsonb := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) else null end;
  v_sesudah jsonb := case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) else null end;
  v_alasan text := coalesce(
    v_row ->> 'alasan',
    v_row ->> 'alasan_penyesuaian',
    v_row ->> 'alasan_diskon',
    v_row ->> 'catatan_status',
    v_row ->> 'keterangan'
  );
begin
  insert into public.audit_logs (
    waktu,
    pelaku_id,
    pelaku_peran,
    aksi,
    tabel,
    data_id,
    sebelum,
    sesudah,
    alasan
  ) values (
    now(),
    auth.uid(),
    private.peran_saya(),
    TG_OP,
    TG_TABLE_NAME,
    v_data_id,
    v_sebelum,
    v_sesudah,
    v_alasan
  );
  return null;
end $$;

-- 2. Pasang trigger catat_audit pada 9 tabel sesuai PRD 9.4
drop trigger if exists catat_audit on public.work_orders;
create trigger catat_audit
after insert or update or delete on public.work_orders
for each row execute function public.catat_audit();

drop trigger if exists catat_audit on public.billing_items;
create trigger catat_audit
after insert or update or delete on public.billing_items
for each row execute function public.catat_audit();

drop trigger if exists catat_audit on public.billing_item_costs;
create trigger catat_audit
after insert or update or delete on public.billing_item_costs
for each row execute function public.catat_audit();

drop trigger if exists catat_audit on public.inventory_items;
create trigger catat_audit
after insert or update or delete on public.inventory_items
for each row execute function public.catat_audit();

drop trigger if exists catat_audit on public.inventory_costs;
create trigger catat_audit
after insert or update or delete on public.inventory_costs
for each row execute function public.catat_audit();

drop trigger if exists catat_audit on public.invoices;
create trigger catat_audit
after insert or update or delete on public.invoices
for each row execute function public.catat_audit();

drop trigger if exists catat_audit on public.payments;
create trigger catat_audit
after insert or update or delete on public.payments
for each row execute function public.catat_audit();

drop trigger if exists catat_audit on public.stock_movements;
create trigger catat_audit
after insert or update or delete on public.stock_movements
for each row execute function public.catat_audit();

drop trigger if exists catat_audit on public.profiles;
create trigger catat_audit
after insert or update or delete on public.profiles
for each row execute function public.catat_audit();

-- 3. Proteksi tabel audit_logs agar tidak bisa diubah atau dihapus siapa pun
create or replace function public.jaga_audit_logs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Data audit log tidak boleh diubah atau dihapus';
end $$;

drop trigger if exists tr_jaga_audit_logs on public.audit_logs;
create trigger tr_jaga_audit_logs
before update or delete on public.audit_logs
for each row execute function public.jaga_audit_logs();

drop trigger if exists tr_jaga_audit_logs_truncate on public.audit_logs;
create trigger tr_jaga_audit_logs_truncate
before truncate on public.audit_logs
for each statement execute function public.jaga_audit_logs();

-- Cabut hak update, delete, truncate dari peran public, anon, dan authenticated
revoke update, delete, truncate on public.audit_logs from public, anon, authenticated;

-- Cabut hak execute fungsi trigger dari API (hanya berjalan via trigger)
revoke execute on function public.catat_audit() from public, anon, authenticated;
revoke execute on function public.jaga_audit_logs() from public, anon, authenticated;
