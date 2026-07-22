# InstaLeo 🛡️

Un **client Instagram alternatif**, sans trackers, avec une **interface façon Discord**.

> Tu mets tes identifiants, tu consultes ton fil et tes messages privés dans une
> interface sombre inspirée de Discord — **sans charger le moindre script de
> tracking Instagram/Meta**.

## 🔑 Le point le plus important à comprendre

Instagram **bloque les connexions venant des serveurs / datacenters** (Vercel,
AWS…) et renvoie de faux « mot de passe incorrect ». Et un navigateur seul ne
peut pas parler à l'API d'Instagram (bloqué par CORS).

**La solution : faire tourner InstaLeo en client *local*, sur ta machine.** Les
requêtes partent alors de **ton adresse IP résidentielle** — exactement comme
l'app officielle — et la connexion fonctionne.

| Mode | Commande | Connexion réelle ? | Pourquoi |
| --- | --- | --- | --- |
| **Dev local** (recommandé) | `npm run dev` | ✅ oui (ton IP) | le back tourne chez toi |
| **Serveur local** | `npm start` | ✅ oui (ton IP) | idem, version compilée |
| **App de bureau** (Electron) | `npm run desktop` | ✅ oui (ton IP) | fenêtre + serveur embarqué |
| **Vercel** | déploiement | ⚠️ démo seulement | IP datacenter bloquée par Instagram |

> Autrement dit : **Vercel = vitrine/démo**, **local = client qui marche vraiment**.

---

## 🚀 Utilisation

### Option 1 — le plus simple (recommandé)

```bash
npm install
npm run dev
```

Ça ouvre http://localhost:5173. Clique sur l'icône de connexion (en bas à
gauche), entre tes identifiants → **la connexion passe par ton IP**, donc elle
aboutit. La première fois, Instagram enverra sûrement un **code de vérification**
par e-mail/SMS : l'app te le demande, tu le saisis, et c'est bon.

### Option 2 — app de bureau (double-clic, sans terminal au quotidien)

```bash
npm install
npm i -D electron            # une fois (télécharge Electron)
npm run build
npm run desktop             # ouvre l'app InstaLeo
```

Pour générer un exécutable installable (.exe / .dmg / .AppImage) :

```bash
npm i -D electron electron-builder
npm run desktop:build       # résultat dans release/
```

### Option 3 — serveur local compilé

```bash
npm start                   # build + serveur -> http://localhost:4321
```

### Option 4 — démo publique sur Vercel

Le déploiement Vercel sert **l'interface en mode démo** (données fictives, zéro
requête réseau). La connexion réelle n'y fonctionne pas (IP datacenter). Pour la
déployer quand même : importe le repo sur Vercel (preset **Vite** auto-détecté).

---

## ✅ Si la connexion échoue quand même

1. **Utilise ton `@pseudo`, pas ton e-mail.** L'API privée rejette souvent l'e-mail.
2. **Tu es bien en local** (`npm run dev` / `npm start` / `npm run desktop`), pas
   sur l'URL Vercel ?
3. **Réseau très surveillé** (Wi-Fi public, VPN, certaines box) ? Essaie un autre
   réseau, ou configure un proxy via la variable `IG_PROXY` (voir `.env.example`).
4. **Checkpoint** : si Instagram demande une validation, ouvre l'app officielle,
   confirme « C'était moi », puis réessaie.

---

## 🔒 Confidentialité

**Bloqué (côté navigateur) :**
- ✅ Aucun script Instagram/Meta, aucun pixel, aucun analytics, aucun cookie tiers.
- ✅ Une **Content-Security-Policy stricte** interdit tout script/connexion/image
  externe → le « 0 tracker » est imposé par le navigateur, pas juste promis.
- ✅ Les images passent par un **proxy local** (`/api/img`) : rien n'est chargé
  directement depuis les serveurs de Meta par la page.
- ✅ En mode démo, images et avatars générés en local (SVG) : zéro requête externe.

**Ce qui reste vrai :** quand tu te connectes, c'est **ton compte** qui
s'authentifie ; Instagram voit donc ton activité côté serveur. Aucun client ne
peut l'éviter — ce qu'on supprime, c'est le **pistage navigateur**.

## ⚠️ Avertissement

Projet **éducatif / personnel**, **non affilié** à Instagram ni à Meta. Utiliser
l'API privée est contraire aux CGU d'Instagram (usage perso, à tes risques). Si tu
partages un fichier **HAR** pour déboguer, il contient ton **mot de passe en
clair** : anonymise-le ou change ton mot de passe ensuite.

---

## 🧱 Architecture

```
.
├── api/                    Handlers (login 2FA/challenge, feed, inbox, thread, send, img)
│   └── _lib/               instagram-private-api + mapping + session chiffrée
├── server/adapter.cjs      Fait tourner les handlers /api dans un serveur Node local
├── server.cjs              Serveur local autonome (dist/ + /api) — `npm start`
├── electron/main.cjs       App de bureau : embarque le serveur, ouvre une fenêtre
├── vite.config.ts          Sert aussi /api en `npm run dev` (donc live, via ton IP)
├── src/                    Front Vite + React + TS (UI façon Discord)
└── vercel.json             Déploiement démo + en-têtes de sécurité (CSP…)
```

**Le même code `/api` tourne partout** — en dev Vite, dans le serveur local,
dans l'app Electron et (en démo) sur Vercel. La seule différence : en local, la
machine qui appelle Instagram, **c'est la tienne**.

Après connexion, l'état de `instagram-private-api` est sérialisé, compressé,
chiffré (AES-256-GCM) et stocké dans un cookie `httpOnly`. Aucun mot de passe
n'est conservé.

## 🛠️ Stack

Vite · React · TypeScript · lucide-react · instagram-private-api · Electron (option)

## 📄 Licence

Usage personnel et éducatif. Aucune garantie. Tu es responsable du respect des
conditions d'utilisation d'Instagram et des lois applicables.
