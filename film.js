/*
  Start des Films auf der Startseite von thermup.de.

  Dieses kleine Skript läuft früh im Kopf der Seite: Es setzt sofort html.film-an (damit schon der erste
  Anstrich im Film-Layout steht) und lädt den eigentlichen Film als Modul aus film3d/haupt.js. Der Film
  läuft auf jedem Gerät und in jeder Fenstergröße; welches Bild im Kreis entsteht (Echtzeit-3D oder die
  vorberechnete Bildfolge), wählt haupt.js selbst. Keinen Film gibt es nur ohne Skript, bei erzwungenen
  Farben (Kontrastmodus), ohne Canvas und nach der Pause-Taste: Dann bleibt die Seite die normale,
  vollständig lesbare Seite. Geladen werden nur eigene Dateien.

  „Film trotzdem starten“ ist nur noch ein Notausgang: Der Hero zeigt den Knopf, wenn der Film aus
  technischen Gründen ausgefallen ist (Dateien nicht ladbar, Fehler im Skript) und, nur mit der Einstellung
  BEI_REDUZIERTER_BEWEGUNG = "aus", bei „Bewegung reduzieren“. Ein Klick startet den Film neu; das gilt nur
  für diesen Besuch, gespeichert wird nichts.
*/
(function () {
  "use strict";
  var root = document.documentElement;

  /* --------------------------------------------------------------- Einstellungen

     BEI_REDUZIERTER_BEWEGUNG: Was geschieht, wenn das Gerät „Bewegung reduzieren“ meldet (unter Android
     auch, wenn die Animationen in den Entwickleroptionen oder den Bedienungshilfen abgeschaltet sind)?
       "gedämpft"  Film und Kanäle laufen trotzdem, aber nur mit dem Scrollen: keine selbst laufende
                   Bewegung, kein Nachgleiten, kurze Überblendungen, Texte blenden nur ein und aus.
                   Die Pause-Taste bleibt und schaltet beide Filme ab. (Standard)
       "aus"       Film und Kanäle bleiben aus; die Seite ist die einfache, vollständig lesbare Fassung,
                   unter dem Hero steht „Film trotzdem starten“.

     BILDFOLGE_AUF_TOUCH: Welches Bild bekommt der Kreis auf Touch-Geräten (Handys, Tablets)?
       true   die vorberechnete Bildfolge: sofort da, flüssig auch auf schwachen Geräten, dafür bis zu
              etwa 4 MB Bilder, die nach und nach geladen werden (Standard)
       false  Echtzeit-3D wie am Rechner, wenn das Gerät es schafft (vorher einige Sekunden Vorbereitung,
              in denen die Bildfolge überbrückt)

     Rechner mit Grafikkarte bekommen immer Echtzeit-3D (bis es bereit ist, überbrückt die Bildfolge),
     Rechner ohne schnelle Grafik und sehr schwache Geräte immer die Bildfolge.

     WEICHES_SCROLLEN: Soll die Seite das Mausrad selbst weich nachführen (Prinzip wie Lenis)?
       false  der Browser scrollt selbst (Standard): bleibt auf jedem Gerät flüssig, auch wenn der Film
              Zeit braucht, denn das Scrollen läuft dann im Compositor, unabhängig vom Hauptthread
       true   die Seite fängt das Mausrad ab und scrollt per Skript: weicher Auslauf, aber das ganze
              Scrollen hängt an der Rechenzeit des Hauptthreads und ruckelt auf schwachen Geräten */
  var BEI_REDUZIERTER_BEWEGUNG = "gedämpft";
  var BILDFOLGE_AUF_TOUCH = true;
  var WEICHES_SCROLLEN = false;

  var reduziertAus = BEI_REDUZIERTER_BEWEGUNG === "aus";
  // dieselbe Haltung gilt für die Kanäle (kanaele.js) und die Pause-Taste (site.js): beide lesen sie hier ab
  root.setAttribute("data-reduziert", reduziertAus ? "aus" : "gedämpft");

  function mq(q) { return window.matchMedia ? window.matchMedia(q) : null; }
  var mqReduce = mq("(prefers-reduced-motion: reduce)");
  var mqForced = mq("(forced-colors: active)");
  var mitLeinwand = !!document.createElement("canvas").getContext;

  var erzwungen = false, ausGrund = "", geladen = false, modul = null;

  // technisch möglich: Canvas, keine erzwungenen Farben, keine Pause
  function technisch() {
    if (!window.requestAnimationFrame || !mitLeinwand) { return false; }
    if (mqForced && mqForced.matches) { return false; }
    return !root.classList.contains("ruhe");
  }
  function moeglich() {
    if (!technisch()) { return false; }
    if (erzwungen) { return true; }
    if (ausGrund === "fehler") { return false; }
    return !(reduziertAus && mqReduce && mqReduce.matches);
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
      import("./film3d/haupt.js?v=12").then(function (m) {
        modul = m;
        m.start({ erzwungen: erzwungen, reduziertAus: reduziertAus, folgeAufTouch: BILDFOLGE_AUF_TOUCH, weichesRad: WEICHES_SCROLLEN });
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
      if (ausGrund === "fehler") { grund = "fehler"; }
      else if (reduziertAus && mqReduce && mqReduce.matches) { grund = "ruhig"; }
    }
    if (grund) { feld.setAttribute("data-grund", grund); } else { feld.removeAttribute("data-grund"); }
    feld.hidden = !grund;
  }

  function trotzdemStarten() {
    erzwungen = true;
    ausGrund = "";
    root.classList.add("film-erzwungen");
    // die Kanäle und die Pause-Taste folgen (kanaele.js, site.js)
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
    // der Film meldet, wenn er sich abschaltet (Grund: fehler oder leer für Pause und Einstellung)
    document.addEventListener("film-aus", function (e) {
      var g = e && e.detail ? e.detail.grund : "";
      if (g) { ausGrund = g; }
      knopfAnpassen();
    });
    laden();
    // später möglich geworden (Pause aufgehoben, Einstellung geändert): dann erst laden
    document.addEventListener("bewegung", laden);
    [mqReduce, mqForced].forEach(function (m) { if (m && m.addEventListener) { m.addEventListener("change", laden); } });
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", bereit); } else { bereit(); }

  // Diagnose-Anzeige (Gerät, Film-Zustand, Bildrate; „Kopieren“ legt alles als Text ab): nur mit ?diag in der
  // Adresse, sonst wird diag.js nie geladen
  if (/[?&]diag(?:=|&|#|$)/.test(window.location.search)) {
    var diagLaden = function () {
      var s = document.createElement("script");
      s.src = "diag.js?v=11";
      document.head.appendChild(s);
    };
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", diagLaden); } else { diagLaden(); }
  }
})();
