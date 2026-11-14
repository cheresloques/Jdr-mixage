// Lecture des fichiers de séance sur Google Drive (lecture seule).
const Drive = (() => {
  let jeton = null;
  let expire = 0;
  let client = null;

  function demander(invite) {
    return new Promise((ok, ko) => {
      if (!window.google?.accounts?.oauth2) return ko(new Error("Le service Google n'est pas chargé."));
      client ??= google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        callback: () => {},
      });
      client.callback = (r) => {
        if (r.error) return ko(new Error("Connexion Google refusée : " + r.error));
        jeton = r.access_token;
        expire = Date.now() + (r.expires_in - 60) * 1000;
        ok(jeton);
      };
      client.requestAccessToken({ prompt: invite ? "consent" : "" });
    });
  }

  async function api(url) {
    if (!jeton || Date.now() > expire) await demander(false);
    const r = await fetch(url, { headers: { Authorization: "Bearer " + jeton } });
    if (!r.ok) throw new Error("Drive : erreur " + r.status);
    return r.json();
  }

  async function listerSeances() {
    const q = `name contains '${CONFIG.SEANCE_SUFFIXE}' and trashed = false`;
    const p = new URLSearchParams({ q, fields: "files(id,name,modifiedTime)", orderBy: "modifiedTime desc", pageSize: "100" });
    const r = await api("https://www.googleapis.com/drive/v3/files?" + p);
    return r.files.filter((f) => f.name.endsWith(CONFIG.SEANCE_SUFFIXE));
  }

  const lireSeance = (id) => api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);

  const aJeton = () => !!jeton && Date.now() < expire;

  return { connecter: () => demander(false), aJeton, listerSeances, lireSeance };
})();
