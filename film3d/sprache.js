/*
  Sprache und Schrift des Films: Beschriftungen folgen dem Sprachschalter der Seite
  (html[data-sprache], gesetzt von site.js). Ohne Angabe gilt Deutsch.
*/
export const NAMEN = {
  de: ["IT-ENGEL", "THEMA", "SKRIPT", "STIMME", "QUELLEN", "FREIGABE", "KANÄLE", "ZIEL"],
  en: ["IT-ENGEL", "TOPIC", "SCRIPT", "VOICE", "SOURCES", "APPROVAL", "CHANNELS", "GOAL"]
};

export const SCHRIFT = '"Raleway", system-ui, sans-serif';
// Raleway hat Mediävalziffern als Standard, und Canvas kann keine Versalziffern (lnum) einschalten:
// Nummern auf den Leinwänden deshalb in einer Systemschrift mit Versalziffern
export const ZIFFERN = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

export function sprache() {
  return document.documentElement.getAttribute("data-sprache") === "en" ? "en" : "de";
}

export function namen() { return NAMEN[sprache()]; }
