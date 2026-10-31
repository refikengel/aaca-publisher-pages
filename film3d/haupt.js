/*
  Film für die Startseite von thermup.de: der Weg eines Videos als Schichtmodell im Kreis der Skala.

  Ablauf in Bildschirmhöhen s (fahrplan.js): je Station Fahrt (der Stapel fährt eine Schicht weiter, ein
  Datenpaket läuft an der Säule hinunter), Aufbau (ein Scanring baut die Szene von unten nach oben auf),
  Arbeit (der Roboter führt die Tätigkeit der Station vor), Abbau. Die Skala mit den bunten Bögen zeigt den
  Fortschritt. Was als Nächstes kommt, ist vorher nicht zu sehen.

  Dieses Modul ist der Rahmen ohne three.js: Kopf, Kapiteltexte, Skala, Scrollen, Ein- und Ausschalten und
  die Wahl des Bildes im Kreis. Das Bild liefert eine von zwei Quellen mit derselben Schnittstelle, jede mit
  eigenem Canvas:
    folge.js   vorberechnete Bildfolge (WebP): sofort da, braucht kaum Rechenleistung;
    bild3d.js  Echtzeit-3D (three.js, selbst gehostet, MIT-Lizenz), Stufen 3 bis 0 (welt.js).
  Echtzeit-3D rechnet in einem Web Worker (bild3d-worker.js, in einem OffscreenCanvas; hier vertritt es
  bild3d-vertreter.js mit derselben Schnittstelle), wo der Browser WebGL 2 in einem OffscreenCanvas kann, sonst wie
  früher hier im Hauptthread. Im Worker treffen die Vorbereitung und die Wartezeiten des Grafiktreibers nur das
  3D-Bild: Scrollen, Texte, Skala und Bildfolge laufen hier ungestört weiter.
  Zuerst zeigt der Kreis immer die Bildfolge. Schafft das Gerät Echtzeit-3D (grundFuerFolge, geprüft vor dem
  Laden von three.js), wird es währenddessen in kleinen Schritten vorbereitet und übernimmt dann an derselben
  Stelle (kurze Überblendung; bis dahin lädt die Folge nur Bilder nahe der aktuellen Stelle). Wird das
  3D-Bild selbst auf Stufe 0 zu langsam oder fällt es aus, übernimmt wieder die Bildfolge. Abgeschaltet wird
  der Film dabei nie; nur wenn auch die Bilder der Folge nicht ladbar sind, ist er aus. Bleibt die Bildfolge das
  Bild, spielt sie im Stand am Anfang die vorberechnete Schleife des winkenden Roboters ab (heroSchleife), so wie
  Echtzeit-3D dort von selbst weiterläuft. Dieselbe Schleife überbrückt auch die Vorbereitung von Echtzeit-3D im
  Worker (der Roboter winkt dann schon, statt Sekunden still zu stehen); das fertige 3D übernimmt bei einem Bild der
  Schleife, das dem 3D-Bild zur selben Zeit gleicht (heroSchleife).

  Handys und Tablets bekommen Echtzeit-3D wie der Rechner, wenn sie es schaffen (Grafik, Speicher, Kerne und
  ein kurzer Rechentest, siehe grundFuerFolge; Einstellung BILDFOLGE_AUF_TOUCH in film.js). Die Bildfolge
  überblendet zwischen zwei Bildern: steht die Seite zwischen ihnen, sieht man beide halbdurchsichtig
  übereinander, und die Bewegung wirkt gestuft. Echtzeit-3D rechnet jedes Bild neu und zeigt immer ein klares Bild.

  Gedämpft (bei „Bewegung reduzieren“, Einstellung in film.js): dieselben Szenen in derselben Quelle wie sonst
  (Echtzeit-3D, wo das Gerät es schafft, sonst die Bildfolge). Große Bewegungen gehören dann dem Scrollen allein:
  die Szene folgt der Scrollposition ohne Nachgleiten und ohne weiches Mausrad, Überblendungen sind kurz. Die
  ruhige Eigenbewegung des 3D-Bildes (winkender Roboter, Staub, ein leichtes Schwanken der Kamera) läuft weiter,
  auch im Stand (Entscheidung vom 27.10.2026); die Pause-Taste hält sie an (und mit ihr den ganzen Film).

  Scrollen: Der Browser scrollt selbst (Mausrad, Touchpad, Tastatur, Leiste, Touch), das bleibt auch dann
  flüssig, wenn der Film auf einem schwachen Gerät Zeit braucht: das Scrollen läuft im Compositor, nicht im
  Hauptthread. Ein eigenes weiches Nachführen des Mausrads (Prinzip wie Lenis) gibt es nur noch als
  Einstellung WEICHES_SCROLLEN in film.js (Standard aus): es hängt das ganze Scrollen an den Hauptthread, und
  die Seite scrollt dann so ruckelig, wie dieser gerade rechnet. Alles hier ist Zusatz: Ohne Skript, bei erzwungenen Farben
  und nach der Pause-Taste bleibt die Seite eine normale, vollständig lesbare Seite. Es wird nichts
  gespeichert und nichts gesendet; nachgeladen werden nur eigene Dateien (Module, Bilder der Folge).

  Für Prüfungen: ?film=folge nur die Bildfolge; ?film=3d Echtzeit-3D auch auf Touch- und schwachen Geräten
  (mit Überbrückung wie sonst); ?film=nur3d gleich Echtzeit-3D ohne Überbrückung, auch mit Software-Grafik
  (für das Werkzeug, das die Bildfolge rendert, und für Messungen), im Hauptthread (das Werkzeug holt seine Bilder
  mit festem Zufall der Seite); ?3d=haupt oder ?3d=worker legt fest, wo Echtzeit-3D rechnet (zum Vergleichen).
*/
// geänderte Module mit Versionsangabe (wie haupt.js in film.js): nach einer Aktualisierung trifft so kein
// zwischengespeichertes altes Modul auf ein neues
import { Skala } from "./skala.js?v=9";
import { klemme, seg, weich } from "./helfer.js";
import { FARBEN } from "./farben.js";
import { MITTE, ENDE, ZEIT_JE_HOEHE, zustand as zustandRechnen } from "./fahrplan.js?v=10";
import { FOLGE } from "./folge-daten.js?v=9";

var root = document.documentElement;
// was scrollt: auf Handys und Tablets ein eigener Bereich (body), sonst das Fenster (site.js, window.seite); ohne
// site.js das Fenster
var seite = window.seite || {
  eigen: false,
  ziel: function () { return window; },
  y: function () { return window.pageYOffset || root.scrollTop || 0; },
  hoehe: function () { return window.innerHeight; },
  nach: function (top, art) { window.scrollTo({ top: top, left: 0, behavior: art || "instant" }); }
};

function mq(q) { return window.matchMedia ? window.matchMedia(q) : null; }
var mqReduce = mq("(prefers-reduced-motion: reduce)");
var mqForced = mq("(forced-colors: active)");
var mqHell = mq("(prefers-color-scheme: light)");
var mqGrob = mq("(pointer: coarse)");

// Einstellungen aus film.js (siehe dort): reduziertAus = bei „Bewegung reduzieren“ aus statt gedämpft,
// folgeAufTouch = Touch-Geräte bekommen die Bildfolge statt Echtzeit-3D, weichesRad = eigenes weiches Mausrad
var reduziertAus = false, folgeAufTouch = true, weichesRad = false;
// erzwungen: der Besucher hat „Film trotzdem starten“ geklickt; kaputt: der Film selbst ist ausgefallen
// (Fehler im Skript, Bilder nicht ladbar), dann kein neuer Versuch bis zum Klick
var erzwungen = false, kaputt = false;
var pruef = (function () {
  var m = /[?&]film=(folge|3d|nur3d)(?:&|#|$)/.exec(window.location.search);
  return m ? m[1] : "";
})();
// wo Echtzeit-3D rechnet: "haupt" (hier), "worker" oder leer (Worker, wo möglich; mit ?film=nur3d hier)
var ort3d = (function () {
  var m = /[?&]3d=(haupt|worker)(?:&|#|$)/.exec(window.location.search);
  return m ? m[1] : (pruef === "nur3d" ? "haupt" : "");
})();

function gedaempft() { return !!(mqReduce && mqReduce.matches); }

function moeglich() {
  if (!window.requestAnimationFrame || kaputt) { return false; }
  if (mqForced && mqForced.matches) { return false; }
  if (reduziertAus && gedaempft() && !erzwungen) { return false; }
  return !root.classList.contains("ruhe");
}

function beruehrung() { return !!(mqGrob && mqGrob.matches); }

// Braucht dieses Gerät die Bildfolge statt Echtzeit-3D? Geprüft vor dem Laden von three.js, mit einer eigenen
// kleinen Leinwand, die gleich wieder freigegeben wird. Leer: Echtzeit-3D; sonst der Grund (steht in
// data-film-grund). Auch Handys und Tablets bekommen 3D, wenn sie es schaffen (strengere Grenzen als am Rechner:
// mindestens fünf Kerne, mehr als 2 GB, bestandener Rechentest); die laufende Anpassung (qualitaet) holt jedes
// Gerät, das es doch nicht schafft, auf eine leichtere Stufe und zuletzt zur Bildfolge zurück. „Bewegung
// reduzieren“ ändert nichts an der Quelle: das Bild bewegt sich dann nur mit dem Scrollen (siehe schleife).
function grundFuerFolge() {
  if (pruef === "folge") { return "Prüfadresse"; }
  var touch = beruehrung();
  if (folgeAufTouch && !pruef && touch) { return "Touch-Gerät"; }
  if (typeof WebGL2RenderingContext === "undefined") { return "kein WebGL 2"; }
  if (pruef === "nur3d") { return ""; }
  try {
    var gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!gl) { return "keine schnelle Grafik"; }
    var info = gl.getExtension("WEBGL_debug_renderer_info");
    var name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "") : "";
    var frei = gl.getExtension("WEBGL_lose_context");
    if (frei) { frei.loseContext(); }
    if (/swiftshader|llvmpipe|softpipe|basic render|software/i.test(name)) { return "Software-Grafik"; }
  } catch (fehler) {
    return "keine schnelle Grafik";
  }
  if (pruef === "3d") { return ""; }
  var n = window.navigator || {};
  // Brave verfälscht Kernzahl und Speicher zum Schutz vor Fingerabdrücken, bei jedem Besuch anders (gemessen am
  // Rechner mit 12 Kernen: 9, dann 5; Speicher 32, dann 16): dort zählt nur der Rechentest, sonst bekäme dasselbe
  // Handy mal Echtzeit-3D und mal die Bildfolge. Wer es doch nicht schafft, holt die laufende Anpassung zurück.
  var verfaelscht = !!n.brave;
  if (!verfaelscht && n.hardwareConcurrency && n.hardwareConcurrency <= (touch ? 4 : 2)) { return "wenige Kerne"; }
  if (!verfaelscht && n.deviceMemory && n.deviceMemory <= 2) { return "wenig Speicher"; }
  if (rechenfaktor(touch) > (touch ? LANGSAM_AB_TOUCH : LANGSAM_AB)) { return "langsames Gerät"; }
  return "";
}

// Wie viel langsamer als ein schneller Rechner (Faktor 1 = AMD Ryzen 5 3600X) rechnet dieses Gerät im Hauptthread?
// Eine kleine feste Rechenaufgabe, einmal beim Start (wenige Millisekunden, am Rechner etwa 5 ms). Sie dient nur
// dazu, sehr schwache Geräte auszusortieren, bevor Echtzeit-3D vorbereitet wird: das Vorbereiten kostet dort
// mehrere Sekunden Hauptthread-Zeit (die Seite steht in dieser Zeit still) und wird danach oft doch verworfen.
// Die Bildfolge sieht gleich aus und läuft auf jedem Gerät. Der Faktor steht in data-film-faktor (Diagnose).
// Erscheint das Gerät zu langsam, wird bis zu zweimal nachgemessen und der beste Lauf gezählt: ein einzelner Hänger
// (anderes Programm, Hintergrundarbeit) soll kein schnelles Gerät aussortieren. Handys takten ihre Kerne erst
// hoch, wenn sie Last sehen, und wechseln zwischen schnellen und langsamen Kernen (gemessen am OnePlus Nord 2T:
// derselbe Lauf dauert 9 bis 28 ms): dort erst 30 ms aufwärmen und fünfmal messen, der beste Lauf zählt.
var REFERENZ_MS = 5.5, LANGSAM_AB = 4, LANGSAM_AB_TOUCH = 4.5;
function rechenfaktor(touch) {
  var best = 1e9, f = 0, k, i, x = 0, t0, versuche = touch ? 5 : 3;
  try {
    if (touch) {
      t0 = window.performance.now();
      while (window.performance.now() - t0 < 30) { for (i = 0; i < 20000; i++) { x += Math.sqrt(i); } }
    }
    for (k = 0; k < versuche; k++) {
      t0 = window.performance.now(); x = 0;
      for (i = 0; i < 2000000; i++) { x += Math.sqrt(i) * 1.0000001; }
      t0 = window.performance.now() - t0;
      if (x >= 0 && t0 < best) { best = t0; }
      if (best / REFERENZ_MS <= (touch ? LANGSAM_AB_TOUCH : LANGSAM_AB)) { break; }
    }
    f = best < 1e9 ? best / REFERENZ_MS : 0;
  } catch (fehler) { f = 0; }
  root.setAttribute("data-film-faktor", f.toFixed(1));
  return f;
}

function hexRgb(text, ersatz) {
  var mm = /^#([0-9a-f]{6})$/i.exec((text || "").trim());
  if (!mm) { return ersatz; }
  var n = parseInt(mm[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

/* ------------------------------------------------------------------- Zustand */

var film, buehne, leinwand2d, anker, hero, heroText, heroCta, sterne, gluehen, startZeichen, startRuht = null;
var kapitel = [], mitSicht = [];
var an = false, gebaut = false, bereit = false, sichtbar = true, raf = 0, letzte = 0, zeit = 0, leerlauf = 0;
var W = 1, H = 1, dpr = 1, filmTop = 0, heroWeg = false, filmEnde = false;
var lay = { x: 0, y: 0, r: 200 };
var sGl = 0;
var T = {}, P = {};
var Z = {};
var skala;
// Quellen des Bildes im Kreis (folge.js, bild3d.js): bild = die gezeigte; kommt = die nächste, die gerade
// vorbereitet wird ({ art, quelle, laeuft }); geht = die vorige, die noch ausgeblendet wird ({ quelle, bis });
// ziel = die beste Quelle für dieses Gerät; folgeKaputt = die Bilder der Folge ließen sich nicht laden
var bild = null, kommt = null, geht = null, ziel = "", folgeKaputt = false;
var qual = { summe: 0, n: 0, liste: [], ueberspringen: 60, ab: 0, langsam: 0 };
var standbildModus = false;

function setze(el, name, wert) {
  var c = el.__w || (el.__w = {});
  if (c[name] === wert) { return; }
  c[name] = wert;
  el.style.setProperty(name, wert);
}
function zahl(v) { return v.toFixed(3); }

/* -------------------------------------------------------------------- Farben */

function themaLesen() {
  var cs = window.getComputedStyle(root);
  function c(name, ersatz) { return hexRgb(cs.getPropertyValue(name), ersatz); }
  T.hell = !!(mqHell && mqHell.matches);
  T.gold = c("--gold", T.hell ? [125, 87, 16] : [227, 180, 93]);
  P.gold = T.gold;
  P.licht = T.hell ? [255, 250, 236] : [255, 240, 205];
  P.farben = FARBEN.map(function (f) {
    var rgb = [(f >> 16) & 255, (f >> 8) & 255, f & 255];
    return T.hell ? mix3(rgb, [40, 30, 20], 0.22) : rgb;
  });
}

/* --------------------------------------------------------------- Messen/Layout */

function messen() {
  if (!buehne) { return; }
  W = buehne.clientWidth;
  H = buehne.clientHeight;
  if (!W || !H) { return; }
  // die Skala in voller Pixeldichte bis 3 (Handys): feine Linien und die kleine Schrift im Überblick bleiben so
  // scharf wie der Text daneben; sie kostet je Bild nur wenige Zeichenbefehle
  dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  yGemerkt = seite.y();
  filmTop = film.getBoundingClientRect().top + yGemerkt;
  var ar = anker.getBoundingClientRect(), br = buehne.getBoundingClientRect();
  lay.x = ar.left - br.left + ar.width / 2;
  lay.y = ar.top - br.top + ar.height / 2;
  lay.r = Math.max(60, ar.width / 2);
  // leichte Stufe und Bildfolge: die Skala ohne Goldstaub (scharf bleibt sie, sie kostet kaum Zeit)
  // (auch auf Handys: dort ohne Goldstaub, die große Zeichenfläche ganz zu löschen und zu füllen kostet je Bild viel)
  skala.leicht = !bild || bild.stufe === 0 || bild.art === "folge" || beruehrung();
  skala.messen(W, H, dpr, lay);
  var kante = Math.round(ar.width), dichte = window.devicePixelRatio || 1;
  [bild, kommt && kommt.quelle, geht && geht.quelle].forEach(function (q) { if (q) { q.groesse(kante, dichte); } });
  film.style.setProperty("--film-s", String(ENDE + 1));
}

function zustand(s) { zustandRechnen(s, Z); }

/* ---------------------------------------------------------------------- Text */

// Die Werte kommen nur an die Elemente, die sie brauchen (Sterne und Glühen des Himmels, Standbild, Startzeichen,
// Sprungmarke, Kapitel): jede Änderung lässt den Browser das Element samt allem darunter neu berechnen; an der
// ganzen Bühne wäre das in jedem Bild die ganze Seite des Films mit allen geteilten Buchstaben.
// In den Kapiteln lesen --in und --out die Zeilen des Texts und die Wörter der Titel (Stylesheet):
var KAP_ZIELE = ".kap-text > *, .kap-titel .stueck";
function domAbgleich(s) {
  var i, k, a, b;
  var h = Z.heroH;
  setze(heroText, "--h", zahl(h));
  if (heroCta) {
    if (h > 0.85) { if (!heroCta.hasAttribute("inert")) { heroCta.setAttribute("inert", ""); } }
    else if (heroCta.hasAttribute("inert")) { heroCta.removeAttribute("inert"); }
  }
  var weg = h > 0.995;
  if (weg !== heroWeg) { heroWeg = weg; heroText.style.visibility = weg ? "hidden" : ""; }
  var morgen = zahl(weich(seg(s, 0.6, MITTE[7])));
  if (sterne) {
    setze(sterne, "--morgen", morgen);
    // gedämpft stehen die Sterne still (Stylesheet): dann braucht es die Höhe nicht, das spart ein Element je Bild
    if (!gedaempft()) { setze(sterne, "--hoehe", zahl(s)); }
  }
  if (gluehen) { setze(gluehen, "--morgen", morgen); }
  var sicht = zahl(weich(seg(s, 0.2, 0.8)));
  for (i = 0; i < mitSicht.length; i++) { setze(mitSicht[i], "--sicht", sicht); }
  // das Startzeichen ist nach dem Hero unsichtbar: dann ruht auch sein laufender Punkt (spart Arbeit je Bild)
  var startWeg = +sicht >= 0.25;
  if (startZeichen && startWeg !== startRuht) { startRuht = startWeg; startZeichen.classList.toggle("ruht", startWeg); }
  for (i = 0; i < kapitel.length; i++) {
    k = kapitel[i];
    a = weich(seg(s, k.ein[0], k.ein[1]));
    b = k.aus ? weich(seg(s, k.aus[0], k.aus[1])) : 0;
    // nur Kapitel in ihrer Zeit bekommen neue Werte, und dort nur die Elemente, die sie lesen (KAP_ZIELE; als
    // Zahlen ohne Vererbung, siehe Stylesheet): sonst rechnete der Browser je Bild das ganze Kapitel neu.
    // Gesucht beim Einsatz des Kapitels: motion.js teilt die Titel in Wörter, unabhängig von diesem Modul.
    var da = a > 0.003 && b < 0.997;
    // (gedämpft steigen die Wörter nicht, motion.js: dann nur die Zeilen)
    if (da && !k.an) { k.ziele = [].slice.call(k.el.querySelectorAll(gedaempft() ? ".kap-text > *" : KAP_ZIELE)); }
    if (da || k.an) {
      var ai = zahl(a), bi = zahl(b);
      for (var j = 0; j < k.ziele.length; j++) { setze(k.ziele[j], "--in", ai); setze(k.ziele[j], "--out", bi); }
    }
    if (da !== k.an) { k.an = da; k.el.classList.toggle("an", da); }
  }
}

/* -------------------------------------------------------- weiches Scrollen */

function lies() { return seite.y(); }
// Die Scrollstelle für die Bildschleife: gelesen im Scroll-Ereignis (dort hat in diesem Bild noch niemand Stile
// geschrieben) und beim Einschalten, Messen und wenn der Film ins Bild kommt. In der Bildschleife selbst zu lesen,
// nachdem Kanäle-Film, Skala oder Kapitel schon Werte gesetzt haben, zwänge den Browser zu einer zusätzlichen
// Stilberechnung je Bild (am Handy gemessen einige Prozent der Scrollzeit).
var yGemerkt = 0;
var gleit = { aktiv: false, ziel: 0, ist: 0 };

function radErlaubt(e) {
  // gedämpft: das Mausrad scrollt wie überall, ohne Nachgleiten
  // (im eigenen Scrollbereich, siehe oben, scrollt das Rad immer selbst: das weiche Rad bewegt nur das Fenster)
  if (!an || !weichesRad || seite.eigen || gedaempft() || e.ctrlKey || e.metaKey || e.defaultPrevented) { return false; }
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { return false; }
  // eigene Bildlaufbereiche (z. B. ausgeklappte Inhalte) behalten ihr normales Verhalten
  var el = e.target;
  while (el && el !== document.body && el.nodeType === 1) {
    var cs = window.getComputedStyle(el);
    if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) { return false; }
    el = el.parentElement;
  }
  return true;
}
function rad(e) {
  if (!radErlaubt(e)) { return; }
  var dy = e.deltaY * (e.deltaMode === 1 ? 32 : (e.deltaMode === 2 ? window.innerHeight : 1));
  var max = Math.max(0, root.scrollHeight - window.innerHeight);
  if (!gleit.aktiv) { gleit.ist = gleit.ziel = lies(); }
  gleit.ziel = klemme(gleit.ziel + dy, 0, max);
  gleit.aktiv = true;
  e.preventDefault();
  starten();
}
function gleiten(dt) {
  if (!gleit.aktiv) { return; }
  // jemand anderes hat gescrollt (Tastatur, Leiste, Sprungmarke): sofort freigeben
  if (Math.abs(lies() - gleit.ist) > 4) { gleit.aktiv = false; return; }
  gleit.ist += (gleit.ziel - gleit.ist) * (1 - Math.exp(-dt / 0.14));
  if (Math.abs(gleit.ziel - gleit.ist) < 0.35) { gleit.ist = gleit.ziel; gleit.aktiv = false; }
  window.scrollTo({ top: gleit.ist, left: 0, behavior: "instant" });
}

/* ------------------------------------------------------- Schleife, Ereignisse */

// Im Stand (nicht gescrollt) braucht die ruhige Eigenbewegung des 3D-Bildes (Kamera, Staub, Roboter) nur die
// halbe Bildrate: das halbiert die Arbeit der Dauerschleife auf schwachen Geräten und Laptops (Wärme, Lüfter,
// Akku) und lässt dem Rest der Seite Luft für die ersten Bilder beim Weiterscrollen. Sobald gescrollt wird,
// läuft wieder jedes Bild.
// Auf Handys und Tablets nach 8 Sekunden ohne Scrollen nur noch 15 Bilder pro Sekunde (der Akku zählt dort mehr als
// die Feinheit einer ruhigen Bewegung).
// Auf Touch-Geräten läuft nach dem Wischen noch 1,5 Sekunden jedes Bild: In dieser Zeit misst die Qualitätsanpassung
// (qualitaet; beim Wischen selbst misst sie dort nicht).
var IM_STAND_MS = 30, STAND_NACH_MS = 400, STAND_NACH_TOUCH_MS = 1500, STAND_LANGSAM_NACH_MS = 8000, IM_STAND_LANGSAM_MS = 66;
var letzteZeichnung = 0, imStandVorher = false;
function standTakt() { return beruehrung() && ruhe() > STAND_LANGSAM_NACH_MS ? IM_STAND_LANGSAM_MS : IM_STAND_MS; }
function imStand() {
  if (!bild || !bild.dauerlauf || geht || gleit.aktiv || ruhe() < (beruehrung() ? STAND_NACH_TOUCH_MS : STAND_NACH_MS)) { return false; }
  return Math.abs(klemme((yGemerkt - filmTop) / Math.max(1, H), 0, ENDE) - sGl) < 0.0005;
}

// Schleife des Hero (folge.js, schleife-daten.js): Zeigt die Bildfolge das Bild im Kreis und steht die Seite am
// Anfang (Scrollposition 0, dort zeigt die Folge ihr erstes Bild), spielt der Kreis nach STAND_NACH_MS ohne Scrollen
// die vorberechnete Schleife des winkenden Roboters ab, so wie Echtzeit-3D dort von selbst weiterläuft. Auch bei
// „Bewegung reduzieren“: Die ruhige Eigenbewegung im Hero läuft dann ebenso, große Bewegungen bleiben ans Scrollen
// gebunden (Regel von Refik vom 27.10.2026). Nicht nach der Pause-Taste (der Film ist dann aus) und nicht im
// Hintergrund. Überbrückt die Folge nur die Vorbereitung von Echtzeit-3D, spielt die Schleife, wenn das 3D im Worker
// vorbereitet wird (im Hauptthread nähme sie ihm Zeit weg); das fertige 3D wartet dann auf Bild 0 oder HERO_BILD der
// Schleife und übernimmt mit dessen Zeit (siehe heroSchleife und zeigen). Hält die Schleife vorher an (Scrollen),
// übernimmt es sofort (siehe uebernehmen). Gezeichnet wird nur
// das Bild im Kreis, und nur wenn ein neues Bild der Schleife dran ist (rund 12 je Sekunde); dazwischen schläft die
// Bildschleife (Zeitgeber bis kurz vor dem nächsten Bild, dann requestAnimationFrame), statt jedes Bild des Browsers
// zu wecken. Skala, Texte und Filmzeit bleiben dabei stehen, die Qualitätsmessung (nur für Echtzeit-3D) ebenso. Das
// erste Scrollen hält sie sofort an: schleife() zeichnet dann wieder das Bild zur Scrollposition. Ihr Zustand steht
// in data-film-schleife: läuft, ruht (bereit, aber nicht am Anfang oder gerade gescrollt) oder aus:Grund.
var SCHLEIFE_BIS = 0.1 / FOLGE.proHoehe;
var hs = { laeuft: false, zeit: 0, letzte: 0, wert: "", wecker: 0, uhr: 0 };
// fertig vorbereitetes Echtzeit-3D, das auf ein passendes Bild der Schleife wartet (siehe uebernehmen)
var wartet3d = null;
// Bild der Schleife, das das Standbild des Hero zeigt (der Roboter winkt): assets/img/hero.webp ist seit dem
// 30.10.2026 eine Kopie von assets/film/s12.webp (nach neuem Rendern der Schleife mitkopieren). Die Folge zeigt es am
// Anfang statt ihres ersten Bildes, bis gescrollt wird (folge.js, heroBild): Beim Ausblenden des Standbilds ändert
// sich so nichts (vorher sah man den Arm doppelt). Die Schleife beginnt dann mit diesem Bild, Echtzeit-3D mit seiner
// Zeit (siehe zeigen).
var HERO_BILD = 12;
// die Folge ist das Bild, oder sie überbrückt die Vorbereitung von Echtzeit-3D im Worker
function schleifeErlaubt() { return ziel === "folge" || (ziel === "3d" && imWorkerMoeglich()); }
// die Scrollposition ist sGl (ohne Scrollen seit STAND_NACH_MS gleich der Seite; sie hier neu zu lesen, zwänge den
// Browser in jedem Durchlauf zu einer Stilberechnung)
function heroSchleifeGeht() {
  return !!(an && sichtbar && bild && bild.art === "folge" && schleifeErlaubt() && bild.schleifeStand && bild.schleifeStand() === "bereit" &&
    !geht && !gleit.aktiv && sGl < SCHLEIFE_BIS);
}
// anhalten (der Zeitgeber fällt weg) und den Zustand pflegen
function heroSchleifeAus() {
  if (hs.uhr) { window.clearTimeout(hs.uhr); hs.uhr = 0; }
  hs.laeuft = false;
  heroSchleifePflegen();
}
// ein Durchlauf von schleife(): true, wenn die Schleife des Hero ihn übernommen hat (sie plant den nächsten selbst)
function heroSchleife(jetzt) {
  if (ruhe() < STAND_NACH_MS || !heroSchleifeGeht()) { heroSchleifeAus(); return false; }
  if (!hs.laeuft) {
    hs.laeuft = true;
    hs.zeit = bild.heroBildZeigt && bild.heroBildZeigt() ? HERO_BILD * bild.schleife.dauer / bild.schleife.anzahl : 0;
    hs.letzte = jetzt;
    heroSchleifePflegen();
  }
  hs.zeit += klemme((jetzt - hs.letzte) / 1000, 0, 0.1);
  hs.letzte = jetzt;
  // die Filmzeit läuft dabei nicht weiter (wie im Stand der Folge bisher); das erste Bild danach bekommt ein kurzes dt
  letzte = jetzt;
  var n = bild.schleife.anzahl, dauer = bild.schleife.dauer, takt = dauer / n;
  if (hs.zeit >= dauer) { hs.zeit -= dauer * Math.floor(hs.zeit / dauer); }
  var k = Math.floor(hs.zeit / takt);
  // wartet Echtzeit-3D, übernimmt es, sobald Bild 0 oder HERO_BILD dran ist, mit der Zeit dieses Bildes: dort gleicht
  // die Schleife dem 3D-Bild (Bild 0 genau; bei HERO_BILD liegen die langsamen Bewegungen 0,06 s auseinander, die
  // Schleife führt sie hin und zurück, das 3D nur vorwärts)
  if (wartet3d && (k === 0 || k === HERO_BILD)) {
    var w = wartet3d;
    wartet3d = null;
    hs.laeuft = false;
    if (kommt === w) { zeigen(w, k * takt); return true; }
  }
  bild.schleifeZeichnen(k % n);
  var warten = ((k + 1) * takt - hs.zeit) * 1000 - 12;
  if (warten > 4) {
    hs.uhr = window.setTimeout(function () { hs.uhr = 0; if (an && !raf) { raf = window.requestAnimationFrame(schleife); } }, warten);
  } else {
    raf = window.requestAnimationFrame(schleife);
  }
  return true;
}
// am Anfang, die Schleife ist bereit, aber eben wurde gescrollt: nach der Pause die Bildschleife wecken
function heroSchleifeWecken() {
  if (hs.wecker || !heroSchleifeGeht()) { return; }
  hs.wecker = window.setTimeout(function () { hs.wecker = 0; if (an) { starten(); } }, Math.max(0, STAND_NACH_MS - ruhe()) + 20);
}
// in jedem Durchlauf ohne Schleife und bei jedem Wechsel: die Schleife laden lassen, sobald sie gebraucht werden
// kann (die Folge bleibt das Bild; folge.js lädt sie erst nach den groben Bildern der Folge und meldet sich dann
// selbst mit neuZeichnen), und ihren Zustand in data-film-schleife schreiben (nur bei einer Änderung)
function heroSchleifePflegen() {
  var w;
  if (!an) { w = root.classList.contains("ruhe") ? "aus:Pause" : "aus:Film aus"; }
  else if (!bild) { w = "aus:nicht geladen"; }
  else if (bild.art !== "folge" || !schleifeErlaubt()) { w = "aus:Echtzeit-3D"; }
  else {
    if (bild.schleifeLaden) { bild.schleifeLaden(); }
    var stand = bild.schleifeStand ? bild.schleifeStand() : "nicht geladen";
    w = stand !== "bereit" ? "aus:" + stand : (hs.laeuft ? "läuft" : "ruht");
  }
  if (w !== hs.wert) { hs.wert = w; root.setAttribute("data-film-schleife", w); }
}

function schleife(jetzt) {
  raf = 0;
  if (!an || document.hidden || standbildModus) { heroSchleifeAus(); return; }
  if (heroSchleife(jetzt)) { return; }
  // die Schleife hat angehalten (Scrollen), während Echtzeit-3D auf ihr Ende wartete: es übernimmt gleich
  if (wartet3d && !hs.laeuft) {
    var w3 = wartet3d;
    wartet3d = null;
    if (kommt === w3) { zeigen(w3); return; }
  }
  var stand = sichtbar && imStand();
  if (stand && jetzt - letzteZeichnung < standTakt() - 2) {
    // dieses Bild auslassen; die Zeit läuft weiter (letzte bleibt stehen, dt im nächsten gezeichneten Bild stimmt)
    raf = window.requestAnimationFrame(schleife);
    return;
  }
  letzteZeichnung = jetzt;
  // im Stand zählt die ganze Zeit seit dem letzten gezeichneten Bild (bis 0,1 s), sonst liefe die ruhige Bewegung
  // bei 15 Bildern pro Sekunde um ein Viertel langsamer als bei 30
  var dt = klemme((jetzt - letzte) / 1000, 0, stand ? 0.1 : 0.05), roh = (jetzt - letzte) / 1000;
  letzte = jetzt;
  gleiten(dt);
  var weiter = false;
  if (stufeWartet >= 0 && ruhe() > 200) { stufeSetzen(stufeWartet, jetzt); }
  if (sichtbar) {
    kopfPruefen();
    var ziel_ = klemme((yGemerkt - filmTop) / Math.max(1, H), 0, ENDE);
    var diff = ziel_ - sGl;
    // Die Szene folgt der Scrollstelle mit einer kurzen Annäherung (Zeitkonstante tau): so wirkt auch ein schneller
    // Wischer auf dem Handy oder ein kurzer Hänger des Hauptthreads nicht sprunghaft. Je weiter sie zurückliegt,
    // desto schneller holt sie auf (eine Zehntelsekunde Rückstand ist in wenigen Bildern weg, ohne Sprung); sofort
    // springt sie nur bei echten Sprüngen (Links, Pos1/Ende: mehr als vier Bildschirmhöhen). Gedämpft („Bewegung
    // reduzieren“) ist die Annäherung kürzer, aber auch dort kein harter Schnitt: Refik (30.10.2026) wünscht sich das
    // Scrollen am Handy weicher, und sein Handy läuft mit „Animationen aus“. Die Szene bewegt sich dabei nur, solange
    // sie der Scrollstelle nachkommt (das Mausrad glättet der Browser selbst).
    var tau = gedaempft() ? 0.05 : (beruehrung() ? 0.1 : 0.07);
    if (Math.abs(diff) > 4) { sGl = ziel_; }
    else { sGl += diff * (1 - Math.exp(-dt * (1 + 2 * Math.abs(diff)) / tau)); }
    // Filmzeit: folgt der Stelle (wie die Bildfolge); dazu läuft im Leerlauf die Zeit weiter (auch gedämpft: die
    // ruhige Eigenbewegung bleibt, nur die großen Bewegungen sind ans Scrollen gebunden)
    leerlauf += dt;
    zeit = sGl * ZEIT_JE_HOEHE + leerlauf;
    if (bild) {
      // gemessen wird nicht im Stand und im ersten Bild danach (die halbe Bildrate im Stand ist Absicht), auf
      // Touch-Geräten auch nicht beim Wischen (siehe messenJetzt); das 3D-Bild im Worker misst den Abstand seiner
      // Bilder selbst (bild3d-vertreter.js), sonst zählt dieses Bild
      var messen = !!(bild.wachsam && !stand && !imStandVorher && messenJetzt());
      zeichneBild(messen, beruehrung() && ruhe() < LEICHT_BIS_MS);
      if (bild && bild.messwerte) { bild.messwerte(qualitaet, jetzt); }
      else if (bild && messen) { qualitaet(jetzt, roh); }
      imStandVorher = stand;
    } else {
      zeichneVorlauf();
    }
    // Dauerschleife nur, solange sich von selbst etwas bewegt (das 3D-Bild, eine Überblendung); sonst
    // weckt erst das Scrollen die Schleife wieder
    weiter = !!(bild && bild.dauerlauf) || !!geht || Math.abs(ziel_ - sGl) > 0.0005;
  }
  if (an && ((sichtbar && weiter) || gleit.aktiv)) { raf = window.requestAnimationFrame(schleife); }
  else { heroSchleifeWecken(); }
}

// solange es noch kein Bild im Kreis gibt: alles außer dem Bild; dort steht bis dahin das Standbild
function zeichneVorlauf() {
  try {
    zustand(sGl);
    skala.zeichne(Z, zeit, P);
    domAbgleich(sGl);
  } catch (fehler) {
    kaputt = true;
    ausschalten("fehler");
  }
}

// Qualität an das Gerät anpassen (nur beim 3D-Bild; gemessen wird nur beim Scrollen, siehe schleife). Gemessen
// wird die mittlere Bilddauer über Zeitfenster von etwa 1,5 Sekunden (mindestens 20 Bilder, spätestens nach
// 4 Sekunden), ohne die langsamsten 8 % der Bilder (ein einzelner Hänger, etwa durch die Speicherbereinigung,
// zählt nicht als langsam). Über 1/45 s (unter etwa 45 Bildern pro Sekunde) geht es eine Stufe leichter, bis
// zur leichten Stufe 0; ist ein Fenster schon unter etwa 15 Bildern pro Sekunde, gleich auf Stufe 0. Übernehmen
// soll die vorberechnete Bildfolge, wo sie besser ist (flüssiger und, auf Stufe 3 gerendert, auch schärfer):
// bei unter etwa 15 Bildern pro Sekunde sofort (auf Stufe 0 schon unter etwa 25), sonst wenn zwei Fenster
// hintereinander unter etwa 22 Bildern pro Sekunde liegen (auf Stufe 0 unter etwa 30). Je schneller das
// geschieht, desto kürzer sieht ein schwaches Gerät ein ruckelndes Bild. Gemessen wird nur beim Scrollen (im
// Stand läuft die Schleife absichtlich mit halber Bildrate, siehe imStand); ein neuer Anlauf setzt die Zeit
// zurück (siehe starten).
var FENSTER_S = 1.5, FENSTER_MIN_BILDER = 20, FENSTER_MAX_S = 4;
// Auf Touch-Geräten zählen nur die Bilder in den 1,5 Sekunden nach dem Wischen (ab 0,15 s danach), nicht das Wischen
// selbst: Am Handy zeichnet der Grafikprozess beim Wischen auch die gescrollte Seite, die Bilder des 3D kommen dann
// langsamer, und die Qualität sank nach jedem schnellen Wischen auf Stufe 1 oder 0, obwohl das Handy das 3D im Stand
// mühelos schafft (am Handy gemessen, Brave und Chrome; Refik wünscht keinen Qualitätsverlust). Beim Wischen wird das
// 3D dort stattdessen leichter (LEICHT_BIS_MS, welt.render). Schafft ein Gerät das 3D auch nach dem Wischen nicht,
// sinkt die Qualität wie bisher. Am Rechner zählt wie bisher das Scrollen.
var MESSEN_AB_MS = 150, LEICHT_BIS_MS = 150;
function messenJetzt() { return !beruehrung() || (ruhe() >= MESSEN_AB_MS && !fingerAufGlas); }
function qualitaet(jetzt, roh) {
  if (kommt && kommt.art === "folge") { return; }   // der Wechsel zur Bildfolge läuft schon
  // den Anlauf nach dem Start und nach jedem Wechsel nicht mitzählen: 60 bzw. 20 Bilder, auf langsamen
  // Geräten höchstens 1 bzw. 0,3 Sekunden
  if (qual.ueberspringen > 0 && jetzt < qual.ab) { qual.ueberspringen--; return; }
  var d = klemme(roh, 0, 0.5);
  qual.summe += d; qual.n++; qual.liste.push(d);
  if (qual.summe < FENSTER_S || (qual.n < FENSTER_MIN_BILDER && qual.summe < FENSTER_MAX_S)) { return; }
  qual.liste.sort(function (a, b) { return a - b; });
  var behalten = Math.max(1, Math.floor(qual.liste.length * 0.92)), s = 0, i;
  for (i = 0; i < behalten; i++) { s += qual.liste[i]; }
  var mittel = s / behalten;
  qual.summe = 0; qual.n = 0; qual.liste.length = 0;
  var stufe0 = bild.stufe === 0;
  if (mittel > (stufe0 ? 1 / 25 : 1 / 15)) { zurFolge("langsam"); return; }
  if (mittel > (stufe0 ? 1 / 30 : 1 / 22)) {
    if (++qual.langsam >= 2) { zurFolge("langsam"); return; }
  } else {
    qual.langsam = 0;
  }
  if (bild.stufe > 0 && mittel > 1 / 45) {
    var neu = mittel > 1 / 15 ? 0 : bild.stufe - 1;
    // Der Wechsel baut die Nachbearbeitung neu, ein kurzer Hänger: nicht mitten im Wischen (dort sähe man ihn als
    // Sprung), sondern beim nächsten Innehalten (schleife); bei sehr langsamen Bildern sofort, da fällt er nicht auf
    if (mittel > 1 / 12) { stufeSetzen(neu, jetzt); } else { stufeWartet = stufeWartet < 0 ? neu : Math.min(stufeWartet, neu); }
  }
}

// eine leichtere Stufe des 3D-Bildes setzen (nur abwärts; aufwärts geht es nie von selbst)
var stufeWartet = -1;
function stufeSetzen(n, jetzt) {
  stufeWartet = -1;
  if (!bild || bild.art !== "3d" || n >= bild.stufe) { return; }
  bild.setzeStufe(n); stufeMelden(); messen();
  qual.ueberspringen = 20; qual.ab = jetzt + 300;
}

function kopfPruefen() {
  var ende = yGemerkt > filmTop + ENDE * H - 0.04 * H;
  if (ende !== filmEnde) { filmEnde = ende; root.classList.toggle("film-ende", ende); }
}

// messen: dieses Bild zählt für die Qualitätsanpassung (liest nur der Stellvertreter im Worker; undefined davor ist
// die Welle, die es nur im Werkzeug der Bildfolge gibt); leicht: beim Wischen auf Touch-Geräten (welt.render)
function zeichneBild(messen, leicht) {
  zustand(sGl);
  var q = bild, g = geht;
  try {
    q.zeichne(Z, zeit, lay, undefined, messen, leicht);
  } catch (fehler) {
    ausgefallen(q);
    return;
  }
  // die vorige Quelle zeichnet bis zum Ende der Überblendung mit (sonst stünde sie still, wenn gescrollt wird); nach
  // dem Ende der Schleife des Hero, solange die Seite am Anfang steht, das Bild der Schleife zur Zeit des 3D-Bildes
  // (Leerlauf ab null: dieselbe Bewegung), sonst das zur Scrollstelle
  if (g) {
    if (window.performance.now() > g.bis) { geht = null; g.quelle.freigeben(); }
    else {
      try {
        if (g.schleife && sGl < SCHLEIFE_BIS && g.quelle.schleife) {
          var sn = g.quelle.schleife.anzahl;
          g.quelle.schleifeZeichnen(Math.floor(leerlauf * sn / g.quelle.schleife.dauer) % sn);
        } else {
          g.quelle.zeichne(Z, zeit, lay);
        }
      } catch (fehler) { ausgefallen(g.quelle); }
    }
  }
  try {
    skala.zeichne(Z, zeit, P);
    domAbgleich(sGl);
  } catch (fehler) {
    // der Film darf die Seite nie stören: bei einem Fehler zurück zur normalen Seite
    kaputt = true;
    ausschalten("fehler");
  }
}

function starten() {
  if (raf || !an) { return; }
  letzte = window.performance.now();
  if (gebaut) { sGl = klemme((lies() - filmTop) / Math.max(1, H), 0, ENDE); }
  raf = window.requestAnimationFrame(schleife);
}
function stoppen() {
  if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
}

// Seite: Bühne, Kreis, Kapitel und Skala (ohne das Bild im Kreis)
function bauen() {
  film = document.getElementById("film");
  buehne = film && film.querySelector(".buehne");
  if (!buehne) { return false; }
  leinwand2d = buehne.querySelector(".film-leinwand");
  anker = buehne.querySelector(".film-anker");
  hero = buehne.querySelector(".hero");
  heroText = buehne.querySelector(".hero-text");
  heroCta = buehne.querySelector(".hero-cta");
  sterne = buehne.querySelector(".himmel-sterne");
  gluehen = buehne.querySelector(".himmel-gluehen");
  if (!leinwand2d || !anker || !hero || !heroText) { return false; }
  startZeichen = buehne.querySelector(".film-start");
  mitSicht = [anker, startZeichen, buehne.querySelector(".film-skip")].filter(Boolean);
  // das Canvas aus dem HTML ist nur der Platzhalter: jede Quelle legt ihr eigenes an (neueLeinwand)
  var platz = buehne.querySelector(".film-3d");
  if (platz) { platz.parentNode.removeChild(platz); }
  // Kapitel: der Überblick (eigene Zeiten), dann die sechs Stationen und das Ziel
  var els = buehne.querySelectorAll(".kap"), i;
  if (els.length !== 8) { return false; }
  kapitel.push({ el: els[0], ein: [1.02, 1.3], aus: [1.55, 1.78], an: false, ziele: [] });
  for (i = 1; i < 8; i++) {
    var c = MITTE[i];
    kapitel.push({ el: els[i], ein: [c - 0.55, c - 0.15], aus: i === 7 ? null : [c + 0.38, c + 0.72], an: false, ziele: [] });
  }
  skala = new Skala(leinwand2d);
  // die Sprungmarken im Film springen sofort, statt die ganze Fahrt abzuspielen
  var sprung = buehne.querySelectorAll(".film-skip, .hero-cta a[href^='#']");
  for (i = 0; i < sprung.length; i++) {
    sprung[i].addEventListener("click", function (e) {
      var ziel_ = document.getElementById(this.getAttribute("href").slice(1));
      if (ziel_ && an) { e.preventDefault(); gleit.aktiv = false; ziel_.scrollIntoView({ behavior: "auto", block: "start" }); }
    });
  }
  gebaut = true;
  return true;
}

function fehlerAus() { kaputt = true; ausschalten("fehler"); }

/* ------------------------------------------------------------ Quellen des Bildes */

// alle Quellen freigeben (nach einem Ausfall des Films: Grafikspeicher und Bilder nicht länger halten)
function alleFreigeben() {
  [bild, kommt && kommt.quelle, geht && geht.quelle].forEach(function (q) { if (q) { q.freigeben(); } });
  bild = null; kommt = null; geht = null; bereit = false; wartet3d = null;
}

// aktuelle Quelle und Qualitätsstufe am Dokument (zur Fehlersuche und für Tests; ohne Wirkung auf die Gestaltung)
function stufeMelden() {
  if (bild) {
    root.setAttribute("data-film-quelle", bild.art);
    root.setAttribute("data-film-stufe", String(bild.stufe));
    if (bild.art === "3d") { root.setAttribute("data-film-ort", bild.imWorker ? "worker" : "hauptthread"); }
    else { root.removeAttribute("data-film-ort"); }
  }
}

// wie lange (ms) zuletzt nicht gescrollt wurde; als Scrollen zählen auch das Mausrad, Tasten und ein Finger auf
// dem Glas (dann kommt das Scrollen gleich), fingerAufGlas: gerade berührt
var zuletztGescrollt = -1e9, fingerAufGlas = false;
function ruhe() { return window.performance.now() - zuletztGescrollt; }
function aktivitaet() { zuletztGescrollt = window.performance.now(); }

// Darf die Vorbereitung von Echtzeit-3D jetzt einen Schritt machen (bild3d.js fragt vor jedem)? Steht noch kein Bild
// im Kreis, stört nichts. Sonst zeigt der Kreis bis dahin die Bildfolge, und kein schwerer Schritt (am Rechner 20 bis
// 200 ms am Stück, am Handy vier- bis fünfmal so lange) soll mitten ins Scrollen fallen: dann stünden Film und Texte
// so lange still, während die Seite weiterzieht, und sprängen danach. Am Rechner laufen leichte Schritte immer und
// schwere in einer Pause von 150 ms; wer das Mausrad ohne Pause dreht, bekommt sie trotzdem, aber mit Ruhe dazwischen:
// nach einem schweren Schritt von d ms mindestens 3 · d ms ohne (höchstens ein Viertel der Zeit Arbeit, mindestens
// 120 ms Abstand; dauer ist die des letzten schweren Schritts, bild3d.js). Das ist ein kurzer Hänger hier und da,
// statt dass Echtzeit-3D erst nach dem Lesen kommt: vorher wartete die Vorbereitung auf Pausen von 250 ms, bei
// gleichmäßigem Scrollen also bis zum Stillstand (gemessen: nach 16 s noch nicht da). Auf Touch-Geräten nie mit
// einem Finger auf dem Glas und erst 300 ms (schwer: 600 ms) nach dem letzten Scrollen, also auch nach dem
// Auslaufen eines Wischers.
var letzterSchwerer = 0;
function frei(schwer, dauer) {
  if (!bild) { return true; }
  var sch = window.navigator && window.navigator.scheduling;
  if (sch && sch.isInputPending && sch.isInputPending()) { return false; }
  var r = ruhe();
  if (beruehrung()) { return !fingerAufGlas && r >= (schwer ? 600 : 300); }
  if (!schwer) { return true; }
  var jetzt = window.performance.now();
  if (r < 150 && jetzt - letzterSchwerer < Math.max(120, 4 * (dauer || 100))) { return false; }
  letzterSchwerer = jetzt;
  return true;
}

// die Module von Echtzeit-3D: geholt, sobald feststeht, dass dieses Gerät 3D bekommt, also gleich beim Start und
// nicht erst, wenn die Bildfolge schon steht (das kostete am Rechner rund 0,6 s). Im Worker (bild3d-vertreter.js)
// holt hier nur der kleine Stellvertreter; er startet den Worker gleich (vorladen), der dann three.js und die
// Module des Films lädt, neben der Seite. Im Hauptthread (bild3d.js und mit ihm three.js, etwa 0,7 MB) wird dabei nur
// der Modulcode ausgeführt, gebaut wird erst in der Vorbereitung. ohneWorker: im Worker geht es nicht (kein WebGL 2
// im OffscreenCanvas, Worker oder seine Module nicht ladbar, siehe bild3d-vertreter.js); dann von da an hier.
var modul3d = null, ohneWorker = false;
function imWorkerMoeglich() {
  if (ohneWorker || ort3d === "haupt") { return false; }
  return typeof OffscreenCanvas === "function" && typeof Worker === "function" &&
    typeof HTMLCanvasElement !== "undefined" && typeof HTMLCanvasElement.prototype.transferControlToOffscreen === "function";
}
function modul3dHolen() {
  if (!modul3d) {
    modul3d = imWorkerMoeglich()
      ? import("./bild3d-vertreter.js?v=18").then(function (m) { m.vorladen(); return m; })
      : import("./bild3d.js?v=18");
    modul3d.then(null, function () { modul3d = null; });
  }
  return modul3d;
}

// ein eigenes Canvas für eine Quelle (ein Canvas kann nur eine Art Kontext haben); es liegt über den
// bisherigen und unter der Skala und bleibt unsichtbar (wartet), bis die Quelle gezeigt wird
function neueLeinwand() {
  var c = document.createElement("canvas");
  c.className = "film-3d wartet";
  c.setAttribute("aria-hidden", "true");
  buehne.insertBefore(c, leinwand2d);
  return c;
}

// Was soll als Nächstes vorbereitet werden? Ohne Bild: die Bildfolge (oder gleich 3D, wenn die Folge nicht
// geht); mit der Bildfolge auf einem 3D-fähigen Gerät: Echtzeit-3D im Hintergrund.
function weiterschalten() {
  if (!an || !gebaut) { return; }
  if (!ziel) {
    var grund = grundFuerFolge();
    ziel = grund ? "folge" : "3d";
    if (grund) { root.setAttribute("data-film-grund", grund); }
    if (ziel === "3d") { modul3dHolen(); }
  }
  if (!bild) {
    if (ziel === "3d" && (pruef === "nur3d" || folgeKaputt)) { vorbereiten("3d"); }
    else if (!folgeKaputt) { vorbereiten("folge"); }
    else { fehlerAus(); }
    return;
  }
  if (bild.art === "folge" && ziel === "3d") { vorbereiten("3d"); }
}

function vorbereiten(art) {
  if (kommt && kommt.art === art) {
    // schon unterwegs; nach einer Pause dort weitermachen, wo die Vorbereitung angehalten hat (fertig und wartend
    // auf das Ende der Schleife: nichts zu tun)
    if (!kommt.laeuft && kommt !== wartet3d) { vorbereitungLaufen(kommt); }
    return;
  }
  if (kommt) { verwerfen(kommt); }
  kommt = { art: art, quelle: null, laeuft: false, modul: null };
  vorbereitungLaufen(kommt);
}

function verwerfen(k) {
  if (kommt === k) { kommt = null; }
  if (wartet3d === k) { wartet3d = null; }
  if (k.quelle) { k.quelle.freigeben(); }
}

function vorbereitungLaufen(k) {
  k.laeuft = true;
  var weiterMachen = function () { return an && kommt === k; };
  // läuft schon ein Bild (die Bildfolge), legt die Vorbereitung von Echtzeit-3D ihre schweren Schritte nicht mitten
  // ins Scrollen (frei); das Anlegen des Grafikkontexts zählt dazu
  var mitRuhe = k.art === "3d";
  var holen = Promise.resolve(k.modul || (k.art === "3d" ? modul3dHolen() : import("./folge.js?v=19")));
  holen.then(function (m) {
    k.modul = m;
    // im Worker entsteht der Kontext dort, und die Vorbereitung hält hier nichts auf
    if (m.imWorker) { mitRuhe = false; }
    if (!mitRuhe || k.quelle) { return null; }
    return new Promise(function (weiter) {
      (function pruefen() { if (!weiterMachen() || frei(true)) { weiter(); } else { window.setTimeout(pruefen, 60); } })();
    });
  }).then(function () {
    var m = k.modul;
    if (kommt !== k) { return false; }
    if (!k.quelle) {
      var leinwand = neueLeinwand();
      try {
        if (k.art === "3d") {
          k.quelle = m.baue(leinwand, mqGrob && mqGrob.matches ? 2 : 3, function () { ausgefallen(k.quelle); },
            { softwareErlaubt: pruef === "nur3d" });
        } else {
          k.quelle = m.baue(leinwand, function () { if (an) { starten(); } }, function () { ausgefallen(k.quelle); },
            { nurNahe: ziel === "3d", heroBild: HERO_BILD });
        }
      } catch (fehler) {
        leinwand.parentNode.removeChild(leinwand);
        throw fehler;
      }
      if (an) { messen(); }
    }
    // Im Worker hält die Vorbereitung den Hauptthread nicht auf, sie belastet aber den Grafikprozess (Shader verknüpfen,
    // Szenen hochladen), den die Seite fürs Scrollen mit ihr teilt: auf Touch-Geräten darum dieselbe Ruhe wie im
    // Hauptthread (frei, der Stellvertreter gibt sie weiter), am Rechner ohne (dort gemessen ohne Lücken).
    var ruhe = mitRuhe || (k.art === "3d" && beruehrung()) ? frei : null;
    return k.quelle.vorbereiten(weiterMachen, function () { return sGl; }, ruhe);
  }).then(function (fertig) {
    k.laeuft = false;
    if (kommt !== k || !fertig || !an) { return; }
    uebernehmen(k);
  }).then(null, function (fehler) {
    k.laeuft = false;
    if (kommt !== k) { return; }
    verwerfen(k);
    // im Worker geht es nicht (etwa ältere Safari ohne WebGL 2 im OffscreenCanvas): Echtzeit-3D hier im Hauptthread,
    // wie früher (sind auch dort die Module nicht ladbar, bleibt es bei der Bildfolge)
    if (fehler && fehler.ohneWorker && !ohneWorker) {
      ohneWorker = true;
      modul3d = null;
      vorbereiten("3d");
      return;
    }
    gescheitert(k.art);
  });
}

// Spielt im Kreis gerade die Schleife des Hero (Überbrückung), wartet fertiges Echtzeit-3D auf ein passendes Bild
// der Schleife (heroSchleife; hält sie vorher an, übernimmt es dann sofort, siehe schleife), sonst übernimmt es gleich
function uebernehmen(k) {
  if (k.art === "3d" && hs.laeuft) { wartet3d = k; return; }
  zeigen(k);
}

// die vorbereitete Quelle übernimmt; die bisherige blendet darunter aus und wird danach freigegeben. schleifenZeit:
// Echtzeit-3D übernimmt aus der Schleife des Hero, bei dieser Zeit ihres Durchlaufs (siehe heroSchleife, zeichneBild)
function zeigen(k, schleifenZeit) {
  kommt = null;
  var q = k.quelle, vorher = bild;
  bild = q;
  // (wer gleich losscrollt, wird von der Vorbereitung von Echtzeit-3D nicht gebremst: frei() hält ihre schweren
  // Schritte aus dem Scrollen heraus; wer erst schaut, bekommt 3D ohne eigene Wartezeit)
  if (vorher) {
    if (geht) { geht.quelle.freigeben(); }
    // so lange wie die Überblendung im Stylesheet (gedämpft kürzer), mit etwas Spielraum
    geht = { quelle: vorher, bis: window.performance.now() + (gedaempft() ? 400 : 1100), schleife: schleifenZeit !== undefined };
  }
  // die neue Zeit im Leerlauf beginnt bei null: das erste 3D-Bild gleicht dem Bild der Folge an derselben Stelle;
  // aus der Schleife bei ihrer Zeit, und zeigt die Folge noch das Bild der Schleife, das dem Standbild gleicht, bei
  // dessen Zeit (der Roboter winkt dann)
  if (vorher && vorher.art === "folge" && q.art === "3d") {
    if (schleifenZeit !== undefined) { leerlauf = schleifenZeit; }
    else if (vorher.heroBildZeigt && vorher.heroBildZeigt() && vorher.schleife) { leerlauf = HERO_BILD * vorher.schleife.dauer / vorher.schleife.anzahl; }
    else { leerlauf = 0; }
  }
  q.leinwand.classList.remove("wartet");
  stufeMelden();
  if (q.art === "folge" && ziel === "folge" && q.vollLaden) { q.vollLaden(); }
  messen();
  // gleich das erste Bild an der aktuellen Stelle (nicht erst mit dem nächsten Scrollen)
  if (sichtbar) {
    yGemerkt = lies();
    sGl = klemme((yGemerkt - filmTop) / Math.max(1, H), 0, ENDE);
    zeit = sGl * ZEIT_JE_HOEHE + leerlauf;
    zeichneBild();
  }
  bereitMelden();
  weiterschalten();
}

// eine Quelle lässt sich nicht (mehr) vorbereiten: 3D geht nicht, dann bleibt es bei der Bildfolge;
// die Bildfolge geht nicht, dann 3D, falls möglich, sonst ist der Film aus
function gescheitert(art) {
  if (art === "3d") {
    ziel = "folge";
    root.setAttribute("data-film-grund", "3D nicht möglich");
    if (bild && bild.art === "folge" && bild.vollLaden) { bild.vollLaden(); }
  } else {
    folgeKaputt = true;
  }
  weiterschalten();
}

// eine Quelle fällt mitten im Film aus (Kontextverlust, Bilder nicht mehr ladbar, Fehler beim Zeichnen)
function ausgefallen(q) {
  if (!q) { return; }
  if (geht && geht.quelle === q) { geht = null; q.freigeben(); return; }
  if (kommt && kommt.quelle === q) { var k = kommt; verwerfen(k); gescheitert(k.art); return; }
  if (q !== bild) { return; }
  bild = null;
  bereit = false;
  root.classList.remove("film-bereit");
  root.removeAttribute("data-film-stufe");
  q.freigeben();
  // die vorige Quelle blendet gerade aus? Dann ist sie wieder die gezeigte
  if (geht) {
    bild = geht.quelle;
    geht = null;
    bild.leinwand.classList.remove("wartet");
    stufeMelden();
    bereitMelden();
  }
  gescheitert(q.art);
  starten();
}

function bereitMelden() {
  if (!an || !bild) { return; }
  bereit = true;
  root.classList.add("film-bereit");
  qual.summe = 0; qual.n = 0; qual.liste.length = 0; qual.langsam = 0;
  qual.ueberspringen = 60;
  qual.ab = window.performance.now() + 1000;
  starten();
}

// Das 3D-Bild ist selbst auf Stufe 0 zu langsam: die
// vorberechnete Bildfolge übernimmt (das 3D-Bild läuft weiter, bis das erste Bild der Folge da ist). Zeigt der
// Kreis schon die Folge (3D war erst in Vorbereitung), bleibt sie und lädt nun alle Bilder.
function zurFolge(grund) {
  ziel = "folge";
  root.setAttribute("data-film-grund", grund);
  if (bild && bild.art === "folge") {
    if (kommt) { verwerfen(kommt); }
    if (bild.vollLaden) { bild.vollLaden(); }
    return;
  }
  if (!folgeKaputt) { vorbereiten("folge"); }
}

function einschalten() {
  if (an) { return; }
  try {
    if (!gebaut && !bauen()) { fehlerAus(); return; }
  } catch (fehler) {
    fehlerAus();
    return;
  }
  root.classList.add("film-an");
  an = true;
  themaLesen();
  messen();
  if (weichesRad) { window.addEventListener("wheel", rad, { passive: false }); }
  kopfPruefen();
  if (bild) { bereitMelden(); } else { starten(); }
  weiterschalten();
}

// grund: "fehler" (der Film ist ausgefallen) oder leer (Pause, Einstellung); film.js erfährt davon über
// das Ereignis „film-aus“ und bietet bei einem Fehler „Film trotzdem starten“ an
function ausschalten(grund) {
  var war = an || root.classList.contains("film-an");
  var mittendrin = an && gebaut && lies() >= filmTop + H;
  an = false;
  gleit.aktiv = false;
  stoppen();
  heroSchleifeAus();
  window.removeEventListener("wheel", rad, { passive: false });
  root.classList.remove("film-ende", "film-an", "film-bereit");
  filmEnde = false;
  if (grund === "fehler") { alleFreigeben(); }
  if (!war) { return; }
  if (mittendrin) {
    var danach = document.getElementById("weg");
    if (danach) { danach.scrollIntoView({ behavior: "auto", block: "start" }); }
  }
  if (heroText) { heroText.style.visibility = ""; heroWeg = false; }
  if (heroCta) { heroCta.removeAttribute("inert"); }
  for (var i = 0; i < kapitel.length; i++) { kapitel[i].el.classList.remove("an"); kapitel[i].an = false; }
  document.dispatchEvent(new CustomEvent("film-aus", { detail: { grund: grund || "" } }));
}

// „Film trotzdem starten“: nach einem Ausfall ein neuer Versuch (alles von vorn), mit der Einstellung
// BEI_REDUZIERTER_BEWEGUNG = "aus" auch bei „Bewegung reduzieren“ (dann gedämpft). Gilt nur für diesen
// Besuch, gespeichert wird nichts.
export function erzwingen() {
  erzwungen = true;
  if (kaputt) {
    kaputt = false;
    folgeKaputt = false;
    ziel = "";
    alleFreigeben();
  }
  qual.langsam = 0;
  steuern();
}

function steuern() {
  if (!moeglich()) { ausschalten(); return; }
  if (an) { return; }
  var anker_ = document.getElementById("weg"), versatz = null;
  if (anker_ && lies() > 40 && anker_.getBoundingClientRect().top < seite.hoehe() * 0.9) {
    versatz = anker_.getBoundingClientRect().top;
  }
  einschalten();
  if (an && versatz !== null) { seite.nach(anker_.getBoundingClientRect().top + lies() - versatz); }
}

export function start(optionen) {
  optionen = optionen || {};
  if (optionen.erzwungen) { erzwungen = true; }
  reduziertAus = !!optionen.reduziertAus;
  if (optionen.folgeAufTouch !== undefined) { folgeAufTouch = !!optionen.folgeAufTouch; }
  weichesRad = !!optionen.weichesRad;
  try {
    var vorhanden = document.getElementById("film");
    if (!vorhanden || !vorhanden.querySelector(".buehne")) { root.classList.remove("film-an"); return; }
    steuern();
    var neuMessen = null;
    window.addEventListener("resize", function () {
      if (!an) { return; }
      window.clearTimeout(neuMessen);
      neuMessen = window.setTimeout(function () {
        if (an && (buehne.clientWidth !== W || buehne.clientHeight !== H || anker.getBoundingClientRect().width !== lay.r * 2)) { messen(); if (bild) { zeichneBild(); } }
      }, 120);
    });
    // ohne Dauerschleife (Bildfolge) weckt das Scrollen die Schleife, solange der Film im Bild ist
    // (sonst nichts zu zeichnen; kommt er wieder ins Bild, startet sie der Beobachter unten)
    seite.ziel().addEventListener("scroll", function () {
      zuletztGescrollt = window.performance.now();
      if (an && (sichtbar || gleit.aktiv)) { yGemerkt = lies(); starten(); }
    }, { passive: true });
    // ein Finger auf dem Glas, das Mausrad und Tasten zählen auch (frei): kein schwerer Schritt der Vorbereitung
    // beginnt, während der Besucher gerade ansetzt. Alle passiv, das Scrollen selbst bleibt beim Browser.
    var finger = function (e) { fingerAufGlas = !!(e.touches && e.touches.length); aktivitaet(); };
    ["touchstart", "touchend", "touchcancel"].forEach(function (t) { window.addEventListener(t, finger, { passive: true }); });
    window.addEventListener("wheel", aktivitaet, { passive: true });
    window.addEventListener("keydown", aktivitaet, { passive: true });
    document.addEventListener("bewegung", steuern);
    // Änderungen der Einstellungen über eigene Abfragen, die sonst niemand liest: Chrome meldet eine Änderung
    // nicht, wenn dieselbe Abfrage vorher schon gelesen wurde, und gedaempft() liest mqReduce in jedem Bild
    // (so ging die Meldung verloren, solange das 3D-Bild lief)
    [mq("(prefers-reduced-motion: reduce)"), mq("(forced-colors: active)")].forEach(function (q) {
      // „Bewegung reduzieren“ wird während des Besuchs ein- oder ausgeschaltet: die Quelle und die Eigenbewegung
      // bleiben, nur das Nachgleiten endet oder beginnt (gedaempft() wird in jedem Bild gelesen)
      if (q && q.addEventListener) { q.addEventListener("change", function () { steuern(); if (an) { starten(); } }); }
    });
    if (mqHell && mqHell.addEventListener) { mqHell.addEventListener("change", function () { if (an) { themaLesen(); } }); }
    document.addEventListener("click", function (e) {
      if (!an || !e.target.closest) { return; }
      if (e.target.closest(".nach-oben")) {
        e.stopImmediatePropagation(); e.preventDefault();
        gleit.aktiv = false;
        seite.nach(0);
      }
    }, true);
    // Sprachschalter der Seite: Namen auf den Platten neu malen (Skala und Skript-Blatt lesen die Sprache je Bild)
    document.addEventListener("sprache", function () { [bild, kommt && kommt.quelle].forEach(function (q) { if (q) { q.sprache(); } }); });
    // zurück aus dem Hintergrund: die Zeit im Hintergrund zählt nicht als langsames Bild
    document.addEventListener("visibilitychange", function () { if (an && !document.hidden) { letzte = window.performance.now(); starten(); } });
    // Film im Bild? Solange ja, läuft beim Scrollen die Schleife und prüft dabei auch das Ende der Fahrt
    // (kopfPruefen); ist er weg, einmal hier. Ein eigener Scroll-Listener dafür läse die Scrollstelle nach den
    // Schreibzugriffen des Kanäle-Films und erzwänge so eine zusätzliche Stilberechnung je Bild.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (eintraege) {
        sichtbar = eintraege[0].isIntersecting;
        root.classList.toggle("film-sichtbar", sichtbar);
        if (an) { yGemerkt = lies(); }
        if (sichtbar && an) { starten(); }
        if (!sichtbar && an) { kopfPruefen(); }
      }, { rootMargin: "10% 0px 10% 0px" }).observe(vorhanden);
    }
    window.addEventListener("load", function () { if (an) { messen(); if (bild) { zeichneBild(); } } });
    if (document.fonts && document.fonts.load) {
      // die Plattennamen erst mit geladener Schrift malen (Canvas nimmt sonst die Ersatzschrift)
      document.fonts.load('700 58px "Raleway"').then(function () { [bild, kommt && kommt.quelle].forEach(function (q) { if (q) { q.sprache(); } }); }, function () {});
    }
  } catch (fehler) {
    kaputt = true;
    ausschalten("fehler");
    root.classList.remove("film-an");
  }
}

// Für das Werkzeug, das die Bildfolge rendert (_werkzeuge/bildfolge_rendern.mjs): ein Bild des 3D-Kreises
// zur Scrollposition s und Zeit t, kante Pixel im Quadrat (doppelt so groß gerendert und verkleinert),
// Ecken außerhalb des Kreises schwarz, dazu die Lage der Schichtnamen im Überblick. welle (nur für die Schleife
// der Bildfolge): eigene Zeit für das Winken im Hero, t führt dann die langsamen Bewegungen (szeneStart in
// szenen.js). Hält die Bildschleife an; auf der Seite selbst ungenutzt. Rechnet das 3D-Bild im Worker (nicht mit
// ?film=nur3d, siehe oben), kommt das Ergebnis als Promise.
export function standbild(s, t, kante, stufe, format, qualitaet, welle) {
  if (!gebaut || !bereit || !bild || !bild.standbild) { return null; }
  standbildModus = true;
  stoppen();
  sGl = s;
  zeit = t;
  zustand(s);
  var quelleBild = bild.standbild(Z, t, lay, kante, stufe, welle);
  return quelleBild && quelleBild.then ? quelleBild.then(fertigstellen) : fertigstellen(quelleBild);
  function fertigstellen(quelleBild) {
    var c = document.createElement("canvas");
    c.width = c.height = kante;
    var ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(quelleBild, 0, 0, kante, kante);
    ctx.beginPath();
    ctx.rect(0, 0, kante, kante);
    ctx.arc(kante / 2, kante / 2, kante / 2 + 1, 0, Math.PI * 2);
    ctx.fillStyle = "#000";
    ctx.fill("evenodd");
    var et = [];
    if (Z.auf > 0.02 && Z.etiketten) {
      for (var i = 0; i < Z.etiketten.length; i++) {
        var e = Z.etiketten[i];
        if (e) { et.push([e.j, +((e.x - lay.x) / lay.r).toFixed(4), +((e.y - lay.y) / lay.r).toFixed(4)]); }
      }
  }
  return { bild: c.toDataURL(format || "image/png", qualitaet || 0.8), etiketten: et, auf: +Z.auf.toFixed(4) };
  }
}
