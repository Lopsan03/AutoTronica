-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

-- Optional migration from old flat table
drop table if exists public.client_service_records;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  telefono text not null,
  vehiculo text not null,
  modelo text not null,
  anio integer not null,
  placas text not null,
  km_actual integer not null default 0,
  vehicle_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  servicio_realizado text not null,
  fecha_servicio date not null,
  km_servicio integer not null,
  proximo_servicio_km integer not null,
  proxima_fecha date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_services_client_id on public.client_services(client_id);
create index if not exists idx_clients_search on public.clients(cliente, telefono, placas, vehiculo, modelo);

create or replace function public.set_updated_at_generic()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_clients on public.clients;
create trigger trg_set_updated_at_clients
before update on public.clients
for each row
execute function public.set_updated_at_generic();

drop trigger if exists trg_set_updated_at_client_services on public.client_services;
create trigger trg_set_updated_at_client_services
before update on public.client_services
for each row
execute function public.set_updated_at_generic();

alter table public.clients enable row level security;
alter table public.client_services enable row level security;

drop policy if exists "anon_select_clients" on public.clients;
create policy "anon_select_clients"
on public.clients
for select
to anon
using (true);

drop policy if exists "anon_insert_clients" on public.clients;
create policy "anon_insert_clients"
on public.clients
for insert
to anon
with check (true);

drop policy if exists "anon_update_clients" on public.clients;
create policy "anon_update_clients"
on public.clients
for update
to anon
using (true)
with check (true);

drop policy if exists "anon_delete_clients" on public.clients;
create policy "anon_delete_clients"
on public.clients
for delete
to anon
using (true);

drop policy if exists "anon_select_client_services" on public.client_services;
create policy "anon_select_client_services"
on public.client_services
for select
to anon
using (true);

drop policy if exists "anon_insert_client_services" on public.client_services;
create policy "anon_insert_client_services"
on public.client_services
for insert
to anon
with check (true);

drop policy if exists "anon_update_client_services" on public.client_services;
create policy "anon_update_client_services"
on public.client_services
for update
to anon
using (true)
with check (true);

drop policy if exists "anon_delete_client_services" on public.client_services;
create policy "anon_delete_client_services"
on public.client_services
for delete
to anon
using (true);

-- Storage bucket for vehicle images
insert into storage.buckets (id, name, public)
values ('vehicle-images', 'vehicle-images', true)
on conflict (id) do nothing;

drop policy if exists "anon_read_vehicle_images" on storage.objects;
create policy "anon_read_vehicle_images"
on storage.objects
for select
to anon
using (bucket_id = 'vehicle-images');

drop policy if exists "anon_insert_vehicle_images" on storage.objects;
create policy "anon_insert_vehicle_images"
on storage.objects
for insert
to anon
with check (bucket_id = 'vehicle-images');

drop policy if exists "anon_update_vehicle_images" on storage.objects;
create policy "anon_update_vehicle_images"
on storage.objects
for update
to anon
using (bucket_id = 'vehicle-images')
with check (bucket_id = 'vehicle-images');

drop policy if exists "anon_delete_vehicle_images" on storage.objects;
create policy "anon_delete_vehicle_images"
on storage.objects
for delete
to anon
using (bucket_id = 'vehicle-images');
