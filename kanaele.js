/*
  „Kanäle“ als zweiter Film der Startseite (direkt nach dem Roboter-Film): je Plattform eine eigene
  Szene in deren Stil (TikTok, YouTube, Instagram, Facebook, Pinterest). Beim Scrollen öffnet sich jede
  Szene als Kreis aus ihrem Symbol oben rechts, in der Szene bewegt sich die Oberfläche mit dem Scrollen.

  Dieses Skript liefert nur Zahlen: je Szene --t (Ablauf 0 bis 1, an die Elemente, die ihm folgen) und --wr
  (Radius der Kreisblende), für Kopf und Markenhinweis --kopf (die Einleitung tritt zurück); alles Sichtbare
  rechnet das Stylesheet daraus. Nach der letzten Szene löst sich die Bühne und scrollt mit der Seite weg.

  Der Film läuft unter denselben Bedingungen wie der Hauptfilm (film.js): auf jedem Gerät und in jeder
  Fenstergröße, bei „Bewegung reduzieren“ gedämpft (nur mit dem Scrollen, ohne die kleinen Dauerbewegungen
  in den Szenen, Texte ohne Wandern; das regelt das Stylesheet). Ohne Skript, bei erzwungenen Farben und
  nach der Pause-Taste bleibt „Kanäle“ eine einfache Liste mit Links, mit der Einstellung
  BEI_REDUZIERTER_BEWEGUNG = "aus" in film.js auch bei „Bewegung reduzieren“. Es wird nichts gespeichert,
  nichts gesendet und nichts nachgeladen. Die Szenen sind Dekoration (aria-hidden); die Links bleiben echte
  Links und sind mit der Tastatur erreichbar (Fokus springt zur passenden Szene).

  Sparsam auch auf schwachen Geräten: --t bekommen nur die Elemente, die ihm folgen (MIT_ABLAUF), als Zahl
  ohne Vererbung (Stylesheet), und nur, wenn er sich in ihrem Bereich ändert (--ablauf im Stylesheet); so
  rechnet der Browser je Bild ein bis wenige Elemente neu statt der ganzen Szene samt Symbolen. Eine verdeckte Szene wird nicht nachgeführt, und steht die Bühne
  außer Sicht, ruhen alle Bewegungen in ihr (Klasse ruht); während gescrollt wird, ruhen die kleinen
  Dauerbewegungen (Klasse wischt).
*/
(function () {
  "use strict";

  var root = document.documentElement;
  function mq(q) { return window.matchMedia ? window.matchMedia(q) : null; }
  var mqReduce = mq("(prefers-reduced-motion: reduce)");
  var mqForced = mq("(forced-colors: active)");
  var mqHochformat = mq("(max-aspect-ratio: 11/10)");

  // dieselbe Haltung zu „Bewegung reduzieren“ wie der Hauptfilm (film.js schreibt sie an das Dokument);
  // „Film trotzdem starten“ (Klasse film-erzwungen) gilt auch hier
  function moeglich() {
    var reduziertAus = root.getAttribute("data-reduziert") === "aus" && !root.classList.contains("film-erzwungen");
    return !(reduziertAus && mqReduce && mqReduce.matches) &&
      !(mqForced && mqForced.matches) && !root.classList.contains("ruhe") &&
      typeof window.requestAnimationFrame === "function";
  }
  // früh setzen (das Skript steht im Kopf), damit die lange Strecke nicht nachträglich springt
  if (moeglich()) { root.classList.add("kanalfilm"); }

  // Ablauf in Bildschirmhöhen, solange die Bühne steht: Einleitung, je Szene L, am Ende ein kurzes Halten
  var INTRO = 0.55, L = 0.9, BLENDE = 0.5, AUSKLANG = 0.2;
  // die Elemente, deren Aussehen dem Ablauf --t ihrer Szene folgt (im Stylesheet var(--t) und die daraus
  // berechneten Werte): nur sie bekommen --t, nicht die ganze Szene. Wer im Stylesheet var(--t) neu nutzt,
  // gehört in diese Liste.
  var MIT_ABLAUF = ".kanal-text > *, .kanal-los, .geraet, .tt-video, .tt-like svg, .tt-herzen, .yt-hoch, .yt-quer, " +
    ".yt-balken > i, .yt-balken > b, .ig-ring, .ig-raster i, .ig-herz, .fb-feed, .fb-like, .fb-blase, .pin-wand, " +
    ".pin-frei i, .pin-spalte, .pin-merken > span";
  var spur = null, buehne = null, eintraege = [], knoepfe = [], kopfTeile = [], ablauf = [];
  // je Szene die zuletzt gesetzten Werte (gesetzt wird nur, was sich ändert)
  var stand = [], kopfWert = "", ruht = null, stehtAlt = null, wischt = false, wischUhr = 0;
  var N = 0, H = 1, R = 1, an = false, raf = 0, aktiv = -2, letztesX = null, gemessen = false;

  function klemme(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function weich(x) { x = klemme(x, 0, 1); return x * x * (3 - 2 * x); }
  function lies() { return window.pageYOffset || root.scrollTop || 0; }
  function anfang(i) { return INTRO + i * L; }               // ab hier ist Szene i ganz offen
  function laenge() { return anfang(N - 1) + L + AUSKLANG; }

  // Lage von Symbolen und Gerät aus der echten Kopfzeile: die Symbole stehen mit Abstand darunter, das Gerät
  // mitten im freien Raum unter den Symbolen (im Hochformat bis zum Text der Szene), ohne sie zu berühren;
  // reicht der Platz nicht, wird es kleiner
  function lageMessen() {
    var abstand = 12;
    var kopf = document.querySelector(".site-header");
    var kh = kopf ? kopf.getBoundingClientRect().height : 0;
    buehne.style.setProperty("--kopfzeile", kh.toFixed(1) + "px");
    buehne.style.removeProperty("--gh");
    buehne.style.removeProperty("--geraet-y");
    var b = buehne.getBoundingClientRect();
    var wahl = buehne.querySelector(".kanal-wahl");
    var w = wahl ? wahl.getBoundingClientRect() : null;
    var oben = (w && w.height ? w.bottom - b.top : kh) + abstand, unten = H - abstand;
    var hoch = !!(mqHochformat && mqHochformat.matches);
    if (hoch) {
      for (var i = 0; i < N; i++) {
        var text = eintraege[i].querySelector(".kanal");
        var t = text ? text.getBoundingClientRect() : null;
        if (t && t.height) { unten = Math.min(unten, t.top - b.top - abstand); }
      }
    }
    var geraet = buehne.querySelector(".geraet");
    var gh = geraet ? geraet.offsetHeight : 0;
    if (!gh) { return; }
    if (unten - oben < gh) {
      // in sehr niedrigen Fenstern (Handy quer) nicht kleiner als 120 Pixel
      gh = Math.max(120, unten - oben);
      buehne.style.setProperty("--gh", gh.toFixed(1) + "px");
    }
    var mitte = hoch ? (oben + unten) / 2 : klemme(H * 0.53, oben + gh / 2, Math.max(oben + gh / 2, unten - gh / 2));
    buehne.style.setProperty("--geraet-y", mitte.toFixed(1) + "px");
  }

  // Ausgangspunkte der Kreisblenden (Mitte der Symbole) und Länge der Strecke
  function messen() {
    if (!an) { return; }
    // Höhe der Bühne (100svh), nicht des Fensters: auf Handys ändert sich das Fenster, wenn die Adressleiste
    // ein- und ausfährt, die Strecke aber nicht
    H = Math.max(1, buehne.clientHeight || window.innerHeight);
    spur.style.setProperty("--kf-s", (laenge() + 1).toFixed(3));
    lageMessen();
    var b = buehne.getBoundingClientRect();
    var W = b.width || window.innerWidth;
    R = Math.sqrt(W * W + H * H) + 60;
    for (var i = 0; i < N; i++) {
      var k = knoepfe[i] ? knoepfe[i].getBoundingClientRect() : null;
      var x = k && k.width ? k.left + k.width / 2 - b.left : W * 0.88;
      var y = k && k.height ? k.top + k.height / 2 - b.top : H * 0.14;
      eintraege[i].style.setProperty("--wx", x.toFixed(1) + "px");
      eintraege[i].style.setProperty("--wy", y.toFixed(1) + "px");
      stand[i].wr = "";
    }
    gemessen = true;
    letztesX = null;
  }

  function wert(e, z, name, v) { if (z[name] !== v) { z[name] = v; e.style.setProperty("--" + name, v); } }
  function klasse(e, z, name, ja) { if (z[name] !== ja) { z[name] = ja; e.classList.toggle(name, ja); } }
  // je Element der Bereich von --t, in dem sich dort etwas ändert (--ablauf: von bis, im Stylesheet bei der
  // Formel; ohne Angabe 0 bis 1): außerhalb bleibt der gesetzte Wert stehen
  function bereich(el) {
    var b = (window.getComputedStyle(el).getPropertyValue("--ablauf") || "").trim().split(/\s+/);
    var von = parseFloat(b[0]), bis = parseFloat(b[1]);
    return isFinite(von) && isFinite(bis) && bis > von ? [von, bis] : [0, 1];
  }
  function ablaufSetzen(i, z, t) {
    var v = t.toFixed(4);
    if (z.t === v) { return; }
    z.t = v;
    for (var k = 0; k < ablauf[i].length; k++) {
      var a = ablauf[i][k], w = klemme(t, a.von, a.bis).toFixed(4);
      if (a.wert !== w) { a.wert = w; a.el.style.setProperty("--t", w); }
    }
  }

  function zeichnen() {
    raf = 0;
    if (!an) { return; }
    if (!gemessen) { messen(); }
    // erst lesen, dann schreiben: Lage der Strecke im Dokument (folgt auch Änderungen weiter oben)
    var x = -spur.getBoundingClientRect().top / H;
    // Bühne außer Sicht: alle Bewegungen in ihr ruhen, sonst nichts zu tun; in Sicht (die Bühne steht)
    // entfällt „Nach oben“ (Stylesheet, Klasse kanal-sichtbar)
    var weg = x < -1.2 || x > laenge() + 1.2;
    if (weg !== ruht) { ruht = weg; buehne.classList.toggle("ruht", weg); }
    var steht = x > -0.05 && x < laenge() + 0.05;
    if (steht !== stehtAlt) { stehtAlt = steht; root.classList.toggle("kanal-sichtbar", steht); }
    if (weg) { return; }
    if (letztesX !== null && Math.abs(x - letztesX) < 0.0004) { return; }
    letztesX = x;
    var neuAktiv = -1;
    for (var i = 0; i < N; i++) {
      var e = eintraege[i], z = stand[i], a = anfang(i);
      var w = weich((x - (a - BLENDE)) / BLENDE);
      var t = klemme((x - (a - BLENDE)) / (L + BLENDE), 0, 1);
      var weiter = i + 1 < N ? weich((x - (anfang(i + 1) - BLENDE)) / BLENDE) : 0;
      var bedeckt = weiter >= 1;
      // eine verdeckte Szene muss nicht nachgeführt werden (sie bekommt ihren Wert, sobald sie wieder sichtbar wird)
      if (!bedeckt) { ablaufSetzen(i, z, t); }
      wert(e, z, "wr", (w * R).toFixed(1) + "px");
      klasse(e, z, "voll", w >= 1);
      klasse(e, z, "zu", w <= 0);
      klasse(e, z, "bedeckt", bedeckt);
      if (w > 0.5) { neuAktiv = i; }
    }
    var kopf = weich((x - (INTRO - BLENDE)) / BLENDE).toFixed(4);
    if (kopf !== kopfWert) {
      kopfWert = kopf;
      for (var k = 0; k < kopfTeile.length; k++) { kopfTeile[k].style.setProperty("--kopf", kopf); }
    }
    if (neuAktiv !== aktiv) {
      aktiv = neuAktiv;
      buehne.setAttribute("data-aktiv", aktiv >= 0 ? (eintraege[aktiv].getAttribute("data-kanal") || "") : "");
      for (var j = 0; j < knoepfe.length; j++) {
        if (j === aktiv) { knoepfe[j].setAttribute("aria-current", "true"); } else { knoepfe[j].removeAttribute("aria-current"); }
      }
    }
  }

  function planen() { if (an && !raf) { raf = window.requestAnimationFrame(zeichnen); } }

  // Während gescrollt wird, ruhen die kleinen Dauerbewegungen der Szenen (Goldstaub, Platte, Herzen, Schweben;
  // Stylesheet, Klasse wischt): der Browser rechnete sie sonst in jedem Bild mit (gemessen: etwa zwei Drittel der
  // Stilarbeit beim Wischen). Eine Fünftelsekunde nach dem letzten Scrollen laufen sie weiter. Gedämpft laufen
  // sie ohnehin nicht.
  function wischen() {
    if (!an || ruht !== false || (mqReduce && mqReduce.matches)) { return; }
    if (!wischt) { wischt = true; buehne.classList.add("wischt"); }
    window.clearTimeout(wischUhr);
    wischUhr = window.setTimeout(function () { wischt = false; if (buehne) { buehne.classList.remove("wischt"); } }, 200);
  }

  // zu Szene i springen (sofort, wie die übrigen Sprungmarken der Seite)
  function springe(i) {
    var top = spur.getBoundingClientRect().top + lies();
    window.scrollTo({ top: Math.round(top + (anfang(i) + 0.12) * H), left: 0, behavior: "instant" });
  }

  function einschalten() {
    if (an) { return; }
    spur = document.getElementById("kanalfilm");
    buehne = spur && spur.querySelector(".kanal-buehne");
    eintraege = buehne ? [].slice.call(buehne.querySelectorAll(".kanal-eintrag")) : [];
    knoepfe = buehne ? [].slice.call(buehne.querySelectorAll(".kanal-wahl a")) : [];
    kopfTeile = buehne ? [].slice.call(buehne.querySelectorAll(".kanal-kopf, .kanal-hinweis")) : [];
    ablauf = eintraege.map(function (e) {
      return [].slice.call(e.querySelectorAll(MIT_ABLAUF)).map(function (el) {
        var b = bereich(el);
        return { el: el, von: b[0], bis: b[1], wert: "" };
      });
    });
    N = eintraege.length;
    if (!spur || !buehne || !N) { root.classList.remove("kanalfilm"); return; }
    root.classList.add("kanalfilm");
    an = true;
    gemessen = false;
    aktiv = -2;
    kopfWert = "";
    // bis zur ersten Rechnung gelten alle Szenen als zu (ihre Bewegungen ruhen) und die Bühne als außer Sicht
    stand = eintraege.map(function (e) {
      e.classList.add("zu");
      return { t: "", wr: "", voll: false, zu: true, bedeckt: false };
    });
    ruht = true;
    buehne.classList.add("ruht");
    // Bilder der Szenen vorab dekodieren, damit das erste Öffnen einer Szene nicht stockt
    [].forEach.call(buehne.querySelectorAll("img"), function (b) { if (b.decode) { b.decode().catch(function () {}); } });
    messen();
    zeichnen();
  }

  function ausschalten() {
    an = false;
    if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
    root.classList.remove("kanalfilm", "kanal-sichtbar");
    stehtAlt = null;
    eintraege.forEach(function (e) {
      ["--wr", "--wx", "--wy"].forEach(function (n) { e.style.removeProperty(n); });
      e.classList.remove("voll", "zu", "bedeckt");
    });
    ablauf.forEach(function (liste) { liste.forEach(function (a) { a.el.style.removeProperty("--t"); }); });
    stand = [];
    kopfTeile.forEach(function (k) { k.style.removeProperty("--kopf"); });
    knoepfe.forEach(function (k) { k.removeAttribute("aria-current"); });
    if (buehne) {
      ["--kopfzeile", "--gh", "--geraet-y"].forEach(function (n) { buehne.style.removeProperty(n); });
      buehne.removeAttribute("data-aktiv");
      buehne.classList.remove("ruht", "wischt");
    }
    window.clearTimeout(wischUhr);
    wischt = false;
    if (spur) { spur.style.removeProperty("--kf-s"); }
  }

  function steuern() {
    try {
      if (moeglich()) { einschalten(); } else { ausschalten(); }
    } catch (fehler) {
      // der Film darf die Seite nie stören: im Zweifel die einfache Liste
      ausschalten();
    }
  }

  function bereit(fn) {
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", fn); } else { fn(); }
  }

  bereit(function () {
    steuern();
    window.addEventListener("scroll", function () { planen(); wischen(); }, { passive: true });
    window.addEventListener("resize", function () { if (an) { gemessen = false; planen(); } });
    window.addEventListener("load", function () { if (an) { gemessen = false; planen(); } });
    document.addEventListener("bewegung", steuern);
    document.addEventListener("film-erzwungen", steuern);
    // Änderungen über eigene Abfragen, die sonst niemand liest (Chrome meldet eine Änderung nicht, wenn dieselbe
    // Abfrage vorher schon gelesen wurde; wischen() liest mqReduce bei jedem Scrollen)
    [mq("(prefers-reduced-motion: reduce)"), mq("(forced-colors: active)")].forEach(function (q) {
      if (q && q.addEventListener) { q.addEventListener("change", steuern); }
    });
    // die Symbole oben rechts springen zur Szene; Tastatur: Fokus in einer Szene holt sie nach vorn
    document.addEventListener("click", function (ev) {
      if (!an || !ev.target.closest) { return; }
      var k = ev.target.closest(".kanal-wahl a");
      var i = k ? knoepfe.indexOf(k) : -1;
      if (i >= 0) { ev.preventDefault(); springe(i); }
    });
    document.addEventListener("focusin", function (ev) {
      if (!an || !ev.target.closest) { return; }
      var e = ev.target.closest(".kanal-eintrag");
      var i = e ? eintraege.indexOf(e) : -1;
      if (i >= 0 && i !== aktiv) { springe(i); }
    });
  });
})();
