/*
  Start des Films auf der Startseite von thermup.de.

  Dieses kleine Skript läuft früh im Kopf der Seite: Es prüft, ob der Film möglich ist (WebGL 2,
  keine Einstellung „Bewegung reduzieren“, keine erzwungenen Farben, Fenster hoch genug, keine
  Pause), setzt dann sofort html.film-an (damit schon der erste Anstrich im Film-Layout steht) und
  lädt den eigentlichen Film als Modul aus film3d/haupt.js. Ist der Film gerade nicht möglich, wird
  nichts geladen; wird er es später (Pause aufgehoben, Einstellung geändert), lädt das Skript ihn
  dann. Schlägt etwas fehl, bleibt die Seite die normale, vollständig lesbare Seite. Geladen werden
  nur eigene Dateien.

  „Film trotzdem starten“: Ist der Film aus, obwohl das Gerät ihn zeigen könnte (bei „Bewegung
  reduzieren“ oder nachdem er wegen zu niedriger Bildrate abgeschaltet wurde), zeigt der Hero einen
  unauffälligen Knopf. Ein Klick startet den Film auf der leichtesten Stufe; er schaltet sich dann nicht
  mehr von selbst ab. Das gilt nur für diesen Besuch: gespeichert wird nichts. Ohne WebGL 2, bei
  erzwungenen Farben, in sehr niedrigen Fenstern und nach der Pause-Taste gibt es den Knopf nicht
  (für die Pause ist die Pause-Taste selbst der Schalter).
*/
(function () {
  "use strict";
  var root = document.documentElement;
  function mq(q) { return window.matchMedia ? window.matchMedia(q) : null; }
  var mqReduce = mq("(prefers-reduced-motion: reduce)");
  var mqForced = mq("(forced-colors: active)");
  var mqHoch = mq("(min-height: 36rem)");

  var erzwungen = false, ausGrund = "", geladen = false, modul = null;

  // technisch möglich: WebGL 2 da, keine erzwungenen Farben, Fenster hoch genug, keine Pause
  function technisch() {
    if (typeof WebGL2RenderingContext === "undefined" || !window.requestAnimationFrame) { return false; }
    if (mqForced && mqForced.matches) { return false; }
    if (mqHoch && !mqHoch.matches) { return false; }
    return !root.classList.contains("ruhe");
  }
  function moeglich() {
    if (!technisch()) { return false; }
    if (erzwungen) { return true; }
    if (ausGrund === "langsam" || ausGrund === "fehler") { return false; }
    return !(mqReduce && mqReduce.matches);
  }
  if (moeglich()) { root.classList.add("film-an"); }

  function zurueck() { root.classList.remove("film-an", "film-bereit"); }

  function laden() {
    if (geladen) { knopfAnpassen(); return; }
    if (!document.getElementById("film") || !moeglich()) { zurueck(); knopfAnpassen(); return; }
    geladen = true;
    root.classList.add("film-an");
    knopfAnpassen();
    try {
      import("./film3d/haupt.js?v=8").then(function (m) {
        modul = m;
        m.start({ erzwungen: erzwungen });
      }, function () { geladen = false; ausGrund = "fehler"; zurueck(); knopfAnpassen(); });
    } catch (fehler) {
      geladen = false;
      ausGrund = "fehler";
      zurueck();
      knopfAnpassen();
    }
  }

  // Knopf „Film trotzdem starten“ mit kurzer Begründung (Text in beiden Sprachen, der Sprachschalter blendet um)
  function knopfAnpassen() {
    var feld = document.getElementById("film-trotzdem");
    if (!feld) { return; }
    var grund = "";
    if (!erzwungen && technisch() && !root.classList.contains("film-an") && document.getElementById("film")) {
      if (ausGrund === "langsam") { grund = "langsam"; }
      else if (mqReduce && mqReduce.matches && ausGrund !== "fehler") { grund = "ruhig"; }
    }
    if (grund) { feld.setAttribute("data-grund", grund); } else { feld.removeAttribute("data-grund"); }
    feld.hidden = !grund;
  }

  function trotzdemStarten() {
    erzwungen = true;
    ausGrund = "";
    root.classList.add("film-erzwungen");
    // die Pause-Taste wird gebraucht, auch bei „Bewegung reduzieren“ (site.js blendet sie dann ein)
    document.dispatchEvent(new Event("film-erzwungen"));
    var feld = document.getElementById("film-trotzdem");
    if (feld) { feld.hidden = true; }
    if (modul) { modul.erzwingen(); } else { laden(); }
    // Fokus auf die Pause-Taste: mit ihr lässt sich der Film wieder anhalten
    var pause = document.querySelector(".pause");
    if (pause && !pause.hidden) { pause.focus(); }
  }

  function bereit() {
    var knopf = document.getElementById("film-trotzdem-knopf");
    if (knopf) { knopf.addEventListener("click", trotzdemStarten); }
    // der Film meldet, wenn er sich abschaltet (Grund: langsam, fehler oder leer)
    document.addEventListener("film-aus", function (e) {
      var g = e && e.detail ? e.detail.grund : "";
      if (g) { ausGrund = g; }
      knopfAnpassen();
    });
    laden();
    // später möglich geworden (Pause aufgehoben, Einstellung geändert): dann erst laden
    document.addEventListener("bewegung", laden);
    [mqReduce, mqForced, mqHoch].forEach(function (m) { if (m && m.addEventListener) { m.addEventListener("change", laden); } });
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", bereit); } else { bereit(); }
})();
