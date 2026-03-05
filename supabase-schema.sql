-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.client_service_records (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  telefono text not null,
  vehiculo text not null,
  modelo text not null,
  anio integer not null,
  placas text not null,
  km integer not null,
  servicio_realizado text not null,
  fecha_servicio date not null,
  proximo_servicio_km integer not null,
  proxima_fecha date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at_client_service_records()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_client_service_records on public.client_service_records;
create trigger trg_set_updated_at_client_service_records
before update on public.client_service_records
for each row
execute function public.set_updated_at_client_service_records();

alter table public.client_service_records enable row level security;

drop policy if exists "anon_select_client_service_records" on public.client_service_records;
create policy "anon_select_client_service_records"
on public.client_service_records
for select
to anon
using (true);

drop policy if exists "anon_insert_client_service_records" on public.client_service_records;
create policy "anon_insert_client_service_records"
on public.client_service_records
for insert
to anon
with check (true);

drop policy if exists "anon_update_client_service_records" on public.client_service_records;
create policy "anon_update_client_service_records"
on public.client_service_records
for update
to anon
using (true)
with check (true);

drop policy if exists "anon_delete_client_service_records" on public.client_service_records;
create policy "anon_delete_client_service_records"
on public.client_service_records
for delete
to anon
using (true);
