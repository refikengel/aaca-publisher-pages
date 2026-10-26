/*
  Renderer, Licht, Kamera und Nachbearbeitung des Echtzeit-Films.

  Gerendert wird nur der Kreis der Skala (ein quadratisches Canvas, per CSS rund beschnitten).
  Qualitätsstufen: 3 = weiche Schatten 2048, vierfache Kantenglättung; 2 = Schatten 1024;
  1 = Schatten 512, Glühen in halber Auflösung, Pixeldichte 1.
*/
import * as THREE from "../vendor/three/build/three.module.min.js";
import { RoomEnvironment } from "../vendor/three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "../vendor/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "../vendor/three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "../vendor/three/addons/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "../vendor/three/addons/postprocessing/UnrealBloomPass.js";

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
  constructor(canvas, stufe) {
    this.canvas = canvas;
    var r = this.renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: false, alpha: false, stencil: false, depth: true,
      powerPreference: "high-performance", failIfMajorPerformanceCaveat: true
    });
    if (!r.capabilities.isWebGL2) { throw new Error("kein WebGL2"); }
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.localClippingEnabled = true;
    this.halbFloat = r.extensions.has("EXT_color_buffer_float") || r.extensions.has("EXT_color_buffer_half_float");

    var sz = this.szene = new THREE.Scene();
    sz.background = this.hintergrund();
    sz.fog = new THREE.FogExp2(0x070b16, 0.028);
    var pm = new THREE.PMREMGenerator(r);
    var raum = new RoomEnvironment();
    sz.environment = pm.fromScene(raum, 0.035).texture;
    sz.environmentIntensity = 0.62;
    raum.traverse(function (o) { if (o.geometry) { o.geometry.dispose(); } if (o.material) { o.material.dispose(); } });
    pm.dispose();

    var k = this.kamera = new THREE.PerspectiveCamera(25, 1, 0.1, 80);
    k.position.set(0, 4.1, 11.2);
    k.lookAt(0, 1.15, 0);
    this.ohneVerdeckung = [];

    // Studiolicht: warmes Hauptlicht mit Schatten, kühles Gegenlicht, farbiges Akzentlicht der Station
    var haupt = this.hauptLicht = new THREE.DirectionalLight(0xfff0dc, 2.25);
    haupt.position.set(-3.6, 6.4, 4.8);
    haupt.castShadow = true;
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
    this.stufe = 0;
    this.pixel = 1;
    this.css = 1;
    this.setzeStufe(stufe || 3);
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
    n = Math.max(1, Math.min(3, n));
    if (n === this.stufe) { return; }
    this.stufe = n;
    var h = this.hauptLicht;
    var gross = n === 3 ? 2048 : (n === 2 ? 1024 : 512);
    h.shadow.mapSize.set(gross, gross);
    if (h.shadow.map) { h.shadow.map.dispose(); h.shadow.map = null; }
    this.passesBauen();
    if (this.css > 1) { this.groesse(this.css, this.dprWunsch || 1); }
  }

  passesBauen() {
    if (this.composer) { this.composer.dispose(); }
    var r = this.renderer;
    var ziel = new THREE.WebGLRenderTarget(4, 4, {
      type: this.halbFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      samples: this.stufe >= 2 ? 4 : 2
    });
    var c = this.composer = new EffectComposer(r, ziel);
    c.addPass(new RenderPass(this.szene, this.kamera));
    // nur echtes Leuchten (Augen, Heiligenschein, Scanstrahl) glüht, helle Flächen nicht
    // dezent: geringe Stärke, enger Radius, hohe Schwelle (das Glühen soll keine Details überstrahlen)
    var bloom = this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.18, 0.22, 1.6);
    c.addPass(bloom);
    c.addPass(new OutputPass());
    var korn = this.korn = new ShaderPass(KornShader);
    c.addPass(korn);
  }

  // css = Kantenlänge des Kreises in CSS-Pixeln, dpr = gewünschte Pixeldichte
  groesse(css, dpr) {
    this.css = css;
    this.dprWunsch = dpr;
    var d = this.stufe === 1 ? Math.min(dpr, 1) : Math.min(dpr, 2);
    // nie mehr als etwa 2,6 Millionen Pixel rendern
    while (css * css * d * d > 2600000 && d > 1) { d -= 0.25; }
    this.pixel = d;
    var r = this.renderer;
    r.setPixelRatio(d);
    r.setSize(css, css, false);
    this.composer.setPixelRatio(d);
    this.composer.setSize(css, css);
    if (this.stufe === 1) { this.bloom.resolution.set(css * d * 0.5, css * d * 0.5); }
    this.kamera.aspect = 1;
    this.kamera.updateProjectionMatrix();
    this.staubStoff.uniforms.uPixel.value = d * css / 600;
  }

  render(zeit) {
    this.staubStoff.uniforms.uZeit.value = zeit;
    this.korn.uniforms.uZeit.value = zeit;
    this.composer.render();
  }

  dispose() {
    if (this.composer) { this.composer.dispose(); }
    this.renderer.dispose();
  }
}
