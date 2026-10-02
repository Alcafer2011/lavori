-- =====================================================================
--  COMANDO RAPIDO DELL'IPHONE "Salva lavori" (si puo' rilanciare)
--  Il comando manda solo l'ORIGINALE. Il PC di casa poi fa copia leggera e
--  miniatura, legge la data dalla foto e scarta i doppioni (stessa impronta).
--  Finche' il PC non l'ha preparata la foto non e' "pronta": chi ha il link non
--  la vede, il padrone la vede come "in arrivo".
--  Il comando entra con un account suo ("comando"), la cui password si rifa'
--  dall'app (Impostazioni > Comando Rapido): quella vecchia smette di valere.
-- =====================================================================

alter table public.foto add column if not exists pronta boolean not null default true;
alter table public.foto add column if not exists impronta text not null default '';
alter table public.foto add column if not exists dal_comando boolean not null default false;
create index if not exists foto_impronta on public.foto (impronta) where impronta <> '';

-- ----- chi guarda vede solo le foto pronte -----
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
        'numero', (select count(*) from public.foto f where f.sezione_id = s.id and f.pronta),
        'copertina', coalesce(
          (select f.miniatura from public.foto f where f.id = s.copertina and f.sezione_id = s.id and f.pronta),
          (select f.miniatura from public.foto f where f.sezione_id = s.id and f.pronta order by f.scattata desc nulls last, f.creato desc limit 1)),
        'ultima', (select max(coalesce(f.scattata, f.creato)) from public.foto f where f.sezione_id = s.id and f.pronta))
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
  where f.sezione_id = album and f.pronta
    and exists (select 1 from public.album_visibili(galleria_foto.codice) s where s.id = album);
$$;

create or replace function public.miei_album() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.e_admin() then raise exception 'Permesso negato'; end if;
  return coalesce((select json_agg(json_build_object(
      'id', s.id, 'nome', s.nome, 'descrizione', s.descrizione, 'codice', s.codice, 'copertina_id', s.copertina,
      'numero', (select count(*) from public.foto f where f.sezione_id = s.id),
      'sul_pc', (select count(*) from public.foto f where f.sezione_id = s.id and f.originale_sul_pc),
      'copertina', coalesce(
        (select f.miniatura from public.foto f where f.id = s.copertina and f.sezione_id = s.id and f.pronta),
        (select f.miniatura from public.foto f where f.sezione_id = s.id and f.pronta order by f.scattata desc nulls last, f.creato desc limit 1)),
      'ultima', (select max(coalesce(f.scattata, f.creato)) from public.foto f where f.sezione_id = s.id))
      order by s.nome)
    from public.sezioni s), '[]'::json);
end $$;

-- ----- quello che chiama il Comando Rapido -----
-- Nomi degli album, per la domanda "In quale album?".
create or replace function public.elenco_album() returns text[]
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.e_admin() then raise exception 'Permesso negato'; end if;
  return coalesce((select array_agg(nome order by nome) from public.sezioni), '{}');
end $$;

-- Prenota il posto per una foto: risponde {"base": "<album>/<id>"}, dove mandare l'originale.
create or replace function public.comando_prepara(album text) returns json
language plpgsql volatile security definer set search_path = public as $$
declare s uuid; nuovo uuid := gen_random_uuid(); b text;
begin
  if not public.e_admin() then raise exception 'Permesso negato'; end if;
  select id into s from public.sezioni where lower(trim(nome)) = lower(trim(coalesce(album, '')));
  if s is null then raise exception 'Album non trovato: %', album; end if;
  b := s || '/' || nuovo;
  insert into public.foto (id, sezione_id, percorso, miniatura, originale, pronta, dal_comando, scattata)
  values (nuovo, s, '', '', b, false, true, null);
  return json_build_object('base', b);
end $$;

-- L'app (solo il padrone) rifa' la password del comando e la mostra UNA volta.
create or replace function public.nuovo_accesso_comando() returns json
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  alfabeto text := 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := gen_random_bytes(24);
  pw text := '';
  chi uuid := (select id from auth.users where email = 'comando.iphone@example.com');
begin
  if not exists (select 1 from public.amministratori where user_id = auth.uid() and padrone) then
    raise exception 'Permesso negato';
  end if;
  if chi is null then raise exception 'Account del comando mancante'; end if;
  for i in 0..23 loop pw := pw || substr(alfabeto, (get_byte(b, i) % length(alfabeto)) + 1, 1); end loop;
  update auth.users set encrypted_password = crypt(pw, gen_salt('bf', 10)), updated_at = now() where id = chi;
  delete from auth.sessions where user_id = chi;
  return json_build_object('email', 'comando.iphone@example.com', 'password', pw);
end $$;

revoke execute on function public.elenco_album(), public.comando_prepara(text), public.nuovo_accesso_comando() from public, anon;
grant execute on function public.elenco_album(), public.comando_prepara(text), public.nuovo_accesso_comando() to authenticated;

notify pgrst, 'reload schema';
