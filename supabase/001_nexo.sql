-- NEXO: private ledgers with optimistic concurrency and immutable history.
create schema if not exists nexo_private;
revoke all on schema nexo_private from public, anon, authenticated;

create table public.nexo_ledgers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.nexo_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  payload jsonb not null,
  saved_at timestamptz not null default now(),
  primary key(user_id, revision)
);
alter table public.nexo_ledgers enable row level security;
alter table public.nexo_history enable row level security;
revoke all on public.nexo_ledgers, public.nexo_history from anon, authenticated;
grant select, insert, update on public.nexo_ledgers to authenticated;
grant select on public.nexo_history to authenticated;
create policy nexo_read_own on public.nexo_ledgers for select to authenticated using (user_id = (select auth.uid()));
create policy nexo_insert_own on public.nexo_ledgers for insert to authenticated with check (user_id = (select auth.uid()));
create policy nexo_update_own on public.nexo_ledgers for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy nexo_history_own on public.nexo_history for select to authenticated using (user_id = (select auth.uid()));

create function nexo_private.validate_ledger() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare k text; x jsonb; a jsonb; b jsonb; total numeric; date_text text;
begin
  if auth.uid() is null or new.user_id <> auth.uid() then raise exception 'Acceso no permitido'; end if;
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then raise exception 'No puedes cambiar el propietario'; end if;
  if jsonb_typeof(new.payload) <> 'object' or octet_length(new.payload::text) > 2000000 then raise exception 'Datos inválidos o demasiado grandes'; end if;
  foreach k in array array['accounts','goals','budgets','movements'] loop
    if jsonb_typeof(new.payload->k) is distinct from 'array' then raise exception 'Formato inválido: %',k; end if;
    if jsonb_array_length(new.payload->k) > (case when k='movements' then 10000 else 500 end) then raise exception 'Demasiados registros'; end if;
    if exists(select 1 from jsonb_array_elements(new.payload->k) e where jsonb_typeof(e) <> 'object' or coalesce(e->>'id','') !~ '^[a-zA-Z0-9_-]{1,100}$') then raise exception 'Identificador inválido'; end if;
    if (select count(*) <> count(distinct e->>'id') from jsonb_array_elements(new.payload->k) e) then raise exception 'Registros duplicados'; end if;
  end loop;
  foreach k in array array['accounts','goals','budgets'] loop
    for x in select value from jsonb_array_elements(new.payload->k) loop
      if jsonb_typeof(x->'name') is distinct from 'string' or length(trim(x->>'name')) not between 1 and 200 then raise exception 'Nombre inválido'; end if;
      if k <> 'goals' and coalesce(x->>'person','') not in ('juan','diana') then raise exception 'Persona inválida'; end if;
      if k='accounts' then
        if jsonb_typeof(x->'type') is distinct from 'string' or length(x->>'type') not between 1 and 200 then raise exception 'Tipo de cuenta inválido'; end if;
        b=x->'initialBalance';
      elsif k='goals' then b=x->'target'; else b=x->'limit'; end if;
      if jsonb_typeof(b) is distinct from 'number' then raise exception 'Valor inválido'; end if;
      total=b::text::numeric;
      if total <> trunc(total) or total > 1000000000000 or total < (case when k='accounts' then 0 else 1 end) then raise exception 'Usa valores enteros válidos en pesos'; end if;
    end loop;
  end loop;
  for x in select value from jsonb_array_elements(new.payload->'movements') loop
    if coalesce(x->>'type','') not in ('income','expense','deposit','withdrawal') or coalesce(x->>'person','') not in ('juan','diana') then raise exception 'Movimiento inválido'; end if;
    if jsonb_typeof(x->'amount') is distinct from 'number' then raise exception 'Valor inválido'; end if;
    total=(x->>'amount')::numeric;
    if total <> trunc(total) or total not between 1 and 1000000000000 then raise exception 'Valor inválido'; end if;
    select e into a from jsonb_array_elements(new.payload->'accounts') e where e->>'id'=x->>'accountId';
    if a is null or a->>'person' <> x->>'person' then raise exception 'La cuenta no corresponde a la persona'; end if;
    date_text=x->>'date';
    if coalesce(date_text,'') !~ '^\d{4}-\d{2}-\d{2}$' or to_char(date_text::date,'YYYY-MM-DD') <> date_text then raise exception 'Fecha inválida'; end if;
    if jsonb_typeof(x->'note') is distinct from 'string' or length(x->>'note') > 2000 or jsonb_typeof(x->'concept') is distinct from 'string' or length(x->>'concept') > 300 then raise exception 'Nota o concepto inválido'; end if;
    if x->>'type' in ('deposit','withdrawal') then
      if coalesce(x->>'budgetId','') <> '' or not exists(select 1 from jsonb_array_elements(new.payload->'goals') e where e->>'id'=x->>'goalId') then raise exception 'Meta inválida'; end if;
    else
      if length(trim(x->>'concept'))=0 or coalesce(x->>'goalId','') <> '' then raise exception 'Concepto inválido'; end if;
      if coalesce(x->>'budgetId','') <> '' and not exists(select 1 from jsonb_array_elements(new.payload->'budgets') e where e->>'id'=x->>'budgetId' and e->>'person'=x->>'person') then raise exception 'Presupuesto inválido'; end if;
    end if;
  end loop;
  for x in select value from jsonb_array_elements(new.payload->'accounts') loop
    select (x->>'initialBalance')::numeric + coalesce(sum((m->>'amount')::numeric * case when m->>'type' in ('income','withdrawal') then 1 else -1 end),0) into total from jsonb_array_elements(new.payload->'movements') m where m->>'accountId'=x->>'id';
    if total < 0 or total > 9007199254740991 then raise exception 'Este cambio dejaría una cuenta sin saldo suficiente'; end if;
  end loop;
  for x in select value from jsonb_array_elements(new.payload->'goals') loop
    select coalesce(sum((m->>'amount')::numeric * case when m->>'type'='deposit' then 1 else -1 end),0) into total from jsonb_array_elements(new.payload->'movements') m where m->>'goalId'=x->>'id';
    if total < 0 or total > 9007199254740991 then raise exception 'Este cambio dejaría una meta con saldo negativo'; end if;
  end loop;
  new.revision = case when tg_op='INSERT' then 1 else old.revision+1 end;
  new.updated_at = now();
  return new;
end; $$;
create trigger nexo_validate before insert or update on public.nexo_ledgers for each row execute function nexo_private.validate_ledger();

-- This private trigger can only append the exact validated record being saved.
create function nexo_private.archive_ledger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.nexo_history(user_id, revision, payload, saved_at) values(new.user_id,new.revision,new.payload,new.updated_at);
  return new;
end; $$;
revoke all on function nexo_private.validate_ledger(), nexo_private.archive_ledger() from public, anon, authenticated;
create trigger nexo_archive after insert or update on public.nexo_ledgers for each row execute function nexo_private.archive_ledger();

create function public.save_nexo(p_state jsonb, p_revision bigint) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare saved public.nexo_ledgers;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_revision is null or p_revision < 0 then raise exception 'Versión inválida'; end if;
  if p_revision=0 then
    insert into public.nexo_ledgers(user_id,payload) values(auth.uid(),p_state) on conflict(user_id) do nothing returning * into saved;
  else
    update public.nexo_ledgers set payload=p_state where user_id=auth.uid() and revision=p_revision returning * into saved;
  end if;
  if saved.user_id is null then raise exception 'Los datos cambiaron en otra pestaña. Actualiza antes de volver a guardar.' using errcode='40001'; end if;
  return jsonb_build_object('revision',saved.revision,'updatedAt',saved.updated_at);
end; $$;
revoke all on function public.save_nexo(jsonb,bigint) from public,anon;
grant execute on function public.save_nexo(jsonb,bigint) to authenticated;
