# InstaLeo 🛡️

Un **client Instagram alternatif**, sans trackers, avec une **interface façon Discord**.
Déployable en un clic sur **Vercel** (Vite + React côté front, fonctions serverless côté back).

> Tu mets tes identifiants, tu consultes ton fil et tes messages privés dans une
> interface sombre inspirée de Discord — **sans charger le moindre script de
> tracking Instagram/Meta** dans ton navigateur.

---

## ✨ Ce que ça fait

- **Interface façon Discord** : rail des « serveurs », liste de canaux, salon de
  discussion, liste des membres, panneau utilisateur en bas à gauche, thème sombre.
- **Fil d'actualité** rendu comme un salon : chaque publication devient un « message ».
- **Messages privés (Direct)** : conversations affichées comme des salons Discord,
  avec regroupement des messages, envoi de texte, etc.
- **Mode démo** intégré : l'appli est utilisable immédiatement, sans identifiants et
  **sans aucune requête réseau** (avatars et images générés localement en SVG).
- **Connexion réelle** (optionnelle) à ton compte via l'API privée d'Instagram,
  exécutée **côté serveur**, avec prise en charge de la **double authentification (2FA)**.

## 🔒 Le modèle de confidentialité (honnête)

**Ce qui est bloqué (côté navigateur) :**

- ✅ Aucun script Instagram/Meta, aucun pixel de suivi, aucun analytics.
- ✅ Aucun cookie tiers / publicitaire.
- ✅ Les images passent par un **proxy** (`/api/img`) : ton navigateur ne contacte
  **jamais** directement les serveurs de Meta (ni cookie, ni referer, ni fuite d'IP).
- ✅ En mode démo, **zéro requête externe** : tout est généré en local.

**Ce qui reste vrai (et qu'aucun client ne peut éviter) :**

- ⚠️ Quand tu te connectes, c'est **ton compte** qui s'authentifie : Instagram voit
  donc ton activité **côté serveur**. Un client alternatif supprime le pistage
  *navigateur*, pas la connaissance qu'a Instagram de ce que fait ton compte.
- ⚠️ Utiliser l'API privée est **contraire aux CGU d'Instagram**. C'est à tes
  risques (défis de sécurité, blocages temporaires, voire bannissement possible).
  À réserver à un usage **personnel**.

## ⚠️ Avertissement

Projet **éducatif / personnel**, **non affilié** à Instagram ni à Meta.
Les connexions depuis une IP de datacenter (comme Vercel) déclenchent souvent une
vérification « connexion suspecte » (checkpoint) ou une demande de 2FA. C'est normal
et géré du mieux possible, mais cela peut rendre la connexion réelle capricieuse.
En cas de doute, **reste en mode démo**.

---

## 🚀 Démarrage rapide

### 1. Voir l'interface en local (mode démo)

```bash
npm install
npm run dev
```

Ouvre http://localhost:5173. L'appli démarre en **mode démo** : tu peux explorer
toute l'interface sans identifiants. (Les routes `/api/*` ne tournent pas avec
`vite dev` — voir ci-dessous pour les tester.)

### 2. Tester la connexion réelle en local

Les fonctions serverless nécessitent le CLI Vercel :

```bash
npm i -g vercel
vercel dev
```

Crée un fichier `.env` (voir `.env.example`) avec au minimum :

```
SESSION_SECRET=une-chaine-aleatoire-longue   # openssl rand -hex 32
```

### 3. Déployer sur Vercel

1. Pousse ce dépôt sur GitHub.
2. Sur [vercel.com](https://vercel.com), **New Project** → importe le dépôt.
   Le framework **Vite** est détecté automatiquement.
3. Dans **Settings → Environment Variables**, ajoute :
   - `SESSION_SECRET` — une longue valeur aléatoire (obligatoire pour chiffrer la session).
   - `ENABLE_LIVE_LOGIN` — `true` (défaut) ou `false` pour forcer le mode démo.
4. **Deploy**. C'est en ligne. 🎉

> La page est marquée `noindex` et n'expose aucune donnée : c'est **ton** déploiement,
> pour **ton** usage.

---

## 🧱 Architecture

```
.
├── api/                    Fonctions serverless Vercel (Node)
│   ├── _lib/
│   │   ├── session.js      Chiffrement AES-256-GCM + cookies httpOnly (chunkés)
│   │   ├── ig.js           Client instagram-private-api + mapping des données
│   │   └── http.js         Utilitaires (lecture JSON, réponses)
│   ├── login.js            Connexion (+ 2FA)
│   ├── logout.js           Déconnexion
│   ├── me.js               Session courante
│   ├── feed.js             Fil d'actualité
│   ├── inbox.js            Liste des conversations
│   ├── thread.js           Messages d'une conversation
│   ├── send.js             Envoi d'un message
│   └── img.js              Proxy d'images (liste blanche de domaines)
├── src/                    Front Vite + React + TypeScript
│   ├── components/         UI façon Discord (rail, sidebar, messages, modales…)
│   ├── lib/                API client, données démo, avatars SVG, formatage
│   ├── state/store.tsx     État global (mode démo/live, espace actif, données)
│   └── index.css           Thème sombre inspiré de Discord
└── vercel.json             Config Vercel (framework Vite, headers de sécurité)
```

**Comment la session tient dans un environnement stateless ?**
Après connexion, l'état de `instagram-private-api` est sérialisé, **compressé**,
**chiffré** (AES-256-GCM avec `SESSION_SECRET`), puis découpé en cookies `httpOnly`.
Chaque appel API restaure ce client à partir des cookies, exécute la requête, puis
rafraîchit la session. Aucun mot de passe n'est stocké.

## 🛠️ Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- [lucide-react](https://lucide.dev/) pour les icônes
- [instagram-private-api](https://github.com/dilame/instagram-private-api) (côté serveur)
- Fonctions serverless Vercel (Node) — chiffrement via `crypto`/`zlib` natifs

## 📄 Licence & responsabilité

Usage personnel et éducatif. Tu es responsable du respect des conditions
d'utilisation d'Instagram et des lois applicables. Aucune garantie.
