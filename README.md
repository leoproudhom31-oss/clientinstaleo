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
2. Clique sur **« Se connecter avec Instagram »**. Une **vraie fenêtre
   Instagram** s'ouvre : tu te connectes normalement (2FA, checkpoints… gérés
   par Instagram lui-même, **aucun robot détecté**).
3. Dès que tu es connecté·e, la fenêtre se ferme et l'app réutilise ta session.
   Ton fil et tes messages s'affichent. ✅

> **Pourquoi c'est fiable ?** La connexion a lieu sur la page officielle
> d'Instagram, comme d'habitude — pas de « faux mot de passe incorrect », pas de
> blocage anti-bot. L'app se contente ensuite de réutiliser la session, depuis
> **ton IP**.
>
> La connexion par identifiants (login/mot de passe) reste disponible en option
> « avancée », mais elle est souvent bloquée par l'anti-bot d'Instagram.
> Sans connexion, l'app démarre en **mode démo** (données fictives).

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

1. Utilise **« Se connecter avec Instagram »** (fenêtre officielle) plutôt que
   les identifiants — c'est de loin le plus fiable.
2. La fenêtre reste ouverte ? Termine bien la connexion (2FA / « C'était moi »)
   sur la page Instagram : dès que tu arrives sur ton fil, elle se ferme seule.
3. Toujours en mode démo après connexion ? Fais **Déconnexion** (⚙️) puis
   reconnecte-toi.
4. Voie identifiants seulement : ton **nom d'utilisateur** (sans « @ », pas
   l'e-mail), et un **mot de passe à jour** si tu l'as changé récemment.
5. Profil toujours affiché comme « mon compte » avec un avatar « ? » : une
   ancienne session incomplète est désormais **invalidée automatiquement** au
   démarrage (l'app repasse en mode démo). Reconnecte-toi simplement via
   **« Se connecter avec Instagram »** — la capture réessaie l'API puis, en
   secours, lit directement ton avatar/pseudo affichés par Instagram lui-même.

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
├── electron/
│   ├── main.cjs          Embarque le serveur + connexion « vraie fenêtre Instagram »
│   └── preload.cjs       Pont sécurisé (igLogin / igLogout) vers l'interface
├── server.cjs            Serveur local (sert dist/ + /api) lancé par Electron
├── server/adapter.cjs    Exécute les handlers /api dans le serveur local
├── api/                  feed, inbox, thread, send, img, login (identifiants)
│   └── _lib/
│       ├── web-ig.cjs        API web Instagram via la session capturée (voie fiable)
│       ├── desktop-session   Session capturée (chiffrée, en mémoire + disque)
│       ├── ig.js             Voie identifiants (instagram-private-api)
│       └── map.cjs           Mapping des réponses -> UI (partagé)
├── src/                  Interface Vite + React + TS (façon Discord)
└── dist/                 Interface déjà compilée (versionnée)
```

**Deux voies de connexion :** (1) **« Se connecter avec Instagram »** ouvre la
vraie page Instagram, capture la session et l'utilise via l'API web — fiable ;
(2) **identifiants** via `instagram-private-api` — souvent bloquée par l'anti-bot.

Le moteur réseau (`instagram-private-api`) tourne dans le processus Electron, sur
**ta machine** : c'est ce qui fait partir les requêtes de **ton IP**.

## 🛠️ Stack

Electron · Vite · React · TypeScript · lucide-react · instagram-private-api

## 📄 Licence

Usage personnel et éducatif. Aucune garantie. Tu es responsable du respect des
conditions d'utilisation d'Instagram et des lois applicables.
