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
VITE_ADMIN_PIN=1234
```

> **Note** : `VITE_ADMIN_PIN` est le code PIN à 4 chiffres pour accéder à l'interface d'administration. Choisissez un PIN sécurisé avant le déploiement en production.

### 3. Configurer Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Dans **SQL Editor**, exécuter le contenu de `supabase/schema.sql`
3. Récupérer l'URL et la clé anon dans **Settings > API**

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
   - `VITE_ADMIN_PIN`
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
│   └── PinModal.tsx        # Modal de saisie du PIN admin
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
3. Saisir le code PIN défini dans `VITE_ADMIN_PIN`
4. Redirection automatique vers `/admin`

L'authentification admin est gérée côté client via `sessionStorage`. Elle s'efface à la fermeture du navigateur.

---

## Sécurité

- Le PIN est vérifié côté client uniquement. Pour un usage sérieux, envisagez d'utiliser Supabase Auth.
- Les questions en brouillon ne sont jamais exposées aux étudiants (filtrage côté client + RLS côté Supabase).
- Aucune donnée personnelle n'est collectée.
