/*
  Diagnose-Anzeige für thermup.de, nur mit ?diag in der Adresse (z. B. https://thermup.de/?diag).

  Zeigt unten links, was dieses Gerät aus der Seite macht: Gerät und Browser, welches Bild der Film im Kreis
  zeigt (Echtzeit-3D oder Bildfolge) und warum, wie schnell die Seite lädt und wie viele Bilder pro Sekunde
  sie gerade zeigt, auch beim Scrollen. „Kopieren“ legt alles als Text in die Zwischenablage, damit sich ein
  langsames Gerät genau beschreiben lässt. Es wird nichts gesendet oder gespeichert (die Seite darf per
  Sicherheitsrichtlinie auch gar nichts senden); ohne ?diag wird dieses Skript nie geladen.
*/
(function () {
  "use strict";
  var root = document.documentElement;
  if (document.getElementById("diag")) { return; }

  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "diag.css?v=11";
  document.head.appendChild(link);

  var box = document.createElement("aside");
  box.id = "diag";
  box.setAttribute("aria-label", "Diagnose");
  var pre = document.createElement("pre");
  var bar = document.createElement("div");
  bar.className = "diag-knoepfe";
  var kopieren = document.createElement("button");
  kopieren.type = "button";
  kopieren.textContent = "Kopieren";
  var zu = document.createElement("button");
  zu.type = "button";
  zu.textContent = "×";
  zu.setAttribute("aria-label", "Diagnose schließen");
  bar.appendChild(kopieren);
  bar.appendChild(zu);
  box.appendChild(pre);
  box.appendChild(bar);
  document.body.appendChild(box);

  /* ------------------------------------------------------------------ Bildabstände */
  var zeiten = [];            // alle Bildzeiten der letzten 6 s
  var gescrollt = [];         // Zeitpunkte von Scrollereignissen (nur die letzten 6 s)
  var lange = 0, bilderGes = 0, minAbstand = 1e9, start = performance.now();
  var scrollBilder = [];      // Abstände der Bilder, während gescrollt wurde
  var letzte = 0;
  function bild(t) {
    if (letzte) {
      var d = t - letzte;
      bilderGes++;
      if (d > 50) { lange++; }
      if (d < minAbstand && d > 2) { minAbstand = d; }
      var zuletztScroll = gescrollt.length ? t - gescrollt[gescrollt.length - 1] : 1e9;
      if (zuletztScroll < 200) { scrollBilder.push(d); if (scrollBilder.length > 600) { scrollBilder.shift(); } }
    }
    letzte = t;
    zeiten.push(t);
    while (zeiten.length && t - zeiten[0] > 6000) { zeiten.shift(); }
    window.requestAnimationFrame(bild);
  }
  window.requestAnimationFrame(bild);
  window.addEventListener("scroll", function () {
    var t = performance.now();
    gescrollt.push(t);
    while (gescrollt.length > 300 || (gescrollt.length && t - gescrollt[0] > 6000)) { gescrollt.shift(); }
  }, { passive: true });

  function fpsIn(ms) {
    var jetzt = performance.now(), n = 0, erste = 0, letzteZeit = 0, schlimmster = 0;
    for (var i = zeiten.length - 1; i >= 0; i--) {
      if (jetzt - zeiten[i] > ms) { break; }
      if (letzteZeit) { var d = letzteZeit - zeiten[i]; if (d > schlimmster) { schlimmster = d; } }
      letzteZeit = zeiten[i]; erste = zeiten[i]; n++;
    }
    var spanne = (zeiten.length ? zeiten[zeiten.length - 1] : 0) - erste;
    return { fps: n > 1 && spanne > 0 ? (n - 1) * 1000 / spanne : 0, schlimmster: schlimmster };
  }
  function perz(liste, p) {
    if (!liste.length) { return 0; }
    var s = liste.slice().sort(function (a, b) { return a - b; });
    return s[Math.min(s.length - 1, Math.floor(s.length * p))];
  }

  /* -------------------------------------------------------------------- Gerät */
  function grafik() {
    try {
      var c = document.createElement("canvas");
      var gl = c.getContext("webgl2") || c.getContext("webgl");
      if (!gl) { return "kein WebGL"; }
      var info = gl.getExtension("WEBGL_debug_renderer_info");
      var name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "") : String(gl.getParameter(gl.RENDERER) || "");
      var art = (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext) ? "WebGL 2" : "WebGL 1";
      var frei = gl.getExtension("WEBGL_lose_context");
      if (frei) { frei.loseContext(); }
      return name + " (" + art + ")";
    } catch (e) { return "Fehler: " + e.message; }
  }
  var gpu = grafik();
  function mq(q) { return window.matchMedia ? window.matchMedia(q).matches : false; }
  var n = window.navigator || {}, vb = n.connection || {};
  var geraet = [
    "Browser: " + (n.userAgent || "?"),
    "Kerne: " + (n.hardwareConcurrency || "?") + " | Speicher: " + (n.deviceMemory ? n.deviceMemory + " GB" : "?") + " | Touchpunkte: " + (n.maxTouchPoints || 0),
    "Grafik: " + gpu,
    "Netz: " + (vb.effectiveType || "?") + (vb.downlink ? " " + vb.downlink + " Mbit/s" : "") + (vb.rtt ? " " + vb.rtt + " ms" : "") + (vb.saveData ? " Datensparen" : ""),
    "Einstellungen: Bewegung reduzieren " + (mq("(prefers-reduced-motion: reduce)") ? "AN" : "aus") + ", grobe Eingabe " + (mq("(pointer: coarse)") ? "ja" : "nein") +
      ", hell " + (mq("(prefers-color-scheme: light)") ? "ja" : "nein")
  ];

  /* ------------------------------------------------------------------- Laden */
  var bereitNach = null;
  function bereitPruefen() {
    if (bereitNach === null && root.classList.contains("film-bereit")) { bereitNach = Math.round(performance.now()); }
  }
  bereitPruefen();
  try { new MutationObserver(bereitPruefen).observe(root, { attributes: true, attributeFilter: ["class"] }); } catch (e) { /* ohne */ }
  var lcp = null, fcp = null, cls = 0, loafSumme = 0, loafAnzahl = 0;
  function beobachte(typ, fn) { try { new PerformanceObserver(function (l) { l.getEntries().forEach(fn); }).observe({ type: typ, buffered: true }); } catch (e) { /* nicht unterstützt */ } }
  beobachte("paint", function (e) { if (e.name === "first-contentful-paint") { fcp = Math.round(e.startTime); } });
  beobachte("largest-contentful-paint", function (e) { lcp = Math.round(e.startTime); });
  beobachte("layout-shift", function (e) { if (!e.hadRecentInput) { cls += e.value; } });
  beobachte("long-animation-frame", function (e) { loafAnzahl++; loafSumme += e.duration; });

  function laden() {
    var nav = performance.getEntriesByType("navigation")[0] || {};
    var res = performance.getEntriesByType("resource"), kb = 0, bild = 0;
    res.forEach(function (r) { kb += (r.transferSize || 0) / 1024; if (/\.webp(\?|$)/.test(r.name)) { bild++; } });
    return "Laden: erste Inhalte " + (fcp === null ? "?" : fcp + " ms") + " | größtes Element " + (lcp === null ? "?" : lcp + " ms") +
      " | Seite geladen " + Math.round(nav.loadEventEnd || 0) + " ms | Film bereit " + (bereitNach === null ? "noch nicht" : bereitNach + " ms") +
      "\nÜbertragen: " + Math.round(kb) + " kB in " + res.length + " Dateien (" + bild + " Bilder der Folge)";
  }

  /* ---------------------------------------------------------------- Ausgabe */
  var text = "";
  function film() {
    var a = function (k) { return root.getAttribute(k) || "-"; };
    var zeichen = [].map.call(document.querySelectorAll("canvas"), function (c) {
      var b = c.getBoundingClientRect();
      return c.width + "x" + c.height + "@" + Math.round(b.width) + "x" + Math.round(b.height);
    }).join(", ");
    return "Film: Quelle " + a("data-film-quelle") + " | Stufe " + a("data-film-stufe") + " | Grund " + a("data-film-grund") + " | Rechenfaktor " + a("data-film-faktor") +
      " | an " + root.classList.contains("film-an") + " | bereit " + root.classList.contains("film-bereit") + " | Kanäle-Film " + root.classList.contains("kanalfilm") +
      "\nZeichenflächen: " + zeichen;
  }
  function aktualisieren() {
    var k = fpsIn(1000), l = fpsIn(5000);
    var hz = minAbstand < 1e8 ? Math.round(1000 / minAbstand) : 0;
    var sp = scrollBilder.length ? (1000 / (scrollBilder.reduce(function (s, d) { return s + d; }, 0) / scrollBilder.length)) : 0;
    text = [
      "IT-Engel Diagnose " + new Date().toLocaleTimeString(),
      "Fenster: " + window.innerWidth + "x" + window.innerHeight + " @" + (window.devicePixelRatio || 1) + " | Bildschirm " + (screen.width || "?") + "x" + (screen.height || "?") +
        " | Takt etwa " + (hz || "?") + " Hz",
      film(),
      "Bilder/s: jetzt " + k.fps.toFixed(0) + " | 5 s " + l.fps.toFixed(0) + " | langsamstes Bild 5 s: " + l.schlimmster.toFixed(0) + " ms | über 50 ms: " + lange + " von " + bilderGes,
      "Beim Scrollen: " + (scrollBilder.length ? sp.toFixed(0) + " Bilder/s, 95 % unter " + perz(scrollBilder, 0.95).toFixed(0) + " ms (" + scrollBilder.length + " Bilder)" : "noch nicht gescrollt"),
      "Lange Bilder (Browser-Messung): " + loafAnzahl + (loafAnzahl ? " mit " + Math.round(loafSumme) + " ms gesamt" : ""),
      laden() + " | Layoutsprünge " + cls.toFixed(3),
      geraet.join("\n"),
      "Seite: " + window.location.pathname + window.location.search + " | Sprache " + (root.lang || "?")
    ].join("\n");
    pre.textContent = text;
  }
  aktualisieren();
  window.setInterval(aktualisieren, 500);

  kopieren.addEventListener("click", function () {
    aktualisieren();
    var fertig = function (ok) { kopieren.textContent = ok ? "Kopiert ✓" : "Nicht möglich"; window.setTimeout(function () { kopieren.textContent = "Kopieren"; }, 2000); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { fertig(true); }, function () { fertig(false); }); return; }
    } catch (e) { /* weiter unten */ }
    try {
      var t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "");
      document.body.appendChild(t);
      t.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(t);
      fertig(ok);
    } catch (e) { fertig(false); }
  });
  zu.addEventListener("click", function () { box.remove(); });
})();
