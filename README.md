# Relais — Suivi Hypernet (PWA)

## 1. Héberger l'app (obligatoire pour la connexion EVE + l'installation propre)

La connexion EVE SSO ne fonctionne pas si tu ouvres juste `index.html` depuis
ton stockage (`file://`). Il faut une vraie URL `https://`. Le plus simple et
gratuit : **GitHub Pages**.

1. Crée un repo GitHub (public ou privé), par ex. `relais-hypernet`.
2. Mets tous les fichiers de ce dossier à la racine du repo (`index.html`,
   `app.js`, `auth.js`, `config.template.js`, `callback.html`, `style.css`,
   `manifest.json`, `sw.js`, `.gitignore`, `.github/workflows/deploy.yml`,
   le dossier `icons/`). Ne crée pas `config.js` toi-même, il est généré
   automatiquement (voir étape 3).
3. Repo → **Settings → Pages** → tu configureras la Source à l'étape 3
   ci-dessous (à faire APRÈS avoir ajouté les secrets).
4. Une fois le workflow lancé (étape 3), ton app est en ligne sur :
   `https://TON_PSEUDO.github.io/relais-hypernet/`

## 2. Créer ton application EVE (pour te connecter avec ton perso)

1. Va sur https://developers.eveonline.com/applications et connecte-toi.
2. **Create New Application**.
3. Nom libre (ex : "Relais Hypernet Tracker").
4. Connection Type : **Authentication & API Access**.
5. Scopes : coche uniquement `esi-wallet.read_character_wallet.v1`.
6. Callback URL : mets EXACTEMENT
   `https://TON_PSEUDO.github.io/relais-hypernet/callback.html`
7. Crée l'appli, puis copie le **Client ID** affiché (pas besoin du secret,
   l'app utilise le flux PKCE, sans secret).

## 3. Mettre le Client ID dans les Secrets GitHub (pas dans le code)

Le fichier `config.js` n'est plus committé dans le repo : il est généré à
chaque déploiement par un workflow GitHub Actions à partir de **Secrets**,
donc ton Client ID n'apparaît jamais en clair dans le code source.

1. Dans ton repo → **Settings → Secrets and variables → Actions**.
2. **New repository secret** → nom `EVE_CLIENT_ID` → colle ton Client ID.
3. **New repository secret** → nom `EVE_CALLBACK_URL` → colle
   `https://TON_PSEUDO.github.io/relais-hypernet/callback.html`
   (doit être identique à ce que tu as mis à l'étape 2.6).
4. Repo → **Settings → Pages** → Source : choisis **GitHub Actions**
   (et non plus "Deploy from a branch").
5. Fais un petit commit (ou lance le workflow manuellement depuis l'onglet
   **Actions → Deploy PWA to GitHub Pages → Run workflow**). Le workflow
   génère `config.js` à partir des secrets et publie le site.

Le fichier `config.template.js` (versionné, sans vraie valeur) sert de
modèle ; `config.js` (avec ton vrai Client ID) n'existe que dans le build
déployé, jamais dans l'historique Git.

## 4. Installer sur ton téléphone Android

1. Ouvre Chrome sur ton téléphone.
2. Va sur `https://TON_PSEUDO.github.io/relais-hypernet/`
3. Menu ⋮ (trois points en haut à droite) → **"Ajouter à l'écran d'accueil"**
   (ou "Installer l'application" si Chrome le propose directement).
4. Confirme. Une icône apparaît sur ton écran d'accueil, l'app s'ouvre en
   plein écran comme une vraie appli.
5. Dans l'app, accepte la bannière de notifications en haut.
6. Bouton **"Connecter"** → tu es redirigé vers la page de connexion EVE
   officielle → autorise l'accès → tu reviens automatiquement dans l'app,
   connecté.

## 5. Utilisation

- **HyperCores achetés (taxe de création)** : l'app scanne
  `/wallet/transactions/` et repère tes achats de l'item HyperCore
  (typeID 52568), payé au moment où tu crées une offre. Lie chaque achat à
  un relais (même pas encore actif) → son champ "Taxe de création" se
  remplit automatiquement.
- **Transactions Hypernet détectées** : l'app scanne ton wallet journal et
  filtre sur les `ref_type` exacts que CCP utilise en interne pour le
  Hypernet (nom de code "flux") : `flux_ticket_sale` (achat d'un ticket),
  `flux_payout` (versement final), `flux_tax` (taxe de 5% à la
  finalisation), `flux_ticket_repayment` (remboursement si offre expirée).
  Pour chaque vente de ticket détectée, choisis à quel relais actif elle
  correspond → le compteur "tickets vendus" est incrémenté automatiquement.
- La marge affichée déduit automatiquement la taxe de finalisation de 5%
  (`flux_tax`) en plus de la taxe de création et du coût du prix.
- Le reste (créer un relais, marquer terminé + gagnant, notifications) est
  identique à avant, en local sur ton téléphone.

**Fiabilité** : les `ref_type` `flux_*` et le typeID HyperCore (52568) sont
des identifiants stables côté CCP (pas du texte libre), donc la détection
est fiable même si CCP traduit ou reformule les descriptions affichées.
Un filtre par mots-clés reste en secours dans `auth.js`
(`HYPERNET_KEYWORDS`) au cas où CCP ajoute une variante non répertoriée.
