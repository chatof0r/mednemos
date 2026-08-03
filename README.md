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
4. Créer le compte administrateur : **Authentication > Users > Add user**, renseigner un email et un mot de passe (décochez "Auto confirm user" uniquement si vous voulez gérer la confirmation par email). C'est ce compte qui donne accès à l'interface `/admin` — il n'y a plus de PIN.

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
│   └── AdminLoginModal.tsx # Modal de connexion admin (Supabase Auth)
├── lib/
│   └── supabase.ts         # Client Supabase
├── pages/
│   ├── Home.tsx            # Sélection en cascade + lancement de session
│   ├── Session.tsx         # Questions + validation + résultats
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

## Accès à l'administration

1. Cliquer sur le **logo** dans la navbar pour ouvrir la modal "À propos"
2. Cliquer sur **Administrateur**
3. Se connecter avec l'email et le mot de passe du compte admin (créé dans Supabase, voir ci-dessus)
4. Redirection automatique vers `/admin`

L'authentification est gérée par **Supabase Auth** (session JWT, persistée par le SDK). La déconnexion invalide la session côté Supabase.

---

## Sécurité

- L'accès en écriture (création/modification/suppression de questions, dossiers, suggestions, images) est protégé par les policies RLS de Supabase, qui exigent une session authentifiée (`to authenticated`) — la clé anon seule ne permet plus que la lecture des contenus publiés et l'envoi de suggestions.
- Les questions et dossiers en brouillon ne sont jamais exposés aux étudiants (RLS : `statut = 'publiee'` uniquement).
- Aucune donnée personnelle n'est collectée.
