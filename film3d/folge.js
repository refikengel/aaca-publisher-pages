/*
  Vorberechnete Bildfolge des Films: das Bild im Kreis für Geräte, die Echtzeit-3D nicht gut schaffen
  (ohne schnelle oder ohne Grafikkarte, sehr schwache Geräte, standardmäßig Touch-Geräte), und auf allen
  übrigen die Überbrückung, bis Echtzeit-3D bereit ist. Die Bilder (assets/film/f000.webp …, Liste und
  Beschriftungen in folge-daten.js, gerendert mit _werkzeuge/bildfolge_rendern.mjs) zeigen den 3D-Kreis
  Schritt für Schritt. Gezeichnet wird auf ein 2D-Canvas, nur wenn sich die Scrollposition ändert, zwischen
  den zwei Nachbarbildern übergeblendet: kein WebGL, kein three.js, keine Dauerschleife. Skala und Texte
  zeichnet weiter haupt.js.

  Geladen wird schrittweise, zuerst nahe der aktuellen Stelle: erst jedes achte Bild, dann jedes vierte, jedes
  zweite, zuletzt alle; bei „Datensparen“ (Save-Data) nur jedes vierte. Als Überbrückung (nurNahe) nur die
  Bilder in der Nähe der aktuellen Stelle, bis vollLaden() gerufen wird. Die Bilder hält der Browser; welche
  er dekodiert behält, entscheidet er selbst (Speicher bleibt begrenzt). Schnittstelle wie bild3d.js.
*/
import { FOLGE } from "./folge-daten.js?v=9";

var GLEICHZEITIG = 4;
// als Überbrückung: so viele Bilder vor und hinter der aktuellen Stelle (16 Bilder je Bildschirmhöhe)
var NAHE = 8;

// leinwand: ein eigenes, frisches Canvas; neuZeichnen(): ein Bild ist da, das besser passt; fehler(): Bilder
// lassen sich nicht laden; optionen.nurNahe: nur als Überbrückung (siehe oben)
export function baue(leinwand, neuZeichnen, fehler, optionen) {
  var ctx = leinwand.getContext("2d", { alpha: false });
  if (!ctx) { throw new Error("kein 2D-Canvas"); }

  var N = FOLGE.anzahl, PRO = FOLGE.proHoehe;
  var datensparen = !!(navigator.connection && navigator.connection.saveData);
  var nurNahe = !!(optionen && optionen.nurNahe), aus = false;
  // feinste Ebene: alle Bilder; bei „Datensparen“ jedes vierte, als Überbrückung jedes zweite (sie dauert nur
  // Sekunden, die Hälfte der Daten reicht)
  var feinste = datensparen ? 4 : (nurNahe ? 2 : 1);
  var bilder = [], fertig = [], angefragt = [], laufend = 0, fehlschlaege = 0, ebene = 8, pos = 0;
  var gezeichnet = { a: -1, b: -1, w: -1, breite: 0 };
  var i;
  for (i = 0; i < N; i++) { bilder.push(null); fertig.push(false); angefragt.push(false); }

  function adresse(k) { return FOLGE.ordner + "f" + ("00" + k).slice(-3) + ".webp"; }

  // nächstes Bild zum Laden: auf der gröbsten noch offenen Ebene das zur aktuellen Stelle nächste
  // (als Überbrückung nur in der Nähe; die Ebenen fangen dann bei jeder Bewegung neu an)
  function naechstesZiel() {
    if (nurNahe) {
      for (var e = 8; e >= feinste; e = e / 2) {
        var best = -1, abstand = 1e9;
        for (var k = Math.max(0, Math.ceil((pos - NAHE) / e) * e); k <= Math.min(N - 1, pos + NAHE); k += e) {
          if (!angefragt[k] && Math.abs(k - pos) < abstand) { best = k; abstand = Math.abs(k - pos); }
        }
        if (best >= 0) { return best; }
      }
      return -1;
    }
    while (ebene >= feinste) {
      var best2 = -1, abstand2 = 1e9;
      for (var k2 = 0; k2 < N; k2 += ebene) {
        if (!angefragt[k2] && Math.abs(k2 - pos) < abstand2) { best2 = k2; abstand2 = Math.abs(k2 - pos); }
      }
      // das letzte Bild gehört zu jeder Ebene (Ende des Films)
      if (best2 < 0 && !angefragt[N - 1]) { best2 = N - 1; }
      if (best2 >= 0) { return best2; }
      ebene = ebene / 2;
    }
    return -1;
  }

  function laden() {
    while (!aus && laufend < GLEICHZEITIG) {
      var k = naechstesZiel();
      if (k < 0) { return; }
      angefragt[k] = true;
      laufend++;
      holen(k);
    }
  }

  function holen(k) {
    var bild = new Image();
    bild.decoding = "async";
    var ende = function (ok) {
      laufend--;
      if (aus) { return; }
      if (ok) {
        bilder[k] = bild;
        fertig[k] = true;
        // passt es besser als das gezeichnete Bild, neu zeichnen
        if (Math.abs(k - pos) < 2.5 || gezeichnet.a < 0) { neuZeichnen(); }
      } else if (++fehlschlaege > 6) {
        fehler();
        return;
      }
      laden();
    };
    // nicht vorab dekodieren (img.decode()): das läuft im Hauptthread (am Rechner etwa 4 ms je Bild, auf einem
    // Handy leicht das Fünffache), für alle Bilder der Folge gleich nach dem Laden der Seite, und der Browser
    // wirft die dekodierten Bilder bald wieder weg. Beim Zeichnen dekodiert er selbst (mit Grafikbeschleunigung
    // in einem Hilfsthread, ohne den Hauptthread aufzuhalten).
    bild.onload = function () { ende(true); };
    bild.onerror = function () { ende(false); };
    bild.src = adresse(k);
  }

  // nächstes fertige Bild bei k, zuerst in Richtung schritt
  function naechstesFertiges(k, schritt) {
    for (var d = 0; d < N; d++) {
      var x = k + d * schritt, y = k - d * schritt;
      if (x >= 0 && x < N && fertig[x]) { return x; }
      if (y >= 0 && y < N && fertig[y]) { return y; }
    }
    return -1;
  }

  // Beschriftungen der Schichten im Überblick zwischen zwei Bildern mitteln (Lage relativ zum Kreis)
  function etiketten(Z, p, lay) {
    var a = Math.floor(p), b = Math.min(N - 1, a + 1), w = p - a;
    var ea = FOLGE.etiketten[a], eb = FOLGE.etiketten[b];
    Z.etiketten = Z.etiketten || [];
    Z.etiketten.length = 0;
    var quelle = ea || eb;
    if (!quelle) { return; }
    for (var n = 0; n < quelle.length; n++) {
      var j = quelle[n][0], x = quelle[n][1], y = quelle[n][2];
      if (ea && eb && eb[n] && eb[n][0] === j) { x = ea[n][1] + (eb[n][1] - ea[n][1]) * w; y = ea[n][2] + (eb[n][2] - ea[n][2]) * w; }
      Z.etiketten[j] = { x: lay.x + x * lay.r, y: lay.y + y * lay.r, j: j };
    }
  }

  function zeichne(Z, zeit, lay) {
    var p = Math.max(0, Math.min(N - 1, Z.s * PRO));
    pos = p;
    etiketten(Z, p, lay);
    var a = naechstesFertiges(Math.floor(p), -1), b = naechstesFertiges(Math.ceil(p), 1);
    if (a < 0) { laden(); return; }
    if (b < 0) { b = a; }
    if (b < a) { var t = a; a = b; b = t; }
    var w = b > a ? Math.max(0, Math.min(1, (p - a) / (b - a))) : 0;
    var breite = leinwand.width;
    // nur zeichnen, wenn sich etwas geändert hat (Bilder, Überblendung, Größe)
    if (a === gezeichnet.a && b === gezeichnet.b && Math.abs(w - gezeichnet.w) < 0.004 && breite === gezeichnet.breite) { laden(); return; }
    gezeichnet = { a: a, b: b, w: w, breite: breite };
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.globalAlpha = 1;
    ctx.drawImage(bilder[a], 0, 0, breite, leinwand.height);
    if (b !== a && w > 0.004) {
      ctx.globalAlpha = w;
      ctx.drawImage(bilder[b], 0, 0, breite, leinwand.height);
      ctx.globalAlpha = 1;
    }
    laden();
  }

  return {
    art: "folge",
    leinwand: leinwand,
    dauerlauf: false,
    wachsam: false,
    stufe: "folge",
    setzeStufe: function () {},
    // Kreis in CSS-Pixeln mal Pixeldichte (bis 3, wie bei Handys), aber nie größer als die Bilder selbst:
    // mehr Pixel als das Bild hat bringen keine Schärfe, nur Arbeit; die Bilder werden dabei weich skaliert
    groesse: function (kante, pixeldichte) {
      var px = Math.max(1, Math.min(FOLGE.kante, Math.round(kante * Math.max(1, Math.min(pixeldichte || 1, 3)))));
      if (leinwand.width !== px) { leinwand.width = leinwand.height = px; gezeichnet.a = -1; }
    },
    // bereit (true), sobald das Bild an der aktuellen Stelle da ist; danach lädt der Rest im Hintergrund.
    // Läuft der Film nicht mehr (nochAn), gleich false.
    vorbereiten: function (nochAn, stelle) {
      pos = Math.max(0, Math.min(N - 1, (stelle ? stelle() : 0) * PRO));
      var start = Math.round(pos);
      return new Promise(function (aufgeloest, abgelehnt) {
        if (!nochAn()) { aufgeloest(false); return; }
        if (fertig[start]) { aufgeloest(true); laden(); return; }
        var probe = new Image();
        probe.onload = function () {
          bilder[start] = probe; fertig[start] = true; angefragt[start] = true;
          aufgeloest(!aus);
          laden();
        };
        probe.onerror = function () { abgelehnt(new Error("Bildfolge nicht ladbar")); };
        angefragt[start] = true;
        probe.src = adresse(start);
      });
    },
    // die Folge bleibt das Bild im Kreis (Echtzeit-3D geht hier nicht): ab jetzt alle Bilder laden
    vollLaden: function () { if (nurNahe) { nurNahe = false; feinste = datensparen ? 4 : 1; laden(); } },
    zeichne: zeichne,
    sprache: function () {},
    // nichts mehr laden, Bilder loslassen, Canvas entfernen
    freigeben: function () {
      aus = true;
      bilder = [];
      fertig = fertig.map(function () { return false; });
      if (leinwand.parentNode) { leinwand.parentNode.removeChild(leinwand); }
    }
  };
}
