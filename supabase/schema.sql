-- ============================================================
-- ASCENSÃO — Supabase SQL completo
-- Execute este arquivo no SQL Editor do Supabase.
-- Depois, promova o seu usuário de mestre com:
--   update public.perfis set tipo = 'mestre' where user_id = 'SEU_UUID_DE_AUTH_USERS';
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------
-- Tabelas públicas de usuário/perfil
-- ------------------------------
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default 'Jogador',
  email text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.perfis (
  user_id uuid primary key references public.usuarios(id) on delete cascade,
  tipo text not null default 'jogador' check (tipo in ('jogador','mestre')),
  nome_publico text not null default 'Jogador',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ------------------------------
-- Fichas e dados secretos
-- ------------------------------
create table if not exists public.fichas (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references public.usuarios(id) on delete cascade,
  nome_jogador text,
  nome_personagem text,
  dados jsonb not null default '{}'::jsonb,
  resumo jsonb not null default '{}'::jsonb,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  atualizada_por uuid references public.usuarios(id) on delete set null
);

-- Separação real dos dados secretos do mestre.
-- Jogadores não têm RLS para ler esta tabela.
create table if not exists public.fichas_segredos_mestre (
  ficha_id uuid primary key references public.fichas(id) on delete cascade,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios(id) on delete set null
);

create table if not exists public.historico_edicoes (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.fichas(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  dados jsonb not null default '{}'::jsonb,
  dados_mestre jsonb not null default '{}'::jsonb,
  resumo jsonb not null default '{}'::jsonb,
  motivo text not null default 'salvamento',
  criado_em timestamptz not null default now()
);

-- ------------------------------
-- Memória de NPCs
-- ------------------------------
create table if not exists public.npcs (
  id uuid primary key default gen_random_uuid(),
  criado_por uuid references public.usuarios(id) on delete set null,
  nome text,
  categoria text,
  dificuldade text,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ------------------------------
-- Índices
-- ------------------------------
create index if not exists idx_fichas_dono on public.fichas(dono_id);
create index if not exists idx_fichas_atualizada on public.fichas(atualizada_em desc);
create index if not exists idx_historico_ficha on public.historico_edicoes(ficha_id, criado_em desc);
create index if not exists idx_npcs_criado_por on public.npcs(criado_por, criado_em desc);
create index if not exists idx_npcs_categoria on public.npcs(categoria, dificuldade);

-- ------------------------------
-- Funções utilitárias
-- ------------------------------
create or replace function public.is_mestre(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis p
    where p.user_id = uid and p.tipo = 'mestre'
  );
$$;

create or replace function public.touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create or replace function public.touch_atualizada_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizada_em = now();
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_meta text;
begin
  nome_meta := coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1), 'Jogador');

  insert into public.usuarios (id, nome, email)
  values (new.id, nome_meta, new.email)
  on conflict (id) do update set
    nome = coalesce(excluded.nome, public.usuarios.nome),
    email = excluded.email,
    atualizado_em = now();

  insert into public.perfis (user_id, tipo, nome_publico)
  values (new.id, 'jogador', nome_meta)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.usuarios
     set email = new.email,
         atualizado_em = now()
   where id = new.id;
  return new;
end;
$$;

create or replace function public.registrar_historico_ficha()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  segredo jsonb := '{}'::jsonb;
  ator uuid;
begin
  select coalesce(s.dados, '{}'::jsonb)
    into segredo
    from public.fichas_segredos_mestre s
   where s.ficha_id = new.id;

  ator := coalesce(new.atualizada_por, auth.uid(), new.dono_id);

  insert into public.historico_edicoes (
    ficha_id,
    usuario_id,
    dados,
    dados_mestre,
    resumo,
    motivo
  ) values (
    new.id,
    ator,
    coalesce(new.dados, '{}'::jsonb),
    coalesce(segredo, '{}'::jsonb),
    coalesce(new.resumo, '{}'::jsonb),
    case when tg_op = 'INSERT' then 'criacao' else 'salvamento' end
  );

  return new;
end;
$$;

-- ------------------------------
-- Triggers
-- ------------------------------
drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

drop trigger if exists trg_auth_user_updated on auth.users;
create trigger trg_auth_user_updated
  after update of email on auth.users
  for each row execute function public.sync_auth_user_email();

drop trigger if exists trg_usuarios_touch on public.usuarios;
create trigger trg_usuarios_touch
  before update on public.usuarios
  for each row execute function public.touch_atualizado_em();

drop trigger if exists trg_perfis_touch on public.perfis;
create trigger trg_perfis_touch
  before update on public.perfis
  for each row execute function public.touch_atualizado_em();

drop trigger if exists trg_fichas_touch on public.fichas;
create trigger trg_fichas_touch
  before update on public.fichas
  for each row execute function public.touch_atualizada_em();

drop trigger if exists trg_segredos_touch on public.fichas_segredos_mestre;
create trigger trg_segredos_touch
  before update on public.fichas_segredos_mestre
  for each row execute function public.touch_atualizado_em();

drop trigger if exists trg_npcs_touch on public.npcs;
create trigger trg_npcs_touch
  before update on public.npcs
  for each row execute function public.touch_atualizado_em();

drop trigger if exists trg_fichas_historico on public.fichas;
create trigger trg_fichas_historico
  after insert or update on public.fichas
  for each row execute function public.registrar_historico_ficha();

-- ------------------------------
-- RLS
-- ------------------------------
alter table public.usuarios enable row level security;
alter table public.perfis enable row level security;
alter table public.fichas enable row level security;
alter table public.fichas_segredos_mestre enable row level security;
alter table public.historico_edicoes enable row level security;
alter table public.npcs enable row level security;

-- Permissões de API para usuários autenticados.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.usuarios to authenticated;
grant select, insert, update, delete on public.perfis to authenticated;
grant select, insert, update, delete on public.fichas to authenticated;
grant select, insert, update, delete on public.fichas_segredos_mestre to authenticated;
grant select, insert, update, delete on public.historico_edicoes to authenticated;
grant select, insert, update, delete on public.npcs to authenticated;

-- Limpa políticas antigas para reexecução segura.
drop policy if exists usuarios_select_own_or_master on public.usuarios;
drop policy if exists usuarios_insert_self on public.usuarios;
drop policy if exists usuarios_update_self_or_master on public.usuarios;

drop policy if exists perfis_select_own_or_master on public.perfis;
drop policy if exists perfis_insert_self_player on public.perfis;
drop policy if exists perfis_update_master_only on public.perfis;

drop policy if exists fichas_select_owner_or_master on public.fichas;
drop policy if exists fichas_insert_owner_or_master on public.fichas;
drop policy if exists fichas_update_owner_or_master on public.fichas;
drop policy if exists fichas_delete_master_only on public.fichas;

drop policy if exists segredos_master_all on public.fichas_segredos_mestre;
drop policy if exists historico_master_select on public.historico_edicoes;
drop policy if exists historico_master_insert on public.historico_edicoes;
drop policy if exists npcs_master_all on public.npcs;

-- usuarios
create policy usuarios_select_own_or_master
on public.usuarios for select to authenticated
using (id = auth.uid() or public.is_mestre(auth.uid()));

create policy usuarios_insert_self
on public.usuarios for insert to authenticated
with check (id = auth.uid());

create policy usuarios_update_self_or_master
on public.usuarios for update to authenticated
using (id = auth.uid() or public.is_mestre(auth.uid()))
with check (id = auth.uid() or public.is_mestre(auth.uid()));

-- perfis
create policy perfis_select_own_or_master
on public.perfis for select to authenticated
using (user_id = auth.uid() or public.is_mestre(auth.uid()));

create policy perfis_insert_self_player
on public.perfis for insert to authenticated
with check (user_id = auth.uid() and tipo = 'jogador');

create policy perfis_update_master_only
on public.perfis for update to authenticated
using (public.is_mestre(auth.uid()))
with check (public.is_mestre(auth.uid()));

-- fichas
create policy fichas_select_owner_or_master
on public.fichas for select to authenticated
using (dono_id = auth.uid() or public.is_mestre(auth.uid()));

create policy fichas_insert_owner_or_master
on public.fichas for insert to authenticated
with check (dono_id = auth.uid() or public.is_mestre(auth.uid()));

create policy fichas_update_owner_or_master
on public.fichas for update to authenticated
using (dono_id = auth.uid() or public.is_mestre(auth.uid()))
with check (dono_id = auth.uid() or public.is_mestre(auth.uid()));

create policy fichas_delete_master_only
on public.fichas for delete to authenticated
using (public.is_mestre(auth.uid()));

-- dados secretos do mestre: somente mestre.
create policy segredos_master_all
on public.fichas_segredos_mestre for all to authenticated
using (public.is_mestre(auth.uid()))
with check (public.is_mestre(auth.uid()));

-- histórico: exclusivo do mestre.
create policy historico_master_select
on public.historico_edicoes for select to authenticated
using (public.is_mestre(auth.uid()));

create policy historico_master_insert
on public.historico_edicoes for insert to authenticated
with check (public.is_mestre(auth.uid()));

-- NPCs: banco do mestre.
create policy npcs_master_all
on public.npcs for all to authenticated
using (public.is_mestre(auth.uid()))
with check (public.is_mestre(auth.uid()));

-- ------------------------------
-- Realtime opcional para sincronização da ficha aberta.
-- ------------------------------
alter table public.fichas replica identity full;
do $$
begin
  begin
    alter publication supabase_realtime add table public.fichas;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
