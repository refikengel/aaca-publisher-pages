/*
  Die acht Szenen des Films. Jede Szene ist eine Gruppe auf ihrer Schicht der Maschine und eine
  Bewegungsfunktion tick(t, u): t = Zeit in Sekunden (läuft immer), u = Fortschritt der Station 0..1.
  Der Roboter ist ein einziges Modell, das der Film der jeweils aktiven Szene übergibt.
*/
import * as THREE from "../vendor/three/build/three.module.min.js";
import { RoundedBoxGeometry } from "../vendor/three/addons/geometries/RoundedBoxGeometry.js";
import { stoff, malTextur, holzTextur, zufall } from "./stoff.js";
import { klemme, seg, weich, weicher, mische, huegel, anschlag, bahn } from "./helfer.js";
import { farbeVon } from "./maschine.js";
import { namen, SCHRIFT } from "./sprache.js";

const V = () => new THREE.Vector3();
export { netz, bei, gedreht, rohr };

function netz(geo, st, schatten) {
  var m = new THREE.Mesh(geo, st);
  m.castShadow = schatten !== false;
  m.receiveShadow = true;
  return m;
}
// Lage setzen und das Objekt zurückgeben (position/rotation sind schreibgeschützte Felder)
function bei(o, x, y, z) { o.position.set(x, y, z); return o; }
function gedreht(o, x, y, z) { o.rotation.set(x, y, z); return o; }
function rohr(r, l, st, seg_) {   // Zylinder entlang X
  var m = netz(new THREE.CylinderGeometry(r, r, l, seg_ || 32), st);
  m.rotation.z = Math.PI / 2;
  return m;
}

/* ===================================================================== 0 Start */

export function szeneStart(k) {
  var gruppe = new THREE.Group();
  var ziel = V(), pol = V(), hq = new THREE.Quaternion(), ruhe = new THREE.Quaternion(), kam = V();
  return {
    j: 0, gruppe: gruppe, oben: 3.0, symbol: 0,
    platz: { x: 0, z: 0.15, dreh: 0 },
    tick: function (t) {
      var rob = k.rob, g = rob.g;
      rob.leben(t);
      // Winken in Schüben: 2 Sekunden winken, 1,6 Sekunden Pause; Heben und Senken fließend
      var z = t % 3.6, w = weich(seg(z, 0, 0.45)) * (1 - weich(seg(z, 2.0, 2.65)));
      var osz = Math.sin(z * 7.5) * weich(seg(z, 0.3, 0.6)) * (1 - weich(seg(z, 1.85, 2.15)));
      // der Oberkörper geht beim Winken leicht mit (Gewicht auf die andere Seite)
      g.torso.rotation.set(0.03, Math.sin(t * 0.7) * 0.08 - w * 0.06, Math.sin(t * 0.5) * 0.02 + w * 0.035);
      rob.wurzel.updateMatrixWorld(true);
      k.welt.kamera.getWorldPosition(kam);
      rob.blick(kam, 0.75);
      rob.augen(rob.blinzeln, Math.sin(t * 0.4) * 0.3, 0.1);
      // Hand: Bahn von der Hüfte nach oben; die Ausrichtung dreht unterwegs von „Handfläche zum Körper“
      // zu „Handfläche nach vorn, Finger oben“ (Kugel-Interpolation, keine Sprünge)
      rob.punkt(mische(-0.5, -0.56 + osz * 0.07, w), mische(0.98, 1.98, w), mische(0.12, 0.3, w), ziel);
      rob.richtung(-1, mische(-0.25, -0.6, w), mische(-0.45, -0.5, w), pol);
      rob.handLage(0, -1, 0.05, 1, 0, 0.25, ruhe);
      rob.handLage(osz * 0.25, 1, 0.12, 0, 0.1, 1, hq);
      ruhe.slerp(hq, weicher(w));
      rob.arm(-1, ziel, pol, ruhe);
      rob.finger(-1, mische(0.32, 0.06, w), mische(0.28, 0.12, w));
      rob.punkt(0.52, 0.98 + Math.sin(t * 1.1) * 0.015 - w * 0.01, 0.14, ziel);
      rob.richtung(1, -0.25, -0.45, pol);
      rob.arm(1, ziel, pol, null);
      rob.finger(1, 0.36, 0.3);
    }
  };
}

/* ===================================================================== 1 Thema */

function trendTafel(farbe, start, ebenen) {
  var rnd = zufall(start);
  var tex = malTextur(512, 340, function (c, w, h) {
    c.clearRect(0, 0, w, h);
    c.fillStyle = "rgba(20,32,64,0.55)";
    c.beginPath(); c.roundRect ? c.roundRect(6, 6, w - 12, h - 12, 26) : c.rect(6, 6, w - 12, h - 12); c.fill();
    c.strokeStyle = "rgba(255,226,170,0.85)"; c.lineWidth = 4; c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.12)"; c.lineWidth = 2;
    for (var i = 1; i < 5; i++) { c.beginPath(); c.moveTo(40, 40 + i * 52); c.lineTo(w - 40, 40 + i * 52); c.stroke(); }
    var f = "#" + new THREE.Color(farbe).getHexString();
    c.strokeStyle = f; c.lineWidth = 9; c.lineJoin = "round"; c.lineCap = "round";
    c.beginPath();
    var y = 250;
    for (i = 0; i <= 8; i++) {
      y = Math.max(70, y - (rnd() * 46 - 8) - i * 4);
      var x = 50 + i * 51;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
    c.fillStyle = "#fff4dc"; c.beginPath(); c.arc(50 + 8 * 51, y, 13, 0, Math.PI * 2); c.fill();
    for (i = 0; i < 6; i++) {
      c.fillStyle = i === 5 ? f : "rgba(255,240,210,0.35)";
      var hb = 18 + rnd() * 40 + i * 6;
      c.fillRect(56 + i * 70, h - 40 - hb, 34, hb);
    }
  });
  var m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
  }));
  m.material.clippingPlanes = ebenen;
  m.renderOrder = 3;
  return m;
}

export function szeneThema(k) {
  var st = k.st, gruppe = new THREE.Group();
  var holz = holzTextur([92, 62, 38], [52, 32, 20]);
  var stativHolz = stoff("p", { color: 0xffffff, map: holz, roughness: 0.48, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  var messing = stoff("p", { color: 0xd4a640, metalness: 1, roughness: 0.24, clearcoat: 0.3, clearcoatRoughness: 0.15 });
  var messingDunkel = stoff("p", { color: 0xa17a2c, metalness: 1, roughness: 0.38 });
  var leder = stoff("p", { color: 0x3a2116, roughness: 0.78, sheen: 0.4, sheenColor: 0x6b4a33 });
  var linse = stoff("p", { color: 0x08121f, roughness: 0.02, metalness: 0, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 520] });

  // Stativ links vorne; der Tubus zeigt nach links vorne oben, der Roboter steht hinter dem Okular
  // und blickt mit Kopf und Körper in dieselbe Richtung wie das Fernrohr
  var stativ = new THREE.Group();
  stativ.position.set(-0.25, 0.07, 0.2);
  gruppe.add(stativ);
  var KOPF = 1.62;
  var saeule = netz(new THREE.CylinderGeometry(0.032, 0.036, 0.42, 24), st.graphit);
  saeule.position.y = KOPF - 0.25;
  stativ.add(saeule);
  var nabe = netz(new THREE.CylinderGeometry(0.075, 0.085, 0.09, 32), messingDunkel);
  nabe.position.y = KOPF - 0.42;
  stativ.add(nabe);
  for (var i = 0; i < 3; i++) {
    var a = i / 3 * Math.PI * 2 + 0.4;
    var fuss = V().set(Math.sin(a) * 0.62, 0, Math.cos(a) * 0.62);
    var oben = V().set(Math.sin(a) * 0.07, KOPF - 0.42, Math.cos(a) * 0.07);
    var mitte = oben.clone().add(fuss).multiplyScalar(0.5);
    var laenge = oben.distanceTo(fuss);
    var bein = netz(new THREE.CylinderGeometry(0.02, 0.026, laenge, 16), stativHolz);
    bein.position.copy(mitte);
    bein.quaternion.setFromUnitVectors(V().set(0, 1, 0), oben.clone().sub(fuss).normalize());
    stativ.add(bein);
    var kappe = netz(new THREE.SphereGeometry(0.03, 16, 10), st.gummi);
    kappe.position.copy(fuss).setY(0.018);
    stativ.add(kappe);
    var klemm = netz(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 16), messing);
    klemm.position.copy(mitte.clone().lerp(oben, 0.55));
    klemm.quaternion.copy(bein.quaternion);
    stativ.add(klemm);
  }
  stativ.add(bei(k.welt.kontaktSchatten(1.6, 1.6, 0.45), 0, 0.004, 0));
  // Montierung: Drehung (Azimut) und Gabel mit Höhenachse
  var azimut = new THREE.Group();
  azimut.position.y = KOPF;
  stativ.add(azimut);
  azimut.add(bei(netz(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 32), st.graphit), 0, -0.03, 0));
  var gabelGeo = new RoundedBoxGeometry(0.03, 0.2, 0.09, 2, 0.012);
  [-1, 1].forEach(function (s) {
    var gab = netz(gabelGeo, st.graphit);
    gab.position.set(0, 0.09, s * 0.12);
    azimut.add(gab);
  });
  var hoehe = new THREE.Group();
  hoehe.position.y = 0.16;
  azimut.add(hoehe);
  hoehe.add(gedreht(netz(new THREE.CylinderGeometry(0.024, 0.024, 0.28, 16), st.chrom), Math.PI / 2, 0, 0));
  // Tubus entlang +X (Objektiv vorne), Okular hinten bei -X
  var tubus = new THREE.Group();
  hoehe.add(tubus);
  var haupt = rohr(0.082, 1.0, messing, 48); haupt.position.x = 0.12; tubus.add(haupt);
  var tau = rohr(0.098, 0.3, messing, 48); tau.position.x = 0.76; tubus.add(tau);
  var tauRand = netz(new THREE.TorusGeometry(0.098, 0.007, 10, 48), messingDunkel); tauRand.rotation.y = Math.PI / 2; tauRand.position.x = 0.91; tubus.add(tauRand);
  var glas = netz(new THREE.CircleGeometry(0.09, 48), linse); glas.rotation.y = Math.PI / 2; glas.position.x = 0.84; tubus.add(glas);
  [-0.28, 0.1, 0.5].forEach(function (x) { var r = netz(new THREE.TorusGeometry(0.085, 0.009, 10, 48), messingDunkel); r.rotation.y = Math.PI / 2; r.position.x = x; tubus.add(r); });
  var griff = rohr(0.0865, 0.17, leder, 48); griff.position.x = -0.08; tubus.add(griff);
  var zelle = rohr(0.07, 0.08, st.graphit); zelle.position.x = -0.42; tubus.add(zelle);
  var auszug = rohr(0.04, 0.16, st.chrom); auszug.position.x = -0.52; tubus.add(auszug);
  var knopfGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.05, 20);
  [-1, 1].forEach(function (s) { var kn = netz(knopfGeo, messing); kn.rotation.x = Math.PI / 2; kn.position.set(-0.47, -0.035, s * 0.065); tubus.add(kn); });
  var winkel = netz(new RoundedBoxGeometry(0.07, 0.09, 0.07, 2, 0.015), st.chrom); winkel.position.set(-0.62, 0.02, 0); tubus.add(winkel);
  var okular = netz(new THREE.CylinderGeometry(0.03, 0.026, 0.11, 24), st.gummi); okular.position.set(-0.62, 0.11, 0); tubus.add(okular);
  var sucher = rohr(0.02, 0.32, messing, 20); sucher.position.set(-0.05, 0.13, 0); tubus.add(sucher);
  [-0.15, 0.06].forEach(function (x) { var st_ = netz(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8), st.graphit); st_.position.set(x, 0.1, 0); tubus.add(st_); });
  // Griffpunkte für die Hände und den Blick (in Tubus-Koordinaten)
  var griffRechts = new THREE.Object3D(); griffRechts.position.set(-0.47, -0.04, 0.1); tubus.add(griffRechts);
  var griffLinks = new THREE.Object3D(); griffLinks.position.set(-0.04, -0.12, -0.06); tubus.add(griffLinks);
  var blickPunkt = new THREE.Object3D(); blickPunkt.position.set(-0.62, 0.2, 0); tubus.add(blickPunkt);
  var richtungPunkt = new THREE.Object3D(); richtungPunkt.position.set(4.0, 0, 0); tubus.add(richtungPunkt);

  // drei Trendtafeln, die das Fernrohr nacheinander „findet“ (in der Farbe der Station)
  var farbe = farbeVon(1);
  var tafeln = [
    { m: trendTafel(farbe, 3, k.scanEbenen), p: V().set(-1.3, 2.7, 0.15), t0: 0.6 },
    { m: trendTafel(farbe, 9, k.scanEbenen), p: V().set(-0.6, 3.0, -0.35), t0: 2.6 },
    { m: trendTafel(farbe, 17, k.scanEbenen), p: V().set(-1.62, 2.2, -0.45), t0: 4.6 }
  ];
  tafeln.forEach(function (tf) { tf.m.position.copy(tf.p); gruppe.add(tf.m); });

  var ziel = V(), pol = V(), hq = new THREE.Quaternion(), p = V();
  return {
    j: 1, gruppe: gruppe, oben: 3.4, symbol: 1,
    platz: { x: 0.53, z: -0.49, dreh: -0.85 },
    tick: function (t) {
      var rob = k.rob, g = rob.g;
      // Suchbewegung des Fernrohrs: schwenken, kurz halten (gefunden), weiter
      var zyklus = 6.6, z = t % zyklus;
      var az = bahn(z, [[0, 0.14], [1.2, 0.05], [2.0, 0.05], [3.2, -0.06], [4.0, -0.06], [5.2, -0.15], [6.0, -0.15], [6.6, 0.14]]);
      var el = bahn(z, [[0, 0.4], [1.2, 0.47], [2.0, 0.47], [3.2, 0.52], [4.0, 0.52], [5.2, 0.43], [6.0, 0.43], [6.6, 0.4]]);
      azimut.rotation.y = az - 2.42;
      hoehe.rotation.z = el;
      // Tafeln leuchten auf, wenn das Fernrohr auf sie zeigt
      for (var i = 0; i < tafeln.length; i++) {
        var tf = tafeln[i], lz = (t - tf.t0) % zyklus;
        if (lz < 0) { lz += zyklus; }
        var an = weich(seg(lz, 0.0, 0.45)) * (1 - weich(seg(lz, 4.6, 5.6)));
        var flacker = lz < 0.45 ? (0.6 + 0.4 * Math.sin(lz * 60)) : 1;
        tf.m.material.opacity = an * flacker;
        tf.m.visible = an > 0.01;
        tf.m.scale.setScalar(0.85 + 0.15 * weich(seg(lz, 0, 0.5)));
        tf.m.position.y = tf.p.y + Math.sin(t * 0.9 + i) * 0.03;
        k.welt.kamera.getWorldPosition(p);
        tf.m.lookAt(p);
      }
      rob.leben(t);
      // der ganze Körper folgt dem Fernrohr: vorgebeugt, mit dem Schwenk mitgedreht
      g.torso.rotation.set(0.24, az * 0.9, 0);
      rob.wurzel.updateMatrixWorld(true);
      blickPunkt.getWorldPosition(p);
      rob.blick(p, 1);
      rob.augen(rob.blinzeln * 0.8, 0, -0.7);
      // rechte Hand (abgewandte Seite) am Fokussierknopf, dreht ihn leicht; Handfläche zum Knopf
      griffRechts.getWorldPosition(ziel);
      rob.richtung(-1, -0.8, -0.25, pol);
      rob.greifen(-1, ziel, 0.15, -0.35, 1, 1, 0.15, 0.2, pol);
      rob.finger(-1, 0.55 + Math.sin(t * 3.0) * 0.08, 0.55);
      // linke Hand (zur Kamera) stützt den Tubus von unten, Finger umgreifen ihn
      griffLinks.getWorldPosition(ziel);
      rob.richtung(1, -0.8, -0.2, pol);
      rob.greifen(1, ziel, -0.2, 0.1, 1, -0.45, 1, 0.15, pol);
      rob.finger(1, 0.62, 0.5);
    }
  };
}

/* ===================================================================== 2 Skript */

export function szeneSkript(k) {
  var st = k.st, gruppe = new THREE.Group();
  var holz = holzTextur([84, 54, 33], [46, 28, 17]);
  var platteStoff = stoff("p", { color: 0xffffff, map: holz, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.18 });
  var elfenbein = stoff("p", { color: 0xf1e9d6, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  var papierStoffBasis = { color: 0xffffff, roughness: 0.92, metalness: 0, side: THREE.DoubleSide };

  // Pult vor dem Roboter (der Roboter steht hinten links und schaut schräg zur Kamera)
  var pult = new THREE.Group();
  pult.position.set(-0.02, 0.07, 0.26);
  pult.rotation.y = 0.55;
  gruppe.add(pult);
  var HOEHE = 0.84;
  var platte = netz(new RoundedBoxGeometry(1.25, 0.06, 0.82, 4, 0.025), platteStoff);
  platte.position.y = HOEHE;
  pult.add(platte);
  var zarge = netz(new RoundedBoxGeometry(1.12, 0.09, 0.7, 2, 0.02), st.lack);
  zarge.position.y = HOEHE - 0.07;
  pult.add(zarge);
  var beinGeo = new THREE.CylinderGeometry(0.022, 0.016, HOEHE - 0.1, 16);
  [[-0.52, -0.32], [0.52, -0.32], [-0.52, 0.32], [0.52, 0.32]].forEach(function (p) {
    var b = netz(beinGeo, st.goldGebuerstet);
    b.position.set(p[0], (HOEHE - 0.1) / 2, p[1]);
    pult.add(b);
    var fuss = netz(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 16), st.gold);
    fuss.position.set(p[0], 0.006, p[1]);
    pult.add(fuss);
  });
  pult.add(bei(k.welt.kontaktSchatten(1.7, 1.25, 0.6), 0, 0.004, 0));

  // Schreibmaschine (Tastatur zur Seite +Z, also zum Roboter)
  var sm = new THREE.Group();
  sm.position.set(0, HOEHE + 0.03, -0.02);
  sm.rotation.y = Math.PI;
  pult.add(sm);
  var grund = netz(new RoundedBoxGeometry(0.8, 0.05, 0.6, 3, 0.02), st.lack);
  grund.position.y = 0.025;
  sm.add(grund);
  var profil = new THREE.Shape();
  profil.moveTo(0.29, 0.05); profil.lineTo(0.29, 0.085); profil.lineTo(0.0, 0.2); profil.lineTo(-0.16, 0.235);
  profil.lineTo(-0.28, 0.235); profil.lineTo(-0.28, 0.05); profil.lineTo(0.29, 0.05);
  var koerperGeo = new THREE.ExtrudeGeometry(profil, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 4, curveSegments: 4 });
  var koerper = netz(koerperGeo, st.lack);
  koerper.rotation.y = -Math.PI / 2;
  koerper.position.x = 0.35;
  sm.add(koerper);
  // Goldlinien und Schild
  [0.088, 0.205].forEach(function (y, i) {
    var linie = netz(new THREE.BoxGeometry(0.66, 0.004, 0.004), st.goldGlanz, false);
    linie.position.set(0, y, i ? 0.005 : 0.294);
    sm.add(linie);
  });
  var schild = netz(new RoundedBoxGeometry(0.16, 0.035, 0.008, 2, 0.006), st.goldGlanz, false);
  schild.position.set(0, 0.07, 0.308);
  sm.add(schild);
  // Tasten: 4 Reihen zu 10, Kappen elfenbein mit Chromring, Stiele
  var kappenGeo = new THREE.CylinderGeometry(0.021, 0.021, 0.011, 24);
  var ringGeo = new THREE.TorusGeometry(0.0215, 0.0035, 8, 24);
  var stielGeo = new THREE.CylinderGeometry(0.0038, 0.0038, 0.06, 8);
  var N = 40;
  var kappen = new THREE.InstancedMesh(kappenGeo, elfenbein, N), ringe = new THREE.InstancedMesh(ringGeo, st.chrom, N), stiele = new THREE.InstancedMesh(stielGeo, st.chrom, N);
  [kappen, ringe, stiele].forEach(function (m) { m.castShadow = true; m.receiveShadow = true; sm.add(m); });
  var tasten = [];
  for (var r = 0; r < 4; r++) {
    for (var c = 0; c < 10; c++) {
      tasten.push({ x: (c - 4.5) * 0.057 + r * 0.011, y: 0.13 + r * 0.03, z: 0.24 - r * 0.056, druck: 0 });
    }
  }
  var leer = netz(new RoundedBoxGeometry(0.34, 0.012, 0.03, 2, 0.005), st.chrom);
  leer.position.set(0.02, 0.1, 0.295);
  sm.add(leer);
  var mtx = new THREE.Matrix4(), qa = new THREE.Quaternion(), qRing = new THREE.Quaternion().setFromAxisAngle(V().set(1, 0, 0), Math.PI / 2), eins = V().set(1, 1, 1), pos = V();
  function tastenStellen() {
    for (var i = 0; i < N; i++) {
      var ta = tasten[i], dy = -ta.druck * 0.012;
      pos.set(ta.x, ta.y + dy, ta.z); mtx.compose(pos, qa, eins); kappen.setMatrixAt(i, mtx);
      pos.set(ta.x, ta.y + dy - 0.003, ta.z); mtx.compose(pos, qRing, eins); ringe.setMatrixAt(i, mtx);
      pos.set(ta.x, ta.y + dy - 0.035, ta.z - 0.006); mtx.compose(pos, qa, eins); stiele.setMatrixAt(i, mtx);
    }
    kappen.instanceMatrix.needsUpdate = true; ringe.instanceMatrix.needsUpdate = true; stiele.instanceMatrix.needsUpdate = true;
  }
  tastenStellen();
  // Typenhebel im Halbkreis vor der Walze
  var HEBEL = 28, hebelGeo = new THREE.BoxGeometry(0.005, 0.004, 0.13);
  hebelGeo.translate(0, 0, 0.065);
  var hebel = new THREE.InstancedMesh(hebelGeo, st.chrom, HEBEL);
  hebel.castShadow = true;
  sm.add(hebel);
  var hebelAnschlag = new Float32Array(HEBEL);
  var korb = V().set(0, 0.16, -0.045);
  var hq_ = new THREE.Quaternion(), he = new THREE.Euler();
  function hebelStellen() {
    for (var i = 0; i < HEBEL; i++) {
      var a = (i / (HEBEL - 1) - 0.5) * 2.3;
      var hoch = hebelAnschlag[i];
      he.set(mische(0.08, -1.05, hoch), a * (1 - hoch * 0.9), 0, "YXZ");
      hq_.setFromEuler(he);
      pos.set(korb.x + Math.sin(a) * 0.1 * (1 - hoch), korb.y - 0.02, korb.z + Math.cos(a) * 0.1 * (1 - hoch) + 0.02);
      mtx.compose(pos, hq_, eins);
      hebel.setMatrixAt(i, mtx);
    }
    hebel.instanceMatrix.needsUpdate = true;
  }
  hebelStellen();
  // Wagen mit Walze, Papierstütze, Hebel und Papier (fährt entlang X)
  var wagen = new THREE.Group();
  sm.add(wagen);
  var walze = rohr(0.052, 0.66, st.gummi, 36); walze.position.set(0, 0.29, -0.15); wagen.add(walze);
  [-1, 1].forEach(function (s) {
    var kn = rohr(0.036, 0.045, st.chrom, 28); kn.position.set(s * 0.36, 0.29, -0.15); wagen.add(kn);
    var kn2 = rohr(0.028, 0.03, st.lack, 24); kn2.position.set(s * 0.395, 0.29, -0.15); wagen.add(kn2);
  });
  var stuetze = netz(new RoundedBoxGeometry(0.6, 0.008, 0.13, 2, 0.004), st.lack); stuetze.position.set(0, 0.34, -0.22); stuetze.rotation.x = 0.6; wagen.add(stuetze);
  var hebelKurve = new THREE.CatmullRomCurve3([V().set(-0.33, 0.3, -0.12), V().set(-0.4, 0.34, -0.05), V().set(-0.42, 0.37, 0.06), V().set(-0.4, 0.38, 0.12)]);
  var rueck = netz(new THREE.TubeGeometry(hebelKurve, 20, 0.007, 8), st.chrom); wagen.add(rueck);
  var rueckKnopf = netz(new THREE.SphereGeometry(0.014, 12, 8), st.lack); rueckKnopf.position.set(-0.4, 0.38, 0.12); wagen.add(rueckKnopf);
  // Farbband-Spulen
  [-1, 1].forEach(function (s) {
    var spule = netz(new THREE.CylinderGeometry(0.042, 0.042, 0.018, 28), st.chrom); spule.position.set(s * 0.21, 0.245, -0.02); sm.add(spule);
    var band = netz(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 24), st.gummi); band.position.set(s * 0.21, 0.247, -0.02); sm.add(band);
  });
  // Papier: Leinwand mit getippten Zeilen
  var ZEILEN = 5, ZEICHEN = 18;
  var papierTex = malTextur(512, 700, function (c, w, h) { c.fillStyle = "#f6f1e4"; c.fillRect(0, 0, w, h); });
  // das Papier wird an der Walze abgeschnitten (eigene Ebene zusätzlich zur Scan-Ebene)
  var papierKante = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  var papierStoff = stoff("s", Object.assign({ map: papierTex }, papierStoffBasis));
  papierStoff.clippingPlanes = papierStoff.clippingPlanes.concat([papierKante]);
  var papier = netz(new THREE.PlaneGeometry(0.4, 0.55), papierStoff);
  var papierHalter = new THREE.Group();
  papierHalter.position.set(0, 0.29, -0.185);
  papierHalter.rotation.x = 0.22;
  wagen.add(papierHalter);
  papierHalter.add(papier);
  var walzePunkt = new THREE.Object3D();
  walzePunkt.position.set(0, 0.3, -0.15);
  wagen.add(walzePunkt);
  var i;
  // fliegendes Blatt (zeigt nach dem Auswurf die Vorderseite)
  var flugTex = malTextur(512, 700, function (c, w, h) { c.fillStyle = "#f6f1e4"; c.fillRect(0, 0, w, h); });
  var flug = netz(new THREE.PlaneGeometry(0.4, 0.55), stoff("s", Object.assign({ map: flugTex, transparent: true }, papierStoffBasis)));
  flug.visible = false;
  sm.add(flug);
  var rnd = zufall(31), zeichenBreite = [];
  for (i = 0; i < ZEILEN * ZEICHEN; i++) { zeichenBreite.push(rnd() < 0.16 ? 0 : 0.55 + rnd() * 0.45); }
  function zeilenMalen(tex, bisZeichen) {
    var c = tex.userData.ctx, w = 512, h = 700;
    c.fillStyle = "#f6f1e4"; c.fillRect(0, 0, w, h);
    c.fillStyle = "rgba(0,0,0,0.05)"; c.fillRect(0, 0, w, 6);
    c.fillStyle = "#1f2433";
    c.font = "700 30px " + SCHRIFT;
    c.fillText(namen()[2], 52, 70);
    c.fillStyle = "#b07b1c"; c.fillRect(52, 84, 120, 4);
    c.fillStyle = "#262b38";
    for (var n = 0; n < bisZeichen; n++) {
      var z = Math.floor(n / ZEICHEN), s = n % ZEICHEN, b = zeichenBreite[n];
      if (b > 0) { c.fillRect(52 + s * 22, 130 + z * 58, 17 * b, 20); }
    }
    tex.needsUpdate = true;
  }
  var gemalt = -1;

  // Ablauf: 8,5 Anschläge pro Sekunde, Zeilenschaltung 0,45 s, Blatt nach 5 Zeilen
  var RATE = 8.5, ZEILE_T = ZEICHEN / RATE + 0.45, BLATT_T = ZEILEN * ZEILE_T + 1.8;
  var ziel = V(), pol = V(), hq = new THREE.Quaternion(), p = V(), taste = V();
  function tasteWelt(i, druck, aus) {
    var ta = tasten[i];
    aus.set(ta.x, ta.y + 0.006 - druck * 0.012, ta.z);
    return sm.localToWorld(aus);
  }
  var letzteTaste = { "-1": 9, "1": 30 };
  var letzteAnzeige = -1;
  return {
    j: 2, gruppe: gruppe, oben: 3.0, symbol: 2,
    platz: { x: -0.42, z: -0.38, dreh: 0.55 },
    fortschritt: 0,
    aktiviert: function () { letzteAnzeige = -1; },
    tick: function (t) {
      var rob = k.rob, g = rob.g;
      var zb = t % BLATT_T, zeile = Math.floor(zb / ZEILE_T), inZeile = zb - zeile * ZEILE_T;
      var tipp = zeile < ZEILEN ? Math.min(ZEICHEN, Math.floor(inZeile * RATE)) : ZEICHEN;
      var getippt = zeile < ZEILEN ? zeile * ZEICHEN + tipp : ZEILEN * ZEICHEN;
      this.fortschritt = getippt / (ZEILEN * ZEICHEN);
      if (getippt !== gemalt) { zeilenMalen(papierTex, getippt); gemalt = getippt; }
      // das Brust-Display zeigt mit, wie weit die Seite ist
      var anzeige = Math.floor(this.fortschritt * 16);
      if (anzeige !== letzteAnzeige) { letzteAnzeige = anzeige; rob.displayMalen(2, farbeVon(2), this.fortschritt); }
      // Wagen: rückt je Anschlag weiter, die Zeilenschaltung fährt ihn zurück
      var schritt = 0.017, schreibT = ZEICHEN / RATE, wagenX = 0, vorschub;
      if (zeile < ZEILEN) {
        wagenX = inZeile < schreibT ? tipp * schritt : mische(ZEICHEN * schritt, 0, weich(seg(inZeile, schreibT, schreibT + 0.42)));
        vorschub = zeile + weich(seg(inZeile, schreibT, schreibT + 0.3));
      } else { vorschub = ZEILEN; }
      wagen.position.x = 0.15 - wagenX;
      // Blatt: die aktuelle Zeile steht an der Walze; nach der letzten Zeile fliegt es davon, ein neues kommt
      var blattEnde = ZEILEN * ZEILE_T;
      var aus = seg(zb, blattEnde, blattEnde + 1.2), neu = seg(zb, blattEnde + 0.9, BLATT_T);
      var py = -0.105 + 0.0456 * vorschub;
      if (aus > 0) { py = neu > 0 ? -0.105 - 0.3 * (1 - weich(neu)) : 0.5; }
      if (neu > 0 && gemalt !== 0) { zeilenMalen(papierTex, 0); gemalt = 0; }
      papier.position.y = py;
      papier.visible = aus <= 0 || neu > 0;
      walzePunkt.getWorldPosition(p);
      papierKante.constant = -(p.y - 0.01);
      flug.visible = aus > 0 && aus < 1;
      if (flug.visible) {
        var nrBlatt = Math.floor(t / BLATT_T);
        if (flug.userData.blatt !== nrBlatt) { flug.userData.blatt = nrBlatt; zeilenMalen(flugTex, ZEILEN * ZEICHEN); }
        var f = weich(aus);
        flug.position.set(wagen.position.x + f * 0.35, 0.62 + f * 1.25, -0.2 - f * 0.1);
        flug.rotation.set(0.22 - f * 0.4, f * Math.PI * 1.0, f * 0.25);
        flug.material.opacity = 1 - weich(seg(aus, 0.75, 1));
      }
      // Tasten, Typenhebel
      for (var i = 0; i < tasten.length; i++) { tasten[i].druck = 0; }
      hebelAnschlag.fill(0);
      var phase = inZeile * RATE, nr = Math.floor(phase), frac = phase - nr;
      var anschlagAktiv = zeile < ZEILEN && nr < ZEICHEN;
      var hand = -1, tIndex = 0;
      if (anschlagAktiv) {
        var h = Math.imul((zeile * 97 + nr * 31 + Math.floor(t / BLATT_T) * 13) | 0, 2654435761) >>> 0;
        tIndex = h % 40;
        hand = (tIndex % 10) < 5 ? 1 : -1;        // linke Hälfte der Tasten: linke Hand (+X des Roboters)
        var druck = frac < 0.35 ? weich(frac / 0.35) : 1 - weich(seg(frac, 0.35, 0.8));
        tasten[tIndex].druck = druck;
        hebelAnschlag[(tIndex * 7) % HEBEL] = druck;
        letzteTaste[hand] = tIndex;
      }
      tastenStellen();
      hebelStellen();
      // Roboter
      rob.leben(t);
      g.torso.rotation.set(0.2, 0.0, 0);
      rob.wurzel.updateMatrixWorld(true);
      tasteWelt(17, 0, p);
      p.y += 0.25;
      rob.blick(p, 0.9);
      g.kopf.rotation.x += 0.18;
      rob.augen(rob.blinzeln, Math.sin(t * 2.1) * 0.25, -0.5);
      [1, -1].forEach(function (s) {
        var ti = letzteTaste[s], aktiv = anschlagAktiv && hand === s;
        var d = aktiv ? tasten[ti].druck : 0;
        tasteWelt(ti, 0, taste);
        // Fingerspitze über der Taste: Handgelenk liegt hinter und über der Spitze
        rob.richtung(0, 0, 1, p);
        ziel.copy(taste).addScaledVector(p, -0.17);
        ziel.y += 0.085 - d * 0.03 + (aktiv ? 0 : 0.03);
        rob.richtung(s, -0.6, -0.3, pol);
        rob.handLage(0, -0.55, 1, 0, -1, -0.35, hq);
        rob.arm(s, ziel, pol, hq);
        rob.finger(s, 0.3, 0.45, [0.55, 0.15 - d * 0.1, 0.6]);
      });
    }
  };
}
