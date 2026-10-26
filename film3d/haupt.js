/*
  Film für die Startseite von thermup.de (fünfte Fassung): der Weg eines Videos als Schichtmodell,
  in Echtzeit gerendert (three.js, selbst gehostet, MIT-Lizenz).

  Ablauf in Bildschirmhöhen s: je Station Fahrt (der Stapel fährt eine Schicht weiter, ein Datenpaket
  läuft an der Säule hinunter), Aufbau (ein Scanring baut die Szene von unten nach oben auf), Arbeit
  (der Roboter führt die Tätigkeit der Station vor), Abbau. Die Skala mit den bunten Bögen zeigt den
  Fortschritt. Was als Nächstes kommt, ist vorher nicht zu sehen.

  Weiches Scrollen: Mausrad und Touchpad werden sanft nachgeführt (Prinzip wie Lenis), Tastatur,
  Bildlaufleiste und Touch bleiben unverändert. Alles hier ist Zusatz: Ohne Skript, bei „Bewegung
  reduzieren“, nach der Pause-Taste und auf Geräten ohne WebGL 2 bleibt die Seite eine normale,
  vollständig lesbare Seite. Es wird nichts gespeichert, nichts gesendet und nichts nachgeladen.
*/
import * as THREE from "../vendor/three/build/three.module.min.js";
import { Welt } from "./welt.js";
import { grundstoffe, scan, scanSetzen } from "./stoff.js";
import { Roboter } from "./roboter.js";
import { Maschine, farbeVon, ABSTAND, FARBEN } from "./maschine.js";
import { szeneStart, szeneThema, szeneSkript } from "./szenen.js";
import { szeneStimme, szeneQuellen, szeneFreigabe, szeneKanaele, szeneZiel } from "./szenen2.js";
import { Skala } from "./skala.js";
import { klemme, seg, weich } from "./helfer.js";

var root = document.documentElement;
var PI = Math.PI;

function mq(q) { return window.matchMedia ? window.matchMedia(q) : null; }
var mqReduce = mq("(prefers-reduced-motion: reduce)");
var mqForced = mq("(forced-colors: active)");
var mqHoch = mq("(min-height: 36rem)");
var mqHell = mq("(prefers-color-scheme: light)");
var mqGrob = mq("(pointer: coarse)");

function moeglich() {
  if (!window.requestAnimationFrame || typeof WebGL2RenderingContext === "undefined") { return false; }
  if (mqReduce && mqReduce.matches) { return false; }
  if (mqForced && mqForced.matches) { return false; }
  if (mqHoch && !mqHoch.matches) { return false; }
  return !root.classList.contains("ruhe");
}

function sanft(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function hexRgb(text, ersatz) {
  var mm = /^#([0-9a-f]{6})$/i.exec((text || "").trim());
  if (!mm) { return ersatz; }
  var n = parseInt(mm[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

/* ------------------------------------------------------------------ Fahrplan */

// Zeiten in Bildschirmhöhen. Je Schicht j mit Mitte c:
//   Fahrt [c-0.8, c-0.5]  Aufbau [c-0.5, c-0.15]  Arbeit [c-0.15, c+0.35]  Abbau [c+0.35, c+0.8]
// Die erste Fahrt ist länger (0,95 bis 1,85): Der Stapel fächert sich zum Schichtenmodell auf, alle acht
// Schichten stehen beschriftet übereinander, dann fährt die Kamera in die erste Schicht hinein.
var MITTE = [0.15, 2.35, 3.95, 5.55, 7.15, 8.75, 10.35, 11.95];
var ENDE = 12.8;
var N_SCHICHT = 8;
var UEBERBLICK = [0.95, 1.85];
function fahrtBeginn(j) { return j === 1 ? UEBERBLICK[0] : MITTE[j] - 0.8; }

/* ------------------------------------------------------------------- Zustand */

var film, buehne, leinwand3d, leinwand2d, anker, hero, heroText, heroCta;
var kapitel = [];
var an = false, gebaut = false, bereit = false, sichtbar = true, raf = 0, letzte = 0, zeit = 0;
var W = 1, H = 1, dpr = 1, filmTop = 0, heroWeg = false, filmEnde = false;
var lay = { x: 0, y: 0, r: 200 };
var sGl = 0;
var T = {}, P = {};
var Z = {};
var welt, st, rob, maschine, szenen = [], skala, kontext;
var aktiveSzene = -1;
var farbeTmp = new THREE.Color(), kamZiel = new THREE.Vector3();
var qual = { summe: 0, n: 0, ueberspringen: 90, versuche: 0 };

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
  dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  filmTop = film.getBoundingClientRect().top + (window.pageYOffset || 0);
  var ar = anker.getBoundingClientRect(), br = buehne.getBoundingClientRect();
  lay.x = ar.left - br.left + ar.width / 2;
  lay.y = ar.top - br.top + ar.height / 2;
  lay.r = Math.max(60, ar.width / 2);
  skala.messen(W, H, dpr, lay);
  welt.groesse(Math.round(ar.width), window.devicePixelRatio || 1);
  film.style.setProperty("--film-s", String(ENDE + 1));
}

// Ablauf zur Scrollposition s: Lage des Stapels, welche Szene, wie weit aufgebaut
function zustand(s) {
  var j, c;
  Z.s = s;
  Z.auf = 0;
  if (s < fahrtBeginn(1)) {
    j = 0; c = MITTE[0];
    Z.idx = 0; Z.fahrt = 0;
  } else {
    j = 1;
    while (j < N_SCHICHT - 1 && s >= fahrtBeginn(j + 1)) { j++; }
    c = MITTE[j];
    var f0 = fahrtBeginn(j);
    Z.fahrt = s < c - 0.5 ? seg(s, f0, c - 0.5) : 0;
    if (j === 1 && s < c - 0.5) {
      // Überblick: auffächern, halten, zusammenfahren; die eigentliche Fahrt liegt im letzten Teil
      var p = Z.fahrt;
      Z.auf = weich(seg(p, 0, 0.32)) * (1 - weich(seg(p, 0.62, 0.96)));
      Z.idx = sanft(seg(p, 0.6, 1));
      Z.paket = seg(p, 0.6, 1);
    } else {
      Z.idx = s < c - 0.5 ? (j - 1) + sanft(Z.fahrt) : j;
      Z.paket = Z.fahrt;
    }
  }
  if (j === 0) { Z.paket = 0; }
  Z.j = j; Z.c = c;
  if (j > 0 && s < c - 0.5) { Z.szene = -1; Z.druck = 0; }
  else if (s < c - 0.15) { Z.szene = j; Z.druck = j === 0 ? 1 : seg(s, c - 0.5, c - 0.15); }
  else if (s < c + 0.35 || j === N_SCHICHT - 1) { Z.szene = j; Z.druck = 1; }
  else { Z.szene = j; Z.druck = 1 - seg(s, c + 0.35, c + 0.8); }
  Z.u = seg(s, c - 0.5, c + 0.8);
  Z.heroH = weich(seg(s, 0.3, 0.8));
  Z.fort = klemme(s / MITTE[N_SCHICHT - 1], 0, 1);
  Z.station = klemme(Z.idx, 0, 7);
}

/* ------------------------------------------------------------------- 3D-Bild */

function szeneWechseln(j) {
  if (j === aktiveSzene) { return; }
  aktiveSzene = j;
  for (var i = 0; i < szenen.length; i++) { szenen[i].gruppe.visible = i === j; }
  if (j < 0) { rob.wurzel.visible = false; return; }
  var sz = szenen[j];
  maschine.platten[j].add(rob.wurzel);
  rob.zuruecksetzen();
  rob.wurzel.visible = true;
  rob.wurzel.position.set(sz.platz.x, 0.07, sz.platz.z);
  rob.wurzel.rotation.set(0, sz.platz.dreh, 0);
  var f = farbeVon(j);
  st.led.emissive.setHex(f);
  rob.displayMalen(sz.symbol, f, 0);
  welt.akzentLicht.color.setHex(f);
  if (sz.aktiviert) { sz.aktiviert(); }
}

function kameraSetzen(s, fahrt, auf) {
  var k = welt.kamera;
  auf = auf || 0;
  var hebung = Math.sin(fahrt * PI) * (1 - auf);
  var gier = Math.sin(s * 0.8) * 0.17 * (1 - auf * 0.6) + Math.sin(zeit * 0.13) * 0.025 + auf * 0.32;
  var hoehe = 0.27 + hebung * 0.07 + auf * 0.2 + Math.sin(zeit * 0.21) * 0.006;
  var abstand = 11.6 + hebung * 1.4 + auf * 15.5;
  // im Überblick blickt die Kamera auf die Mitte des aufgefächerten Stapels
  var mitteY = (1.15 - hebung * 0.35) * (1 - auf) + auf * ((maschine.idx - 3.5) * maschine.abstandJetzt() + 0.35);
  // im Überblick rückt der Stapel etwas nach rechts, damit links Platz für die Beschriftung bleibt
  var seitlich = -auf * 1.1;
  k.position.set(seitlich + Math.sin(gier) * abstand * Math.cos(hoehe), mitteY + Math.sin(hoehe) * abstand, Math.cos(gier) * abstand * Math.cos(hoehe));
  kamZiel.set(seitlich, mitteY, 0);
  k.lookAt(kamZiel);
}

// Beschriftung der Schichten im Überblick: Bildschirmlage des linken Randes jeder Schicht
var etikettPunkt = new THREE.Vector3();
function etikettenRechnen() {
  Z.etiketten = Z.etiketten || [];
  if (Z.auf < 0.02) { Z.etiketten.length = 0; return; }
  for (var j = 0; j < N_SCHICHT; j++) {
    var p = maschine.platten[j];
    etikettPunkt.set(-1.9, 0, 0.35);
    p.localToWorld(etikettPunkt);
    etikettPunkt.project(welt.kamera);
    Z.etiketten[j] = { x: lay.x + etikettPunkt.x * lay.r, y: lay.y - etikettPunkt.y * lay.r, j: j };
  }
}

function bild3d() {
  var j = Z.szene, sichtbarSzene = j >= 0 && Z.druck > 0.001;
  maschine.stellen(Z.idx, Z.auf);
  szeneWechseln(sichtbarSzene ? j : -1);
  var farbeJ = farbeTmp.setHex(farbeVon(Math.max(1, Math.min(6, Z.j))));
  if (Z.j === 0 || Z.j === 7) { farbeJ.setHex(0xf2c14e); }
  if (sichtbarSzene) {
    var sz = szenen[j];
    sz.tick(zeit, Z.u);
    rob.haloAusrichten();
    var plattenY = (Z.idx - j) * ABSTAND;
    if (Z.druck < 0.999) {
      var y = plattenY + 0.07 + Z.druck * sz.oben;
      scanSetzen(y, 1, farbeJ);
      maschine.scanZeigen(y, Math.min(1, Math.sin(Z.druck * PI) * 1.6 + 0.05), farbeJ, sz.oben, zeit);
    } else {
      scanSetzen(1000, 0);
      maschine.scanZeigen(0, 0);
    }
  } else {
    scanSetzen(1000, 0);
    maschine.scanZeigen(0, 0);
  }
  maschine.paketZeigen(Z.paket, farbeJ, zeit);
  welt.akzentLicht.intensity = sichtbarSzene ? 1.2 + (1 - Z.druck) * 2.5 : 0.4;
  welt.staubStoff.uniforms.uStaerke.value = 0.6 + 0.4 * Math.sin(Z.fahrt * PI);
  kameraSetzen(Z.s, Z.fahrt, Z.auf);
  etikettenRechnen();
  welt.render(zeit);
}

/* ---------------------------------------------------------------------- Text */

function domAbgleich(s) {
  var i, k, a, b;
  var h = Z.heroH;
  setze(heroText, "--h", zahl(h));
  setze(hero, "--hout", zahl(weich(seg(s, 0.6, 0.95))));
  if (heroCta) {
    if (h > 0.85) { if (!heroCta.hasAttribute("inert")) { heroCta.setAttribute("inert", ""); } }
    else if (heroCta.hasAttribute("inert")) { heroCta.removeAttribute("inert"); }
  }
  var weg = h > 0.995;
  if (weg !== heroWeg) { heroWeg = weg; heroText.style.visibility = weg ? "hidden" : ""; }
  setze(buehne, "--morgen", zahl(weich(seg(s, 0.6, MITTE[7]))));
  setze(buehne, "--hoehe", zahl(s));
  setze(buehne, "--sicht", zahl(weich(seg(s, 0.2, 0.8))));
  for (i = 0; i < kapitel.length; i++) {
    k = kapitel[i];
    a = weich(seg(s, k.ein[0], k.ein[1]));
    b = k.aus ? weich(seg(s, k.aus[0], k.aus[1])) : 0;
    setze(k.el, "--in", zahl(a));
    setze(k.el, "--out", zahl(b));
    var da = a > 0.003 && b < 0.997;
    if (da !== k.an) { k.an = da; k.el.classList.toggle("an", da); }
  }
}

/* -------------------------------------------------------- weiches Scrollen */

function lies() { return (window.pageYOffset || root.scrollTop || 0); }
var gleit = { aktiv: false, ziel: 0, ist: 0 };

function radErlaubt(e) {
  if (!an || e.ctrlKey || e.metaKey || e.defaultPrevented) { return false; }
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

function schleife(jetzt) {
  raf = 0;
  if (!an || document.hidden) { return; }
  var dt = klemme((jetzt - letzte) / 1000, 0, 0.05), roh = (jetzt - letzte) / 1000;
  letzte = jetzt;
  zeit += dt;
  gleiten(dt);
  if (sichtbar && bereit) {
    kopfPruefen();
    var ziel = klemme((lies() - filmTop) / Math.max(1, H), 0, ENDE);
    var diff = ziel - sGl;
    // große Sprünge (Links, Pos1/Ende) sofort, sonst eine leichte Annäherung (das Rad ist schon geglättet)
    if (Math.abs(diff) > 2.5) { sGl = ziel; } else { sGl += diff * (1 - Math.exp(-dt / 0.06)); }
    zeichneBild();
    qualitaet(roh);
  }
  if (an && ((sichtbar && bereit) || gleit.aktiv)) { raf = window.requestAnimationFrame(schleife); }
}

// Qualität an das Gerät anpassen: dauerhaft unter etwa 40 Bildern pro Sekunde eine Stufe zurück;
// reicht auch die niedrigste Stufe nicht, bleibt die Seite ohne Film
function qualitaet(roh) {
  if (qual.ueberspringen > 0) { qual.ueberspringen--; return; }
  qual.summe += roh; qual.n++;
  if (qual.n < 120) { return; }
  var mittel = qual.summe / qual.n;
  qual.summe = 0; qual.n = 0;
  if (mittel > 1 / 40) {
    if (welt.stufe > 1) { welt.setzeStufe(welt.stufe - 1); messen(); qual.ueberspringen = 30; }
    else if (++qual.versuche >= 2) { ausschalten(); }
  }
}

function kopfPruefen() {
  var ende = lies() > filmTop + ENDE * H - 0.04 * H;
  if (ende !== filmEnde) { filmEnde = ende; root.classList.toggle("film-ende", ende); }
}

function zeichneBild() {
  try {
    zustand(sGl);
    bild3d();
    skala.zeichne(Z, zeit, P);
    domAbgleich(sGl);
  } catch (fehler) {
    // der Film darf die Seite nie stören: bei einem Fehler zurück zur normalen Seite
    ausschalten();
  }
}

function starten() {
  if (raf || !an) { return; }
  letzte = window.performance.now();
  if (bereit) { sGl = klemme((lies() - filmTop) / Math.max(1, H), 0, ENDE); }
  raf = window.requestAnimationFrame(schleife);
}
function stoppen() {
  if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
}

function bauen() {
  film = document.getElementById("film");
  buehne = film && film.querySelector(".buehne");
  if (!buehne) { return false; }
  leinwand3d = buehne.querySelector(".film-3d");
  leinwand2d = buehne.querySelector(".film-leinwand");
  anker = buehne.querySelector(".film-anker");
  hero = buehne.querySelector(".hero");
  heroText = buehne.querySelector(".hero-text");
  heroCta = buehne.querySelector(".hero-cta");
  if (!leinwand3d || !leinwand2d || !anker || !hero || !heroText) { return false; }
  // Kapitel: der Überblick (eigene Zeiten), dann die sechs Stationen und das Ziel
  var els = buehne.querySelectorAll(".kap"), i;
  if (els.length !== 8) { return false; }
  kapitel.push({ el: els[0], ein: [1.02, 1.3], aus: [1.55, 1.78], an: false });
  for (i = 1; i < 8; i++) {
    var c = MITTE[i];
    kapitel.push({ el: els[i], ein: [c - 0.55, c - 0.15], aus: i === 7 ? null : [c + 0.38, c + 0.72], an: false });
  }
  welt = new Welt(leinwand3d, mqGrob && mqGrob.matches ? 2 : 3);
  st = grundstoffe();
  maschine = new Maschine();
  welt.szene.add(maschine.gruppe);
  rob = new Roboter(st);
  var schatten = welt.kontaktSchatten(1.3, 1.3, 0.75);
  schatten.position.y = 0.004;
  rob.wurzel.add(schatten);
  kontext = { st: st, welt: welt, rob: rob, scanEbenen: [scan.ebene], scanUniforms: scan.uniforms };
  szenen = [szeneStart(kontext), szeneThema(kontext), szeneSkript(kontext), szeneStimme(kontext),
    szeneQuellen(kontext), szeneFreigabe(kontext), szeneKanaele(kontext), szeneZiel(kontext)];
  for (i = 0; i < szenen.length; i++) { maschine.platten[i].add(szenen[i].gruppe); }
  skala = new Skala(leinwand2d);
  // die Sprungmarken im Film springen sofort, statt die ganze Fahrt abzuspielen
  var sprung = buehne.querySelectorAll(".film-skip, .hero-cta a[href^='#']");
  for (i = 0; i < sprung.length; i++) {
    sprung[i].addEventListener("click", function (e) {
      var ziel = document.getElementById(this.getAttribute("href").slice(1));
      if (ziel && an) { e.preventDefault(); gleit.aktiv = false; ziel.scrollIntoView({ behavior: "auto", block: "start" }); }
    });
  }
  gebaut = true;
  return true;
}

// alles unter wurzel sichtbar machen (three.js übersetzt und lädt nur, was sichtbar ist); liste merkt
// sich, was vorher versteckt war, damit es danach wieder versteckt wird
function allesZeigen(wurzel, liste) {
  wurzel.traverse(function (o) { if (!o.visible) { o.visible = true; liste.push(o); } });
}
function wiederVerstecken(liste) {
  for (var i = 0; i < liste.length; i++) { liste[i].visible = false; }
  liste.length = 0;
}

// alle Shader und Texturen vorab vorbereiten, damit beim ersten Erscheinen einer Szene nichts ruckelt
// (auch Teile, die erst später im Ablauf auftauchen, etwa die Etagen der Kiste in der Freigabe)
function vorbereiten() {
  var i, versteckt = [];
  for (i = 0; i < szenen.length; i++) { szenen[i].gruppe.visible = true; allesZeigen(szenen[i].gruppe, versteckt); }
  maschine.scanner.visible = true;
  maschine.paket.visible = true;
  maschine.schienen.forEach(function (s) { s.schiene.visible = s.schlitten.visible = true; });
  for (i = 0; i < maschine.platten.length; i++) { maschine.platten[i].visible = true; }
  var r = welt.renderer;
  var fertig = r.compileAsync ? r.compileAsync(welt.szene, welt.kamera) : Promise.resolve(r.compile(welt.szene, welt.kamera));
  return fertig.then(function () {
    wiederVerstecken(versteckt);
    // je Szene einmal rendern (lädt Texturen und Instanzdaten hoch, baut Schattenshader)
    return new Promise(function (aufgeloest) {
      var j = 0;
      function weiter() {
        if (!an) { aufgeloest(); return; }
        if (j < szenen.length) {
          aktiveSzene = -2;
          maschine.stellen(j);
          szeneWechseln(j);
          szenen[j].tick(0.5, 0.5);
          allesZeigen(szenen[j].gruppe, versteckt);
          scanSetzen(0.07 + szenen[j].oben * 0.5, 1, farbeTmp.setHex(farbeVon(Math.max(1, Math.min(6, j)))));
          maschine.scanZeigen(1, 1, farbeTmp, szenen[j].oben, 0);
          maschine.paketZeigen(0.5, farbeTmp, 0);
          kameraSetzen(MITTE[j], 0, 0);
          welt.render(0);
          wiederVerstecken(versteckt);
          j++;
          window.requestAnimationFrame(weiter);
          return;
        }
        aktiveSzene = -2;
        szeneWechseln(-1);
        scanSetzen(1000, 0);
        aufgeloest();
      }
      window.requestAnimationFrame(weiter);
    });
  });
}

function einschalten() {
  if (an) { return; }
  try {
    if (!gebaut && !bauen()) { root.classList.remove("film-an"); return; }
  } catch (fehler) {
    root.classList.remove("film-an");
    return;
  }
  root.classList.add("film-an");
  an = true;
  themaLesen();
  messen();
  window.addEventListener("scroll", kopfPruefen, { passive: true });
  window.addEventListener("wheel", rad, { passive: false });
  kopfPruefen();
  var start = function () {
    if (!an) { return; }
    bereit = true;
    root.classList.add("film-bereit");
    qual.ueberspringen = 90;
    starten();
  };
  if (bereit) { start(); return; }
  vorbereiten().then(start, function () { ausschalten(); });
}

function ausschalten() {
  var war = an || root.classList.contains("film-an");
  var mittendrin = an && gebaut && lies() >= filmTop + H;
  an = false;
  gleit.aktiv = false;
  stoppen();
  window.removeEventListener("scroll", kopfPruefen, { passive: true });
  window.removeEventListener("wheel", rad, { passive: false });
  root.classList.remove("film-ende", "film-an", "film-bereit");
  filmEnde = false;
  if (!war) { return; }
  if (mittendrin) {
    var danach = document.getElementById("weg");
    if (danach) { danach.scrollIntoView({ behavior: "auto", block: "start" }); }
  }
  if (heroText) { heroText.style.visibility = ""; heroWeg = false; }
  if (heroCta) { heroCta.removeAttribute("inert"); }
  for (var i = 0; i < kapitel.length; i++) { kapitel[i].el.classList.remove("an"); kapitel[i].an = false; }
}

function steuern() {
  if (!moeglich()) { ausschalten(); return; }
  if (an) { return; }
  var anker_ = document.getElementById("weg"), versatz = null;
  if (anker_ && lies() > 40 && anker_.getBoundingClientRect().top < window.innerHeight * 0.9) {
    versatz = anker_.getBoundingClientRect().top;
  }
  einschalten();
  if (an && versatz !== null) { window.scrollTo(0, anker_.getBoundingClientRect().top + lies() - versatz); }
}

export function start() {
  try {
    var vorhanden = document.getElementById("film");
    if (!vorhanden || !vorhanden.querySelector(".buehne")) { root.classList.remove("film-an"); return; }
    steuern();
    var neuMessen = null;
    window.addEventListener("resize", function () {
      if (!an) { return; }
      window.clearTimeout(neuMessen);
      neuMessen = window.setTimeout(function () {
        if (an && (buehne.clientWidth !== W || buehne.clientHeight !== H || anker.getBoundingClientRect().width !== lay.r * 2)) { messen(); if (bereit) { zeichneBild(); } }
      }, 120);
    });
    document.addEventListener("bewegung", steuern);
    [mqReduce, mqForced, mqHoch].forEach(function (q) { if (q && q.addEventListener) { q.addEventListener("change", steuern); } });
    if (mqHell && mqHell.addEventListener) { mqHell.addEventListener("change", function () { if (an) { themaLesen(); } }); }
    document.addEventListener("click", function (e) {
      if (!an || !e.target.closest) { return; }
      if (e.target.closest(".nach-oben")) {
        e.stopImmediatePropagation(); e.preventDefault();
        gleit.aktiv = false;
        window.scrollTo(0, 0);
      }
    }, true);
    // Sprachschalter der Seite: Namen auf den Platten neu malen (Skala und Skript-Blatt lesen die Sprache je Bild)
    document.addEventListener("sprache", function () { if (gebaut) { maschine.beschriftungMalen(); } });
    document.addEventListener("visibilitychange", function () { if (an && !document.hidden) { starten(); } });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (eintraege) {
        sichtbar = eintraege[0].isIntersecting;
        root.classList.toggle("film-sichtbar", sichtbar);
        if (sichtbar && an) { starten(); }
      }, { rootMargin: "10% 0px 10% 0px" }).observe(vorhanden);
    }
    window.addEventListener("load", function () { if (an) { messen(); } });
    if (document.fonts && document.fonts.load) {
      // die Plattennamen erst mit geladener Schrift malen (Canvas nimmt sonst die Ersatzschrift)
      document.fonts.load('700 58px "Raleway"').then(function () { if (gebaut) { maschine.beschriftungMalen(); } }, function () {});
    }
  } catch (fehler) {
    ausschalten();
    root.classList.remove("film-an");
  }
}
