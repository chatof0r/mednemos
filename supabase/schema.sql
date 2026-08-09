-- =============================================================
-- MedNemos — Schéma Supabase
-- À exécuter dans l'éditeur SQL de votre projet Supabase.
-- Idempotent : peut être relancé sans risque sur une base existante
-- (les ALTER TABLE / CREATE POLICY ci-dessous mettent à niveau un
-- projet déjà provisionné avec une version antérieure de ce script).
-- =============================================================

-- Table des dossiers (progressifs "DP" ou libres "DL")
create table if not exists public.dossiers (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  titre            text not null,
  enonce           text,
  image_url        text,
  niveau           text not null check (niveau in ('P2', 'D1')),
  matiere          text not null,
  cours            text[],
  annee            int,
  session          int check (session in (1, 2)),
  source           text not null default 'annale' check (source in ('annale', 'ronéo')),
  statut           text not null default 'brouillon' check (statut in ('brouillon', 'publiee')),
  numero_officiel  int,
  type_dossier     text not null default 'dp' check (type_dossier in ('dp', 'dl'))
);

-- Table des questions
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  niveau      text not null check (niveau in ('P2', 'D1')),
  matiere     text not null,
  cours       text[],
  annee       int,
  session     int check (session in (1, 2)),
  type        text not null check (type in ('QCM', 'QRU', 'QZONE', 'QROC', 'QS')),
  enonce      text not null,
  image_url   text,
  items       jsonb not null default '[]'::jsonb,
  reponses    text[] not null default '{}',
  hotspot     jsonb,
  statut      text not null default 'brouillon' check (statut in ('brouillon', 'publiee')),
  numero_officiel  int,
  source           text not null default 'annale' check (source in ('annale', 'ronéo')),
  note_correction  text,
  dossier_id       uuid references public.dossiers(id) on delete set null,
  ordre_dossier    int
);

-- Colonnes ajoutées après la création initiale — no-op si déjà présentes
-- (mise à niveau d'un projet provisionné avec une version antérieure du schéma)
alter table public.questions add column if not exists session int;
alter table public.questions add column if not exists hotspot jsonb;
alter table public.questions add column if not exists numero_officiel int;
alter table public.questions add column if not exists source text not null default 'annale';
alter table public.questions add column if not exists note_correction text;
alter table public.questions add column if not exists dossier_id uuid references public.dossiers(id) on delete set null;
alter table public.questions add column if not exists ordre_dossier int;

-- Table des suggestions
create table if not exists public.suggestions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  message     text not null,
  lu          boolean not null default false
);

-- Table des profils utilisateurs (étudiants)
-- Une ligne par compte Supabase Auth (auth.users), créée automatiquement
-- par le trigger on_auth_user_created ci-dessous.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  nom         text,
  prenom      text,
  niveau      text check (niveau in ('P2', 'D1')),
  faculte     text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Rempli automatiquement public.profiles à la création d'un compte Supabase
-- Auth, à partir des métadonnées passées lors du signInWithOtp (voir README).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nom, prenom, niveau, faculte)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nom',
    new.raw_user_meta_data->>'prenom',
    new.raw_user_meta_data->>'niveau',
    new.raw_user_meta_data->>'faculte'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rattrapage : comptes auth.users déjà créés avant la mise en place du trigger
-- (ex. le compte admin créé manuellement depuis le dashboard Supabase).
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Renvoie true si l'utilisateur courant (auth.uid()) est marqué admin.
-- Utilisé par les policies d'écriture ci-dessous.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- =============================================================
-- Row Level Security (RLS)
-- =============================================================
--
-- L'accès admin ne repose plus sur un PIN vérifié côté client : les
-- écritures (insert/update/delete) exigent une session Supabase Auth
-- authentifiée ET marquée is_admin=true (voir README — "Accès à
-- l'administration"). La clé anon ne donne jamais, à elle seule, un accès
-- en écriture. Un compte étudiant authentifié (profil non-admin) ne peut
-- ni écrire les dossiers/questions/suggestions, ni s'auto-promouvoir admin
-- (voir revoke sur profiles.is_admin plus bas).

alter table public.dossiers enable row level security;
alter table public.questions enable row level security;
alter table public.suggestions enable row level security;
alter table public.profiles enable row level security;

-- ── Profiles ──────────────────────────────────────────────────
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Un utilisateur authentifié peut modifier sa ligne (policy ci-dessus) mais
-- ne peut jamais toucher à la colonne is_admin, même via une requête REST
-- forgée à la main : seul un rôle avec accès direct à Postgres (service_role,
-- SQL editor) le peut.
revoke update (is_admin) on public.profiles from authenticated;

-- ── Dossiers ──────────────────────────────────────────────────
drop policy if exists "dossiers_select_publiee" on public.dossiers;
create policy "dossiers_select_publiee"
  on public.dossiers for select
  using (statut = 'publiee');

drop policy if exists "dossiers_all_anon" on public.dossiers;         -- ancienne politique, trop permissive
drop policy if exists "dossiers_write_admin" on public.dossiers;
create policy "dossiers_write_admin"
  on public.dossiers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Questions ─────────────────────────────────────────────────
drop policy if exists "questions_select_publiee" on public.questions;
create policy "questions_select_publiee"
  on public.questions for select
  using (statut = 'publiee');

drop policy if exists "questions_all_anon" on public.questions;       -- ancienne politique, trop permissive
drop policy if exists "questions_write_admin" on public.questions;
create policy "questions_write_admin"
  on public.questions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Suggestions ───────────────────────────────────────────────
-- insert public : les étudiants peuvent envoyer des suggestions sans être connectés
drop policy if exists "suggestions_insert" on public.suggestions;
create policy "suggestions_insert"
  on public.suggestions for insert
  with check (true);

drop policy if exists "suggestions_all_anon" on public.suggestions;   -- ancienne politique, trop permissive
drop policy if exists "suggestions_read_write_admin" on public.suggestions;
create policy "suggestions_read_write_admin"
  on public.suggestions for select
  to authenticated
  using (public.is_admin());

drop policy if exists "suggestions_update_admin" on public.suggestions;
create policy "suggestions_update_admin"
  on public.suggestions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "suggestions_delete_admin" on public.suggestions;
create policy "suggestions_delete_admin"
  on public.suggestions for delete
  to authenticated
  using (public.is_admin());

-- =============================================================
-- Storage : bucket pour les images de questions
-- =============================================================

insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

-- Upload/suppression réservés aux sessions authentifiées (admin)
drop policy if exists "images_upload_anon" on storage.objects;        -- ancienne politique, trop permissive
drop policy if exists "images_upload_admin" on storage.objects;
create policy "images_upload_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'question-images' and public.is_admin());

drop policy if exists "images_read_public" on storage.objects;
create policy "images_read_public"
  on storage.objects for select
  using (bucket_id = 'question-images');

drop policy if exists "images_delete_anon" on storage.objects;        -- ancienne politique, trop permissive
drop policy if exists "images_delete_admin" on storage.objects;
create policy "images_delete_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'question-images' and public.is_admin());

-- =============================================================
-- Index utiles
-- =============================================================
create index if not exists questions_niveau_idx on public.questions (niveau);
create index if not exists questions_matiere_idx on public.questions (matiere);
create index if not exists questions_statut_idx on public.questions (statut);
create index if not exists questions_dossier_id_idx on public.questions (dossier_id);
create index if not exists dossiers_statut_idx on public.dossiers (statut);
create index if not exists suggestions_lu_idx on public.suggestions (lu);
create index if not exists profiles_email_idx on public.profiles (email);
