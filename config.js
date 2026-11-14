// Configuration de la table de mixage.
// Les deux identifiants ci-dessous sont publics (ce ne sont pas des secrets) :
// ils identifient l'application auprès de Spotify et de Google.
window.CONFIG = {
  // Spotify Developer Dashboard > ton app > Client ID
  SPOTIFY_CLIENT_ID: "",
  // Google Cloud Console > Identifiants > ID client OAuth (type "Application Web")
  GOOGLE_CLIENT_ID: "",
  // Les fichiers de séance sur Drive se terminent par ce suffixe.
  SEANCE_SUFFIXE: ".seance.json",
  // Durée par défaut du fondu enchaîné, en secondes.
  FONDU_SECONDES: 3,
};
