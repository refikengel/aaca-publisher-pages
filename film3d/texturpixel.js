/*
  Pixel der gemalten Texturen des Films (Rauheit, Riefen, gebürstet, Holz) als reine Rechnung ohne DOM: stoff.js
  macht daraus Texturen, texturen-worker.js rechnet dieselben Pixel neben dem Hauptthread vor. Jede Funktion liefert
  { w, h, pixel } (RGBA, Uint8ClampedArray); gleiche Werte ergeben immer dieselben Pixel (fester Zufall).
*/

export function zufall(start) {
  var n = start | 0;
  return function () {
    n = (n + 0x6D2B79F5) | 0;
    var t = Math.imul(n ^ (n >>> 15), 1 | n);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// glattes Wertrauschen auf einem Gitter (kachelbar), Werte 0..1
export function rauschfeld(n, zellen, rnd) {
  var gitter = new Float32Array(zellen * zellen), i, x, y;
  for (i = 0; i < gitter.length; i++) { gitter[i] = rnd(); }
  var out = new Float32Array(n * n);
  for (y = 0; y < n; y++) {
    var gy = y / n * zellen, y0 = Math.floor(gy), fy = gy - y0, y1 = (y0 + 1) % zellen;
    fy = fy * fy * (3 - 2 * fy);
    for (x = 0; x < n; x++) {
      var gx = x / n * zellen, x0 = Math.floor(gx), fx = gx - x0, x1 = (x0 + 1) % zellen;
      fx = fx * fx * (3 - 2 * fx);
      var a = gitter[y0 * zellen + x0], b = gitter[y0 * zellen + x1], c = gitter[y1 * zellen + x0], d = gitter[y1 * zellen + x1];
      out[y * n + x] = (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
    }
  }
  return out;
}

// Grauwerte 0..1 zu RGBA
function grau(n, werte) {
  var pixel = new Uint8ClampedArray(n * n * 4);
  for (var i = 0; i < n * n; i++) {
    var v = Math.max(0, Math.min(255, Math.round(werte[i] * 255)));
    pixel[i * 4] = v; pixel[i * 4 + 1] = v; pixel[i * 4 + 2] = v; pixel[i * 4 + 3] = 255;
  }
  return { w: n, h: n, pixel: pixel };
}

// feine Unregelmäßigkeit für die Rauheit (Fingerabdrücke, Polierspuren): mittlerer Wert um basis
function rauheit(basis, staerke, start) {
  var n = 256, rnd = zufall(start);
  var a = rauschfeld(n, 8, rnd), b = rauschfeld(n, 32, rnd), c = rauschfeld(n, 64, rnd), w = new Float32Array(n * n);
  for (var i = 0; i < w.length; i++) {
    w[i] = basis + staerke * ((a[i] - 0.5) * 0.9 + (b[i] - 0.5) * 0.5 + (c[i] - 0.5) * 0.3);
  }
  return grau(n, w);
}

// gedrehte Oberfläche: feine konzentrische Riefen um die Mitte (für die Deckel der Schichten)
function riefen(basis, staerke) {
  var n = 512, rnd = zufall(11), feld = rauschfeld(n, 16, rnd), w = new Float32Array(n * n);
  for (var y = 0; y < n; y++) {
    for (var x = 0; x < n; x++) {
      var dx = x - n / 2 + 0.5, dy = y - n / 2 + 0.5, r = Math.sqrt(dx * dx + dy * dy);
      var riefe = Math.sin(r * 1.9 + feld[y * n + x] * 3.0) * 0.5 + Math.sin(r * 0.37) * 0.25;
      w[y * n + x] = basis + staerke * riefe + (rnd() - 0.5) * staerke * 0.5;
    }
  }
  return grau(n, w);
}

// gebürstet: Striche in einer Richtung (u)
function buerst(basis, staerke) {
  var w = 512, h = 64, rnd = zufall(5), pixel = new Uint8ClampedArray(w * h * 4);
  var zeile = new Float32Array(h);
  for (var y = 0; y < h; y++) { zeile[y] = (rnd() - 0.5); }
  for (y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var v = basis + staerke * (zeile[y] * 0.8 + (rnd() - 0.5) * 0.35 + Math.sin(x * 0.05 + zeile[y] * 9) * 0.08);
      var g = Math.max(0, Math.min(255, Math.round(v * 255))), k = (y * w + x) * 4;
      pixel[k] = pixel[k + 1] = pixel[k + 2] = g; pixel[k + 3] = 255;
    }
  }
  return { w: w, h: h, pixel: pixel };
}

// Holzmaserung (Farbe), für Regal und Pult
function holz(hell, dunkel) {
  var w = 512, h = 512, rnd = zufall(23), pixel = new Uint8ClampedArray(w * h * 4);
  var feld = rauschfeld(256, 8, rnd);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var f = feld[((y >> 1) % 256) * 256 + ((x >> 3) % 256)];
      var ring = Math.sin((x * 0.11 + f * 9.0) + Math.sin(y * 0.013) * 2.0) * 0.5 + 0.5;
      ring = Math.pow(ring, 2.2);
      var t = Math.min(1, Math.max(0, ring * 0.75 + (rnd() - 0.5) * 0.12));
      var k = (y * w + x) * 4;
      pixel[k] = hell[0] + (dunkel[0] - hell[0]) * t;
      pixel[k + 1] = hell[1] + (dunkel[1] - hell[1]) * t;
      pixel[k + 2] = hell[2] + (dunkel[2] - hell[2]) * t;
      pixel[k + 3] = 255;
    }
  }
  return { w: w, h: h, pixel: pixel };
}

export var PIXEL = { rauheit: rauheit, riefen: riefen, buerst: buerst, holz: holz };
