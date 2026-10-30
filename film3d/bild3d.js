/*
  Das 3D-Bild des Films (three.js, Echtzeit): baut Welt, Maschine, Roboter und Szenen, bereitet Shader und
  Texturen vor und zeichnet zum Zustand Z (fahrplan.js) ein Bild in den Kreis. haupt.js nimmt es nur auf Geräten
  mit schneller Grafik, während der Kreis schon die vorberechnete Bildfolge (folge.js) zeigt. Es läuft in einem
  Web Worker in einem OffscreenCanvas (bild3d-worker.js; im Hauptthread vertritt es bild3d-vertreter.js), wo der
  Browser das kann, sonst im Hauptthread; folge.js, dieses Modul und der Stellvertreter haben dieselbe Schnittstelle:
    art, leinwand, stufe, setzeStufe(n), groesse(kante, pixeldichte), vorbereiten(nochAn) → Promise (true:
    fertig, false: angehalten, ein neuer Aufruf macht dort weiter), zeichne(Z, zeit, lay), sprache(),
    freigeben(), dauerlauf (die Bildschleife läuft ständig, auch gedämpft), wachsam (Bildrate wird gemessen).
  Die Vorbereitung läuft in kleinen Schritten (leichte gebündelt, bis etwa 10 ms je Bild verbraucht sind, schwere
  einzeln und nicht mitten ins Scrollen), damit die Bildfolge davor flüssig bleibt.
*/
import * as THREE from "../vendor/three/build/three.module.min.js";
// geänderte Module mit Versionsangabe (wie haupt.js in film.js): nach einer Aktualisierung trifft so kein
// zwischengespeichertes altes Modul auf ein neues
import { Welt } from "./welt.js?v=18";
import { grundstoffe, scan, scanSetzen, texturenVorab, texturenVergessen } from "./stoff.js?v=18";
import { Roboter } from "./roboter.js?v=18";
import { Maschine, ABSTAND } from "./maschine.js?v=18";
import { farbeVon } from "./farben.js";
import { szeneStart, szeneThema, szeneSkript } from "./szenen.js?v=18";
import { szeneStimme, szeneQuellen, szeneFreigabe, szeneKanaele, szeneZiel } from "./szenen2.js?v=18";
import { MITTE, N_SCHICHT } from "./fahrplan.js?v=10";

var PI = Math.PI;
var SZENEN = [szeneStart, szeneThema, szeneSkript, szeneStimme, szeneQuellen, szeneFreigabe, szeneKanaele, szeneZiel];

// Im Hauptthread den nächsten Schritt erst nach dem nächsten Bild (dazwischen zeichnet die Seite, auch die Bildfolge).
// Im Worker (kein document) gleich danach: dort wartet keine Seite, nur Nachrichten (anhalten, Größe) sollen dazwischen
// ankommen; über einen eigenen Kanal statt setTimeout, das ab der fünften Verschachtelung mindestens 4 ms wartet.
var imWorker = typeof document === "undefined", kanal = null, danach = [];
function naechstes(fn) {
  if (!imWorker) { window.requestAnimationFrame(function () { window.setTimeout(fn, 0); }); return; }
  if (!kanal) {
    kanal = new MessageChannel();
    kanal.port1.onmessage = function () { var f = danach.shift(); if (f) { f(); } };
  }
  danach.push(fn);
  kanal.port2.postMessage(0);
}

// leinwand: ein eigenes, frisches Canvas; stufe: Startstufe (3 Rechner, 2 Touch); fehler(): bei
// Kontextverlust; optionen.softwareErlaubt: auch ohne Grafikbeschleunigung (nur für Messungen). Wirft, wenn es
// keine schnelle Grafik gibt (dann bleibt haupt.js bei der Bildfolge).
export function baue(leinwand, stufe, fehler, optionen) {
  var welt = new Welt(leinwand, stufe, !!(optionen && optionen.softwareErlaubt));
  var st = null, rob = null, maschine = null, szenen = [], kontext = null, aktiveSzene = -1, freigegeben = false;
  var farbeTmp = new THREE.Color(), kamZiel = new THREE.Vector3(), etikettPunkt = new THREE.Vector3();
  var zeit = 0;

  // Kontextverlust (Treiber neu gestartet, Speicher knapp): melden, haupt.js nimmt dann die Bildfolge
  leinwand.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();
    if (!freigegeben) { fehler(); }
  });

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
  function etikettenRechnen(Z, lay) {
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

  // welle: nur für die Schleife der Bildfolge (eigene Zeit des Winkens, siehe szeneStart in szenen.js); messen: nur
  // für den Stellvertreter im Worker (hier ohne Bedeutung); leicht: beim Wischen auf Touch-Geräten (welt.render)
  function zeichne(Z, t, lay, welle, messen, leicht) {
    zeit = t;
    var j = Z.szene, sichtbarSzene = j >= 0 && Z.druck > 0.001;
    maschine.stellen(Z.idx, Z.auf);
    szeneWechseln(sichtbarSzene ? j : -1);
    var farbeJ = farbeTmp.setHex(farbeVon(Math.max(1, Math.min(6, Z.j))));
    if (Z.j === 0 || Z.j === 7) { farbeJ.setHex(0xf2c14e); }
    if (sichtbarSzene) {
      var sz = szenen[j];
      sz.tick(zeit, Z.u, welle);
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
    etikettenRechnen(Z, lay);
    welt.render(zeit, leicht);
  }

  // alles unter wurzel sichtbar machen (three.js zeichnet und lädt beim Vorwärmen nur, was sichtbar ist);
  // liste merkt sich, was vorher versteckt war, damit es danach wieder versteckt wird
  function allesZeigen(wurzel, liste) {
    wurzel.traverse(function (o) { if (!o.visible) { o.visible = true; liste.push(o); } });
  }
  function wiederVerstecken(liste) {
    for (var i = 0; i < liste.length; i++) { liste[i].visible = false; }
    liste.length = 0;
  }

  /* ------------------------------------------------------------- Vorbereitung */

  // Schritte, in dieser Reihenfolge, damit der Grafiktreiber übersetzt, während hier weitergebaut wird (vorher
  // wartete die Vorbereitung am Ende fast eine Sekunde auf ihn): Shader der Umgebung und der Nachbearbeitung
  // anstoßen (sie übersetzen nebenher), die Umgebung bauen (die Szenen spiegeln sie, ihre Shader brauchen sie
  // also schon), Grundstoffe mit Maschine und Roboter und deren Shader, dann je Szene: bauen und gleich ihre Shader
  // anstoßen (samt den Tiefen-Stoffen ihrer Schatten); am Ende auf alle Shader warten und je Szene ein Bild zum
  // Vorwärmen (lädt Texturen und Instanzdaten hoch). Schwere Schritte (schwer) laufen am Rechner etwa 20 bis 200 ms
  // am Stück, auf Handys vier- bis fünfmal so lange; haupt.js legt sie im Hauptthread nicht mitten ins Scrollen (siehe
  // vorbereiten), im Worker nur auf Touch-Geräten nicht (dort halten sie die Seite nicht auf).
  var schritte = [], schritt = 0, versteckt = [], umgebung = null, texturen = null, stoffe = new Set(), gesehen = {};
  function schwer(fn) { fn.schwer = true; return fn; }

  // Der Treiber übersetzt die Shader in eigenen Threads des Grafikprozesses, die großen (Stoffe mit Lack, Spiegelung
  // und Schatten) je 0,3 bis 0,8 s. Alle auf einmal angestoßen (bis Fassung 17) liefen bis zu elf gleichzeitig,
  // zusammen rund 15 s Rechenzeit, und ließen dem Browser kaum etwas übrig: Bildausgabe, Texte und Bildfolge standen
  // dann bis zu einer halben Sekunde, auch mit dem 3D-Bild im Worker (gemessen am Rechner mit 12 Threads,
  // 30.10.2026). Darum höchstens GLEICHZEITIG Programme auf einmal: die Hälfte der Threads, höchstens sechs (dort
  // gemessen: mit vier wie mit sechs keine Lücken, mit sechs 3D gut 0,5 s früher).
  var kerne = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4;
  var GLEICHZEITIG = Math.max(1, Math.min(6, Math.floor(kerne / 2))), laufend = [];
  // wie viele angestoßene Programme der Treiber noch übersetzt
  function offen() {
    laufend = laufend.filter(function (p) { return !p.isReady(); });
    return laufend.length;
  }
  function merken(m) {
    var p = welt.renderer.properties.get(m).currentProgram;
    if (p && laufend.indexOf(p) < 0 && !p.isReady()) { laufend.push(p); }
  }
  // erfüllt, sobald wieder Platz für ein Programm ist
  function platz() {
    return new Promise(function (weiter) {
      (function pruefen() { if (offen() < GLEICHZEITIG) { weiter(); } else { setTimeout(pruefen, 16); } })();
    });
  }
  // ein Schritt, der ein Programm anstößt: erst, wenn Platz ist (sonst derselbe Schritt noch einmal, danach)
  function mitPlatz(fn) {
    return function schrittMitPlatz() {
      if (offen() >= GLEICHZEITIG) { schritte.splice(schritt + 1, 0, schrittMitPlatz); return platz(); }
      return fn();
    };
  }
  // die gemalten Texturen rechnet ein Worker nebenher (stoff.js), gebraucht werden sie ab den Grundstoffen
  schritte.push(function () { texturen = texturenVorab(); });
  // Die Probe der Schnittebenen (welt.schnittebenen) wird beim ersten Zeichnen mit 0, 1 und 2 Ebenen übersetzt, und
  // dabei wartet WebGL auf den Treiber, samt allem, was vor ihr in dessen Warteschlange steht: mitten zwischen den
  // Szenen gemessen 169 ms für die Probe mit zwei Ebenen. Gleich zu Beginn, solange die Warteschlange leer ist,
  // kosten alle drei zusammen nur einen Bruchteil, und später zeichnet die Probe in unter 1 ms. Je Probe ein
  // Schritt (jeder verknüpft ein Programm, siehe vorbereiten).
  [0, 1, 2].forEach(function (n) { schritte.push(schwer(function () { welt.schnittebenen(n); })); });
  schritte.push(schwer(function () { umgebung = welt.umgebungVorbereiten(); }));
  // die Stoffe der Nachbearbeitung einzeln, je ein Schritt mit einem Programm
  schritte.push(function () {
    var neu = welt.nachbearbeitungAuftraege().map(function (auftrag) {
      return mitPlatz(function () { var m = auftrag(); stoffe.add(m); merken(m); });
    });
    schritte.splice.apply(schritte, [schritt + 1, 0].concat(neu));
  });
  schritte.push(function () { return umgebung; });
  schritte.push(schwer(function () { welt.umgebungBauen(); }));
  // Ein Bild der noch leeren Welt (Licht, Hintergrund, Nachbearbeitung), sobald deren Shader fertig sind: legt die
  // Renderziele an (Schattenkarte, Zwischenbilder mit Kantenglättung, Leuchten) und übersetzt den Hintergrund. Beim
  // ersten Vorwärmen kam das sonst zu den Daten der ersten Szene dazu (am Rechner rund 70 ms am Stück im
  // Grafikprozess, eine Lücke von 80 ms im Bildtakt der Seite).
  schritte.push(function () { return welt.warten(stoffe, true); });
  schritte.push(schwer(function () { welt.leerbild(); }));
  schritte.push(function () { return texturen; });
  schritte.push(schwer(function () {
    st = grundstoffe();
    maschine = new Maschine();
    welt.szene.add(maschine.gruppe);
    rob = new Roboter(st);
    var schatten = welt.kontaktSchatten(1.3, 1.3, 0.75);
    schatten.position.y = 0.004;
    rob.wurzel.add(schatten);
    kontext = { st: st, welt: welt, rob: rob, scanEbenen: [scan.ebene], scanUniforms: scan.uniforms };
  }));
  schritte.push(function () { shaderPlanen(null); });
  SZENEN.forEach(function (bauer, i) {
    schritte.push(schwer(function () {
      szenen[i] = bauer(kontext);
      maschine.platten[i].add(szenen[i].gruppe);
    }));
    schritte.push(function () { shaderPlanen(szenen[i].gruppe); });
  });
  schritte.push(function () {
    return welt.warten(stoffe).then(function () { wiederVerstecken(versteckt); });
  });
  for (var vw = 0; vw < N_SCHICHT; vw++) { schritte.push(schwer(vorwaermen.bind(null, vw))); }
  schritte.push(function () {
    texturenVergessen();
    welt.schattenStoffeFreigeben();
    aktiveSzene = -2;
    szeneWechseln(-1);
    scanSetzen(1000, 0);
  });

  // Art eines Objekts, soweit sie den Shader bestimmt (mit Instanzen, Punkte, Linien, welche Attribute)
  function art(o) {
    var g = o.geometry, morph = g && g.morphAttributes && Object.keys(g.morphAttributes).length ? "+m" : "";
    return (o.isInstancedMesh ? (o.instanceColor ? "ic" : "i") : "") + (o.isSkinnedMesh ? "s" : "") +
      (o.isPoints ? "p" : (o.isLine ? "l" : (o.isSprite ? "t" : "n"))) + ":" + (g ? Object.keys(g.attributes).sort().join(",") : "") + morph;
  }

  // Shader passend zu den Schnittebenen übersetzen (siehe welt.schnittebenen): jede Verbindung aus Stoff und
  // Art des Objekts einmal, mit der Zahl an Ebenen, die der Stoff wirklich hat (Maschine, Staub und
  // Kontaktschatten keine, die Szenen und der Roboter eine, das Skript-Blatt zwei). Früher wurden die Szenen
  // in mehreren Fassungen übersetzt, von denen nur eine gebraucht wird. In Stücken von etwa 12 ms je Schritt und
  // nie mehr als GLEICHZEITIG offene Programme (sonst wartet der Schritt, bis eines fertig ist); auf alle gewartet
  // wird am Ende. Je Teil: wurzel ist eine Szene (alles darin wird dafür sichtbar und danach
  // wieder versteckt); ohne wurzel Welt, Maschine und Roboter (gleich nach ihrem Bau, die Szenen noch ohne).
  function shaderPlanen(wurzel) {
    var i;
    if (wurzel) {
      wurzel.visible = true;
      allesZeigen(wurzel, versteckt);
    } else {
      maschine.scanner.visible = true;
      maschine.paket.visible = true;
      maschine.schienen.forEach(function (s) { s.schiene.visible = s.schlitten.visible = true; });
      for (i = 0; i < maschine.platten.length; i++) { maschine.platten[i].visible = true; }
    }
    var nachEbenen = [[], [], []], schatten = [[], [], []], bilder = [];
    function sammeln(o) {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) { return; }
      var stoffe = Array.isArray(o.material) ? o.material : [o.material], n = 0;
      var schluessel = stoffe.map(function (m) {
        n = Math.max(n, m.clippingPlanes ? m.clippingPlanes.length : 0);
        bilderSammeln(m);
        return m.id;
      }).join(",") + "|" + art(o);
      schattenSammeln(o);
      if (gesehen[schluessel]) { return; }
      gesehen[schluessel] = true;
      nachEbenen[Math.min(2, n)].push(o);
    }
    // Was einen Schatten wirft, zeichnet three.js in die Schattenkarte mit einem eigenen Tiefen-Stoff (siehe
    // welt.schattenUebersetzen); dessen Programm entstand bis Fassung 17 erst beim ersten Bild der Szene (vorwaermen)
    // und wurde dort sofort gebraucht, der Grafikprozess wartete dann in seinem Hauptthread. Darum hier mit: je
    // Einstellung einmal.
    function schattenSammeln(o) {
      var m = o.material;
      if (!welt.mitSchatten || !o.castShadow || o.isSprite || Array.isArray(m)) { return; }
      var n = m.clipShadows && m.clippingPlanes ? m.clippingPlanes.length : 0;
      var schluessel = "s|" + [m.side, m.shadowSide, n, m.clipIntersection, !!m.map, !!m.alphaMap, m.alphaTest > 0,
        !!m.displacementMap, m.wireframe].join(",") + "|" + art(o);
      if (gesehen[schluessel]) { return; }
      gesehen[schluessel] = true;
      schatten[Math.min(2, n)].push(o);
    }
    // Die Texturen der Stoffe kamen sonst alle mit dem ersten Bild einer Szene auf die Grafikkarte, im Worker samt dem
    // ersten Rastern seiner gemalten Leinwände (dafür lädt der Grafikprozess die Shader von Skia und wartet darauf in
    // seinem Hauptthread, gemessen 58 ms am Stück beim ersten Vorwärmen): im Worker darum einzeln, je ein schwerer
    // Schritt.
    function bilderSammeln(m) {
      for (var k in m) {
        var t = m[k];
        if (t && t.isTexture && !t.isRenderTargetTexture && t.image && !gesehen["t" + t.id]) {
          gesehen["t" + t.id] = true;
          bilder.push(t);
        }
      }
    }
    if (wurzel) {
      wurzel.traverse(sammeln);
    } else {
      welt.szene.traverse(sammeln);
      // der Roboter hängt erst an einer Platte, wenn seine Szene dran ist
      if (!rob.wurzel.parent) { rob.wurzel.traverse(sammeln); }
    }
    var neu = [];
    // uebersetzen: welt.uebersetzen (der Stoff des Objekts) oder welt.schattenUebersetzen (sein Tiefen-Stoff)
    function stueckweise(n, objekte, uebersetzen) {
      var k = 0;
      return function teil() {
        var t0 = performance.now(), programme = welt.renderer.info.programs.length;
        welt.schnittebenen(n);
        // bis ein neues Programm angestoßen ist (Objekte mit schon übersetzten Stoffen kosten fast nichts)
        while (k < objekte.length && performance.now() - t0 < 12 && offen() < GLEICHZEITIG &&
          welt.renderer.info.programs.length === programme) {
          uebersetzen.call(welt, objekte[k++]).forEach(function (m) { stoffe.add(m); merken(m); });
        }
        // nicht fertig: derselbe Schritt noch einmal, sobald wieder Platz ist
        if (k < objekte.length) {
          schritte.splice(schritt + 1, 0, teil);
          if (offen() >= GLEICHZEITIG) { return platz(); }
        }
      };
    }
    [0, 2, 1].forEach(function (n) {
      if (nachEbenen[n].length) { neu.push(stueckweise(n, nachEbenen[n], welt.uebersetzen)); }
    });
    [0, 2, 1].forEach(function (n) {
      if (schatten[n].length) { neu.push(stueckweise(n, schatten[n], welt.schattenUebersetzen)); }
    });
    // (nur im Worker: im Hauptthread sind die Shader von Skia von der Seite schon geladen, und jeder schwere Schritt
    // wartet dort auf eine Scrollpause, frei in haupt.js)
    if (imWorker) { bilder.forEach(function (t) { neu.push(schwer(function () { welt.renderer.initTexture(t); })); }); }
    // gleich nach diesem Schritt einfügen
    schritte.splice.apply(schritte, [schritt + 1, 0].concat(neu));
  }

  function vorwaermen(j) {
    aktiveSzene = -2;
    maschine.stellen(j);
    szeneWechseln(j);
    szenen[j].tick(0.5, 0.5);
    allesZeigen(szenen[j].gruppe, versteckt);
    scanSetzen(0.07 + szenen[j].oben * 0.5, 1, farbeTmp.setHex(farbeVon(Math.max(1, Math.min(6, j)))));
    maschine.scanZeigen(1, 1, farbeTmp, szenen[j].oben, 0);
    maschine.paketZeigen(0.5, farbeTmp, 0);
    zeit = 0;
    kameraSetzen(MITTE[j], 0, 0);
    welt.render(0);
    wiederVerstecken(versteckt);
  }

  // nochAn(): weitermachen? Sonst anhalten (Promise mit false); ein neuer Aufruf macht beim nächsten Schritt weiter.
  // frei(schwer): darf jetzt ein (schwerer) Schritt laufen? haupt.js legt keinen mitten ins Scrollen; ohne frei
  // läuft alles durch. Je Bild laufen leichte Schritte hintereinander, bis BUDGET_MS verbraucht sind (vorher wartete
  // jeder Schritt auf ein eigenes Bild); ein schwerer Schritt läuft für sich, gleich am Anfang eines Bildes. Ein
  // Schritt mit Promise (Warten auf den Treiber) gibt die Bilder frei, bis er erfüllt ist.
  // frei bekommt dazu die Dauer des letzten schweren Schritts (ms): danach richtet sich, wie lange Ruhe sein muss.
  var BUDGET_MS = 10, letzteSchwere = 0;
  function vorbereiten(nochAn, stelle, frei) {
    return new Promise(function (fertig, fehlgeschlagen) {
      function weiter() {
        var beginn = performance.now(), n = 0;
        for (;;) {
          if (freigegeben) { fehlgeschlagen(new Error("freigegeben")); return; }
          if (!nochAn()) { fertig(false); return; }
          if (schritt >= schritte.length) { fertig(true); return; }
          var f = schritte[schritt];
          if (n && (f.schwer || performance.now() - beginn > BUDGET_MS)) { naechstes(weiter); return; }
          if (frei && !frei(!!f.schwer, letzteSchwere)) { setTimeout(weiter, 40); return; }
          var r, t0 = performance.now(), programme = welt.renderer.info.programs.length;
          try { r = f(); } catch (e) { fehlgeschlagen(e); return; }
          if (f.schwer) { letzteSchwere = performance.now() - t0; }
          schritt++;
          n++;
          // Hat der Schritt der Grafikkarte etwas aufgetragen (ein neues Shaderprogramm oder schwere Arbeit), geht es
          // erst weiter, wenn sie es erledigt hat: Der Grafikprozess verknüpft jedes Programm in seinem Hauptthread (am
          // Rechner 5 bis 15 ms, so lange wartet dort alles, auch das Zeichnen der Seite), und mehrere auf einmal stauten
          // sich zu Lücken von über 50 ms im Bildtakt der ganzen Seite.
          if (!(r && r.then) && (f.schwer || welt.renderer.info.programs.length !== programme)) { r = welt.abgearbeitet(); }
          if (r && r.then) { r.then(function () { naechstes(weiter); }, fehlgeschlagen); return; }
        }
      }
      naechstes(weiter);
    });
  }

  return {
    art: "3d",
    leinwand: leinwand,
    dauerlauf: true,
    wachsam: true,
    get stufe() { return welt.stufe; },
    setzeStufe: function (n) { welt.setzeStufe(n); },
    groesse: function (kante, pixeldichte) { welt.groesse(kante, pixeldichte); },
    vorbereiten: vorbereiten,
    zeichne: zeichne,
    // Namen auf den Platten neu malen (Sprachwechsel, geladene Schrift)
    sprache: function () { if (maschine) { maschine.beschriftungMalen(); } },
    // Bild für das Werkzeug der Bildfolge: zu Z rendern, das fertige Canvas zurück (welle: siehe zeichne)
    standbild: function (Z, t, lay, kante, stufeWunsch, welle) {
      if (welt.stufe !== stufeWunsch) { welt.setzeStufe(stufeWunsch); }
      welt.groesse(kante, 2);
      zeichne(Z, t, lay, welle);
      return welt.renderer.domElement;
    },
    // Grafikspeicher freigeben und das Canvas entfernen (der Kontextverlust ist dann gewollt)
    freigeben: function () {
      if (freigegeben) { return; }
      freigegeben = true;
      try { welt.composer.dispose(); } catch (e) { /* egal */ }
      // (nach einem Kontextverlust nicht noch einmal: three.js warnte dann in der Konsole)
      try {
        welt.renderer.dispose();
        if (!welt.renderer.getContext().isContextLost()) { welt.renderer.forceContextLoss(); }
      } catch (e) { /* egal */ }
      if (leinwand.parentNode) { leinwand.parentNode.removeChild(leinwand); }
    }
  };
}
