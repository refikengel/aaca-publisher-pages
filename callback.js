/*
  Rückkehradresse der Anmeldung bei einer Plattform (callback.html), zum Beispiel
  Instagram, Facebook, Pinterest oder Google (OAuth-Ablauf mit Autorisierungscode).

  Liest code, state, scope bzw. scopes sowie error, error_description und
  error_reason aus der Adresse und zeigt sie in diesem Browserfenster an. Es wird
  nichts gespeichert (kein localStorage, keine Cookies), nichts gesendet und nichts
  nachgeladen. Nach dem Anzeigen wird die Adresse bereinigt, damit der Code nicht im
  Browserverlauf bleibt. Angezeigt wird ausschließlich per textContent.

  Wie auf den anderen Seiten ist genau eine Sprache sichtbar (Sprache des Browsers); die
  Knöpfe im Kopf wechseln ohne Neuladen, weil die Angaben danach nicht mehr in der Adresse stehen.
*/
(function () {
  "use strict";

  var root = document.documentElement;
  var sprache = /^de/i.test((navigator.languages && navigator.languages[0]) || navigator.language || "de") ? "de" : "en";
  var wahl = document.querySelector(".sprachwahl");

  function spracheSetzen(sp) {
    sprache = sp;
    root.setAttribute("data-sprache", sp);
    root.lang = sp;
    var titel = root.getAttribute("data-titel-" + sp);
    if (titel) { document.title = titel; }
    [].forEach.call(document.querySelectorAll("[data-label-" + sp + "]"), function (e) {
      e.setAttribute("aria-label", e.getAttribute("data-label-" + sp));
    });
    if (wahl) {
      wahl.setAttribute("aria-label", sp === "en" ? "Language" : "Sprache");
      [].forEach.call(wahl.querySelectorAll("button"), function (b) {
        b.setAttribute("aria-pressed", b.value === sp ? "true" : "false");
      });
    }
  }

  spracheSetzen(sprache);
  // die Fußzeile steht hinter diesem Skript: ihre Beschriftung nach dem Laden nachziehen
  document.addEventListener("DOMContentLoaded", function () { spracheSetzen(sprache); });
  if (wahl) {
    wahl.hidden = false;
    wahl.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("button") : null;
      if (b && (b.value === "de" || b.value === "en")) { spracheSetzen(b.value); }
    });
  }

  var FELDER = ["code", "state", "scope", "scopes", "error", "error_description", "error_reason"];
  // Lesbare Textfelder: dort steht "+" für ein Leerzeichen (z. B. "Permissions+error").
  // Bei code und state bleibt "+" ein "+".
  var TEXTFELDER = ["scope", "scopes", "error", "error_description", "error_reason"];
  var MAX_LAENGE = 2048;

  function dekodieren(text) {
    try {
      return decodeURIComponent(text);
    } catch (fehler) {
      return text;
    }
  }

  // Liest die Abfrage-Parameter der Adresse. Bei code und state bleibt "+" ein "+"
  // (Autorisierungscodes enthalten keine Leerzeichen). Nur bekannte Felder, je Feld
  // gilt der erste Treffer.
  function leseAdresse(suche) {
    var ergebnis = Object.create(null);
    var teile = suche.replace(/^\?/, "").split("&");
    for (var i = 0; i < teile.length; i++) {
      if (!teile[i]) { continue; }
      var pos = teile[i].indexOf("=");
      var name = dekodieren(pos === -1 ? teile[i] : teile[i].slice(0, pos));
      if (FELDER.indexOf(name) === -1 || name in ergebnis) { continue; }
      var roh = pos === -1 ? "" : teile[i].slice(pos + 1);
      if (TEXTFELDER.indexOf(name) !== -1) { roh = roh.replace(/\+/g, " "); }
      ergebnis[name] = dekodieren(roh).slice(0, MAX_LAENGE);
    }
    return ergebnis;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function zeige(name, wert) {
    var zeile = el("zeile-" + name);
    var feld = el("wert-" + name);
    if (!zeile || !feld || !wert) { return false; }
    feld.textContent = wert;
    zeile.hidden = false;
    return true;
  }

  var daten = leseAdresse(window.location.search);

  var hatCode = zeige("code", daten.code);
  zeige("state", daten.state);
  zeige("scopes", daten.scopes || daten.scope);
  var hatFehler = zeige("error", daten.error);
  zeige("error_description", daten.error_description);
  zeige("error_reason", daten.error_reason);

  var meldung = el(hatCode ? "meldung-code" : (hatFehler ? "meldung-fehler" : "meldung-leer"));
  if (meldung) { meldung.hidden = false; }

  // Adresse bereinigen: Code und state bleiben nicht im Verlauf stehen. Das entfernt
  // auch einen Anhang wie "#_=_", den manche Plattformen an die Adresse hängen.
  if ((window.location.search || window.location.hash) && window.history && typeof window.history.replaceState === "function") {
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch (fehler) {
      /* z. B. bei file:// nicht erlaubt – dann bleibt die Adresse unverändert */
    }
  }

  var knopf = el("knopf-kopieren");
  var status = el("kopier-status");
  if (knopf && status) {
    knopf.addEventListener("click", function () {
      var feld = el("wert-code");
      var text = feld ? feld.textContent : "";
      var gemeldet = false;

      function melde(ok) {
        if (gemeldet) { return; }
        gemeldet = true;
        if (sprache === "en") {
          status.textContent = ok ? "Copied." : "Copy failed: select the code and press Ctrl+C.";
        } else {
          status.textContent = ok ? "Kopiert." : "Kopieren nicht möglich: Code markieren und mit Strg+C kopieren.";
        }
      }

      function ausweichen() {
        var ok = false;
        try {
          var bereich = document.createRange();
          bereich.selectNodeContents(feld);
          var auswahl = window.getSelection();
          auswahl.removeAllRanges();
          auswahl.addRange(bereich);
          ok = document.execCommand("copy");
        } catch (fehler) {
          ok = false;
        }
        melde(ok);
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function" && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { melde(true); }, ausweichen);
      } else {
        ausweichen();
      }
    });
  }
})();
