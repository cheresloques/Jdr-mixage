// Table de mixage : choix de la séance, pads, fondus enchaînés.
const $ = (id) => document.getElementById(id);
const DEMO = new URLSearchParams(location.search).has("demo");

const etat = {
  seance: null,
  sceneActive: null,
  appareil: null,
  volumeMaitre: 80,   // curseur général (0-100)
  volumeActuel: 0,    // volume réellement envoyé à Spotify
  volumeOk: true,     // l'appareil accepte-t-il le réglage du volume à distance ?
  fondu: CONFIG.FONDU_SECONDES,
  enLecture: false,
  transition: 0,      // compteur pour annuler un fondu si on clique ailleurs
};

const memo = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("mix_" + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("mix_" + k, JSON.stringify(v)); } catch {} },
};

// --- Mode démo : simule Spotify et Drive pour essayer l'interface sans compte. ---
if (DEMO) {
  const log = (...a) => console.log("[démo]", ...a);
  Object.assign(Spotify, {
    initialiser: async () => true, estConnecte: () => true,
    appareils: async () => [{ id: "demo", name: "Tablette (démo)", type: "Tablet", is_active: true }],
    etat: async () => null,
    jouer: async (uri) => log("joue", uri), reprendre: async () => log("reprend"),
    pause: async () => log("pause"), suivant: async () => log("suivant"),
    aleatoire: async (a) => log("aléatoire", a), volume: async (v) => log("volume", Math.round(v)),
  });
  Object.assign(Drive, {
    listerSeances: async () => [{ id: "seances/exemple.seance.json", name: "exemple.seance.json", modifiedTime: new Date().toISOString() }],
    lireSeance: async (id) => (await fetch(id)).json(),
  });
}

// --- Messages ---
let minuterieMessage;
function message(texte) {
  const m = $("message");
  m.textContent = texte;
  m.hidden = false;
  clearTimeout(minuterieMessage);
  minuterieMessage = setTimeout(() => (m.hidden = true), 4000);
}
async function essayer(fn) {
  try { return await fn(); } catch (e) { console.error(e); message(e.message); }
}

// --- Écrans ---
function montrer(ecran) {
  for (const id of ["ecran-connexion", "ecran-seances", "ecran-table"]) $(id).hidden = id !== ecran;
  $("console").hidden = ecran !== "ecran-table";
  $("retour").hidden = ecran !== "ecran-table";
  if (ecran !== "ecran-table") { $("titre").textContent = "Table de mixage"; $("sous-titre").textContent = ""; }
}

const driveConnecte = () => DEMO || memo.get("drive", false);

async function demarrer() {
  $("fondu").value = etat.fondu = memo.get("fondu", CONFIG.FONDU_SECONDES);
  $("volume").value = etat.volumeMaitre = memo.get("volume", 80);
  afficherReglages();

  const spotifyOk = await essayer(() => Spotify.initialiser());
  if (spotifyOk && driveConnecte()) return ouvrirListe();
  ecranConnexion();
}

function ecranConnexion() {
  montrer("ecran-connexion");
  $("config-manquante").hidden = !!(CONFIG.SPOTIFY_CLIENT_ID && CONFIG.GOOGLE_CLIENT_ID);
  $("btn-spotify").classList.toggle("fait", Spotify.estConnecte());
  $("btn-spotify").textContent = Spotify.estConnecte() ? "Spotify connecté ✓" : "Connecter Spotify";
  $("btn-drive").classList.toggle("fait", driveConnecte());
  $("btn-drive").textContent = driveConnecte() ? "Google Drive connecté ✓" : "Connecter Google Drive";
  if (Spotify.estConnecte() && driveConnecte()) ouvrirListe();
}

$("btn-spotify").onclick = () => essayer(() => Spotify.connecter());
$("btn-drive").onclick = () => essayer(async () => {
  await Drive.connecter();
  memo.set("drive", true);
  ecranConnexion();
});

// --- Liste des séances ---
async function ouvrirListe() {
  montrer("ecran-seances");
  const ul = $("liste-seances");
  if (!DEMO && !Drive.aJeton()) {
    // La fenêtre de connexion Google doit être ouverte par un toucher de l'utilisateur.
    ul.innerHTML = "";
    const b = document.createElement("button");
    b.className = "grand";
    b.textContent = "Charger mes séances depuis Drive";
    b.onclick = () => essayer(async () => { await Drive.connecter(); ouvrirListe(); });
    ul.append(b);
    return;
  }
  ul.innerHTML = "<li>Chargement…</li>";
  const fichiers = await essayer(() => Drive.listerSeances());
  ul.innerHTML = "";
  if (!fichiers) return;
  if (!fichiers.length) {
    ul.innerHTML = `<li>Aucun fichier <code>*${CONFIG.SEANCE_SUFFIXE}</code> trouvé sur ton Drive.</li>`;
    return;
  }
  for (const f of fichiers) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.innerHTML = `<span></span><small>Modifié le ${new Date(f.modifiedTime).toLocaleDateString("fr-FR")}</small>`;
    b.firstChild.textContent = f.name.replace(CONFIG.SEANCE_SUFFIXE, "");
    b.onclick = () => essayer(async () => ouvrirSeance(await Drive.lireSeance(f.id)));
    li.append(b);
    ul.append(li);
  }
}
$("btn-recharger").onclick = ouvrirListe;
$("retour").onclick = ouvrirListe;

// --- Table de mixage ---
function creerPad(scene, numero) {
  const b = document.createElement("button");
  b.className = "pad";
  if (scene.couleur) b.style.setProperty("--c", scene.couleur);
  b.innerHTML = `<span class="num"></span><span class="nom"></span><span class="ambiance"></span><span class="type"></span>`;
  b.querySelector(".num").textContent = numero ?? "0";
  b.querySelector(".nom").textContent = scene.titre;
  b.querySelector(".ambiance").textContent = scene.ambiance || "";
  b.querySelector(".type").textContent = scene.type === "ambiance" ? "Ambiance" : "Musique";
  b.onclick = () => lancerScene(scene, b);
  scene._pad = b;
  return b;
}

function ouvrirSeance(seance) {
  if (!Array.isArray(seance?.scenes)) throw new Error("Fichier de séance invalide : il manque la liste « scenes ».");
  etat.seance = seance;
  $("titre").textContent = seance.seance || "Séance";
  $("sous-titre").textContent = seance.campagne || "";
  const pads = $("pads");
  pads.innerHTML = "";
  seance.scenes.forEach((s, i) => pads.append(creerPad(s, i + 1)));
  $("pad-hors").innerHTML = "";
  if (seance.hors_sentiers?.spotify_playlist) {
    $("pad-hors").append(creerPad({ titre: "Hors des sentiers battus", ambiance: "Pour l'imprévu", ...seance.hors_sentiers }, 0));
  }
  montrer("ecran-table");
  rafraichirAppareils();
  verrouEcran();
}

function marquerActif(scene) {
  document.querySelectorAll(".pad").forEach((p) => p.classList.toggle("actif", p === scene?._pad));
  $("scene-en-cours").textContent = scene ? scene.titre : "Silence";
}

const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
const volumeCible = (scene) => (etat.volumeMaitre * (scene?.volume ?? 100)) / 100;

// Règle le volume si l'appareil le permet. Certains appareils (souvent Android/iOS)
// refusent le réglage à distance : on bascule alors en changement de scène sans fondu.
let avertiVolume = false;
async function regler(v) {
  if (!etat.volumeOk) return false;
  try {
    await Spotify.volume(v, etat.appareil);
    etat.volumeActuel = v;
    return true;
  } catch (e) {
    if (!/volume/i.test(e.message)) throw e;
    etat.volumeOk = false;
    majVolumeDispo();
    if (!avertiVolume) {
      avertiVolume = true;
      message("Cet appareil ne permet pas de régler le volume à distance : changements de scène sans fondu. Règle le volume sur la tablette ou l'enceinte.");
    }
    return false;
  }
}
function majVolumeDispo() {
  $("volume").disabled = $("fondu").disabled = !etat.volumeOk;
  $("volume").title = $("fondu").title = etat.volumeOk ? "" : "Volume non réglable à distance sur cet appareil";
}

// Rampe de volume : quelques paliers, car chaque palier est un appel réseau vers Spotify.
async function rampe(de, a, duree, jeton) {
  const paliers = Math.max(1, Math.min(8, Math.round(duree / 250)));
  for (let i = 1; i <= paliers; i++) {
    if (jeton !== etat.transition) return false;
    const v = de + ((a - de) * i) / paliers;
    if (!(await regler(v))) return true;
    if (i < paliers) await pause(duree / paliers);
  }
  return true;
}

async function lancerScene(scene, pad) {
  if (!scene.spotify_playlist) return message("Pas de playlist pour cette scène.");
  const jeton = ++etat.transition;
  pad.classList.add("charge");
  try {
    const demi = (etat.fondu * 1000) / 2;
    if (etat.enLecture && demi > 0) {
      if (!(await rampe(etat.volumeActuel, 0, demi, jeton))) return;
    } else {
      await regler(0);
    }
    if (jeton !== etat.transition) return;
    await Spotify.jouer(scene.spotify_playlist, etat.appareil);
    await Spotify.aleatoire(scene.aleatoire !== false, etat.appareil).catch(() => {});
    etat.enLecture = true;
    etat.sceneActive = scene;
    marquerActif(scene);
    await rampe(0, volumeCible(scene), Math.max(demi, 1), jeton);
    setTimeout(afficherMorceau, 1500);
  } catch (e) {
    console.error(e);
    message(e.message.includes("NO_ACTIVE_DEVICE") || e.message.includes("404")
      ? "Aucun appareil Spotify actif : ouvre l'app Spotify sur la tablette puis choisis-la dans « Appareil »."
      : e.message);
  } finally {
    pad.classList.remove("charge");
  }
}

async function afficherMorceau() {
  if (DEMO) return ($("morceau").textContent = "Morceau de démonstration");
  const e = await Spotify.etat().catch(() => null);
  const t = e?.item;
  $("morceau").textContent = t ? `${t.name} · ${t.artists?.map((a) => a.name).join(", ") || ""}` : "";
  if (e) etat.enLecture = e.is_playing;
}
setInterval(() => { if (!$("console").hidden && !document.hidden) afficherMorceau(); }, 15000);

// --- Console ---
$("btn-lecture").onclick = () => essayer(async () => {
  if (etat.enLecture) { await Spotify.pause(etat.appareil); etat.enLecture = false; }
  else { await Spotify.reprendre(etat.appareil); etat.enLecture = true; }
});
$("btn-suivant").onclick = () => essayer(async () => { await Spotify.suivant(etat.appareil); setTimeout(afficherMorceau, 1000); });

function afficherReglages() {
  $("volume-val").textContent = $("volume").value;
  $("fondu-val").textContent = $("fondu").value + " s";
}
let minuterieVolume;
$("volume").oninput = () => {
  etat.volumeMaitre = Number($("volume").value);
  memo.set("volume", etat.volumeMaitre);
  afficherReglages();
  clearTimeout(minuterieVolume);
  minuterieVolume = setTimeout(() => essayer(async () => {
    if (!etat.enLecture) return;
    etat.transition++; // annule un fondu en cours
    await regler(volumeCible(etat.sceneActive));
  }), 250);
};
$("fondu").oninput = () => {
  etat.fondu = Number($("fondu").value);
  memo.set("fondu", etat.fondu);
  afficherReglages();
};

async function rafraichirAppareils() {
  const liste = await essayer(() => Spotify.appareils());
  if (!liste) return;
  const sel = $("appareil");
  const prefere = memo.get("appareil", null);
  sel.innerHTML = "";
  if (!liste.length) sel.innerHTML = "<option value=''>Aucun (ouvre Spotify)</option>";
  for (const d of liste) {
    const o = new Option(d.name, d.id);
    sel.append(o);
  }
  const choix = liste.find((d) => d.id === prefere) || liste.find((d) => d.is_active) || liste[0];
  etat.listeAppareils = liste;
  if (choix) { sel.value = choix.id; choisirAppareil(choix.id); }
}
function choisirAppareil(id) {
  etat.appareil = id || null;
  const d = (etat.listeAppareils || []).find((x) => x.id === id);
  etat.volumeOk = d ? d.supports_volume !== false : true;
  majVolumeDispo();
}
$("appareil").onchange = () => { choisirAppareil($("appareil").value); memo.set("appareil", etat.appareil); };
$("btn-appareils").onclick = rafraichirAppareils;

// Raccourcis clavier : 1-9 pour les scènes, 0 pour « hors des sentiers », espace pour pause.
document.addEventListener("keydown", (e) => {
  if ($("ecran-table").hidden || e.target.matches("input, select")) return;
  if (e.key === " ") { e.preventDefault(); $("btn-lecture").click(); return; }
  const n = Number(e.key);
  if (e.key === "0") $("pad-hors").querySelector(".pad")?.click();
  else if (n >= 1 && n <= 9) $("pads").children[n - 1]?.click();
});

// Empêche la tablette de se mettre en veille pendant la partie.
let verrou = null;
async function verrouEcran() {
  try { verrou = await navigator.wakeLock?.request("screen"); } catch {}
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !$("ecran-table").hidden) verrouEcran();
});

demarrer();
