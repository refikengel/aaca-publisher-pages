/*
  Gemeinsames Skript für thermup.de: Sprachschalter, Kopfzeile, Einblenden, Pause.

  Alles hier ist Zusatz. Ohne dieses Skript bleibt jede Seite vollständig
  lesbar (dann stehen Deutsch und Englisch untereinander). Es wird nichts
  gespeichert (kein localStorage, keine Cookies), nichts gesendet und nichts
  nachgeladen. Bewegung folgt der Einstellung „Bewegung reduzieren“ und lässt
  sich über die Pause-Taste anhalten.
*/
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function reduziert() { return !!(mqReduce && mqReduce.matches) || root.classList.contains("ruhe"); }
  function neu(tag, klasse) { var e = document.createElement(tag); if (klasse) { e.className = klasse; } return e; }
  function sicher(fn) { try { fn(); } catch (fehler) { /* Zusatzfunktionen dürfen die Seite nie stören */ } }
  function bewegungGeaendert() { document.dispatchEvent(new Event("bewegung")); }

  function bereit(fn) {
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", fn); } else { fn(); }
  }

  /* ------------------------------------------------ eigener Scrollbereich */

  // Auf Handys und Tablets scrollt die Seite in einem eigenen Bereich (der Rahmen #bereich um den Inhalt) statt im
  // Fenster. Dann klappt der Browser seine Leisten beim Wischen nicht auf und zu: Das Fenster behält seine Größe,
  // nichts verschiebt sich, und Film und Kanäle müssen sich nicht neu einstellen (Refik, 30.10.2026: beim
  // Zurückwischen klappte die Leiste auf, Fenster und Bildausschnitt stellten sich neu ein). Am Handy gemessen in
  // Chrome, Brave und DuckDuckGo: Scrollt das Fenster, springt seine Höhe beim Wischen zwischen zwei Werten hin und
  // her, im eigenen Bereich nie. Der Bereich endet einen Pixel über dem unteren Rand (Stylesheet): Einen Bereich in
  // genau Fenstergröße behandelt Chrome wie das Fenster selbst, dann klappten die Leisten wieder. Am Rechner bleibt
  // das Fenster der Scrollbereich (dort klappt nichts, und die Tastatur scrollt auch ohne Fokus). Die übrigen Skripte
  // lesen und setzen die Scrollstelle über window.seite; mit ?scroll=fenster in der Adresse scrollt auch am Handy das
  // Fenster (zum Vergleichen).
  var eigenerBereich = !!(window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches) &&
    !/[?&]scroll=fenster(?:&|#|$)/.test(window.location.search);
  if (eigenerBereich) { root.classList.add("eigen-scroll"); }
  var rahmen = null;
  function bereichEl() { return rahmen || (rahmen = document.getElementById("bereich")); }
  var seite = window.seite = {
    eigen: eigenerBereich,
    // was scrollt: Ziel der Ereignisse scroll und von scrollTo
    ziel: function () { return eigenerBereich ? (bereichEl() || window) : window; },
    y: function () {
      if (eigenerBereich) { var b = bereichEl(); return b ? b.scrollTop : 0; }
      return window.pageYOffset || root.scrollTop || 0;
    },
    // sichtbare Höhe des Scrollbereichs
    hoehe: function () { var b = eigenerBereich && bereichEl(); return b ? b.clientHeight : window.innerHeight; },
    nach: function (top, art) {
      var z = seite.ziel();
      if (z && z.scrollTo) { z.scrollTo({ top: top, left: 0, behavior: art || "instant" }); }
    }
  };

  // Beim Neuladen stellt der Browser die Scrollstelle des Fensters selbst wieder her, die eines eigenen Bereichs
  // nicht. Darum steht die Stelle im Verlaufseintrag dieses Tabs (history.state, dort, wo der Browser auch die
  // Scrollstelle des Fensters führt; kein Cookie, kein localStorage, nichts gesendet) und wird beim Neuladen und
  // beim Zurückkehren wieder gesetzt.
  function stelleMerken() {
    if (!eigenerBereich || !window.history || !window.history.replaceState) { return; }
    try {
      var alt = window.history.state, neuStand = {};
      if (alt && typeof alt === "object") { for (var k in alt) { if (Object.prototype.hasOwnProperty.call(alt, k)) { neuStand[k] = alt[k]; } } }
      neuStand.seiteY = Math.round(seite.y());
      window.history.replaceState(neuStand, "");
    } catch (fehler) { /* dann beginnt die Seite oben */ }
  }
  function initStelle() {
    if (!eigenerBereich) { return; }
    var s = window.history && window.history.state, y = s && typeof s.seiteY === "number" ? s.seiteY : 0;
    if (y > 0) {
      seite.nach(y);
      // Bilder und Schrift können die Seite noch verschieben: nach dem Laden einmal nachsetzen, wenn noch niemand
      // gescrollt hat
      var bewegt = false;
      seite.ziel().addEventListener("scroll", function () { bewegt = true; }, { passive: true, once: true });
      window.addEventListener("load", function () { if (!bewegt || Math.abs(seite.y() - y) < 2) { seite.nach(y); } });
    }
    var uhr = 0;
    seite.ziel().addEventListener("scroll", function () {
      window.clearTimeout(uhr);
      uhr = window.setTimeout(stelleMerken, 300);
    }, { passive: true });
    window.addEventListener("pagehide", stelleMerken);
  }

  /* ------------------------------------------------------- Sprachschalter */

  // Genau eine Sprache zeigen. Vorrang hat ?lang=de|en in der Adresse, dann #de/#en (Links auf die
  // Sprachabschnitte), sonst die Sprache des Browsers (Deutsch, wenn sie mit „de“ beginnt, sonst
  // Englisch). Gespeichert wird nichts: Links auf die eigenen Seiten bekommen ?lang= angehängt, damit
  // die Wahl auf der nächsten Seite gilt. Seiten mit beiden Sprachen tragen data-sprachen="de en";
  // auf rein deutschen Seiten (Impressum, Datenschutz) wechseln nur Kopf- und Fußzeile.
  var sprache = (function () {
    var m = /[?&]lang=(de|en)(?:&|#|$)/.exec(window.location.search);
    if (m) { return m[1]; }
    var h = window.location.hash;
    if (h === "#de" || h === "#en") { return h.slice(1); }
    var l = (navigator.languages && navigator.languages[0]) || navigator.language || "de";
    return /^de/i.test(l) ? "de" : "en";
  })();
  var zweisprachig = /\ben\b/.test(root.getAttribute("data-sprachen") || "");

  // sofort setzen (das Skript steht im Kopf): so erscheint nie kurz die andere Sprache
  root.setAttribute("data-sprache", sprache);
  if (zweisprachig) { root.lang = sprache; }

  function linksAnpassen() {
    if (window.location.protocol === "file:" || !window.URL) { return; }
    [].forEach.call(document.querySelectorAll("a[href]"), function (a) {
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || href.charAt(0) === "?") { return; }
      var u;
      try { u = new URL(href, window.location.href); } catch (fehler) { return; }
      if (u.origin !== window.location.origin || !/(\.html|\/)$/.test(u.pathname)) { return; }
      u.searchParams.set("lang", sprache);
      a.setAttribute("href", u.pathname + u.search + u.hash);
    });
  }

  function adresseAnpassen() {
    if (window.location.protocol === "file:" || !window.URL || !window.history || !window.history.replaceState) { return; }
    try {
      var u = new URL(window.location.href);
      u.searchParams.set("lang", sprache);
      if (u.hash === "#de" || u.hash === "#en") { u.hash = ""; }
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (fehler) { /* Adresse bleibt, wie sie ist */ }
  }

  function spracheAnwenden() {
    root.setAttribute("data-sprache", sprache);
    if (zweisprachig) { root.lang = sprache; }
    var titel = root.getAttribute("data-titel-" + sprache);
    if (titel) { document.title = titel; }
    // Beschriftungen ohne sichtbaren Text (aria-label, title) in der gewählten Sprache
    [].forEach.call(document.querySelectorAll("[data-label-" + sprache + "]"), function (e) {
      var t = e.getAttribute("data-label-" + sprache);
      e.setAttribute("aria-label", t);
      if (e.hasAttribute("title")) { e.setAttribute("title", t); }
    });
    [].forEach.call(document.querySelectorAll(".sprachwahl [hreflang]"), function (a) {
      if (a.getAttribute("hreflang") === sprache) { a.setAttribute("aria-current", "true"); } else { a.removeAttribute("aria-current"); }
    });
    linksAnpassen();
    document.dispatchEvent(new Event("sprache"));
  }

  function initSprache() {
    [].forEach.call(document.querySelectorAll(".sprachwahl [hreflang]"), function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var wahl = a.getAttribute("hreflang");
        if (wahl !== "de" && wahl !== "en") { return; }
        if (wahl !== sprache) {
          sprache = wahl;
          spracheAnwenden();
        }
        adresseAnpassen();
      });
    });
    spracheAnwenden();
  }

  /* ----------------------------------------------- Kopfzeile, Nach-oben-Knopf */

  function initScroll() {
    var kopf = document.querySelector(".site-header");
    // Höhe der Kopfzeile als --kopf-ist: Im eigenen Scrollbereich liegt sie über dem Film, ohne fest zu sein
    // (Stylesheet, html.eigen-scroll.film-an .site-header)
    if (kopf && eigenerBereich) {
      var kopfHoehe = function () { root.style.setProperty("--kopf-ist", kopf.offsetHeight + "px"); };
      kopfHoehe();
      if (window.ResizeObserver) { new ResizeObserver(kopfHoehe).observe(kopf); } else { window.addEventListener("resize", kopfHoehe); }
    }
    var oben = neu("button", "nach-oben");
    oben.type = "button";
    oben.setAttribute("data-label-de", "Nach oben");
    oben.setAttribute("data-label-en", "Back to top");
    oben.setAttribute("aria-label", sprache === "en" ? "Back to top" : "Nach oben");
    oben.title = oben.getAttribute("aria-label");
    oben.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
    document.body.appendChild(oben);

    // Die Scrollstelle wird im Scroll-Ereignis gelesen, angewandt erst im nächsten Bild: Läuft der Film, schreibt er
    // in jedem Bild Stile, bevor dieser Rückruf drankommt; hier gelesen zwänge das den Browser zu einer zusätzlichen
    // Stilberechnung je Bild (am Handy gemessen rund 5 % der Scrollzeit). Im Ereignis ist noch nichts geschrieben.
    // Auf Handys und Tablets (eigener Scrollbereich) erscheint „Nach oben“ nur beim Zurückwischen und geht 2,5 Sekunden
    // danach wieder: Beim Lesen (Wischen nach unten) lag der Knopf sonst dauernd über dem Text (am Handy gesehen).
    var geplant = false, y = 0, yVorher = 0, hochBis = 0, uhrOben = 0;
    function lesen() { y = seite.y(); }
    function messen() {
      geplant = false;
      if (kopf) { kopf.classList.toggle("is-scrolled", y > 8); }
      if (eigenerBereich) {
        if (y < yVorher - 4) {
          hochBis = Date.now() + 2500;
          window.clearTimeout(uhrOben);
          uhrOben = window.setTimeout(planen, 2600);
        } else if (y > yVorher + 4) { hochBis = 0; }
        if (Math.abs(y - yVorher) > 4) { yVorher = y; }
        oben.classList.toggle("sichtbar", y > 900 && Date.now() < hochBis);
      } else {
        oben.classList.toggle("sichtbar", y > 900);
      }
    }
    function planen() { lesen(); if (!geplant) { geplant = true; window.requestAnimationFrame(messen); } }
    seite.ziel().addEventListener("scroll", planen, { passive: true });
    window.addEventListener("resize", planen);
    oben.addEventListener("click", function () {
      seite.ziel().scrollTo({ top: 0, behavior: reduziert() ? "auto" : "smooth" });
    });
    lesen();
    messen();
  }

  /* ----------------------------------------------- Einblenden beim Scrollen */

  // Erst beim ersten Scrollen werden nur Elemente unterhalb des sichtbaren
  // Bereichs vorbereitet. Wer nicht scrollt (auch Prüfwerkzeuge), sieht alles.
  function initReveal() {
    var elemente = [].slice.call(document.querySelectorAll("[data-reveal]"));
    if (!elemente.length || !("IntersectionObserver" in window)) { return; }
    var scharf = false;
    function scharfStellen() {
      if (scharf || reduziert()) { return; }
      scharf = true;
      try {
        var beobachter = new IntersectionObserver(function (eintraege) {
          eintraege.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add("is-visible"); beobachter.unobserve(e.target); }
          });
        }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
        var h = seite.hoehe();
        elemente.forEach(function (e) {
          if (e.getBoundingClientRect().top > h * 0.98) { e.classList.add("is-armed"); beobachter.observe(e); }
        });
      } catch (fehler) {
        elemente.forEach(function (e) { e.classList.add("is-visible"); });
      }
    }
    seite.ziel().addEventListener("scroll", scharfStellen, { passive: true, once: true });
  }

  /* ------------------------------------------------------------ Pause-Taste */

  function initPause() {
    var knopf = document.querySelector(".pause");
    if (!knopf) { return; }
    // Die Filme laufen bei „Bewegung reduzieren“ gedämpft weiter (film.js): Die Taste bleibt, sie schaltet sie
    // ab. Nur mit der Einstellung „aus“ (data-reduziert) bewegt sich dann nichts und die Taste entfällt, bis
    // der Besucher „Film trotzdem starten“ klickt.
    function anzeigen() {
      knopf.hidden = !!(mqReduce && mqReduce.matches) && root.getAttribute("data-reduziert") === "aus" &&
        !root.classList.contains("film-erzwungen");
    }
    anzeigen();
    document.addEventListener("film-erzwungen", anzeigen);
    knopf.addEventListener("click", function () {
      var an = root.classList.toggle("ruhe");
      knopf.setAttribute("aria-pressed", an ? "true" : "false");
      bewegungGeaendert();
    });
    if (mqReduce && mqReduce.addEventListener) {
      mqReduce.addEventListener("change", function () { anzeigen(); bewegungGeaendert(); });
    }
  }

  bereit(function () {
    // ohne Rahmen (eine Seite ohne #bereich) bleibt das Fenster der Scrollbereich, sonst ließe sich nichts scrollen
    if (eigenerBereich && !bereichEl()) { eigenerBereich = seite.eigen = false; root.classList.remove("eigen-scroll"); }
    sicher(initStelle);
    sicher(initScroll);
    sicher(initSprache);
    sicher(initReveal);
    sicher(initPause);
  });
})();
