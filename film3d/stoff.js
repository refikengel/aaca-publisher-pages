/*
  Materialien und Texturen für den Echtzeit-Film (alles im Browser erzeugt, keine Bilddateien).

  Jedes Material des Films hängt an derselben Scan-Ebene: Was oberhalb der Ebene liegt, wird nicht
  gezeichnet (auch nicht im Schatten), und an der Schnittkante glüht ein schmales Band in der Farbe
  der Station. So entsteht der Aufbau „wie gedruckt“ und der Abbau in umgekehrter Richtung.
*/
import * as THREE from "../vendor/three/build/three.module.min.js";
import { zufall, PIXEL } from "./texturpixel.js?v=17";

/* --------------------------------------------------------------------- Scan */

export const scan = {
  // behält alles unterhalb von y = constant (Abstand = -y + constant >= 0)
  ebene: new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000),
  uniforms: {
    uScanY: { value: 1000 },
    uScanAn: { value: 0 },
    uScanFarbe: { value: new THREE.Color(1, 0.75, 0.35) },
    uScanBreite: { value: 0.09 }
  }
};

export function scanSetzen(y, an, farbe) {
  scan.ebene.constant = y;
  scan.uniforms.uScanY.value = y;
  scan.uniforms.uScanAn.value = an;
  if (farbe) { scan.uniforms.uScanFarbe.value.copy(farbe); }
}

function scanHaken(m) {
  m.onBeforeCompile = function (shader) {
    shader.uniforms.uScanY = scan.uniforms.uScanY;
    shader.uniforms.uScanAn = scan.uniforms.uScanAn;
    shader.uniforms.uScanFarbe = scan.uniforms.uScanFarbe;
    shader.uniforms.uScanBreite = scan.uniforms.uScanBreite;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vScanY;")
      .replace("#include <project_vertex>",
        "#include <project_vertex>\n{\n  vec4 scanW = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n  scanW = instanceMatrix * scanW;\n#endif\n  vScanY = (modelMatrix * scanW).y;\n}");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>",
        "#include <common>\nvarying float vScanY;\nuniform float uScanY;\nuniform float uScanAn;\nuniform vec3 uScanFarbe;\nuniform float uScanBreite;")
      .replace("#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n{\n  float sd = uScanY - vScanY;\n  float band = uScanAn * (1.0 - smoothstep(0.0, uScanBreite, sd));\n  float kante = uScanAn * exp(-sd * sd * 9000.0);\n  totalEmissiveRadiance += uScanFarbe * (band * band * 1.4 + kante * 7.0);\n}");
  };
  m.customProgramCacheKey = function () { return "scan-v1"; };
}

// Material mit Scan-Ebene; art "p" = MeshPhysicalMaterial, sonst MeshStandardMaterial
export function stoff(art, werte) {
  var m = art === "p" ? new THREE.MeshPhysicalMaterial(werte) : new THREE.MeshStandardMaterial(werte);
  m.clippingPlanes = [scan.ebene];
  m.clipShadows = true;
  scanHaken(m);
  return m;
}

// Material ohne Scan (für die Maschine selbst, die nie auf- oder abgebaut wird)
export function stoffFest(art, werte) {
  return art === "p" ? new THREE.MeshPhysicalMaterial(werte) : new THREE.MeshStandardMaterial(werte);
}

/* ----------------------------------------------------------- Zufall, Rauschen */

// fester Zufall und Rauschen stehen in texturpixel.js (dort rechnet auch der Worker); zufall für die Szenen hier weiter
export { zufall };

// Leinwand zum Malen der Texturen: im Hauptthread ein Canvas, im Worker des 3D-Bildes (bild3d-worker.js) ein
// OffscreenCanvas (dort gibt es kein document); beide malen gleich. Auch für welt.js und roboter.js.
export function leinwand(w, h) {
  if (typeof document === "undefined") { return new OffscreenCanvas(w, h); }
  var c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

/* ------------------------------------------------------- Vorab im Worker */

// Die gemalten Texturen, die Grundstoffe, Maschine und Szenen anfordern (Art und Werte wie in texturpixel.js):
// texturenVorab() lässt sie gleich zu Beginn der Vorbereitung in einem Worker rechnen, neben dem Hauptthread. Dort
// kosteten die Pixelschleifen am Rechner zusammen rund 150 ms, am Handy ein Mehrfaches, in zwei langen Stücken
// (Grundstoffe, Szenen mit Holz), in denen Film und Texte stillstanden. Hier gerechnet, malt der Hauptthread nur
// noch das fertige Bild auf seine Leinwand. Fehlt eine Textur in der Liste, rechnet der Hauptthread sie beim Abruf
// selbst, wie früher; ebenso ohne Worker, wenn er ausfällt oder nach 4 s nicht fertig ist.
var VORAB = [
  ["rauheit", [0.5, 0.35, 3]], ["rauheit", [0.5, 0.5, 9]], ["buerst", [0.5, 0.6]], ["riefen", [0.42, 0.16]],
  ["holz", [[92, 62, 38], [52, 32, 20]]], ["holz", [[84, 54, 33], [46, 28, 17]]], ["holz", [[96, 64, 40], [56, 35, 21]]]
];
var vorab = new Map();
function schluessel(art, werte) { return art + ":" + JSON.stringify(werte); }
function pixelHolen(art, werte) {
  return vorab.get(schluessel(art, werte)) || PIXEL[art].apply(null, werte);
}

// Promise, erfüllt, wenn die Pixel da sind oder der Worker ausfällt (nie abgelehnt)
export function texturenVorab() {
  return new Promise(function (fertig) {
    var w, uhr = 0;
    function ende() {
      clearTimeout(uhr);
      try { w.terminate(); } catch (e) { /* egal */ }
      fertig();
    }
    try {
      w = new Worker(new URL("./texturen-worker.js?v=17", import.meta.url), { type: "module" });
    } catch (fehler) {
      fertig();
      return;
    }
    uhr = setTimeout(ende, 4000);
    w.onmessage = function (e) {
      var d = e.data;
      if (d.fertig) { ende(); return; }
      vorab.set(d.schluessel, { w: d.w, h: d.h, pixel: d.pixel });
    };
    w.onerror = ende;
    w.postMessage(VORAB.map(function (v) { return [schluessel(v[0], v[1]), v[0], v[1]]; }));
  });
}

// nach der Vorbereitung: die vorab gerechneten Pixel werden nicht mehr gebraucht (die Texturen haben ihre Leinwand)
export function texturenVergessen() { vorab.clear(); }

// Leinwand mit den Pixeln, als Textur
function pixelTextur(p) {
  var c = leinwand(p.w, p.h);
  c.getContext("2d").putImageData(new ImageData(p.pixel, p.w, p.h), 0, 0);
  return new THREE.CanvasTexture(c);
}

function grauTextur(p, wiederholen) {
  var t = pixelTextur(p);
  t.colorSpace = THREE.NoColorSpace;
  if (wiederholen) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(wiederholen, wiederholen); }
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------------ Texturen */

// feine Unregelmäßigkeit für die Rauheit (Fingerabdrücke, Polierspuren): mittlerer Wert um basis
export function rauheitTextur(basis, staerke, start, wiederholen) {
  return grauTextur(pixelHolen("rauheit", [basis, staerke, start || 7]), wiederholen || 1);
}

// gedrehte Oberfläche: feine konzentrische Riefen um die Mitte (für die Deckel der Schichten)
export function riefenTextur(basis, staerke) {
  return grauTextur(pixelHolen("riefen", [basis, staerke]), 0);
}

// gebürstet: Striche in einer Richtung (u)
export function buerstTextur(basis, staerke) {
  var t = pixelTextur(pixelHolen("buerst", [basis, staerke]));
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Holzmaserung (Farbe), für Regal und Pult
export function holzTextur(hell, dunkel) {
  var tex = pixelTextur(pixelHolen("holz", [hell, dunkel]));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Leinwand-Textur zum Selbstbemalen (Schilder, Papier, Bildschirme)
export function malTextur(w, h, malen, farbig) {
  var c = leinwand(w, h), ctx = c.getContext("2d");
  malen(ctx, w, h);
  var t = new THREE.CanvasTexture(c);
  t.colorSpace = farbig === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.userData.ctx = ctx;
  t.userData.malen = malen;
  return t;
}

/* --------------------------------------------------------- Grundmaterialien */

export function grundstoffe() {
  var rauhPerl = rauheitTextur(0.5, 0.35, 3, 2);
  var rauhMetall = rauheitTextur(0.5, 0.5, 9, 3);
  var buerste = buerstTextur(0.5, 0.6);
  return {
    perl: stoff("p", { color: 0xdcd6cb, roughness: 0.36, roughnessMap: rauhPerl, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.09 }),
    gold: stoff("p", { color: 0xe6b55c, roughness: 0.3, roughnessMap: rauhMetall, metalness: 1 }),
    goldGlanz: stoff("p", { color: 0xf0c56d, roughness: 0.16, metalness: 1, clearcoat: 0.4, clearcoatRoughness: 0.1 }),
    goldGebuerstet: stoff("p", { color: 0xe2b15a, roughness: 0.34, roughnessMap: buerste, metalness: 1 }),
    graphit: stoff("p", { color: 0x2b3039, roughness: 0.42, roughnessMap: rauhMetall, metalness: 0.75 }),
    gummi: stoff("s", { color: 0x15171c, roughness: 0.82, metalness: 0 }),
    chrom: stoff("p", { color: 0xe4e8ee, roughness: 0.1, metalness: 1 }),
    stahl: stoff("p", { color: 0xaab1bc, roughness: 0.32, roughnessMap: buerste, metalness: 1 }),
    visier: stoff("p", { color: 0x04060a, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.6 }),
    nacht: stoff("p", { color: 0x152038, roughness: 0.3, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 }),
    lack: stoff("p", { color: 0x0b0e14, roughness: 0.24, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.06 }),
    augen: stoff("s", { color: 0x000000, emissive: 0xffd07a, emissiveIntensity: 3.4, roughness: 0.4 }),
    halo: stoff("p", { color: 0xe9b85f, roughness: 0.2, metalness: 1, emissive: 0xffc35e, emissiveIntensity: 1.35 }),
    schub: stoff("s", { color: 0x000000, emissive: 0xffe1a6, emissiveIntensity: 2.4, roughness: 0.5 }),
    // Leuchtpunkte in der Farbe der aktuellen Station (Farbe setzt der Film)
    led: stoff("s", { color: 0x000000, emissive: 0xf2c14e, emissiveIntensity: 2.6, roughness: 0.5 }),
    // Glasanzeige mit eigener Leinwand (Brust-Display, Telefone)
    displayStoff: function (tex) {
      return stoff("p", { color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.05, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 });
    }
  };
}
