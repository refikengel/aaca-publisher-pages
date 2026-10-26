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
    var oben = neu("button", "nach-oben");
    oben.type = "button";
    oben.setAttribute("data-label-de", "Nach oben");
    oben.setAttribute("data-label-en", "Back to top");
    oben.setAttribute("aria-label", sprache === "en" ? "Back to top" : "Nach oben");
    oben.title = oben.getAttribute("aria-label");
    oben.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
    document.body.appendChild(oben);

    var geplant = false;
    function messen() {
      geplant = false;
      var y = window.pageYOffset || root.scrollTop || 0;
      if (kopf) { kopf.classList.toggle("is-scrolled", y > 8); }
      oben.classList.toggle("sichtbar", y > 900);
    }
    function planen() { if (!geplant) { geplant = true; window.requestAnimationFrame(messen); } }
    window.addEventListener("scroll", planen, { passive: true });
    window.addEventListener("resize", planen);
    oben.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduziert() ? "auto" : "smooth" });
    });
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
        var h = window.innerHeight;
        elemente.forEach(function (e) {
          if (e.getBoundingClientRect().top > h * 0.98) { e.classList.add("is-armed"); beobachter.observe(e); }
        });
      } catch (fehler) {
        elemente.forEach(function (e) { e.classList.add("is-visible"); });
      }
    }
    window.addEventListener("scroll", scharfStellen, { passive: true, once: true });
  }

  /* ------------------------------------------------------------ Pause-Taste */

  function initPause() {
    var knopf = document.querySelector(".pause");
    if (!knopf) { return; }
    // bei „Bewegung reduzieren“ bewegt sich nichts, die Taste entfällt; hat der Besucher den Film trotzdem
    // gestartet („Film trotzdem starten“, film.js), braucht er sie zum Anhalten
    function anzeigen() { knopf.hidden = !!(mqReduce && mqReduce.matches) && !root.classList.contains("film-erzwungen"); }
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
    sicher(initScroll);
    sicher(initSprache);
    sicher(initReveal);
    sicher(initPause);
  });
})();
