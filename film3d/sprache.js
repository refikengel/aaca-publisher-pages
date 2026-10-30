/*
  Sprache und Schrift des Films: Beschriftungen folgen dem Sprachschalter der Seite
  (html[data-sprache], gesetzt von site.js). Ohne Angabe gilt Deutsch. Im Worker des 3D-Bildes (bild3d-worker.js)
  gibt es kein document: dort gilt die Sprache, die ihm die Seite schickt (spracheSetzen).
*/
export const NAMEN = {
  de: ["IT-ENGEL", "THEMA", "SKRIPT", "STIMME", "QUELLEN", "FREIGABE", "KANÄLE", "ZIEL"],
  en: ["IT-ENGEL", "TOPIC", "SCRIPT", "VOICE", "SOURCES", "APPROVAL", "CHANNELS", "GOAL"],
  // nur für die vorberechnete Bildfolge (_werkzeuge/bildfolge_rendern.mjs): ohne Wörter, damit dieselben Bilder
  // zu beiden Sprachen passen (auf den Platten stehen dann nur die Nummern)
  neutral: ["IT-ENGEL", "", "", "", "", "", "", "IT-ENGEL"]
};

export const SCHRIFT = '"Raleway", system-ui, sans-serif';
// Raleway hat Mediävalziffern als Standard, und Canvas kann keine Versalziffern (lnum) einschalten:
// Nummern auf den Leinwänden deshalb in einer Systemschrift mit Versalziffern
export const ZIFFERN = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

var gesetzt = "";
export function spracheSetzen(s) { gesetzt = s || ""; }

export function sprache() {
  var s = typeof document !== "undefined" ? document.documentElement.getAttribute("data-sprache") : gesetzt;
  return s === "en" || s === "neutral" ? s : "de";
}

export function namen() { return NAMEN[sprache()]; }
