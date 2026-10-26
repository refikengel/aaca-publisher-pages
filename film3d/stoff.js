/*
  Materialien und Texturen für den Echtzeit-Film (alles im Browser erzeugt, keine Bilddateien).

  Jedes Material des Films hängt an derselben Scan-Ebene: Was oberhalb der Ebene liegt, wird nicht
  gezeichnet (auch nicht im Schatten), und an der Schnittkante glüht ein schmales Band in der Farbe
  der Station. So entsteht der Aufbau „wie gedruckt“ und der Abbau in umgekehrter Richtung.
*/
import * as THREE from "../vendor/three/build/three.module.min.js";

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
function rauschfeld(n, zellen, rnd) {
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

function leinwand(w, h) {
  var c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function grauTextur(n, werte, wiederholen) {
  var c = leinwand(n, n), ctx = c.getContext("2d"), bild = ctx.createImageData(n, n), i;
  for (i = 0; i < n * n; i++) {
    var v = Math.max(0, Math.min(255, Math.round(werte[i] * 255)));
    bild.data[i * 4] = v; bild.data[i * 4 + 1] = v; bild.data[i * 4 + 2] = v; bild.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(bild, 0, 0);
  var t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  if (wiederholen) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(wiederholen, wiederholen); }
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------------ Texturen */

// feine Unregelmäßigkeit für die Rauheit (Fingerabdrücke, Polierspuren): mittlerer Wert um basis
export function rauheitTextur(basis, staerke, start, wiederholen) {
  var n = 256, rnd = zufall(start || 7);
  var a = rauschfeld(n, 8, rnd), b = rauschfeld(n, 32, rnd), c = rauschfeld(n, 64, rnd), w = new Float32Array(n * n);
  for (var i = 0; i < w.length; i++) {
    w[i] = basis + staerke * ((a[i] - 0.5) * 0.9 + (b[i] - 0.5) * 0.5 + (c[i] - 0.5) * 0.3);
  }
  return grauTextur(n, w, wiederholen || 1);
}

// gedrehte Oberfläche: feine konzentrische Riefen um die Mitte (für die Deckel der Schichten)
export function riefenTextur(basis, staerke) {
  var n = 512, rnd = zufall(11), feld = rauschfeld(n, 16, rnd), w = new Float32Array(n * n);
  for (var y = 0; y < n; y++) {
    for (var x = 0; x < n; x++) {
      var dx = x - n / 2 + 0.5, dy = y - n / 2 + 0.5, r = Math.sqrt(dx * dx + dy * dy);
      var riefe = Math.sin(r * 1.9 + feld[y * n + x] * 3.0) * 0.5 + Math.sin(r * 0.37) * 0.25;
      w[y * n + x] = basis + staerke * riefe + (rnd() - 0.5) * staerke * 0.5;
    }
  }
  return grauTextur(n, w, 0);
}

// gebürstet: Striche in einer Richtung (u)
export function buerstTextur(basis, staerke) {
  var w = 512, h = 64, c = leinwand(w, h), ctx = c.getContext("2d"), rnd = zufall(5), bild = ctx.createImageData(w, h);
  var zeile = new Float32Array(h);
  for (var y = 0; y < h; y++) { zeile[y] = (rnd() - 0.5); }
  for (y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var v = basis + staerke * (zeile[y] * 0.8 + (rnd() - 0.5) * 0.35 + Math.sin(x * 0.05 + zeile[y] * 9) * 0.08);
      var g = Math.max(0, Math.min(255, Math.round(v * 255))), k = (y * w + x) * 4;
      bild.data[k] = bild.data[k + 1] = bild.data[k + 2] = g; bild.data[k + 3] = 255;
    }
  }
  ctx.putImageData(bild, 0, 0);
  var t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Holzmaserung (Farbe), für Regal und Pult
export function holzTextur(hell, dunkel) {
  var w = 512, h = 512, c = leinwand(w, h), ctx = c.getContext("2d"), rnd = zufall(23), bild = ctx.createImageData(w, h);
  var feld = rauschfeld(256, 8, rnd);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var f = feld[((y >> 1) % 256) * 256 + ((x >> 3) % 256)];
      var ring = Math.sin((x * 0.11 + f * 9.0) + Math.sin(y * 0.013) * 2.0) * 0.5 + 0.5;
      ring = Math.pow(ring, 2.2);
      var t = Math.min(1, Math.max(0, ring * 0.75 + (rnd() - 0.5) * 0.12));
      var k = (y * w + x) * 4;
      bild.data[k] = hell[0] + (dunkel[0] - hell[0]) * t;
      bild.data[k + 1] = hell[1] + (dunkel[1] - hell[1]) * t;
      bild.data[k + 2] = hell[2] + (dunkel[2] - hell[2]) * t;
      bild.data[k + 3] = 255;
    }
  }
  ctx.putImageData(bild, 0, 0);
  var tex = new THREE.CanvasTexture(c);
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
