/*
  Renderer, Licht, Kamera und Nachbearbeitung des Echtzeit-Films.

  Gerendert wird nur der Kreis der Skala (ein quadratisches Canvas, per CSS rund beschnitten).
  Qualitätsstufen: 3 = weiche Schatten 2048, vierfache Kantenglättung; 2 = Schatten 1024;
  1 = Schatten 512, Glühen in halber Auflösung, Pixeldichte bis 1,5; 0 = leicht: keine Schatten, kein
  Glühen, kein Korn, kein schwebender Staub, statt Mehrfachabtastung eine günstige Kantenglättung
  (FXAA), Pixeldichte bis 1,5. Stufe 0 ist für schwache Geräte gedacht; Geräte ohne schnelle Grafik zeigen
  statt des Echtzeitbilds die vorberechnete Bildfolge (folge.js).
*/
import * as THREE from "../vendor/three/build/three.module.min.js";
import { RoomEnvironment } from "../vendor/three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "../vendor/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "../vendor/three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "../vendor/three/addons/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "../vendor/three/addons/postprocessing/UnrealBloomPass.js";

// günstige Kantenglättung für Stufe 0 nach dem Prinzip von FXAA (NVIDIA): Helligkeit an vier diagonalen
// Nachbarn, daraus die Kantenrichtung, entlang der Kante zweimal nachtasten; ohne Schleifen (keine
// Warnungen beim Übersetzen, gleich schnell auf allen Geräten). resolution = 1 / Pixelgröße des Bildes
const KantenShader = {
  uniforms: { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2(1 / 512, 1 / 512) } },
  vertexShader: "varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: [
    "uniform sampler2D tDiffuse; uniform vec2 resolution; varying vec2 vUv;",
    "float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }",
    "void main() {",
    "  vec4 mitte = texture2D(tDiffuse, vUv);",
    "  float lNW = luma(texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * resolution).rgb);",
    "  float lNE = luma(texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * resolution).rgb);",
    "  float lSW = luma(texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * resolution).rgb);",
    "  float lSE = luma(texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * resolution).rgb);",
    "  float lM = luma(mitte.rgb);",
    "  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));",
    "  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));",
    "  vec2 richtung = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));",
    "  float daempfung = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);",
    "  float kehr = 1.0 / (min(abs(richtung.x), abs(richtung.y)) + daempfung);",
    "  richtung = clamp(richtung * kehr, vec2(-8.0), vec2(8.0)) * resolution;",
    "  vec3 a = 0.5 * (texture2D(tDiffuse, vUv - richtung * 0.1667).rgb + texture2D(tDiffuse, vUv + richtung * 0.1667).rgb);",
    "  vec3 b = 0.5 * a + 0.25 * (texture2D(tDiffuse, vUv - richtung * 0.5).rgb + texture2D(tDiffuse, vUv + richtung * 0.5).rgb);",
    "  float lB = luma(b);",
    "  gl_FragColor = vec4((lB < lMin || lB > lMax) ? a : b, mitte.a);",
    "}"
  ].join("\n")
};

const KornShader = {
  uniforms: { tDiffuse: { value: null }, uZeit: { value: 0 }, uKorn: { value: 0.022 }, uVignette: { value: 0.3 } },
  vertexShader: "varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: [
    "uniform sampler2D tDiffuse; uniform float uZeit; uniform float uKorn; uniform float uVignette; varying vec2 vUv;",
    "float h(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }",
    "void main() {",
    "  vec4 c = texture2D(tDiffuse, vUv);",
    "  float n = h(vUv * 1024.0 + fract(uZeit * 7.13)) - 0.5;",
    "  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));",
    "  c.rgb += n * uKorn * (1.0 - l * 0.6);",
    "  float r = length(vUv - 0.5) * 2.0;",
    "  c.rgb *= 1.0 - uVignette * smoothstep(0.45, 1.02, r);",
    "  gl_FragColor = c;",
    "}"
  ].join("\n")
};

export class Welt {
  // stufe: Qualitätsstufe 0 bis 3; softwareErlaubt: auch ohne Grafikbeschleunigung starten
  // (der Browser meldet sonst einen „major performance caveat“ und legt keinen Kontext an)
  constructor(canvas, stufe, softwareErlaubt) {
    this.canvas = canvas;
    stufe = stufe === undefined ? 3 : stufe;
    var r = this.renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: false, alpha: false, stencil: false, depth: true,
      powerPreference: "high-performance", failIfMajorPerformanceCaveat: !softwareErlaubt
    });
    if (!r.capabilities.isWebGL2) { throw new Error("kein WebGL2"); }
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    // startet der Film gleich leicht, werden die Shader ohne Schatten übersetzt (spart auch dort Rechenzeit)
    this.mitSchatten = stufe > 0;
    r.shadowMap.enabled = this.mitSchatten;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.localClippingEnabled = true;
    this.halbFloat = r.extensions.has("EXT_color_buffer_float") || r.extensions.has("EXT_color_buffer_half_float");

    var sz = this.szene = new THREE.Scene();
    sz.background = this.hintergrund();
    sz.fog = new THREE.FogExp2(0x070b16, 0.028);
    // die Umgebung (Spiegelungen) kommt mit umgebungBauen(), als eigener Schritt der Vorbereitung

    var k = this.kamera = new THREE.PerspectiveCamera(25, 1, 0.1, 80);
    k.position.set(0, 4.1, 11.2);
    k.lookAt(0, 1.15, 0);
    this.ohneVerdeckung = [];

    // Studiolicht: warmes Hauptlicht mit Schatten, kühles Gegenlicht, farbiges Akzentlicht der Station
    var haupt = this.hauptLicht = new THREE.DirectionalLight(0xfff0dc, 2.25);
    haupt.position.set(-3.6, 6.4, 4.8);
    haupt.castShadow = this.mitSchatten;
    var sc = haupt.shadow.camera;
    sc.left = -3.2; sc.right = 3.2; sc.top = 3.6; sc.bottom = -2.4; sc.near = 1; sc.far = 18;
    haupt.shadow.bias = -0.00035;
    haupt.shadow.normalBias = 0.018;
    sz.add(haupt);
    sz.add(haupt.target);
    var gegen = this.gegenLicht = new THREE.DirectionalLight(0x9ec3ff, 1.5);
    gegen.position.set(4.2, 3.4, -4.6);
    sz.add(gegen);
    var akzent = this.akzentLicht = new THREE.PointLight(0xf2c14e, 0, 7, 2);
    akzent.position.set(0.6, 0.45, 2.4);
    sz.add(akzent);
    var himmel = new THREE.HemisphereLight(0x34446e, 0x0a0d18, 0.35);
    sz.add(himmel);

    this.staubBauen();
    this.schattenBauen();
    this.stufe = -1;
    this.pixel = 1;
    this.css = 1;
    this.setzeStufe(stufe);
  }

  // Umgebung für Spiegelungen und weiches Licht (ein Raum, vorab weichgezeichnet): nicht im Konstruktor,
  // sondern in zwei Schritten der Vorbereitung. umgebungVorbereiten() lässt die Shader des Raums und des
  // Weichzeichners nebenher übersetzen (Promise: fertig), umgebungBauen() rendert dann ohne Warten. Der
  // Weichzeichner wird über interne Methoden von three.js r170 vorbereitet; geht das nicht, übersetzt
  // umgebungBauen ihn eben selbst (dauert nur länger).
  umgebungVorbereiten() {
    var r = this.renderer, ziel = r.getRenderTarget(), stoffe = new Set();
    var pm = this.pm = new THREE.PMREMGenerator(r);
    var raum = this.raum = new RoomEnvironment();
    var hilfsziel = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    try {
      r.setRenderTarget(hilfsziel);
      r.compile(raum, new THREE.PerspectiveCamera(90, 1, 0.1, 100)).forEach(function (m) { stoffe.add(m); });
      try {
        pm._setSize(256);
        pm._allocateTargets().dispose();
        pm._compileMaterial(pm._blurMaterial);
        stoffe.add(pm._blurMaterial);
      } catch (fehler) { /* andere three.js-Fassung: dann ohne */ }
    } finally {
      r.setRenderTarget(ziel);
    }
    return this.warten(stoffe, true).then(function () { hilfsziel.dispose(); });
  }

  umgebungBauen() {
    var pm = this.pm || new THREE.PMREMGenerator(this.renderer), raum = this.raum || new RoomEnvironment();
    this.szene.environment = pm.fromScene(raum, 0.035).texture;
    this.szene.environmentIntensity = 0.62;
    raum.traverse(function (o) { if (o.geometry) { o.geometry.dispose(); } if (o.material) { o.material.dispose(); } });
    pm.dispose();
    this.pm = this.raum = null;
  }

  hintergrund() {
    var n = 512, c = document.createElement("canvas");
    c.width = c.height = n;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(n * 0.5, n * 0.42, 0, n * 0.5, n * 0.5, n * 0.72);
    g.addColorStop(0, "#17223f");
    g.addColorStop(0.45, "#0d1529");
    g.addColorStop(1, "#04060d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
    // feines Rauschen gegen Farbstufen
    var bild = ctx.getImageData(0, 0, n, n), d = bild.data;
    for (var i = 0; i < d.length; i += 4) {
      var z = (Math.random() - 0.5) * 3;
      d[i] += z; d[i + 1] += z; d[i + 2] += z;
    }
    ctx.putImageData(bild, 0, 0);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // schwebender Staub im Licht: weiche Punkte, die langsam treiben (Tiefe)
  staubBauen() {
    var n = 260, pos = new Float32Array(n * 3), zuf = new Float32Array(n), i;
    for (i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 9;
      pos[i * 3 + 1] = Math.random() * 6 - 1.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 7 - 1;
      zuf[i] = Math.random();
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("zuf", new THREE.BufferAttribute(zuf, 1));
    var mat = this.staubStoff = new THREE.ShaderMaterial({
      uniforms: { uZeit: { value: 0 }, uPixel: { value: 1 }, uFarbe: { value: new THREE.Color(1.0, 0.86, 0.6) }, uStaerke: { value: 1 } },
      vertexShader: [
        "attribute float zuf; uniform float uZeit; uniform float uPixel; varying float vA;",
        "void main() {",
        "  vec3 p = position;",
        "  p.x += sin(uZeit * 0.11 + zuf * 40.0) * 0.35;",
        "  p.y += mod(uZeit * (0.05 + zuf * 0.06) + zuf * 6.0, 6.0) - 3.0;",
        "  p.z += cos(uZeit * 0.09 + zuf * 23.0) * 0.3;",
        "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
        "  gl_Position = projectionMatrix * mv;",
        "  float tiefe = -mv.z;",
        "  gl_PointSize = uPixel * (1.4 + zuf * 2.6) * (9.0 / tiefe);",
        "  vA = (0.25 + 0.75 * zuf) * smoothstep(3.0, 7.0, tiefe) * (1.0 - smoothstep(13.0, 18.0, tiefe));",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uFarbe; uniform float uStaerke; varying float vA;",
        "void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, r); gl_FragColor = vec4(uFarbe * a * vA * 0.55 * uStaerke, 1.0); }"
      ].join("\n"),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    var punkte = this.staub = new THREE.Points(geo, mat);
    punkte.frustumCulled = false;
    this.szene.add(punkte);
    this.ohneVerdeckung.push(punkte);
  }

  // weiche Kontaktschatten (dunkler Kreisverlauf) für Dinge, die auf der Bühne stehen oder schweben
  schattenBauen() {
    var n = 256, c = document.createElement("canvas");
    c.width = c.height = n;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, "rgba(0,0,0,0.85)");
    g.addColorStop(0.35, "rgba(0,0,0,0.55)");
    g.addColorStop(0.7, "rgba(0,0,0,0.18)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
    this.schattenTex = new THREE.CanvasTexture(c);
  }

  kontaktSchatten(breite, tiefe, staerke) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(breite, tiefe), new THREE.MeshBasicMaterial({
      map: this.schattenTex, transparent: true, depthWrite: false, opacity: staerke === undefined ? 0.8 : staerke,
      color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    }));
    m.material.clippingPlanes = [];
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 1;
    return m;
  }

  setzeStufe(n) {
    n = Math.max(0, Math.min(3, n));
    if (n === this.stufe) { return; }
    this.stufe = n;
    var h = this.hauptLicht;
    if (n === 0) {
      // keine Schatten mehr rechnen: die Schattenkarte einmal leeren (weiß = nichts im Schatten) und nicht
      // mehr erneuern. Die Shader bleiben dieselben; nichts muss neu übersetzt werden (sonst ein Ruckler).
      h.shadow.autoUpdate = false;
      h.shadow.needsUpdate = false;
      this.schattenLeeren();
    } else if (this.mitSchatten) {
      h.shadow.autoUpdate = true;
      var gross = n === 3 ? 2048 : (n === 2 ? 1024 : 512);
      h.shadow.mapSize.set(gross, gross);
      if (h.shadow.map) { h.shadow.map.dispose(); h.shadow.map = null; }
    }
    this.staub.visible = n > 0;
    this.passesBauen();
    if (this.css > 1) { this.groesse(this.css, this.dprWunsch || 1); }
  }

  // Shader vorab übersetzen, Stoff für Stoff, ohne auf den Treiber zu warten (der übersetzt nebenher, wo er
  // kann). three.js (r170) übersetzt dabei mit dem Schnittebenen-Zustand des zuletzt gezeichneten Stoffs, nicht
  // mit dem des jeweiligen Stoffs; im Film haben fast alle Stoffe eine Schnittebene (den Scan), die Maschine
  // keine, das Skript-Blatt zwei. Darum: schnittebenen(n) zeichnet ein winziges Bild mit einem Stoff mit n
  // Ebenen, danach übersetzt uebersetzen(objekt) die Stoffe von Objekten mit genau n Ebenen (nur das Objekt,
  // ohne seine Kinder), und zwar für das Zwischenbild der Nachbearbeitung (linear, Tonwerte erst am Ende), in
  // das auch gezeichnet wird. So entsteht jeder Shader einmal, passend, und beim ersten Bild einer Szene muss
  // kaum noch etwas blockierend nachübersetzt werden. warten(stoffe) ist erfüllt, wenn alle fertig sind.
  schnittebenen(n) {
    var r = this.renderer, ziel = r.getRenderTarget();
    if (!this.probe) {
      var flaeche = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
      flaeche.frustumCulled = false;
      this.probe = { ziel: new THREE.WebGLRenderTarget(1, 1), szene: new THREE.Scene(), flaeche: flaeche, ebenen: [new THREE.Plane(), new THREE.Plane(), new THREE.Plane()] };
      this.probe.szene.add(flaeche);
    }
    var p = this.probe;
    try {
      p.flaeche.material.clippingPlanes = n ? p.ebenen.slice(0, n) : null;
      p.flaeche.material.needsUpdate = true;
      r.setRenderTarget(p.ziel);
      r.render(p.szene, this.kamera);
    } finally {
      r.setRenderTarget(ziel);
    }
  }

  // die Stoffe eines Objekts (ohne Kinder) übersetzen; liefert die Menge der Stoffe (für warten)
  uebersetzen(objekt) {
    var r = this.renderer, ziel = r.getRenderTarget(), kinder = objekt.children;
    objekt.children = [];
    try {
      r.setRenderTarget(this.composer.readBuffer);
      return r.compile(objekt, this.kamera, this.szene);
    } finally {
      objekt.children = kinder;
      r.setRenderTarget(ziel);
    }
  }

  // erfüllt, wenn die Shader aller stoffe fertig sind; ohne behalten wird danach auch die Probe freigegeben
  warten(stoffe, behalten) {
    var eig = this.renderer.properties, probe = this.probe;
    if (probe && !behalten) {
      this.probe = null;
      probe.ziel.dispose(); probe.flaeche.geometry.dispose(); probe.flaeche.material.dispose();
    }
    return new Promise(function (fertig) {
      (function pruefen() {
        var offen = false;
        stoffe.forEach(function (m) {
          var p = eig.get(m).currentProgram;
          if (p && !p.isReady()) { offen = true; }
        });
        if (offen) { window.setTimeout(pruefen, 16); } else { fertig(); }
      })();
    });
  }

  schattenLeeren() {
    var karte = this.hauptLicht.shadow.map;
    if (!karte) { return; }
    var r = this.renderer, farbe = r.getClearColor(new THREE.Color()), alpha = r.getClearAlpha(), vorher = r.getRenderTarget();
    r.setRenderTarget(karte);
    r.setClearColor(0xffffff, 1);
    r.clear(true, true, false);
    r.setRenderTarget(vorher);
    r.setClearColor(farbe, alpha);
  }

  passesBauen() {
    if (this.composer) { this.composer.dispose(); }
    var r = this.renderer;
    var ziel = new THREE.WebGLRenderTarget(4, 4, {
      type: this.halbFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      samples: this.stufe >= 2 ? 4 : (this.stufe === 1 ? 2 : 0)
    });
    var c = this.composer = new EffectComposer(r, ziel);
    c.addPass(new RenderPass(this.szene, this.kamera));
    this.bloom = null;
    this.korn = null;
    this.fxaa = null;
    // Stufe 0: nur Bild, Ausgabe (Tonwerte, Farbraum) und FXAA. Der Weg über das Renderziel bleibt, damit
    // die Shader dieselben bleiben wie auf den höheren Stufen (kein Neuübersetzen beim Wechsel).
    if (this.stufe > 0) {
      // nur echtes Leuchten (Augen, Heiligenschein, Scanstrahl) glüht, helle Flächen nicht
      // dezent: geringe Stärke, enger Radius, hohe Schwelle (das Glühen soll keine Details überstrahlen)
      var bloom = this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.18, 0.22, 1.6);
      c.addPass(bloom);
    }
    c.addPass(new OutputPass());
    if (this.stufe > 0) {
      var korn = this.korn = new ShaderPass(KornShader);
      c.addPass(korn);
    } else {
      // Kantenglättung nach der Ausgabe (FXAA arbeitet auf den fertigen Farben)
      var fxaa = this.fxaa = new ShaderPass(KantenShader);
      c.addPass(fxaa);
    }
  }

  // css = Kantenlänge des Kreises in CSS-Pixeln, dpr = gewünschte Pixeldichte
  groesse(css, dpr) {
    this.css = css;
    this.dprWunsch = dpr;
    // Stufe 1 und 0 höchstens 1,5-fach: auf Handys (Pixeldichte 3) sonst sichtbar grob, am Rechner (1) gleich
    var d = this.stufe <= 1 ? Math.min(dpr, 1.5) : Math.min(dpr, 2);
    // nie mehr als etwa 2,6 Millionen Pixel rendern
    while (css * css * d * d > 2600000 && d > 1) { d -= 0.25; }
    this.pixel = d;
    var r = this.renderer;
    r.setPixelRatio(d);
    r.setSize(css, css, false);
    this.composer.setPixelRatio(d);
    this.composer.setSize(css, css);
    if (this.stufe === 1 && this.bloom) { this.bloom.resolution.set(css * d * 0.5, css * d * 0.5); }
    if (this.fxaa) { this.fxaa.material.uniforms.resolution.value.set(1 / (css * d), 1 / (css * d)); }
    this.kamera.aspect = 1;
    this.kamera.updateProjectionMatrix();
    this.staubStoff.uniforms.uPixel.value = d * css / 600;
  }

  render(zeit) {
    this.staubStoff.uniforms.uZeit.value = zeit;
    if (this.korn) { this.korn.uniforms.uZeit.value = zeit; }
    this.composer.render();
  }

  dispose() {
    if (this.composer) { this.composer.dispose(); }
    this.renderer.dispose();
  }
}
