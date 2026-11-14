// Connexion Spotify (OAuth PKCE, sans serveur) et pilotage de la lecture via Spotify Connect.
const Spotify = (() => {
  const SCOPES = "user-read-playback-state user-modify-playback-state";
  const API = "https://api.spotify.com/v1";
  const store = {
    get(k) { try { return localStorage.getItem("sp_" + k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem("sp_" + k) : localStorage.setItem("sp_" + k, v); } catch {} },
  };
  // Adresse de retour normalisée (sans index.html, avec le « / » final) pour correspondre au dashboard Spotify.
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, "").replace(/\/?$/, "/");

  function aleatoire(n) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => ("0" + (b % 36).toString(36)).slice(-1)).join("");
  }
  async function challenge(verifier) {
    const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(h))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function connecter() {
    const verifier = aleatoire(64);
    store.set("verifier", verifier);
    const p = new URLSearchParams({
      client_id: CONFIG.SPOTIFY_CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri(),
      scope: SCOPES,
      code_challenge_method: "S256",
      code_challenge: await challenge(verifier),
    });
    location.href = "https://accounts.spotify.com/authorize?" + p;
  }

  async function demanderJeton(params) {
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CONFIG.SPOTIFY_CLIENT_ID, ...params }),
    });
    if (!r.ok) throw new Error("Connexion Spotify refusée (" + r.status + ")");
    const j = await r.json();
    store.set("access", j.access_token);
    store.set("expire", String(Date.now() + (j.expires_in - 60) * 1000));
    if (j.refresh_token) store.set("refresh", j.refresh_token);
  }

  // À appeler au chargement : termine la connexion si on revient de Spotify.
  async function initialiser() {
    const q = new URLSearchParams(location.search);
    if (q.get("code")) {
      await demanderJeton({
        grant_type: "authorization_code",
        code: q.get("code"),
        redirect_uri: redirectUri(),
        code_verifier: store.get("verifier"),
      });
      store.set("verifier", null);
      history.replaceState(null, "", redirectUri());
    }
    return estConnecte();
  }

  const estConnecte = () => !!store.get("refresh");

  function deconnecter() { ["access", "expire", "refresh"].forEach((k) => store.set(k, null)); }

  async function jeton() {
    if (store.get("access") && Date.now() < Number(store.get("expire"))) return store.get("access");
    await demanderJeton({ grant_type: "refresh_token", refresh_token: store.get("refresh") });
    return store.get("access");
  }

  async function api(methode, chemin, corps) {
    const r = await fetch(API + chemin, {
      method: methode,
      headers: { Authorization: "Bearer " + (await jeton()), "Content-Type": "application/json" },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    if (r.status === 429) {
      const attente = Number(r.headers.get("Retry-After") || 1);
      await new Promise((ok) => setTimeout(ok, attente * 1000));
      return api(methode, chemin, corps);
    }
    if (!r.ok) {
      let msg = r.status + "";
      try { msg = (await r.json()).error.message || msg; } catch {}
      throw new Error("Spotify : " + msg);
    }
    return r.status === 204 ? null : r.json().catch(() => null);
  }

  const qs = (o) => "?" + new URLSearchParams(Object.fromEntries(Object.entries(o).filter(([, v]) => v != null)));

  return {
    connecter, initialiser, estConnecte, deconnecter,
    appareils: async () => (await api("GET", "/me/player/devices")).devices || [],
    etat: () => api("GET", "/me/player"),
    jouer: (uri, appareil) => api("PUT", "/me/player/play" + qs({ device_id: appareil }), { context_uri: uri }),
    reprendre: (appareil) => api("PUT", "/me/player/play" + qs({ device_id: appareil })),
    pause: (appareil) => api("PUT", "/me/player/pause" + qs({ device_id: appareil })),
    suivant: (appareil) => api("POST", "/me/player/next" + qs({ device_id: appareil })),
    aleatoire: (actif, appareil) => api("PUT", "/me/player/shuffle" + qs({ state: actif, device_id: appareil })),
    volume: (v, appareil) => api("PUT", "/me/player/volume" + qs({ volume_percent: Math.round(v), device_id: appareil })),
  };
})();
