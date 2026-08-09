# MedNemos

Site web permettant aux étudiants en médecine (P2 et D1) de s'entraîner sur des annales d'examens passés.

## Stack

- **React + Vite** (TypeScript)
- **Tailwind CSS**
- **Supabase** (PostgreSQL + Storage)
- **React Router v6**
- **Déploiement** : Vercel

---

## Installation locale

### 1. Cloner et installer les dépendances

```bash
cd annales-medicales
npm install
```

### 2. Configurer les variables d'environnement

Copier `.env.example` vers `.env` et renseigner les valeurs :

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Configurer Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Dans **SQL Editor**, exécuter le contenu de `supabase/schema.sql`
3. Récupérer l'URL et la clé anon dans **Settings > API**
4. Créer le compte administrateur : **Authentication > Users > Add user**, renseigner un email et un mot de passe (décochez "Auto confirm user" uniquement si vous voulez gérer la confirmation par email).
5. Marquer ce compte comme admin — dans **SQL Editor** :
   ```sql
   update public.profiles set is_admin = true where email = 'votre-email-admin@exemple.com';
   ```
   C'est ce flag (et non plus la simple présence d'une session) qui donne accès à l'interface `/admin` : les comptes étudiants créés via "Créer un profil" sont eux aussi de vraies sessions Supabase Auth, mais n'ont pas `is_admin = true`.
6. Activer les codes de connexion par email (OTP) pour les comptes étudiants — dans **Authentication > Email Templates**, éditer le template **Magic Link** et vous assurer qu'il affiche `{{ .Token }}` (le code à 6 chiffres), par ex. :
   ```
   Votre code de connexion MedNemos : {{ .Token }}
   ```
   Sans ce template, Supabase n'envoie qu'un lien cliquable et le code saisi dans l'app ne fonctionnera pas.

> Le bucket de stockage `question-images` est créé automatiquement par le script SQL. Si vous avez une erreur, créez-le manuellement dans **Storage** en cochant "Public bucket".

### 4. Lancer le serveur de développement

```bash
npm run dev
```

L'application sera disponible sur `http://localhost:5173`.

---

## Déploiement sur Vercel

### 1. Pousser le code sur GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/votre-user/annales-medicales.git
git push -u origin main
```

### 2. Connecter à Vercel

1. Aller sur [vercel.com](https://vercel.com) et importer le dépôt GitHub
2. Framework Preset : **Vite**
3. Dans **Environment Variables**, ajouter :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Cliquer **Deploy**

### 3. Configurer les URLs autorisées dans Supabase

Dans **Authentication > URL Configuration**, ajouter l'URL Vercel de votre déploiement dans **Site URL** et **Redirect URLs**.

---

## Structure du projet

```
src/
├── components/
│   ├── Navbar.tsx          # Barre de navigation
│   ├── AboutModal.tsx      # Modal "À propos" + suggestions
│   ├── AdminLoginModal.tsx # Modal de connexion admin (Supabase Auth, email + mot de passe)
│   └── UserAuthModal.tsx   # Modal profil étudiant (email + code de connexion OTP)
├── lib/
│   ├── supabase.ts         # Client Supabase
│   └── auth.tsx            # AuthProvider / useAuth (session + profil courant)
├── pages/
│   ├── Home.tsx            # Sélection en cascade + lancement de session
│   ├── Session.tsx         # Questions + validation + résultats
│   ├── Profile.tsx         # Profil étudiant (création/édition/déconnexion)
│   ├── Admin.tsx           # Page admin (onglets)
│   └── admin/
│       ├── AdminQuestions.tsx    # Liste et gestion des questions
│       ├── AdminSuggestions.tsx  # Liste des suggestions
│       ├── QuestionForm.tsx      # Formulaire de création/édition
│       └── QuestionPreview.tsx   # Prévisualisation d'une question
├── types/
│   └── index.ts            # Interfaces TypeScript
├── App.tsx
├── main.tsx
└── index.css
supabase/
└── schema.sql              # Script de création des tables
```

---

## Profil étudiant

1. Aller sur `/profil` (ou cliquer sur **Se connecter** dans la navbar)
2. Onglet **Créer un profil** : renseigner email, prénom, nom, niveau (P2/D1) et faculté (facultatif)
3. Un code à 6 chiffres est envoyé par email — le saisir pour valider
4. Le profil est créé automatiquement et la session ouverte ; les connexions suivantes se font via l'onglet **Se connecter** (email + nouveau code, sans redemander les infos)

Aucun mot de passe : la connexion se fait uniquement par code à usage unique envoyé par email (Supabase Auth OTP), vérifié côté serveur.

## Accès à l'administration

1. Cliquer sur le **logo** dans la navbar pour ouvrir la modal "À propos"
2. Cliquer sur **Administrateur**
3. Se connecter avec l'email et le mot de passe du compte admin (créé dans Supabase, voir ci-dessus)
4. Redirection automatique vers `/admin`

L'authentification est gérée par **Supabase Auth** (session JWT, persistée par le SDK). La déconnexion invalide la session côté Supabase. Un compte étudiant authentifié via OTP n'a **pas** accès à `/admin` : l'accès est conditionné au flag `profiles.is_admin`, pas à la simple présence d'une session.

---

## Sécurité

- L'accès en écriture (création/modification/suppression de questions, dossiers, suggestions, images) est protégé par les policies RLS de Supabase, qui exigent une session authentifiée **et** `profiles.is_admin = true` — ni la clé anon ni un compte étudiant ordinaire ne permettent d'écrire ces tables.
- Les questions et dossiers en brouillon ne sont jamais exposés aux étudiants (RLS : `statut = 'publiee'` uniquement).
- Chaque étudiant ne peut lire/modifier que sa propre ligne dans `profiles` (RLS `auth.uid() = id`), et ne peut jamais modifier la colonne `is_admin` de son propre profil (revoquée pour le rôle `authenticated`), même via une requête REST forgée à la main.
- Les seules données personnelles collectées sont celles fournies volontairement à la création d'un profil (email, prénom/nom, niveau, faculté) ; elles ne sont jamais revendues à des tiers.
