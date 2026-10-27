/*
  Farben der sechs Stationen (Thema bis Kanäle), eine je Schicht. Ohne three.js, damit auch die Skala und
  der Film ohne 3D (Bildfolge, folge.js) sie kennen.
*/
export const FARBEN = [0xf2c14e, 0xf08a4b, 0xe85d75, 0x9280f0, 0x3fcf86, 0x4fb3f0];

// Station j (1 bis 6); Start und Ziel in Gold
export function farbeVon(j) { return j >= 1 && j <= 6 ? FARBEN[j - 1] : 0xf2c14e; }
