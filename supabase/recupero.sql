-- =====================================================================
--  RECUPERO DELL'ACCESSO (si puo' rilanciare)
--  Se Alessandro perde email E password: con il CODICE DI RECUPERO (creato da lui
--  nelle Impostazioni, salvato a parte) sceglie una nuova email e una nuova password.
--  Nel database c'e' solo l'impronta del codice (bcrypt), mai il codice in chiaro.
--  Dopo l'uso il codice non vale piu' e i vecchi accessi (telefono perso) vengono chiusi.
--  Massimo 5 tentativi sbagliati all'ora.
-- =====================================================================

-- Il padrone e' l'account di Alessandro (non quello del PC di casa).
alter table public.amministratori add column if not exists padrone boolean not null default false;
update public.amministratori set padrone = (email <> 'pc.di.casa@example.com')
  where not exists (select 1 from public.amministratori where padrone);

create or replace function public.nuovo_utente() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((select registrazione_aperta from public.impostazioni where id = 1), false) then
    raise exception 'Registrazione chiusa';
  end if;
  insert into public.amministratori (user_id, email, padrone)
  values (new.id, coalesce(new.email, ''), not exists (select 1 from public.amministratori where padrone))
  on conflict do nothing;
  update public.impostazioni set registrazione_aperta = false where id = 1;
  return new;
end $$;

create table if not exists public.recupero (
  id int primary key default 1 check (id = 1),
  codice_hash text,
  creato timestamptz
);
create table if not exists public.tentativi_recupero (
  quando timestamptz not null default now(),
  riuscito boolean not null default false
);
alter table public.recupero enable row level security;            -- nessuna regola: nessuno lo legge
alter table public.tentativi_recupero enable row level security;
revoke all on public.recupero, public.tentativi_recupero from anon, authenticated;

-- Il padrone sa se ha gia' un codice (e da quando).
create or replace function public.stato_recupero() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.e_admin() then raise exception 'Permesso negato'; end if;
  return (select json_build_object('creato', creato) from public.recupero where id = 1 and codice_hash is not null);
end $$;

-- Crea un codice nuovo (il vecchio smette di valere). Lo restituisce UNA volta sola.
create or replace function public.nuovo_codice_recupero() returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := gen_random_bytes(20);
  c text := '';
begin
  if not exists (select 1 from public.amministratori where user_id = auth.uid() and padrone) then
    raise exception 'Permesso negato';
  end if;
  for i in 0..19 loop
    c := c || substr(alfabeto, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  insert into public.recupero (id, codice_hash, creato) values (1, crypt(c, gen_salt('bf', 10)), now())
  on conflict (id) do update set codice_hash = excluded.codice_hash, creato = excluded.creato;
  return substr(c, 1, 4) || '-' || substr(c, 5, 4) || '-' || substr(c, 9, 4) || '-' || substr(c, 13, 4) || '-' || substr(c, 17, 4);
end $$;

-- Senza account: codice giusto -> nuova email e nuova password per il padrone.
create or replace function public.recupera_accesso(codice text, nuova_email text, nuova_password text) returns json
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  h text;
  pulito text := upper(regexp_replace(coalesce(codice, ''), '[^A-Za-z0-9]', '', 'g'));
  e text := lower(trim(coalesce(nuova_email, '')));
  chi uuid := (select user_id from public.amministratori where padrone limit 1);
begin
  if (select count(*) from public.tentativi_recupero where not riuscito and quando > now() - interval '1 hour') >= 5 then
    raise exception 'Troppi tentativi sbagliati: riprova fra un''ora.';
  end if;
  select codice_hash into h from public.recupero where id = 1;
  if h is null or chi is null or crypt(pulito, h) <> h then
    insert into public.tentativi_recupero (riuscito) values (false);
    return json_build_object('ok', false, 'errore', 'Codice di recupero sbagliato.');
  end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return json_build_object('ok', false, 'errore', 'Email non valida.');
  end if;
  if length(coalesce(nuova_password, '')) < 8 then
    return json_build_object('ok', false, 'errore', 'La password deve avere almeno 8 caratteri.');
  end if;
  if exists (select 1 from auth.users where lower(email) = e and id <> chi) then
    return json_build_object('ok', false, 'errore', 'Questa email e'' gia'' usata da un altro account.');
  end if;
  update auth.users set email = e, encrypted_password = crypt(nuova_password, gen_salt('bf', 10)),
    email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
  where id = chi;
  update auth.identities set identity_data = identity_data || jsonb_build_object('email', e), updated_at = now()
  where user_id = chi and provider = 'email';
  delete from auth.sessions where user_id = chi;              -- chiude gli accessi vecchi (telefono perso)
  update public.amministratori set email = e where user_id = chi;
  update public.recupero set codice_hash = null where id = 1;  -- il codice usato non vale piu'
  insert into public.tentativi_recupero (riuscito) values (true);
  delete from public.tentativi_recupero where quando < now() - interval '30 days';
  return json_build_object('ok', true);
end $$;

revoke execute on function public.stato_recupero(), public.nuovo_codice_recupero() from public, anon;
grant execute on function public.stato_recupero(), public.nuovo_codice_recupero() to authenticated;
revoke execute on function public.recupera_accesso(text, text, text) from public;
grant execute on function public.recupera_accesso(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
