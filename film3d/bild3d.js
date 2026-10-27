/*
  Das 3D-Bild des Films (three.js, Echtzeit): baut Welt, Maschine, Roboter und Szenen, bereitet Shader und
  Texturen vor und zeichnet zum Zustand Z (fahrplan.js) ein Bild in den Kreis. haupt.js lädt dieses Modul
  nur auf Geräten mit schneller Grafik, während der Kreis schon die vorberechnete Bildfolge (folge.js) zeigt;
  beide haben dieselbe Schnittstelle:
    art, leinwand, stufe, setzeStufe(n), groesse(kante, pixeldichte), vorbereiten(nochAn) → Promise (true:
    fertig, false: angehalten, ein neuer Aufruf macht dort weiter), zeichne(Z, zeit, lay), sprache(),
    freigeben(), dauerlauf (die Bildschleife läuft ständig, auch gedämpft), wachsam (Bildrate wird gemessen).
  Die Vorbereitung läuft in kleinen Schritten, einer je Bild, damit die Bildfolge davor flüssig bleibt.
*/
import * as THREE from "../vendor/three/build/three.module.min.js";
// geänderte Module mit Versionsangabe (wie haupt.js in film.js): nach einer Aktualisierung trifft so kein
// zwischengespeichertes altes Modul auf ein neues
import { Welt } from "./welt.js?v=10";
import { grundstoffe, scan, scanSetzen } from "./stoff.js";
import { Roboter } from "./roboter.js";
import { Maschine, ABSTAND } from "./maschine.js";
import { farbeVon } from "./farben.js";
import { szeneStart, szeneThema, szeneSkript } from "./szenen.js";
import { szeneStimme, szeneQuellen, szeneFreigabe, szeneKanaele, szeneZiel } from "./szenen2.js";
import { MITTE, N_SCHICHT } from "./fahrplan.js?v=10";

var PI = Math.PI;
var SZENEN = [szeneStart, szeneThema, szeneSkript, szeneStimme, szeneQuellen, szeneFreigabe, szeneKanaele, szeneZiel];

// den nächsten Schritt erst nach dem nächsten Bild (dazwischen zeichnet die Seite, auch die Bildfolge)
function naechstes(fn) { window.requestAnimationFrame(function () { window.setTimeout(fn, 0); }); }

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

  // welle: nur für die Schleife der Bildfolge (eigene Zeit des Winkens, siehe szeneStart in szenen.js)
  function zeichne(Z, t, lay, welle) {
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
    welt.render(zeit);
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

  // Schritte: Shader der Umgebung anstoßen (sie übersetzen nebenher), Grundstoffe mit Maschine und Roboter, je
  // Szene ein Schritt, dann die Umgebung, die Shader der Szenen Stück für Stück, je Szene ein Bild zum
  // Vorwärmen (lädt Texturen und Instanzdaten hoch, baut Schattenshader)
  var schritte = [], schritt = 0, versteckt = [], umgebung = null;
  schritte.push(function () { umgebung = welt.umgebungVorbereiten(); });
  schritte.push(function () {
    st = grundstoffe();
    maschine = new Maschine();
    welt.szene.add(maschine.gruppe);
    rob = new Roboter(st);
    var schatten = welt.kontaktSchatten(1.3, 1.3, 0.75);
    schatten.position.y = 0.004;
    rob.wurzel.add(schatten);
    kontext = { st: st, welt: welt, rob: rob, scanEbenen: [scan.ebene], scanUniforms: scan.uniforms };
  });
  SZENEN.forEach(function (bauer, i) {
    schritte.push(function () {
      szenen[i] = bauer(kontext);
      maschine.platten[i].add(szenen[i].gruppe);
    });
  });
  // die Umgebung muss stehen, bevor die Shader der Szenen übersetzt werden (sie spiegeln sie)
  schritte.push(function () { return umgebung; });
  schritte.push(function () { welt.umgebungBauen(); });
  schritte.push(shaderPlanen);

  // Art eines Objekts, soweit sie den Shader bestimmt (mit Instanzen, Punkte, Linien, welche Attribute)
  function art(o) {
    var g = o.geometry, morph = g && g.morphAttributes && Object.keys(g.morphAttributes).length ? "+m" : "";
    return (o.isInstancedMesh ? (o.instanceColor ? "ic" : "i") : "") + (o.isSkinnedMesh ? "s" : "") +
      (o.isPoints ? "p" : (o.isLine ? "l" : (o.isSprite ? "t" : "n"))) + ":" + (g ? Object.keys(g.attributes).sort().join(",") : "") + morph;
  }

  // Shader passend zu den Schnittebenen übersetzen (siehe welt.schnittebenen): jede Verbindung aus Stoff und
  // Art des Objekts einmal, mit der Zahl an Ebenen, die der Stoff wirklich hat (Maschine, Staub und
  // Kontaktschatten keine, die Szenen und der Roboter eine, das Skript-Blatt zwei). Früher wurden die Szenen
  // in mehreren Fassungen übersetzt, von denen nur eine gebraucht wird. In Stücken von etwa 12 ms je Schritt;
  // gewartet wird am Ende auf alle.
  function shaderPlanen() {
    var i;
    for (i = 0; i < szenen.length; i++) { szenen[i].gruppe.visible = true; allesZeigen(szenen[i].gruppe, versteckt); }
    maschine.scanner.visible = true;
    maschine.paket.visible = true;
    maschine.schienen.forEach(function (s) { s.schiene.visible = s.schlitten.visible = true; });
    for (i = 0; i < maschine.platten.length; i++) { maschine.platten[i].visible = true; }
    var nachEbenen = [[], [], []], gesehen = {};
    function sammeln(o) {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) { return; }
      var stoffe = Array.isArray(o.material) ? o.material : [o.material], n = 0;
      var schluessel = stoffe.map(function (m) {
        n = Math.max(n, m.clippingPlanes ? m.clippingPlanes.length : 0);
        return m.id;
      }).join(",") + "|" + art(o);
      if (gesehen[schluessel]) { return; }
      gesehen[schluessel] = true;
      nachEbenen[Math.min(2, n)].push(o);
    }
    welt.szene.traverse(sammeln);
    // der Roboter hängt erst an einer Platte, wenn seine Szene dran ist
    if (!rob.wurzel.parent) { rob.wurzel.traverse(sammeln); }
    var stoffe = new Set(), neu = [];
    function stueckweise(n, objekte) {
      var k = 0;
      return function teil() {
        var t0 = performance.now();
        welt.schnittebenen(n);
        while (k < objekte.length && performance.now() - t0 < 12) {
          welt.uebersetzen(objekte[k++]).forEach(function (m) { stoffe.add(m); });
        }
        // nicht fertig: derselbe Schritt gleich noch einmal
        if (k < objekte.length) { schritte.splice(schritt + 1, 0, teil); }
      };
    }
    [0, 2, 1].forEach(function (n) { if (nachEbenen[n].length) { neu.push(stueckweise(n, nachEbenen[n])); } });
    neu.push(function () {
      return welt.warten(stoffe).then(function () { wiederVerstecken(versteckt); });
    });
    for (i = 0; i < N_SCHICHT; i++) { neu.push(vorwaermen.bind(null, i)); }
    neu.push(function () {
      aktiveSzene = -2;
      szeneWechseln(-1);
      scanSetzen(1000, 0);
    });
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
  // ruhe(): wie lange (ms) zuletzt nicht gescrollt wurde; gearbeitet wird nur in Pausen von mindestens 250 ms,
  // damit kein Schritt das Wischen durch die Bildfolge stocken lässt
  function vorbereiten(nochAn, stelle, ruhe) {
    return new Promise(function (fertig, fehlgeschlagen) {
      function weiter() {
        if (freigegeben) { fehlgeschlagen(new Error("freigegeben")); return; }
        if (!nochAn()) { fertig(false); return; }
        if (schritt >= schritte.length) { fertig(true); return; }
        if (ruhe && ruhe() < 250) { window.setTimeout(weiter, 120); return; }
        var r;
        try { r = schritte[schritt](); } catch (e) { fehlgeschlagen(e); return; }
        schritt++;
        if (r && r.then) { r.then(function () { naechstes(weiter); }, fehlgeschlagen); } else { naechstes(weiter); }
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
      try { welt.renderer.dispose(); welt.renderer.forceContextLoss(); } catch (e) { /* egal */ }
      if (leinwand.parentNode) { leinwand.parentNode.removeChild(leinwand); }
    }
  };
}
