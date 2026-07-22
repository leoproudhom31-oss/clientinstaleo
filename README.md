# InstaLeo 🛡️

**Client Instagram de bureau**, sans trackers, avec une **interface façon Discord**.
Application **Electron** : elle tourne sur **ta machine**, donc les requêtes
partent de **ton adresse IP** — comme l'app officielle — et la connexion
fonctionne (contrairement à un hébergement type Vercel, dont l'IP datacenter est
bloquée par Instagram).

> Tu mets tes identifiants, tu consultes ton fil et tes messages privés dans une
> interface sombre inspirée de Discord — **sans le moindre script de tracking
> Instagram/Meta**.

---

## 🚀 Lancer l'application

Le code est **déjà compilé** (dossier `dist/` versionné). Il te suffit de :

```bash
npm install     # installe les dépendances (dont Electron)
npm start       # ouvre l'application InstaLeo
```

C'est tout. Une fenêtre s'ouvre :

1. Clique sur l'icône **connexion** (en bas à gauche).
2. Entre ton **`@pseudo`** (⚠️ pas ton e-mail — l'API privée le rejette souvent)
   et ton mot de passe.
3. La première fois, Instagram envoie un **code de vérification** par e-mail/SMS :
   l'app te le demande, tu le saisis, et tu es connecté·e.

> Sans identifiants, l'app démarre en **mode démo** (données fictives, zéro
> requête réseau) — pratique pour visualiser l'interface.

---

## 📦 Générer un exécutable installable (optionnel)

Pour produire un `.exe` (Windows), `.dmg` (macOS) ou `.AppImage` (Linux) :

```bash
npm i -D electron-builder     # une fois
npm run dist                  # résultat dans release/
```

`electron-builder` construit pour le système sur lequel tu lances la commande.

---

## ✅ Si la connexion échoue

1. **`@pseudo`, pas l'e-mail** — c'est la cause n°1.
2. **Code de vérification** : entre bien celui reçu par e-mail/SMS.
3. **Checkpoint** : si Instagram bloque, ouvre l'app officielle, confirme
   « C'était moi », puis réessaie dans InstaLeo.
4. **Réseau surveillé** (Wi-Fi public, VPN…) : essaie un autre réseau, ou
   renseigne `IG_PROXY` dans un fichier `.env` (voir `.env.example`).

---

## 🔒 Confidentialité

- ✅ Aucun script Instagram/Meta, aucun pixel, aucun analytics, aucun cookie tiers.
- ✅ **Content-Security-Policy stricte** : tout script/connexion/image externe est
  interdit → le « 0 tracker » est imposé, pas juste promis.
- ✅ Les images passent par un **proxy local** : la fenêtre ne charge rien
  directement depuis les serveurs de Meta.
- ✅ La session est chiffrée (AES-256-GCM) ; **aucun mot de passe n'est stocké**.
- ⚠️ Quand tu te connectes, c'est **ton compte** qui s'authentifie : Instagram
  voit ton activité côté serveur. Aucun client ne peut l'éviter — ce qu'on
  supprime, c'est le **pistage navigateur**.

## ⚠️ Avertissement

Projet **éducatif / personnel**, **non affilié** à Instagram ni à Meta. Utiliser
l'API privée est contraire aux CGU d'Instagram (usage perso, à tes risques). Ne
partage jamais un fichier **HAR** de connexion : il contient ton mot de passe en
clair.

---

## 🧑‍💻 Développement (optionnel)

```bash
npm run dev     # interface web + /api en direct (http://localhost:5173), hot reload
npm run build   # recompile dist/ (à refaire si tu modifies src/)
```

## 🧱 Architecture

```
.
├── electron/main.cjs     App de bureau : embarque le serveur, ouvre la fenêtre
├── server.cjs            Serveur local (sert dist/ + /api) lancé par Electron
├── server/adapter.cjs    Exécute les handlers /api dans le serveur local
├── api/                  login (2FA + challenge), feed, inbox, thread, send, img
│   └── _lib/             instagram-private-api + mapping + session chiffrée
├── src/                  Interface Vite + React + TS (façon Discord)
└── dist/                 Interface déjà compilée (versionnée)
```

Le moteur réseau (`instagram-private-api`) tourne dans le processus Electron, sur
**ta machine** : c'est ce qui fait partir les requêtes de **ton IP**.

## 🛠️ Stack

Electron · Vite · React · TypeScript · lucide-react · instagram-private-api

## 📄 Licence

Usage personnel et éducatif. Aucune garantie. Tu es responsable du respect des
conditions d'utilisation d'Instagram et des lois applicables.
