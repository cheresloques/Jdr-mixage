# Table de mixage JdR

Une web app pour piloter la musique Spotify pendant les parties de jeu de rôle.
Chaque séance est un fichier JSON sur Google Drive, préparé par Claude : un pad par scène prévue,
plus un pad « Hors des sentiers battus » pour l'imprévu. Un toucher sur un pad lance la playlist
avec un fondu enchaîné.

Essai sans compte : ouvrir `index.html?demo` (Spotify et Drive sont simulés).

## Comment ça marche

- **Aucun serveur** : l'app est un site statique (GitHub Pages).
- **Spotify** : connexion OAuth PKCE, puis pilotage via Spotify Connect. L'app Spotify de la tablette
  joue le son (vers l'enceinte Bluetooth) ; la table de mixage lui envoie les ordres
  (playlist, volume, pause). **Compte Premium obligatoire.**
- **Google Drive** : lecture seule des fichiers qui se terminent par `.seance.json`.
- **Fondu** : le volume descend, la playlist change, le volume remonte, en quelques paliers
  (durée réglable de 0 à 10 s).

## Utilisation en partie

1. Ouvrir l'app Spotify sur la tablette (et la relier à l'enceinte).
2. Ouvrir la table de mixage, choisir la séance.
3. Vérifier que l'appareil sélectionné en bas est bien la tablette.
4. Toucher les pads. Raccourcis clavier : `1`-`9` scènes, `0` hors des sentiers, espace pause.

Astuce : dans Chrome Android, menu ⋮ > « Ajouter à l'écran d'accueil » pour l'avoir en plein écran.

## Format d'un fichier de séance

Nom : `<quelque chose>.seance.json`, n'importe où sur le Drive (conseillé : `JdR/Musique/seances/`).
Voir [`seances/exemple.seance.json`](seances/exemple.seance.json).

| Champ | Rôle |
|---|---|
| `seance`, `campagne` | Titre affiché en haut |
| `scenes[]` | Un pad par scène, dans l'ordre |
| `scenes[].titre` | Nom du pad |
| `scenes[].type` | `musique` ou `ambiance` (affichage) |
| `scenes[].ambiance` | Petite description sous le titre |
| `scenes[].couleur` | Couleur du pad (`#rrggbb`) |
| `scenes[].spotify_playlist` | URI `spotify:playlist:…` |
| `scenes[].volume` | Volume relatif de la scène, 0-100 (défaut 100) |
| `scenes[].aleatoire` | Lecture aléatoire (défaut `true`) |
| `hors_sentiers` | Même forme qu'une scène, pad à part |

## Mise en place (une seule fois)

### 1. App Spotify
1. <https://developer.spotify.com/dashboard> > *Create app*.
2. *Redirect URI* : l'adresse GitHub Pages exacte, par exemple
   `https://cheresloques.github.io/jdr-mixage/` (avec le `/` final).
3. Cocher *Web API*. Copier le *Client ID* dans `config.js`.
4. L'app reste en mode développement : c'est suffisant pour ton compte.

### 2. Accès Google Drive
1. <https://console.cloud.google.com/> > créer un projet, activer *Google Drive API*.
2. *Écran de consentement OAuth* : type externe, mode test, ajouter ton adresse Gmail comme testeur.
3. *Identifiants* > *ID client OAuth* > *Application Web*, origine JavaScript autorisée :
   `https://cheresloques.github.io`.
4. Copier l'ID client dans `config.js`.

Google affichera « application non validée » à la connexion : normal pour une app perso en mode test.

### 3. GitHub Pages
*Settings* > *Pages* > *Deploy from a branch* > `main`, dossier `/ (root)`.

## Limites connues

- Spotify ne joue qu'un morceau à la fois par compte : pas d'ambiances superposées.
- Les fondus passent par le réseau : quelques paliers par seconde, pas un fondu de studio.
- Une scène démarre toujours au début d'une playlist (en aléatoire par défaut).
