-- =============================================================
-- Annales Médicales — Schéma Supabase
-- À exécuter dans l'éditeur SQL de votre projet Supabase
-- =============================================================

-- Table des questions
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  niveau      text not null check (niveau in ('P2', 'D1')),
  matiere     text not null,
  cours       text,
  annee       int,
  type        text not null check (type in ('QCM', 'QRU')),
  enonce      text not null,
  image_url   text,
  items       jsonb not null default '[]'::jsonb,
  reponses    text[] not null default '{}',
  statut      text not null default 'brouillon' check (statut in ('brouillon', 'publiee'))
);

-- Table des suggestions
create table if not exists public.suggestions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  message     text not null,
  lu          boolean not null default false
);

-- =============================================================
-- Row Level Security (RLS)
-- =============================================================

-- Activer RLS sur les deux tables
alter table public.questions enable row level security;
alter table public.suggestions enable row level security;

-- Questions : lecture publique des questions publiées uniquement
drop policy if exists "questions_select_publiee" on public.questions;
create policy "questions_select_publiee"
  on public.questions for select
  using (statut = 'publiee');

-- Questions : toutes les opérations autorisées via la clé anon
drop policy if exists "questions_all_anon" on public.questions;
create policy "questions_all_anon"
  on public.questions for all
  using (true)
  with check (true);

-- Suggestions : insert public (les étudiants peuvent envoyer des suggestions)
drop policy if exists "suggestions_insert" on public.suggestions;
create policy "suggestions_insert"
  on public.suggestions for insert
  with check (true);

-- Suggestions : lecture et modification via la clé anon (admin)
drop policy if exists "suggestions_all_anon" on public.suggestions;
create policy "suggestions_all_anon"
  on public.suggestions for all
  using (true)
  with check (true);

-- =============================================================
-- Storage : bucket pour les images de questions
-- =============================================================

-- Créer le bucket (à faire depuis le Dashboard Supabase > Storage,
-- ou via l'API Storage avec service_role key)
-- Nom du bucket : question-images
-- Accès : public

-- Politique de storage pour permettre l'upload via la clé anon
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

drop policy if exists "images_upload_anon" on storage.objects;
create policy "images_upload_anon"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'question-images');

drop policy if exists "images_read_public" on storage.objects;
create policy "images_read_public"
  on storage.objects for select
  using (bucket_id = 'question-images');

drop policy if exists "images_delete_anon" on storage.objects;
create policy "images_delete_anon"
  on storage.objects for delete
  to anon
  using (bucket_id = 'question-images');

-- =============================================================
-- Index utiles
-- =============================================================
create index if not exists questions_niveau_idx on public.questions (niveau);
create index if not exists questions_matiere_idx on public.questions (matiere);
create index if not exists questions_statut_idx on public.questions (statut);
create index if not exists suggestions_lu_idx on public.suggestions (lu);
