// kleine Rechenhilfen für Bewegungen (ohne Speicherzuteilung pro Bild)
export function klemme(x, a, b) { return x < a ? a : (x > b ? b : x); }
export function seg(t, a, b) { return klemme((t - a) / (b - a), 0, 1); }
export function weich(t) { return t * t * (3 - 2 * t); }
export function weicher(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
export function mische(a, b, t) { return a + (b - a) * t; }
// sanfter Hügel von 0 über 1 zurück auf 0 zwischen a und b
export function huegel(t, a, b) { var x = seg(t, a, b); return Math.sin(x * Math.PI); }
// schneller Anschlag: steigt in "an" Sekunden auf 1, fällt in "ab" Sekunden zurück
export function anschlag(t, start, an, ab) {
  if (t < start) { return 0; }
  if (t < start + an) { return weich((t - start) / an); }
  if (t < start + an + ab) { return 1 - weich((t - start - an) / ab); }
  return 0;
}
// Schlüsselbilder: [[zeit, wert], ...] mit weichen Übergängen (Werte Zahlen)
export function bahn(t, punkte) {
  if (t <= punkte[0][0]) { return punkte[0][1]; }
  for (var i = 1; i < punkte.length; i++) {
    if (t <= punkte[i][0]) {
      var a = punkte[i - 1], b = punkte[i];
      return mische(a[1], b[1], weich((t - a[0]) / (b[0] - a[0])));
    }
  }
  return punkte[punkte.length - 1][1];
}
// dasselbe für Vektoren [x, y, z]; schreibt in ziel (THREE.Vector3)
export function bahn3(t, punkte, ziel) {
  if (t <= punkte[0][0]) { var p0 = punkte[0][1]; return ziel.set(p0[0], p0[1], p0[2]); }
  for (var i = 1; i < punkte.length; i++) {
    if (t <= punkte[i][0]) {
      var a = punkte[i - 1], b = punkte[i], k = weich((t - a[0]) / (b[0] - a[0]));
      return ziel.set(mische(a[1][0], b[1][0], k), mische(a[1][1], b[1][1], k), mische(a[1][2], b[1][2], k));
    }
  }
  var pl = punkte[punkte.length - 1][1];
  return ziel.set(pl[0], pl[1], pl[2]);
}
