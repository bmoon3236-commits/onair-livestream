# OnAir — Site de live streaming (WebRTC)

Site de streaming vidéo en direct original : comptes utilisateurs, diffusion webcam
en direct (WebRTC), chat en direct, liste des lives en cours, réactions animées.
Aucun système de paiement, aucun jeton.

## Stack technique

- **Backend** : Node.js + Express + Socket.io (serveur de signaling WebRTC + chat + réactions)
- **Comptes** : stockage fichier JSON (`data/users.json`) + mots de passe hashés (bcrypt)
- **Frontend** : HTML/CSS/JS natif, pas de framework — WebRTC natif du navigateur
- **Vidéo** : pair-à-pair, un `RTCPeerConnection` par spectateur (diffusion "mesh")

## Lancer en local

```bash
npm install
npm start
```

Puis ouvrir http://localhost:3000 dans le navigateur. Autorise l'accès à la webcam/micro
quand ton navigateur le demande sur la page "Démarrer un live".

## Déploiement en ligne (obligatoire pour un accès public)

Ce projet est un serveur Node.js classique avec WebSockets : il faut un hébergeur qui
garde un process Node vivant en permanence (pas un hébergement statique).

Options simples et gratuites/pas chères pour démarrer :

1. **Render.com** — "New Web Service", connecter le repo Git, build command `npm install`,
   start command `npm start`. Fonctionne tel quel.
2. **Railway.app** — détection automatique de Node, déploiement en un clic depuis Git.
3. **Fly.io** — plus de contrôle, nécessite `fly launch` en ligne de commande.

Étapes générales :
1. Pousse ce dossier sur un dépôt GitHub.
2. Connecte ce dépôt à l'hébergeur choisi.
3. Définis la variable d'environnement `SESSION_SECRET` avec une valeur aléatoire longue
   (sécurité des sessions).
4. Le HTTPS est indispensable : `getUserMedia` (accès webcam) ne fonctionne **que** en
   HTTPS ou sur `localhost`. Les hébergeurs ci-dessus fournissent HTTPS automatiquement.

## ⚠️ Limite technique importante : serveur TURN

Ce projet utilise uniquement un serveur STUN public (Google) pour aider les navigateurs
à se connecter directement entre eux. Ça fonctionne bien pour la plupart des connexions,
mais **certains réseaux (NAT symétriques, réseaux d'entreprise stricts, certains
opérateurs mobiles) bloqueront la connexion directe**.

Pour une fiabilité de connexion proche de 100 % en production, il faut ajouter un serveur
**TURN** (relais de secours quand la connexion directe échoue) à la liste `ICE_SERVERS`
dans `public/js/broadcast.js` et `public/js/watch.js`. Options :
- Un service TURN managé (ex. Twilio Network Traversal Service, Xirsys, Cloudflare Calls)
- Ou héberger son propre serveur `coturn`

Sans TURN, le site fonctionnera pour la plupart des utilisateurs mais pas pour tous.

## Limite d'architecture : diffusion "mesh"

Le diffuseur ouvre une connexion WebRTC séparée par spectateur. C'est simple et
fonctionne bien jusqu'à environ 10-20 spectateurs simultanés par live. Au-delà, la
charge sur l'ordinateur/la connexion du diffuseur devient trop lourde. Pour un vrai
passage à l'échelle (des centaines/milliers de spectateurs), il faudrait un serveur
SFU dédié (ex. mediasoup, LiveKit, Janus) — une évolution possible mais plus complexe.

## Structure du projet

```
livestream-app/
├── server.js           # Serveur Express + Socket.io (auth, streams, signaling)
├── userStore.js         # Stockage utilisateurs (fichier JSON + bcrypt)
├── data/users.json      # Base d'utilisateurs (créée automatiquement)
├── package.json
└── public/
    ├── index.html        # Accueil : liste des lives + connexion
    ├── broadcast.html     # Page diffuseur (webcam, chat, réactions)
    ├── watch.html         # Page spectateur
    ├── css/style.css
    └── js/
        ├── auth.js        # Connexion/inscription partagées
        ├── index.js       # Liste des streams
        ├── broadcast.js   # WebRTC côté diffuseur
        └── watch.js       # WebRTC côté spectateur
```
