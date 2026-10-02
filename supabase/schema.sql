-- =====================================================================
--  I MIEI LAVORI - struttura del database
--  Si puo' rilanciare quante volte si vuole.
--
--  - Solo Alessandro entra con la password e modifica (la registrazione si
--    chiude da sola dopo il primo account).
--  - Chi ha un link guarda e basta: il link "tutto" mostra tutti gli album,
--    il link di un album mostra solo quell'album.
--  - Ogni foto: una copia leggera online (bucket 'foto', pubblico ma non
--    elencabile) e l'ORIGINALE che aspetta nel bucket privato 'originali'
--    finche' il PC di casa non lo scarica (pc/scarica_originali.py), poi
--    online viene cancellato e resta solo sul PC.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- tabelle ----------
create table if not exists public.impostazioni (
  id int primary key default 1 check (id = 1),
  titolo text not null default 'I miei lavori',
  sottotitolo text not null default 'Carpenteria metallica',
  codice_tutto text not null default replace(gen_random_uuid()::text, '-', ''),
  registrazione_aperta boolean not null default true,
  aggiornato timestamptz not null default now()
);
insert into public.impostazioni (id) values (1) on conflict do nothing;

create table if not exists public.amministratori (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  creato timestamptz not null default now()
);

create table if not exists public.sezioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 80),
  descrizione text not null default '',
  copertina uuid,                       -- id di una foto (vuoto = la piu' recente)
  codice text not null unique default replace(gen_random_uuid()::text, '-', ''),
  creato timestamptz not null default now(),
  aggiornato timestamptz not null default now()
);

create unique index if not exists sezioni_nome on public.sezioni (lower(trim(nome)));

create table if not exists public.foto (
  id uuid primary key default gen_random_uuid(),
  sezione_id uuid not null references public.sezioni(id) on delete cascade,
  percorso text not null,               -- copia leggera nel bucket 'foto'
  miniatura text not null,              -- miniatura nel bucket 'foto'
  larghezza int not null default 0,
  altezza int not null default 0,
  scattata timestamptz,                 -- data della foto (dal telefono)
  nota text not null default '',
  nome_file text not null default '',   -- nome sul telefono
  peso_originale bigint not null default 0,
  originale text,                       -- percorso nel bucket 'originali' finche' il PC non lo prende
  originale_sul_pc boolean not null default false,
  percorso_pc text not null default '',
  creato timestamptz not null default now()
);
create index if not exists foto_sezione on public.foto (sezione_id, scattata desc);
create index if not exists foto_in_attesa on public.foto (creato) where originale is not null;

-- ---------- chi e' chi ----------
create or replace function public.e_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.amministratori where user_id = auth.uid());
$$;

-- La prima registrazione diventa il padrone di casa e chiude la porta.
create or replace function public.nuovo_utente() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((select registrazione_aperta from public.impostazioni where id = 1), false) then
    raise exception 'Registrazione chiusa';
  end if;
  insert into public.amministratori (user_id, email) values (new.id, coalesce(new.email, ''))
  on conflict do nothing;
  update public.impostazioni set registrazione_aperta = false where id = 1;
  return new;
end $$;
drop trigger if exists al_nuovo_utente on auth.users;
create trigger al_nuovo_utente after insert on auth.users
  for each row execute function public.nuovo_utente();

-- Il primo account non deve aspettare la mail di conferma: lo si conferma subito
-- (solo finche' la porta e' aperta; dopo la registrazione e' comunque chiusa).
create or replace function public.conferma_primo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select registrazione_aperta from public.impostazioni where id = 1), false) then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end $$;
drop trigger if exists conferma_primo on auth.users;
create trigger conferma_primo before insert on auth.users
  for each row execute function public.conferma_primo();

create or replace function public.tocca_aggiornato() returns trigger
language plpgsql as $$ begin new.aggiornato = now(); return new; end $$;
drop trigger if exists sezioni_aggiornato on public.sezioni;
create trigger sezioni_aggiornato before update on public.sezioni
  for each row execute function public.tocca_aggiornato();

-- ---------- per chi guarda (senza account) ----------
-- Titolo e se la porta e' aperta, per la pagina d'ingresso.
create or replace function public.ingresso() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('titolo', titolo, 'sottotitolo', sottotitolo,
                           'registrazione_aperta', registrazione_aperta)
  from public.impostazioni where id = 1;
$$;

-- Cosa si vede con un codice: tutti gli album (codice_tutto) o uno solo (codice dell'album).
create or replace function public.album_visibili(codice text) returns setof public.sezioni
language sql stable security definer set search_path = public as $$
  select s.* from public.sezioni s, public.impostazioni i
  where i.id = 1 and length(coalesce(codice, '')) >= 16
    and (codice = i.codice_tutto or codice = s.codice);
$$;
revoke execute on function public.album_visibili(text) from public, anon, authenticated;

create or replace function public.galleria(codice text) returns json
language plpgsql stable security definer set search_path = public as $$
declare i public.impostazioni; tutto boolean;
begin
  select * into i from public.impostazioni where id = 1;
  if length(coalesce(codice, '')) < 16 then return null; end if;
  tutto := codice = i.codice_tutto;
  if not tutto and not exists (select 1 from public.sezioni where sezioni.codice = galleria.codice) then
    return null;
  end if;
  return json_build_object(
    'titolo', i.titolo, 'sottotitolo', i.sottotitolo, 'tutto', tutto,
    'album', coalesce((select json_agg(json_build_object(
        'id', s.id, 'nome', s.nome, 'descrizione', s.descrizione,
        'numero', (select count(*) from public.foto f where f.sezione_id = s.id),
        'copertina', coalesce(
          (select f.miniatura from public.foto f where f.id = s.copertina and f.sezione_id = s.id),
          (select f.miniatura from public.foto f where f.sezione_id = s.id order by f.scattata desc nulls last, f.creato desc limit 1)),
        'ultima', (select max(coalesce(f.scattata, f.creato)) from public.foto f where f.sezione_id = s.id))
        order by s.nome)
      from public.album_visibili(galleria.codice) s), '[]'::json)
  );
end $$;

create or replace function public.galleria_foto(codice text, album uuid) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'id', f.id, 'percorso', f.percorso, 'miniatura', f.miniatura,
      'larghezza', f.larghezza, 'altezza', f.altezza,
      'scattata', coalesce(f.scattata, f.creato), 'nota', f.nota)
      order by f.scattata desc nulls last, f.creato desc), '[]'::json)
  from public.foto f
  where f.sezione_id = album
    and exists (select 1 from public.album_visibili(galleria_foto.codice) s where s.id = album);
$$;

-- ---------- per il padrone di casa ----------
-- Cambia un link: il vecchio smette di funzionare. album = null -> il link di tutto.
create or replace function public.nuovo_codice(album uuid default null) returns text
language plpgsql security definer set search_path = public as $$
declare c text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.e_admin() then raise exception 'Permesso negato'; end if;
  if album is null then
    update public.impostazioni set codice_tutto = c where id = 1;
  else
    update public.sezioni set codice = c where id = album;
  end if;
  return c;
end $$;

-- Quanto spazio online e' usato (MB) e quanti originali aspettano il PC.
create or replace function public.spazio() returns json
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not public.e_admin() then raise exception 'Permesso negato'; end if;
  return json_build_object(
    'mb_foto', round(coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'foto'), 0) / 1048576.0),
    'mb_originali', round(coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'originali'), 0) / 1048576.0),
    'in_attesa', (select count(*) from public.foto where originale is not null),
    'sul_pc', (select count(*) from public.foto where originale_sul_pc),
    'totale', (select count(*) from public.foto),
    'ultimo_pc', (select max(creato) from public.giri_pc)
  );
end $$;

-- Gli album come li vede il padrone di casa: con i link e quante foto sono gia' sul PC.
create or replace function public.miei_album() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.e_admin() then raise exception 'Permesso negato'; end if;
  return coalesce((select json_agg(json_build_object(
      'id', s.id, 'nome', s.nome, 'descrizione', s.descrizione, 'codice', s.codice, 'copertina_id', s.copertina,
      'numero', (select count(*) from public.foto f where f.sezione_id = s.id),
      'sul_pc', (select count(*) from public.foto f where f.sezione_id = s.id and f.originale_sul_pc),
      'copertina', coalesce(
        (select f.miniatura from public.foto f where f.id = s.copertina and f.sezione_id = s.id),
        (select f.miniatura from public.foto f where f.sezione_id = s.id order by f.scattata desc nulls last, f.creato desc limit 1)),
      'ultima', (select max(coalesce(f.scattata, f.creato)) from public.foto f where f.sezione_id = s.id))
      order by s.nome)
    from public.sezioni s), '[]'::json);
end $$;

-- "Impronte" delle foto gia' caricate (nome sul telefono + peso): per non caricarle due volte.
create or replace function public.impronte() returns text[]
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.e_admin() then raise exception 'Permesso negato'; end if;
  return coalesce((select array_agg(nome_file || '|' || peso_originale) from public.foto), '{}');
end $$;

-- Ogni passaggio del PC lascia un segno: l'app mostra "il PC ha controllato alle 14:20".
create table if not exists public.giri_pc (
  id bigint generated always as identity primary key,
  creato timestamptz not null default now(),
  scaricate int not null default 0,
  errori text not null default ''
);

-- ---------- permessi (Row Level Security) ----------
alter table public.impostazioni   enable row level security;
alter table public.amministratori enable row level security;
alter table public.sezioni        enable row level security;
alter table public.foto           enable row level security;
alter table public.giri_pc        enable row level security;

revoke all on public.impostazioni, public.amministratori, public.sezioni, public.foto, public.giri_pc from anon;
grant usage on schema public to anon, authenticated;
grant select, update on public.impostazioni to authenticated;
grant select on public.amministratori to authenticated;
grant select, insert, update, delete on public.sezioni, public.foto to authenticated;
grant select, insert, delete on public.giri_pc to authenticated;

revoke execute on function public.nuovo_codice(uuid), public.spazio(), public.miei_album(), public.impronte() from public, anon;
grant execute on function public.e_admin(), public.ingresso(), public.galleria(text), public.galleria_foto(text, uuid) to anon, authenticated;
grant execute on function public.nuovo_codice(uuid), public.spazio(), public.miei_album(), public.impronte() to authenticated;

drop policy if exists "impostazioni: admin legge" on public.impostazioni;
create policy "impostazioni: admin legge" on public.impostazioni for select to authenticated using (public.e_admin());
drop policy if exists "impostazioni: admin modifica" on public.impostazioni;
create policy "impostazioni: admin modifica" on public.impostazioni for update to authenticated
  using (public.e_admin()) with check (public.e_admin());
drop policy if exists "amministratori: admin legge" on public.amministratori;
create policy "amministratori: admin legge" on public.amministratori for select to authenticated using (public.e_admin());
drop policy if exists "sezioni: admin" on public.sezioni;
create policy "sezioni: admin" on public.sezioni for all to authenticated
  using (public.e_admin()) with check (public.e_admin());
drop policy if exists "foto: admin" on public.foto;
create policy "foto: admin" on public.foto for all to authenticated
  using (public.e_admin()) with check (public.e_admin());
drop policy if exists "giri: admin legge" on public.giri_pc;
create policy "giri: admin legge" on public.giri_pc for select to authenticated using (public.e_admin());
drop policy if exists "giri: admin scrive" on public.giri_pc;
create policy "giri: admin scrive" on public.giri_pc for all to authenticated using (public.e_admin()) with check (public.e_admin());

-- ---------- cartelle delle foto ----------
-- 'foto': pubblica ma NON elencabile (nomi casuali, si conoscono solo dalla galleria).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto', 'foto', true, 5242880, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880;
-- 'originali': privata; la legge solo il PC (chiave segreta) e il padrone di casa.
insert into storage.buckets (id, name, public, file_size_limit)
values ('originali', 'originali', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "foto: admin vede" on storage.objects;
create policy "foto: admin vede" on storage.objects for select to authenticated
  using (bucket_id in ('foto', 'originali') and public.e_admin());
drop policy if exists "foto: admin carica" on storage.objects;
create policy "foto: admin carica" on storage.objects for insert to authenticated
  with check (bucket_id in ('foto', 'originali') and public.e_admin());
drop policy if exists "foto: admin modifica" on storage.objects;
create policy "foto: admin modifica" on storage.objects for update to authenticated
  using (bucket_id in ('foto', 'originali') and public.e_admin());
drop policy if exists "foto: admin cancella" on storage.objects;
create policy "foto: admin cancella" on storage.objects for delete to authenticated
  using (bucket_id in ('foto', 'originali') and public.e_admin());

-- PostgREST rilegge le funzioni nuove
notify pgrst, 'reload schema';
