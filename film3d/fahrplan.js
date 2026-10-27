/*
  Fahrplan des Films: wann was zu sehen ist, in Bildschirmhöhen s (Scrollposition). Ohne three.js und ohne
  Seite: gilt für das 3D-Bild (bild3d.js), die vorberechnete Bildfolge (folge.js) und das Werkzeug, das die
  Bildfolge rendert.

  Je Schicht j mit Mitte c:
    Fahrt [c-0.8, c-0.5]  Aufbau [c-0.5, c-0.15]  Arbeit [c-0.15, c+0.35]  Abbau [c+0.35, c+0.8]
  Die erste Fahrt ist länger (0,95 bis 1,85): Der Stapel fächert sich zum Schichtenmodell auf, alle acht
  Schichten stehen beschriftet übereinander, dann fährt die Kamera in die erste Schicht hinein.
*/
import { klemme, seg, weich } from "./helfer.js";

export const MITTE = [0.15, 2.35, 3.95, 5.55, 7.15, 8.75, 10.35, 11.95];
export const ENDE = 12.8;
export const N_SCHICHT = 8;
// Filmzeit in Sekunden je Bildschirmhöhe: so ist die Bildfolge gerendert (Bild bei s zeigt die Zeit s * 2),
// und so läuft die Zeit im 3D-Bild mit dem Scrollen (dazu kommt die Zeit im Leerlauf, die beim Übernehmen der
// Folge bei null beginnt); ein 3D-Bild zur Zeit 2 s gleicht dann dem Bild der Folge an derselben Stelle
export const ZEIT_JE_HOEHE = 2;
export const UEBERBLICK = [0.95, 1.85];
export function fahrtBeginn(j) { return j === 1 ? UEBERBLICK[0] : MITTE[j] - 0.8; }

export function sanft(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

// Ablauf zur Scrollposition s: Lage des Stapels, welche Szene, wie weit aufgebaut (schreibt in Z)
export function zustand(s, Z) {
  var j, c;
  Z.s = s;
  Z.auf = 0;
  if (s < fahrtBeginn(1)) {
    j = 0; c = MITTE[0];
    Z.idx = 0; Z.fahrt = 0;
  } else {
    j = 1;
    while (j < N_SCHICHT - 1 && s >= fahrtBeginn(j + 1)) { j++; }
    c = MITTE[j];
    var f0 = fahrtBeginn(j);
    Z.fahrt = s < c - 0.5 ? seg(s, f0, c - 0.5) : 0;
    if (j === 1 && s < c - 0.5) {
      // Überblick: auffächern, halten, zusammenfahren; die eigentliche Fahrt liegt im letzten Teil
      var p = Z.fahrt;
      Z.auf = weich(seg(p, 0, 0.32)) * (1 - weich(seg(p, 0.62, 0.96)));
      Z.idx = sanft(seg(p, 0.6, 1));
      Z.paket = seg(p, 0.6, 1);
    } else {
      Z.idx = s < c - 0.5 ? (j - 1) + sanft(Z.fahrt) : j;
      Z.paket = Z.fahrt;
    }
  }
  if (j === 0) { Z.paket = 0; }
  Z.j = j; Z.c = c;
  if (j > 0 && s < c - 0.5) { Z.szene = -1; Z.druck = 0; }
  else if (s < c - 0.15) { Z.szene = j; Z.druck = j === 0 ? 1 : seg(s, c - 0.5, c - 0.15); }
  else if (s < c + 0.35 || j === N_SCHICHT - 1) { Z.szene = j; Z.druck = 1; }
  else { Z.szene = j; Z.druck = 1 - seg(s, c + 0.35, c + 0.8); }
  Z.u = seg(s, c - 0.5, c + 0.8);
  Z.heroH = weich(seg(s, 0.3, 0.8));
  Z.fort = klemme(s / MITTE[N_SCHICHT - 1], 0, 1);
  Z.station = klemme(Z.idx, 0, 7);
}
