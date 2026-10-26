/*
  Die Maschine: ein Stapel aus acht Schichten (ähnlich dem OSI-Modell). Die Schichten hängen an
  einer Säule mit Zahnstange hinten rechts; jede Schicht greift mit einem Ritzel in die Zahnstange,
  das sich beim Fahren genau um den gefahrenen Weg dreht. Während der Fahrt läuft ein Datenpaket an
  der Säule hinunter und über den Arm in die nächste Schicht; dort baut ein Scanring die Szene auf.
*/
import * as THREE from "../vendor/three/build/three.module.min.js";
import { RoundedBoxGeometry } from "../vendor/three/addons/geometries/RoundedBoxGeometry.js";
import { stoffFest as stoff, riefenTextur, malTextur, buerstTextur, rauheitTextur } from "./stoff.js";
import { namen, SCHRIFT, ZIFFERN } from "./sprache.js";

const N_SCHICHTEN = 8;
export const FARBEN = [0xf2c14e, 0xf08a4b, 0xe85d75, 0x9280f0, 0x3fcf86, 0x4fb3f0];
export const PLATTE_R = 1.9;
export const ABSTAND = 2.7;

const SAEULE = new THREE.Vector3(2.02, 0, -2.0);   // Lage der Säule (Achse), hinten rechts
const RITZEL_R = 0.13;

function netz(geo, st, schatten) {
  var m = new THREE.Mesh(geo, st);
  m.castShadow = !!schatten;
  m.receiveShadow = true;
  return m;
}

export function farbeVon(j) { return j >= 1 && j <= 6 ? FARBEN[j - 1] : 0xf2c14e; }

// Zahnrad als extrudierter Umriss
function zahnradGeo(r, zaehne, dicke) {
  var form = new THREE.Shape(), schritt = Math.PI * 2 / zaehne;
  for (var i = 0; i < zaehne; i++) {
    var a = i * schritt;
    var pts = [[a - schritt * 0.27, r * 0.86], [a - schritt * 0.15, r], [a + schritt * 0.15, r], [a + schritt * 0.27, r * 0.86]];
    pts.forEach(function (p, k) {
      var x = Math.cos(p[0]) * p[1], y = Math.sin(p[0]) * p[1];
      if (i === 0 && k === 0) { form.moveTo(x, y); } else { form.lineTo(x, y); }
    });
  }
  form.closePath();
  var loch = new THREE.Path();
  loch.absarc(0, 0, r * 0.28, 0, Math.PI * 2, true);
  form.holes.push(loch);
  var geo = new THREE.ExtrudeGeometry(form, { depth: dicke, bevelEnabled: true, bevelThickness: dicke * 0.12, bevelSize: dicke * 0.1, bevelSegments: 2, curveSegments: 6 });
  geo.translate(0, 0, -dicke / 2);
  return geo;
}

export class Maschine {
  constructor() {
    // eigene Materialien ohne Scan-Ebene: die Maschine bleibt immer ganz sichtbar
    var buerste = buerstTextur(0.5, 0.6), rauh = rauheitTextur(0.5, 0.5, 9, 3);
    var st = this.st = {
      gold: stoff("p", { color: 0xe6b55c, roughness: 0.3, roughnessMap: rauh, metalness: 1 }),
      goldGlanz: stoff("p", { color: 0xf0c56d, roughness: 0.16, metalness: 1, clearcoat: 0.4, clearcoatRoughness: 0.1 }),
      goldGebuerstet: stoff("p", { color: 0xe2b15a, roughness: 0.34, roughnessMap: buerste, metalness: 1 }),
      graphit: stoff("p", { color: 0x2b3039, roughness: 0.42, roughnessMap: rauh, metalness: 0.75 }),
      chrom: stoff("p", { color: 0xe4e8ee, roughness: 0.1, metalness: 1 }),
      stahl: stoff("p", { color: 0x8a919c, roughness: 0.36, roughnessMap: buerste, metalness: 1 })
    };
    var gruppe = this.gruppe = new THREE.Group();
    gruppe.name = "maschine";
    var riefen = riefenTextur(0.42, 0.16);
    this.deckelStoff = stoff("p", { color: 0x1d2a49, metalness: 0.88, roughness: 0.4, roughnessMap: riefen, clearcoat: 0.25, clearcoatRoughness: 0.3 });
    this.kanteStoff = stoff("p", { color: 0x18223c, metalness: 0.9, roughness: 0.32 });
    this.messing = stoff("p", { color: 0xc99a3c, metalness: 1, roughness: 0.3 });
    var R = PLATTE_R;
    this.geo = {
      deckel: new THREE.CircleGeometry(R - 0.07, 96),
      kante: new THREE.LatheGeometry([
        new THREE.Vector2(R - 0.07, 0.07), new THREE.Vector2(R - 0.035, 0.066), new THREE.Vector2(R - 0.008, 0.048),
        new THREE.Vector2(R, 0.02), new THREE.Vector2(R, -0.02), new THREE.Vector2(R - 0.008, -0.048),
        new THREE.Vector2(R - 0.035, -0.066), new THREE.Vector2(R - 0.07, -0.07)
      ].reverse(), 128),
      boden: new THREE.CircleGeometry(R - 0.07, 64),
      rand: new THREE.TorusGeometry(R - 0.045, 0.017, 12, 160),
      strich: new THREE.BoxGeometry(0.012, 0.006, 1),
      band: new THREE.CylinderGeometry(R + 0.004, R + 0.004, 0.07, 48, 1, true, -0.42, 0.84),
      led: new THREE.CapsuleGeometry(0.013, 0.03, 4, 10),
      ritzel: zahnradGeo(RITZEL_R, 14, 0.06),
      arm: new RoundedBoxGeometry(1, 0.07, 0.16, 2, 0.02)
    };
    this.platten = [];
    for (var j = 0; j < N_SCHICHTEN; j++) { this.platten.push(this.platteBauen(j)); }
    this.saeuleBauen();
    this.scannerBauen();
    this.paketBauen();
    this.idx = 0;
  }

  platteBauen(j) {
    var st = this.st, geo = this.geo, R = PLATTE_R;
    var p = new THREE.Group();
    p.name = "schicht-" + j;
    // drehbare Scheibe (Deckel mit Skalenstrichen): dreht sich beim Ein- und Ausfahren wie ein Drehteller
    var scheibe = new THREE.Group();
    p.add(scheibe);
    var deckel = netz(geo.deckel, this.deckelStoff);
    deckel.rotation.x = -Math.PI / 2; deckel.position.y = 0.07;
    scheibe.add(deckel);
    p.add(netz(geo.kante, this.kanteStoff));
    var boden = netz(geo.boden, this.kanteStoff);
    boden.rotation.x = Math.PI / 2; boden.position.y = -0.07;
    p.add(boden);
    var rand = netz(geo.rand, st.goldGebuerstet);
    rand.rotation.x = Math.PI / 2; rand.position.y = 0.066;
    p.add(rand);
    // 120 Skalenstriche nahe am Rand, jeder zehnte länger
    var n = 120, striche = new THREE.InstancedMesh(geo.strich, st.gold, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), achse = new THREE.Vector3(0, 1, 0);
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, lang = i % 10 === 0 ? 0.12 : (i % 5 === 0 ? 0.075 : 0.045);
      var r = R - 0.13 - lang / 2;
      pos.set(Math.sin(a) * r, 0.073, Math.cos(a) * r);
      q.setFromAxisAngle(achse, a);
      s.set(i % 10 === 0 ? 1.4 : 1, 1, lang);
      m.compose(pos, q, s);
      striche.setMatrixAt(i, m);
    }
    striche.receiveShadow = true;
    scheibe.add(striche);
    // gravierter Name auf der Vorderkante (in der Sprache der Seite; beschriftungMalen malt ihn neu)
    var tex = malTextur(1024, 96, function (ctx, w, h) {
      var name = namen()[j], nr = j >= 1 && j <= 6 ? "0" + j : "";
      ctx.clearRect(0, 0, w, h);
      if ("letterSpacing" in ctx) { ctx.letterSpacing = "14px"; }
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 56px " + ZIFFERN;
      var bNr = nr ? ctx.measureText(nr).width : 0, luecke = nr ? 52 : 0;
      ctx.font = "700 58px " + SCHRIFT;
      var bName = ctx.measureText(name).width, x = (w - bNr - luecke - bName) / 2;
      ctx.fillText(name, x + bNr + luecke, h / 2 + 3);
      if (nr) { ctx.font = "600 56px " + ZIFFERN; ctx.fillText(nr, x, h / 2 + 3); }
    });
    var bandStoff = stoff("p", { color: 0xe9bd68, metalness: 1, roughness: 0.25, alphaMap: tex, transparent: true, depthWrite: false });
    var band = netz(geo.band, bandStoff);
    band.renderOrder = 2;
    p.add(band);
    // Leuchtpunkt links neben dem Namen
    var ledStoff = stoff("s", { color: 0x000000, emissive: farbeVon(j), emissiveIntensity: 3.0 });
    var led = netz(geo.led, ledStoff);
    led.rotation.z = Math.PI / 2;
    var wl = -0.36;
    led.position.set(Math.sin(wl) * (R + 0.01), 0, Math.cos(wl) * (R + 0.01));
    led.rotation.y = wl;
    p.add(led);
    // Arm zur Säule mit Ritzel, das in die Zahnstange greift
    var richtung = Math.atan2(SAEULE.x, SAEULE.z);
    var abst = Math.sqrt(SAEULE.x * SAEULE.x + SAEULE.z * SAEULE.z);
    var arm = netz(geo.arm, this.kanteStoff, true);
    var armL = abst - R - 0.02;
    arm.scale.x = armL;
    arm.position.set(Math.sin(richtung) * (R + armL / 2 - 0.05), -0.01, Math.cos(richtung) * (R + armL / 2 - 0.05));
    arm.rotation.y = richtung - Math.PI / 2;
    p.add(arm);
    var ritzel = netz(geo.ritzel, this.messing, true);
    var rp = abst - 0.16 - RITZEL_R;
    ritzel.position.set(Math.sin(richtung) * rp, 0.05, Math.cos(richtung) * rp);
    ritzel.rotation.y = richtung - Math.PI / 2;
    p.add(ritzel);
    var nabe = netz(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 20), st.chrom);
    nabe.position.copy(ritzel.position);
    nabe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.cos(richtung), 0, Math.sin(richtung)));
    p.add(nabe);
    p.userData = { led: led, ledStoff: ledStoff, band: band, bandTex: tex, ritzel: ritzel, scheibe: scheibe };
    this.gruppe.add(p);
    return p;
  }

  saeuleBauen() {
    var st = this.st, g = new THREE.Group();
    g.position.copy(SAEULE);
    this.gruppe.add(g);
    this.saeule = g;
    var H = 40;
    var rohr = netz(new THREE.CylinderGeometry(0.11, 0.11, H, 32), this.kanteStoff, true);
    g.add(rohr);
    // Zahnstange zur Plattenmitte hin
    var richtung = Math.atan2(-SAEULE.x, -SAEULE.z);
    var stange = new THREE.Group();
    stange.rotation.y = richtung;
    g.add(stange);
    var leiste = netz(new THREE.BoxGeometry(0.06, H, 0.05), st.stahl, true);
    leiste.position.z = 0.12;
    stange.add(leiste);
    var zahnGeo = new THREE.BoxGeometry(0.05, 0.022, 0.04);
    var teilung = 2 * Math.PI * RITZEL_R / 14;
    var anzahl = Math.floor(14 / teilung);
    var zaehne = new THREE.InstancedMesh(zahnGeo, st.stahl, anzahl), m = new THREE.Matrix4();
    for (var i = 0; i < anzahl; i++) { m.makeTranslation(0, -7 + i * teilung, 0.155); zaehne.setMatrixAt(i, m); }
    stange.add(zaehne);
    this.zaehne = zaehne;
    this.teilung = teilung;
    // Datenleitung an der Säule
    var leitung = netz(new THREE.CylinderGeometry(0.012, 0.012, H, 8), new THREE.MeshBasicMaterial({ color: 0x0c1220 }), false);
    leitung.position.set(Math.sin(richtung + 1.2) * 0.12, 0, Math.cos(richtung + 1.2) * 0.12);
    g.add(leitung);
    this.leitungPos = leitung.position.clone();
  }

  // Scanring: ein leuchtender Ring am Plattenrand, eine feine Lichtscheibe darin, zwei Schienen mit Schlitten
  scannerBauen() {
    var st = this.st, g = this.scanner = new THREE.Group();
    g.visible = false;
    this.gruppe.add(g);
    var farbe = this.scanFarbe = new THREE.Color(1, 0.8, 0.4);
    var ring = this.scanRing = new THREE.Mesh(new THREE.TorusGeometry(PLATTE_R + 0.06, 0.01, 10, 160), new THREE.MeshBasicMaterial({
      color: farbe.clone().multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
    }));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    var scheibe = this.scanScheibe = new THREE.Mesh(new THREE.CircleGeometry(PLATTE_R + 0.06, 128), new THREE.ShaderMaterial({
      uniforms: { uFarbe: { value: farbe }, uZeit: { value: 0 }, uStaerke: { value: 1 } },
      vertexShader: "varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: [
        "uniform vec3 uFarbe; uniform float uZeit; uniform float uStaerke; varying vec2 vP;",
        "void main() {",
        "  float r = length(vP) / " + (PLATTE_R + 0.06).toFixed(3) + ";",
        "  float rand = smoothstep(0.55, 1.0, r);",
        "  float linien = 0.5 + 0.5 * sin(vP.x * 46.0 + uZeit * 3.0);",
        "  float a = (0.03 + rand * 0.22) * (0.75 + 0.25 * linien) * uStaerke;",
        "  gl_FragColor = vec4(uFarbe * a, 1.0);",
        "}"
      ].join("\n"),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
    }));
    scheibe.rotation.x = -Math.PI / 2;
    g.add(scheibe);
    // zwei Schienen links und rechts, die mit dem Scan ausfahren
    this.schienen = [];
    var schieneGeo = new THREE.BoxGeometry(0.05, 1, 0.05);
    schieneGeo.translate(0, 0.5, 0);
    var schlittenGeo = new RoundedBoxGeometry(0.12, 0.08, 0.1, 2, 0.015);
    var self = this;
    [-1, 1].forEach(function (s) {
      var schiene = netz(schieneGeo, st.stahl, false);
      schiene.position.set(s * (PLATTE_R + 0.08), 0.07, 0.18);
      self.gruppe.add(schiene);
      var schlitten = netz(schlittenGeo, st.graphit, false);
      schlitten.position.set(s * (PLATTE_R + 0.08), 0, 0.18);
      self.gruppe.add(schlitten);
      var licht = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), new THREE.MeshBasicMaterial({ color: farbe, toneMapped: false }));
      licht.position.set(-s * 0.065, 0, 0);
      schlitten.add(licht);
      schiene.visible = schlitten.visible = false;
      self.schienen.push({ schiene: schiene, schlitten: schlitten, licht: licht });
    });
  }

  paketBauen() {
    var g = this.paket = new THREE.Group();
    g.visible = false;
    this.gruppe.add(g);
    this.paketStoff = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.4).multiplyScalar(3), toneMapped: false });
    var kern = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6), this.paketStoff);
    kern.rotation.x = Math.PI / 2;
    g.add(kern);
    this.paketKern = kern;
    var hof = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.4), transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    g.add(hof);
    this.paketHof = hof;
    // das Licht hängt direkt an der Maschine und bleibt immer „sichtbar“ (nur die Stärke wechselt):
    // ändert sich die Zahl der Lichter, müsste three.js alle Shader neu übersetzen (Ruckler)
    this.paketLicht = new THREE.PointLight(0xffd080, 0, 2.5, 2);
    this.gruppe.add(this.paketLicht);
  }

  // Namen auf den Plattenkanten neu malen (nach einem Sprachwechsel oder sobald die Schrift geladen ist)
  beschriftungMalen() {
    for (var j = 0; j < this.platten.length; j++) {
      var tex = this.platten[j].userData.bandTex;
      tex.userData.malen(tex.userData.ctx, tex.image.width, tex.image.height);
      tex.needsUpdate = true;
    }
  }

  // Abstand der Schichten: im Überblick (auf = 1) rücken sie zusammen, damit alle acht ins Bild passen
  abstandJetzt() { return ABSTAND * (1 - 0.6 * (this.auf || 0)); }

  // Stapel auf die Station idx stellen (gebrochene Werte = Fahrt); Schicht idx liegt bei y = 0
  stellen(idx, auf) {
    this.idx = idx;
    this.auf = auf || 0;
    var d = this.abstandJetzt();
    for (var j = 0; j < this.platten.length; j++) {
      var y = (idx - j) * d;
      var p = this.platten[j];
      p.position.y = y;
      p.visible = Math.abs(idx - j) < 0.999 || this.auf > 0.01;
      // das Ritzel dreht sich genau um den gefahrenen Weg (Abrollen an der Zahnstange)
      p.userData.ritzel.rotation.z = -y / RITZEL_R;
      // der Drehteller läuft beim Einfahren aus und steht still, sobald die Schicht angekommen ist
      p.userData.scheibe.rotation.y = -(idx - j) * 2.1 * (1 - this.auf);
      // Leuchtpunkt: im Überblick leuchten alle Schichten in ihrer Farbe, sonst nur die aktive hell
      p.userData.ledStoff.emissiveIntensity = Math.abs(idx - j) < 0.5 ? 2.2 : 0.5 + 1.7 * this.auf;
    }
  }

  // Scan sichtbar machen: y = Höhe der Scan-Ebene (Welt), staerke 0..1, oben = Höhe der Schienen
  scanZeigen(y, staerke, farbe, oben, zeit) {
    var an = staerke > 0.001;
    this.scanner.visible = an;
    if (farbe) { this.scanFarbe.copy(farbe); this.scanRing.material.color.copy(farbe).multiplyScalar(1.6); }
    for (var i = 0; i < this.schienen.length; i++) {
      var sc = this.schienen[i];
      sc.schiene.visible = sc.schlitten.visible = an;
      if (!an) { continue; }
      sc.schiene.scale.y = Math.max(0.001, (oben + 0.15) * Math.min(1, staerke * 3));
      sc.schlitten.position.y = y;
      sc.licht.material.color.copy(this.scanFarbe).multiplyScalar(1.8);
    }
    if (!an) { return; }
    this.scanner.position.y = y;
    this.scanRing.material.opacity = Math.min(1, staerke * 2);
    this.scanScheibe.material.uniforms.uStaerke.value = Math.min(1, staerke * 2);
    this.scanScheibe.material.uniforms.uZeit.value = zeit;
  }

  // Datenpaket während der Fahrt: u 0..1 (an der Säule hinunter, dann über den Arm zur Plattenmitte)
  paketZeigen(u, farbe, zeit) {
    var an = u > 0 && u < 1;
    this.paket.visible = an;
    if (!an) { this.paketLicht.intensity = 0; return; }
    this.paketStoff.color.copy(farbe).multiplyScalar(1.7);
    this.paketHof.material.color.copy(farbe);
    this.paketLicht.color.copy(farbe);
    var richtung = Math.atan2(SAEULE.x, SAEULE.z), abst = Math.sqrt(SAEULE.x * SAEULE.x + SAEULE.z * SAEULE.z);
    var p = this.paket.position;
    if (u < 0.62) {
      var v = u / 0.62;
      p.set(SAEULE.x + this.leitungPos.x, ABSTAND * 0.9 * (1 - v) + 0.2, SAEULE.z + this.leitungPos.z);
    } else {
      var w = (u - 0.62) / 0.38;
      var r = (1 - w) * (abst - 0.2);
      p.set(Math.sin(richtung) * r, 0.2 - w * 0.08, Math.cos(richtung) * r);
    }
    var hell = Math.sin(u * Math.PI);
    this.paketLicht.intensity = 2.5 * hell;
    this.paketLicht.position.copy(p);
    this.paketKern.rotation.z = zeit * 3;
    this.paketHof.scale.setScalar(0.8 + 0.25 * Math.sin(zeit * 9));
  }
}
