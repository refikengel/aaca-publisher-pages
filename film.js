/*
  Start des Films auf der Startseite von thermup.de (fünfte Fassung).

  Dieses kleine Skript läuft früh im Kopf der Seite: Es prüft, ob der Film möglich ist (WebGL 2,
  keine Einstellung „Bewegung reduzieren“, keine erzwungenen Farben, Fenster hoch genug, keine
  Pause), setzt dann sofort html.film-an (damit schon der erste Anstrich im Film-Layout steht) und
  lädt den eigentlichen Film als Modul aus film3d/haupt.js. Ist der Film gerade nicht möglich, wird
  nichts geladen; wird er es später (Pause aufgehoben, Einstellung geändert), lädt das Skript ihn
  dann. Schlägt etwas fehl, bleibt die Seite die normale, vollständig lesbare Seite. Geladen werden
  nur eigene Dateien.
*/
(function () {
  "use strict";
  var root = document.documentElement;
  function mq(q) { return window.matchMedia ? window.matchMedia(q) : null; }
  var abfragen = [["(prefers-reduced-motion: reduce)", false], ["(forced-colors: active)", false], ["(min-height: 36rem)", true]];
  function moeglich() {
    if (typeof WebGL2RenderingContext === "undefined" || !window.requestAnimationFrame) { return false; }
    for (var i = 0; i < abfragen.length; i++) {
      var m = mq(abfragen[i][0]);
      if (m && m.matches !== abfragen[i][1]) { return false; }
    }
    return !root.classList.contains("ruhe");
  }
  if (moeglich()) { root.classList.add("film-an"); }

  var geladen = false;
  function zurueck() { root.classList.remove("film-an", "film-bereit"); }
  function laden() {
    if (geladen) { return; }
    if (!document.getElementById("film")) { zurueck(); return; }
    if (!moeglich()) { zurueck(); return; }
    geladen = true;
    root.classList.add("film-an");
    try {
      import("./film3d/haupt.js?v=6").then(function (modul) { modul.start(); }, function () { geladen = false; zurueck(); });
    } catch (fehler) {
      geladen = false;
      zurueck();
    }
  }
  function bereit() {
    laden();
    // später möglich geworden (Pause aufgehoben, Einstellung geändert): dann erst laden
    document.addEventListener("bewegung", laden);
    abfragen.forEach(function (a) { var m = mq(a[0]); if (m && m.addEventListener) { m.addEventListener("change", laden); } });
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", bereit); } else { bereit(); }
})();
