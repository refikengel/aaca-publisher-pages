/*
  „Kanäle“ als zweiter Film der Startseite (direkt nach dem Roboter-Film): je Plattform eine eigene
  Szene in deren Stil (TikTok, YouTube, Instagram, Facebook, Pinterest). Beim Scrollen öffnet sich jede
  Szene als Kreis aus ihrem Symbol oben rechts, in der Szene bewegt sich die Oberfläche mit dem Scrollen.

  Dieses Skript liefert nur Zahlen: je Szene --t (Ablauf 0 bis 1) und --wr (Radius der Kreisblende),
  für die Bühne --kopf (Einleitung tritt zurück); alles Sichtbare rechnet das Stylesheet daraus. Nach
  der letzten Szene löst sich die Bühne und scrollt mit der Seite weg.

  Alles hier ist Zusatz: Ohne Skript, bei „Bewegung reduzieren“, erzwungenen Farben, sehr niedrigen
  Fenstern und nach der Pause-Taste bleibt „Kanäle“ eine einfache Liste mit Links. Es wird nichts
  gespeichert, nichts gesendet und nichts nachgeladen. Die Szenen sind Dekoration (aria-hidden); die
  Links bleiben echte Links und sind mit der Tastatur erreichbar (Fokus springt zur passenden Szene).
*/
(function () {
  "use strict";

  var root = document.documentElement;
  function mq(q) { return window.matchMedia ? window.matchMedia(q) : null; }
  var mqReduce = mq("(prefers-reduced-motion: reduce)");
  var mqForced = mq("(forced-colors: active)");
  var mqHoch = mq("(min-height: 32rem)");

  function moeglich() {
    return !(mqReduce && mqReduce.matches) && !(mqForced && mqForced.matches) && !(mqHoch && !mqHoch.matches) &&
      !root.classList.contains("ruhe") && typeof window.requestAnimationFrame === "function";
  }
  // früh setzen (das Skript steht im Kopf), damit die lange Strecke nicht nachträglich springt
  if (moeglich()) { root.classList.add("kanalfilm"); }

  // Ablauf in Bildschirmhöhen, solange die Bühne steht: Einleitung, je Szene L, am Ende ein kurzes Halten
  var INTRO = 0.55, L = 0.9, BLENDE = 0.5, AUSKLANG = 0.2;
  var spur = null, buehne = null, eintraege = [], knoepfe = [];
  var N = 0, H = 1, R = 1, an = false, raf = 0, aktiv = -2, letztesX = null, gemessen = false;

  function klemme(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function weich(x) { x = klemme(x, 0, 1); return x * x * (3 - 2 * x); }
  function lies() { return window.pageYOffset || root.scrollTop || 0; }
  function anfang(i) { return INTRO + i * L; }               // ab hier ist Szene i ganz offen
  function laenge() { return anfang(N - 1) + L + AUSKLANG; }

  // Ausgangspunkte der Kreisblenden (Mitte der Symbole) und Länge der Strecke
  function messen() {
    if (!an) { return; }
    H = Math.max(1, window.innerHeight);
    spur.style.setProperty("--kf-s", (laenge() + 1).toFixed(3));
    var b = buehne.getBoundingClientRect();
    var W = b.width || window.innerWidth;
    R = Math.sqrt(W * W + H * H) + 60;
    for (var i = 0; i < N; i++) {
      var k = knoepfe[i] ? knoepfe[i].getBoundingClientRect() : null;
      var x = k && k.width ? k.left + k.width / 2 - b.left : W * 0.88;
      var y = k && k.height ? k.top + k.height / 2 - b.top : H * 0.14;
      eintraege[i].style.setProperty("--wx", x.toFixed(1) + "px");
      eintraege[i].style.setProperty("--wy", y.toFixed(1) + "px");
    }
    gemessen = true;
    letztesX = null;
  }

  function zeichnen() {
    raf = 0;
    if (!an) { return; }
    if (!gemessen) { messen(); }
    // erst lesen, dann schreiben: Lage der Strecke im Dokument (folgt auch Änderungen weiter oben)
    var x = -spur.getBoundingClientRect().top / H;
    if (x < -1.2 || x > laenge() + 1.2) { return; }           // Bühne außer Sicht: nichts zu tun
    if (letztesX !== null && Math.abs(x - letztesX) < 0.0004) { return; }
    letztesX = x;
    var neuAktiv = -1;
    for (var i = 0; i < N; i++) {
      var e = eintraege[i], a = anfang(i);
      var w = weich((x - (a - BLENDE)) / BLENDE);
      var t = klemme((x - (a - BLENDE)) / (L + BLENDE), 0, 1);
      var weiter = i + 1 < N ? weich((x - (anfang(i + 1) - BLENDE)) / BLENDE) : 0;
      e.style.setProperty("--t", t.toFixed(4));
      e.style.setProperty("--wr", (w * R).toFixed(1) + "px");
      e.classList.toggle("voll", w >= 1);
      e.classList.toggle("zu", w <= 0);
      e.classList.toggle("bedeckt", weiter >= 1);
      if (w > 0.5) { neuAktiv = i; }
    }
    buehne.style.setProperty("--kopf", weich((x - (INTRO - BLENDE)) / BLENDE).toFixed(4));
    if (neuAktiv !== aktiv) {
      aktiv = neuAktiv;
      buehne.setAttribute("data-aktiv", aktiv >= 0 ? (eintraege[aktiv].getAttribute("data-kanal") || "") : "");
      for (var j = 0; j < knoepfe.length; j++) {
        if (j === aktiv) { knoepfe[j].setAttribute("aria-current", "true"); } else { knoepfe[j].removeAttribute("aria-current"); }
      }
    }
  }

  function planen() { if (an && !raf) { raf = window.requestAnimationFrame(zeichnen); } }

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
    N = eintraege.length;
    if (!spur || !buehne || !N) { root.classList.remove("kanalfilm"); return; }
    root.classList.add("kanalfilm");
    an = true;
    gemessen = false;
    aktiv = -2;
    // Bilder der Szenen vorab dekodieren, damit das erste Öffnen einer Szene nicht stockt
    [].forEach.call(buehne.querySelectorAll("img"), function (b) { if (b.decode) { b.decode().catch(function () {}); } });
    messen();
    zeichnen();
  }

  function ausschalten() {
    an = false;
    if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
    root.classList.remove("kanalfilm");
    eintraege.forEach(function (e) {
      ["--t", "--wr", "--wx", "--wy"].forEach(function (n) { e.style.removeProperty(n); });
      e.classList.remove("voll", "zu", "bedeckt");
    });
    knoepfe.forEach(function (k) { k.removeAttribute("aria-current"); });
    if (buehne) { buehne.style.removeProperty("--kopf"); buehne.removeAttribute("data-aktiv"); }
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
    window.addEventListener("scroll", planen, { passive: true });
    window.addEventListener("resize", function () { if (an) { gemessen = false; planen(); } });
    window.addEventListener("load", function () { if (an) { gemessen = false; planen(); } });
    document.addEventListener("bewegung", steuern);
    [mqReduce, mqForced, mqHoch].forEach(function (q) { if (q && q.addEventListener) { q.addEventListener("change", steuern); } });
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
