/*
  Schleife des Hero für die Bildfolge (film3d/folge.js spielt sie im Stand ab). Erzeugt von
  _werkzeuge/bildfolge_rendern.mjs --schleife am 2026-10-27; nicht von Hand ändern, sondern neu rendern.
  Scrollposition 0, Stufe 3, 720 Pixel im Quadrat wie die Folge. Bild k (0 … anzahl-1) ist assets/film/s00.webp …;
  anzahl Bilder in dauer Sekunden, danach wieder Bild 0. Der Roboter winkt in der Zeit k · dauer / anzahl, die
  langsamen Bewegungen laufen mit der Zeit 1.8 · (1 - cos(2π · k / anzahl)) / 2 aus der Ruhe hin und zurück:
  Bild 0 gleicht f000.webp (Scrollposition 0), und die Schleife endet genau dort, wo sie beginnt.
*/
export const SCHLEIFE = {"anzahl":43,"dauer":3.6,"ordner":"assets/film/","bytes":776838};
