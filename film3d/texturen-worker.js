/*
  Rechnet die Pixel der gemalten Texturen (texturpixel.js) neben dem Hauptthread vor, gleich zu Beginn der
  Vorbereitung von Echtzeit-3D; stoff.js holt sie ab. Auftrag: [[schlüssel, art, werte], ...]; Antwort je Textur
  { schluessel, w, h, pixel } (die Pixel werden übergeben, nicht kopiert), am Ende { fertig: true }.
  Liest und sendet nichts außer diesen Nachrichten.
*/
import { PIXEL } from "./texturpixel.js?v=17";

self.onmessage = function (e) {
  e.data.forEach(function (a) {
    var p = PIXEL[a[1]].apply(null, a[2]);
    self.postMessage({ schluessel: a[0], w: p.w, h: p.h, pixel: p.pixel }, [p.pixel.buffer]);
  });
  self.postMessage({ fertig: true });
};
