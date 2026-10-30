/*
  Worker des 3D-Bildes: rechnet bild3d.js (three.js) neben der Seite, in dem OffscreenCanvas, das ihm der
  Stellvertreter im Hauptthread (bild3d-vertreter.js) übergeben hat. Wartezeiten des Grafiktreibers (etwa beim ersten
  Gebrauch eines Shaders) und die schweren Schritte der Vorbereitung treffen so nur dieses Bild, nie das Scrollen, die
  Kapiteltexte, die Skala oder die Bildfolge im Hauptthread.

  Nachrichten der Seite (typ): start { leinwand, stufe, sprache, softwareErlaubt }; vorbereiten und anhalten (die
  Vorbereitung in Schritten wie im Hauptthread, ohne auf Bilder zu warten); ruhe { erlaubt } (auf Touch-Geräten: 0
  gerade keine Schritte, 1 nur leichte, 2 alle, siehe frei in haupt.js); bild { nr, messen, leicht, z } (leicht: beim
  Wischen, siehe welt.render; z: Szene, Druck,
  Stapel, Überblick, Station, Fortschritt, Paket, Fahrt, Stelle, Zeit, Lage und Radius des Kreises); groesse, stufe,
  sprache, standbild, freigeben. Antworten: geladen (Module da), vorbereitet, bild { nr, et, abstand } (et:
  Bildschirmlage der Beschriftungen im Überblick, abstand: ms seit dem vorigen Bild, nur bei messen), standbild,
  fehler { text, ohneWorker }, verlust (Kontextverlust). Lädt nur eigene Dateien (Module, Schrift), sendet nichts nach
  außen.
*/
import { baue } from "./bild3d.js?v=18";
import { spracheSetzen } from "./sprache.js?v=18";

var quelle = null, leinwand = null, gl = null, halt = true, laeuft = false;
// was die Seite der Vorbereitung gerade erlaubt (ruhe, nur auf Touch-Geräten gesetzt): 0 nichts, 1 leichte Schritte, 2 alle
var erlaubt = 2;
var Z = { etiketten: [] }, lay = { x: 0, y: 0, r: 200 };
// das neueste Bild, das noch gezeichnet werden soll (die Seite schickt das nächste erst nach der Antwort)
var auftrag = null, wecker = 0, letztesBild = 0;
// höchstens zwei Bilder in der Grafikkarte unterwegs (WebGL-Zäune): schafft sie das Bild nicht so schnell, wie die
// Seite es anfordert, wartet der Worker, statt ihr Arbeit für Bilder zu geben, die nie zu sehen sind; so misst er
// auch die Bildrate, die wirklich ankommt (danach stuft haupt.js die Qualität ab, wie im Hauptthread)
var zaeune = [];

function melden(fehler, ohneWorker) {
  self.postMessage({ typ: "fehler", text: String((fehler && fehler.message) || fehler), ohneWorker: !!ohneWorker });
}

// Raleway wie im Stylesheet (assets/fonts): die Schriften der Seite gelten im Worker nicht, er lädt sie selbst (aus
// dem Zwischenspeicher des Browsers) und malt die Namen auf den Platten neu, sobald sie da ist (wie haupt.js mit der
// Schrift der Seite). Die Nummern nehmen eine Systemschrift (sprache.js, ZIFFERN).
function schriftLaden() {
  if (!self.fonts || typeof FontFace === "undefined") { return; }
  try {
    var adresse = new URL("../assets/fonts/Raleway-latin.woff2", import.meta.url).href;
    var schrift = new FontFace("Raleway", "url(\"" + adresse + "\")", { weight: "100 900", style: "normal" });
    self.fonts.add(schrift);
    schrift.load().then(function () { if (quelle) { quelle.sprache(); } }, function () {});
  } catch (fehler) { /* dann die Ersatzschrift */ }
}

function starten(d) {
  spracheSetzen(d.sprache);
  schriftLaden();
  // Kann dieser Browser WebGL 2 in einem OffscreenCanvas (ältere Safari nicht)? Sonst rechnet die Seite das Bild selbst
  // (bild3d.js im Hauptthread). Geprüft mit einer eigenen kleinen Leinwand, damit die Leinwand des Films ihren
  // Kontext mit den richtigen Einstellungen bekommt (dort scheitert er auch ohne schnelle Grafik, dann bleibt die Bildfolge).
  var probe = null;
  try { probe = new OffscreenCanvas(1, 1).getContext("webgl2"); } catch (fehler) { probe = null; }
  if (!probe) { melden("kein WebGL 2 im OffscreenCanvas", true); return; }
  var los = probe.getExtension("WEBGL_lose_context");
  if (los) { los.loseContext(); }
  leinwand = d.leinwand;
  quelle = baue(leinwand, d.stufe, function () { self.postMessage({ typ: "verlust" }); }, { softwareErlaubt: d.softwareErlaubt });
  gl = leinwand.getContext("webgl2");
}

function vorbereiten() {
  if (laeuft || !quelle) { return; }
  laeuft = true;
  quelle.vorbereiten(function () { return !halt; }, null, function (schwer) { return erlaubt >= (schwer ? 2 : 1); }).then(function (fertig) {
    laeuft = false;
    if (fertig) { self.postMessage({ typ: "vorbereitet" }); }
    // inzwischen wieder angestoßen: dort weitermachen
    else if (!halt) { vorbereiten(); }
  }, function (fehler) {
    laeuft = false;
    if (quelle) { melden(fehler); }
  });
}

function grafikFrei() {
  while (zaeune.length && gl.getSyncParameter(zaeune[0], gl.SYNC_STATUS) === gl.SIGNALED) { gl.deleteSync(zaeune.shift()); }
  return zaeune.length < 2;
}

// Zustand aus der Nachricht in Z und lay (dieselben Werte, die bild3d.js im Hauptthread liest)
function zustandLesen(z) {
  Z.szene = z[0]; Z.druck = z[1]; Z.idx = z[2]; Z.auf = z[3]; Z.j = z[4]; Z.u = z[5]; Z.paket = z[6]; Z.fahrt = z[7]; Z.s = z[8];
  lay.x = z[10]; lay.y = z[11]; lay.r = z[12];
  return z[9];
}

function etiketten() {
  if (Z.auf < 0.02 || !Z.etiketten.length) { return null; }
  var et = [];
  for (var i = 0; i < Z.etiketten.length; i++) { var e = Z.etiketten[i]; et.push(e.x, e.y, e.j); }
  return et;
}

function zeichnen() {
  if (!auftrag || !quelle || wecker) { return; }
  if (gl && !grafikFrei()) {
    wecker = setTimeout(function () { wecker = 0; zeichnen(); }, 3);
    return;
  }
  var d = auftrag;
  auftrag = null;
  var zeit = zustandLesen(d.z), t0 = performance.now();
  try {
    quelle.zeichne(Z, zeit, lay, undefined, false, !!d.leicht);
  } catch (fehler) {
    melden(fehler);
    return;
  }
  if (gl) {
    var zaun = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (zaun) { zaeune.push(zaun); }
  }
  var abstand = d.messen && letztesBild ? t0 - letztesBild : 0;
  letztesBild = t0;
  self.postMessage({ typ: "bild", nr: d.nr, et: etiketten(), abstand: abstand });
}

// Bild für das Werkzeug der Bildfolge (standbild in bild3d.js): als ImageBitmap zurück, dazu die Beschriftungen
function standbild(d) {
  var zeit = zustandLesen(d.z);
  var bild = quelle.standbild(Z, zeit, lay, d.kante, d.stufe, d.welle);
  createImageBitmap(bild).then(function (bm) {
    self.postMessage({ typ: "standbild", nr: d.nr, bild: bm, et: etiketten() }, [bm]);
  }, function (fehler) { melden(fehler); });
}

function freigeben() {
  halt = true;
  if (wecker) { clearTimeout(wecker); wecker = 0; }
  if (quelle) { var q = quelle; quelle = null; q.freigeben(); }
  self.close();
}

self.onmessage = function (e) {
  var d = e.data;
  try {
    switch (d.typ) {
      case "start": starten(d); break;
      case "vorbereiten": halt = false; vorbereiten(); break;
      case "anhalten": halt = true; break;
      case "ruhe": erlaubt = d.erlaubt; break;
      case "bild": auftrag = d; zeichnen(); break;
      case "groesse": if (quelle) { quelle.groesse(d.kante, d.dichte); } break;
      case "stufe": if (quelle) { quelle.setzeStufe(d.n); } break;
      case "sprache": spracheSetzen(d.s); if (quelle) { quelle.sprache(); } break;
      case "standbild": standbild(d); break;
      case "freigeben": freigeben(); break;
    }
  } catch (fehler) {
    melden(fehler);
  }
};

// alle Module sind geladen (Fehler davor heißen für den Stellvertreter: hier geht es nicht, also im Hauptthread)
self.postMessage({ typ: "geladen" });
