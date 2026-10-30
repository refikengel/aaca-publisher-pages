/*
  Stellvertreter des 3D-Bildes im Hauptthread: dieselbe Schnittstelle wie bild3d.js (art, leinwand, stufe,
  setzeStufe, groesse, vorbereiten, zeichne, sprache, freigeben, dauerlauf, wachsam, standbild), gerechnet wird aber
  in einem Web Worker (bild3d-worker.js) in einem OffscreenCanvas, an das die Leinwand hier ihre Darstellung abgibt
  (transferControlToOffscreen). Wartezeiten des Grafiktreibers und die schweren Schritte der Vorbereitung treffen so
  nur das 3D-Bild, das bis zur Übernahme ohnehin unsichtbar ist, nie das Scrollen, die Kapiteltexte, die Skala oder
  die Bildfolge. Der Hauptthread lädt dafür auch three.js nicht; das holt der Worker, sobald vorladen() ihn startet.

  Je Bild gehen nur der Zustand Z (die Werte, die bild3d.js liest), die Zeit und die Lage des Kreises an den Worker;
  zurück kommen die Bildschirmlage der Beschriftungen im Überblick (die Skala malt sie, wie bisher eine Bildlage
  später) und, beim Scrollen, der Abstand der Bilder im Worker für die Qualitätsanpassung in haupt.js (messwerte).
  Höchstens ein Bild ist unterwegs: Kommt das nächste, bevor der Worker das vorige gezeichnet hat, wartet nur das
  jeweils neueste. Kann der Browser kein WebGL 2 im OffscreenCanvas (ältere Safari), scheitert vorbereiten mit
  fehler.ohneWorker, und haupt.js nimmt bild3d.js im Hauptthread.
*/
import { sprache } from "./sprache.js?v=18";

// für haupt.js: der Kontext entsteht im Worker, das Anlegen kostet den Hauptthread nichts
export var imWorker = true;

var vorab = null;

// Ein Fehler, bevor der Worker „geladen“ meldet (Skript oder Module nicht ladbar, kein Modul-Worker), heißt: hier
// geht es nicht, also im Hauptthread (ohneWorker); sind auch dort die Module nicht ladbar, bleibt die Bildfolge.
function neuerWorker() {
  var v = { w: new Worker(new URL("./bild3d-worker.js?v=18", import.meta.url), { type: "module" }), fehler: null, an: null, geladen: false };
  // bis baue() die Quelle anschließt, wird nur ein Fehler gemerkt
  v.w.onmessage = function (e) {
    if (e.data.typ === "geladen") { v.geladen = true; } else if (v.an) { v.an(e.data); } else if (e.data.typ === "fehler") { v.fehler = e.data; }
  };
  v.w.onerror = function (e) {
    if (e && e.preventDefault) { e.preventDefault(); }
    var d = { typ: "fehler", text: "Worker: " + ((e && e.message) || "nicht ladbar"), ohneWorker: !v.geladen };
    if (v.an) { v.an(d); } else { v.fehler = d; }
  };
  return v;
}

// den Worker gleich starten: er lädt three.js und die Module des Films, während der Kreis noch die Bildfolge vorbereitet
export function vorladen() {
  if (!vorab) {
    try { vorab = neuerWorker(); } catch (fehler) { vorab = null; }
  }
}

// leinwand: ein eigenes, frisches Canvas; stufe: Startstufe; fehler(): bei Kontextverlust oder Ausfall des Workers;
// optionen.softwareErlaubt: auch ohne Grafikbeschleunigung (nur für Messungen)
export function baue(leinwand, stufe, fehler, optionen) {
  var v = vorab;
  vorab = null;
  if (!v) {
    try { v = neuerWorker(); } catch (fehlerWorker) { fehlerWorker.ohneWorker = true; throw fehlerWorker; }
  }
  var aus = leinwand.transferControlToOffscreen();
  var kaputt = null, warten = null, uhr = 0, frei = false, gebaut = false;
  var unterwegs = false, wartend = null, nr = 0, letzteEt = null, messungen = [], standbilder = {};

  function senden(d, uebergabe) { if (!frei) { v.w.postMessage(d, uebergabe || []); } }

  function ausfall(d) {
    if (kaputt || frei) { return; }
    kaputt = new Error(d.text || "3D-Bild ausgefallen");
    kaputt.ohneWorker = !!d.ohneWorker;
    for (var k in standbilder) { standbilder[k].fehlgeschlagen(kaputt); }
    standbilder = {};
    if (warten) { var w = warten; warten = null; clearTimeout(uhr); w.fehlgeschlagen(kaputt); }
    // (vor dem Ende von baue und bei ohneWorker meldet es der nächste Aufruf von vorbereiten)
    else if (gebaut && !kaputt.ohneWorker) { fehler(); }
  }

  v.an = function (d) {
    if (frei) { return; }
    if (d.typ === "bild") {
      unterwegs = false;
      letzteEt = d.et;
      if (d.abstand > 0) { messungen.push(d.abstand / 1000); }
      if (wartend) { var a = wartend; wartend = null; unterwegs = true; senden(a); }
    } else if (d.typ === "vorbereitet") {
      if (warten) { var w = warten; warten = null; clearTimeout(uhr); w.fertig(true); }
    } else if (d.typ === "standbild") {
      var s = standbilder[d.nr];
      delete standbilder[d.nr];
      if (s) { letzteEt = d.et; s.fertig(d.bild); }
    } else if (d.typ === "fehler" || d.typ === "verlust") {
      ausfall(d.typ === "verlust" ? { text: "Kontextverlust" } : d);
    }
  };
  if (v.fehler) { ausfall(v.fehler); }

  senden({ typ: "start", leinwand: aus, stufe: stufe, sprache: sprache(), softwareErlaubt: !!(optionen && optionen.softwareErlaubt) }, [aus]);

  // die Beschriftungen aus dem letzten Bild des Workers, als { x, y, j } wie in bild3d.js
  function etikettenSetzen(Z) {
    var et = Z.etiketten || (Z.etiketten = []);
    et.length = 0;
    if (Z.auf >= 0.02 && letzteEt) {
      for (var i = 0; i < letzteEt.length; i += 3) { et.push({ x: letzteEt[i], y: letzteEt[i + 1], j: letzteEt[i + 2] }); }
    }
  }
  function werte(Z, zeit, lay) {
    return [Z.szene, Z.druck, Z.idx, Z.auf, Z.j, Z.u, Z.paket, Z.fahrt, Z.s, zeit, lay.x, lay.y, lay.r];
  }
  function klemmen(n) { return Math.max(0, Math.min(3, n === undefined ? 3 : n)); }

  var api = {
    art: "3d",
    leinwand: leinwand,
    dauerlauf: true,
    wachsam: true,
    imWorker: true,
    stufe: klemmen(stufe),
    setzeStufe: function (n) {
      n = klemmen(n);
      if (n === api.stufe) { return; }
      api.stufe = n;
      senden({ typ: "stufe", n: n });
    },
    groesse: function (kante, pixeldichte) { senden({ typ: "groesse", kante: kante, dichte: pixeldichte }); },
    // wie bild3d.js: true, wenn fertig; false, sobald nochAn() nicht mehr gilt (ein neuer Aufruf macht dort weiter).
    // Die Schritte laufen im Worker und halten hier nichts auf. ruhe (frei aus haupt.js, nur auf Touch-Geräten): ob
    // gerade leichte bzw. auch schwere Schritte laufen dürfen; der Worker erfährt es bei jeder Änderung (alle 50 ms
    // geprüft) und wartet sonst.
    vorbereiten: function (nochAn, stelle, ruhe) {
      return new Promise(function (fertig, fehlgeschlagen) {
        if (kaputt) { fehlgeschlagen(kaputt); return; }
        if (frei) { fehlgeschlagen(new Error("freigegeben")); return; }
        warten = { fertig: fertig, fehlgeschlagen: fehlgeschlagen };
        var zuletzt = -1;
        function ruheMelden() {
          var jetzt = !ruhe ? 2 : (ruhe(false) ? (ruhe(true, 0) ? 2 : 1) : 0);
          if (jetzt !== zuletzt) { zuletzt = jetzt; senden({ typ: "ruhe", erlaubt: jetzt }); }
        }
        ruheMelden();
        senden({ typ: "vorbereiten" });
        (function pruefen() {
          if (!warten) { return; }
          if (!nochAn()) {
            var w = warten;
            warten = null;
            senden({ typ: "anhalten" });
            w.fertig(false);
            return;
          }
          ruheMelden();
          uhr = setTimeout(pruefen, ruhe ? 50 : 100);
        })();
      });
    },
    // welle gibt es nur für standbild; messen: haupt.js zählt dieses Bild für die Qualitätsanpassung; leicht: beim
    // Wischen auf Touch-Geräten (welt.render)
    zeichne: function (Z, zeit, lay, welle, messen, leicht) {
      etikettenSetzen(Z);
      var a = { typ: "bild", nr: ++nr, messen: !!messen, leicht: !!leicht, z: werte(Z, zeit, lay) };
      if (unterwegs) { wartend = a; } else { unterwegs = true; senden(a); }
    },
    // die Bilddauern (s) aus dem Worker seit dem letzten Aufruf, je eine an f(jetzt, dauer)
    messwerte: function (f, jetzt) {
      for (var i = 0; i < messungen.length; i++) { f(jetzt, messungen[i]); }
      messungen.length = 0;
    },
    sprache: function () { senden({ typ: "sprache", s: sprache() }); },
    // für das Werkzeug der Bildfolge (standbild in haupt.js): Promise mit dem Bild als ImageBitmap; setzt Z.etiketten
    standbild: function (Z, t, lay, kante, stufeWunsch, welle) {
      return new Promise(function (fertig, fehlgeschlagen) {
        if (kaputt) { fehlgeschlagen(kaputt); return; }
        var n = ++nr;
        standbilder[n] = {
          fertig: function (bm) { etikettenSetzen(Z); fertig(bm); },
          fehlgeschlagen: fehlgeschlagen
        };
        if (klemmen(stufeWunsch) !== api.stufe) { api.stufe = klemmen(stufeWunsch); }
        senden({ typ: "standbild", nr: n, z: werte(Z, t, lay), kante: kante, stufe: stufeWunsch, welle: welle });
      });
    },
    // Worker beenden (er gibt vorher den Grafikspeicher frei) und die Leinwand entfernen
    freigeben: function () {
      if (frei) { return; }
      senden({ typ: "freigeben" });
      frei = true;
      clearTimeout(uhr);
      if (warten) { var w = warten; warten = null; w.fehlgeschlagen(new Error("freigegeben")); }
      setTimeout(function () { v.w.terminate(); }, 300);
      if (leinwand.parentNode) { leinwand.parentNode.removeChild(leinwand); }
    }
  };
  gebaut = true;
  return api;
}
