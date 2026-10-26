/*
  Bewegung im Text der Startseite von thermup.de, angelehnt an die Bauweise von anime.js
  (Text in Zeichen und Wörter teilen, gestaffelt einblenden, Linien zeichnen, Knöpfe
  folgen dem Zeiger mit Trägheit), aber als kleines eigenes Skript ohne fremden Code.

  Alles hier ist Zusatz: Ohne dieses Skript bleibt jeder Text normal lesbar. Für
  Hilfstechnik bleibt der Originaltext erhalten (unsichtbare Kopie, die geteilten
  Buchstaben sind ausgeblendet). Bei „Bewegung reduzieren“ und nach der Pause-Taste
  bewegt sich nichts. Es wird nichts gespeichert, nichts gesendet, nichts nachgeladen.
*/
(function () {
  "use strict";

  var root = document.documentElement;
  var mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var mqFein = window.matchMedia ? window.matchMedia("(hover: hover) and (pointer: fine)") : null;

  function erlaubt() { return !(mqReduce && mqReduce.matches) && !root.classList.contains("ruhe"); }
  // früh setzen, damit geteilter Text nicht erst kurz aufblitzt; bei jedem Fehler wieder weg
  if (erlaubt()) { root.classList.add("bewegt"); }
  var sicherung = window.setTimeout(function () { if (!root.classList.contains("geteilt")) { root.classList.remove("bewegt"); } }, 2500);

  function neu(tag, klasse) { var e = document.createElement(tag); if (klasse) { e.className = klasse; } return e; }

  // teilt den Text eines Elements in Wörter (art "w") oder Zeichen (art "z"), mit Maske je Teil.
  // Der Originaltext bleibt als unsichtbare Kopie für Hilfstechnik erhalten.
  function teile(el, art, start) {
    if (!el || el.getAttribute("data-geteilt")) { return start || 0; }
    var text = el.textContent.replace(/\s+/g, " ").trim();
    if (!text) { return start || 0; }
    var i = start || 0;
    var kopie = neu("span", "nur-sr");
    kopie.textContent = text;
    var sicht = neu("span", "teil");
    sicht.setAttribute("aria-hidden", "true");
    var woerter = text.split(" ");
    woerter.forEach(function (wort, wi) {
      if (art === "z") {
        var wortHuelle = neu("span", "wort");
        for (var c = 0; c < wort.length; c++) {
          var m = neu("span", "maske"), z = neu("span", "stueck");
          z.textContent = wort.charAt(c);
          z.style.setProperty("--i", String(i++));
          m.appendChild(z); wortHuelle.appendChild(m);
        }
        sicht.appendChild(wortHuelle);
      } else {
        var mw = neu("span", "maske"), w = neu("span", "stueck");
        w.textContent = wort;
        w.style.setProperty("--i", String(i++));
        mw.appendChild(w); sicht.appendChild(mw);
      }
      if (wi < woerter.length - 1) { sicht.appendChild(document.createTextNode(" ")); }
    });
    el.textContent = "";
    el.appendChild(kopie);
    el.appendChild(sicht);
    el.setAttribute("data-geteilt", "1");
    return i;
  }

  // teilt die Sprachteile eines Elements einzeln (span[lang]) oder das Element selbst
  function teileSprachen(el, art) {
    var teile_ = el.querySelectorAll("span[lang]");
    if (teile_.length) { [].forEach.call(teile_, function (t) { teile(t, art, 0); }); } else { teile(el, art, 0); }
  }

  /* ------------------------------------------------------------- Einstieg im Hero */

  function hero() {
    var h1 = document.querySelector(".hero h1");
    var text = document.querySelector(".hero-text");
    if (!h1 || !text) { return; }
    teile(h1, "z", 0);
    var kinder = text.children;
    for (var k = 0; k < kinder.length; k++) { kinder[k].style.setProperty("--j", String(k)); }
    // zwei Bilder warten, dann läuft der Einstieg (Schriften sind dann meist geladen)
    var los = function () { text.classList.add("ein"); };
    window.requestAnimationFrame(function () { window.requestAnimationFrame(los); });
    window.setTimeout(los, 700);   // falls Bilder gedrosselt laufen (Hintergrund-Tab): der Text erscheint trotzdem
  }

  /* ------------------------------------------------- Überschriften, Gruppen, Linien */

  function abschnitte() {
    var koepfe = document.querySelectorAll(".abschnitt-kopf h2, .sprachblock h2.titel");
    [].forEach.call(koepfe, function (h) { teileSprachen(h, "w"); });
    // Gruppen gestaffelt: Stationen, Kanäle, Fakten
    [".weg .station", ".kanaele li", ".fakten li"].forEach(function (sel) {
      [].forEach.call(document.querySelectorAll(sel), function (el, i) { el.style.setProperty("--i", String(i % 6)); });
    });
    if (!("IntersectionObserver" in window)) { [].forEach.call(koepfe, function (h) { h.classList.add("sichtbar"); }); return; }
    var beob = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("sichtbar"); beob.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.2 });
    [].forEach.call(koepfe, function (h) {
      // was schon im Bild steht, erscheint sofort (auch für Prüfwerkzeuge ohne Scrollen)
      if (h.getBoundingClientRect().top < window.innerHeight * 0.9) { h.classList.add("sichtbar"); } else { beob.observe(h); }
    });
  }

  // Titel der Filmkapitel: Wörter steigen mit dem Scrollen aus ihrer Maske (gekoppelt an --in/--out)
  function filmTitel() {
    [].forEach.call(document.querySelectorAll(".kap-titel"), function (t) { teileSprachen(t, "w"); });
  }

  /* ------------------------------------------------ Knöpfe folgen dem Zeiger */

  function magnet() {
    if (!mqFein || !mqFein.matches) { return; }
    [].forEach.call(document.querySelectorAll(".knopf-link"), function (k) {
      k.addEventListener("pointermove", function (e) {
        if (!root.classList.contains("bewegt")) { return; }
        var r = k.getBoundingClientRect();
        var dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        k.style.setProperty("--mx", (dx * 5).toFixed(2) + "px");
        k.style.setProperty("--my", (dy * 4).toFixed(2) + "px");
      });
      k.addEventListener("pointerleave", function () { k.style.setProperty("--mx", "0px"); k.style.setProperty("--my", "0px"); });
    });
  }

  function steuern() {
    root.classList.toggle("bewegt", erlaubt());
  }

  function bereit(fn) {
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", fn); } else { fn(); }
  }

  bereit(function () {
    try {
      hero();
      filmTitel();
      abschnitte();
      magnet();
      root.classList.add("geteilt");
      window.clearTimeout(sicherung);
      document.addEventListener("bewegung", steuern);
      if (mqReduce && mqReduce.addEventListener) { mqReduce.addEventListener("change", steuern); }
    } catch (fehler) {
      // Zusatzfunktionen dürfen die Seite nie stören
      root.classList.remove("bewegt");
    }
  });
})();
