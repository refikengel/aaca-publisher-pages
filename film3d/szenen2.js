/*
  Szenen 3 bis 7: Stimme, Quellen, Freigabe, Kanäle, Ziel (Aufbau wie in szenen.js).
*/
import * as THREE from "../vendor/three/build/three.module.min.js";
import { RoundedBoxGeometry } from "../vendor/three/addons/geometries/RoundedBoxGeometry.js";
import { stoff, malTextur, holzTextur, zufall } from "./stoff.js";
import { klemme, seg, weich, weicher, mische, huegel, anschlag, bahn } from "./helfer.js";
import { netz, bei, gedreht, rohr } from "./szenen.js";
import { farbeVon, FARBEN as FARBE6 } from "./maschine.js";

const V = () => new THREE.Vector3();

// leuchtender Ring (additiv) für Schallwellen, Signale und Bestätigungen
function lichtRing(radius, dicke, farbe, ebenen) {
  var m = new THREE.Mesh(new THREE.TorusGeometry(radius, dicke, 8, 96), new THREE.MeshBasicMaterial({
    color: new THREE.Color(farbe).multiplyScalar(1.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
  }));
  m.material.clippingPlanes = ebenen;
  m.renderOrder = 3;
  return m;
}

// Haken als leuchtende Röhre
function hakenRoehre(groesse, farbe, ebenen) {
  var kurve = new THREE.CatmullRomCurve3([V().set(-0.5, 0.05, 0), V().set(-0.15, -0.32, 0), V().set(0.55, 0.42, 0)].map(function (p) { return p.multiplyScalar(groesse); }), false, "catmullrom", 0.1);
  var m = new THREE.Mesh(new THREE.TubeGeometry(kurve, 24, groesse * 0.07, 10), new THREE.MeshBasicMaterial({
    color: new THREE.Color(farbe).multiplyScalar(1.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
  }));
  m.material.clippingPlanes = ebenen;
  m.renderOrder = 3;
  return m;
}

/* ===================================================================== 3 Stimme */

export function szeneStimme(k) {
  var st = k.st, gruppe = new THREE.Group(), farbe = farbeVon(3);
  var champagner = stoff("p", { color: 0xd9c189, metalness: 1, roughness: 0.27 });
  var gitterTex = malTextur(256, 256, function (c, w, h) {
    c.fillStyle = "#d8d2c2"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#2a2a2a";
    for (var y = 0; y < h; y += 8) { for (var x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) { c.beginPath(); c.arc(x + 2, y + 2, 2.3, 0, Math.PI * 2); c.fill(); } }
  });
  gitterTex.wrapS = gitterTex.wrapT = THREE.RepeatWrapping;
  gitterTex.repeat.set(4, 2);
  var gitter = stoff("p", { color: 0xffffff, map: gitterTex, metalness: 0.85, roughness: 0.38 });
  var schaum = stoff("s", { color: 0x07080b, roughness: 1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });

  var platz = { x: -0.3, z: -0.32, dreh: 0.38 };
  var vor = V().set(Math.sin(platz.dreh), 0, Math.cos(platz.dreh));
  var links = V().set(Math.cos(platz.dreh), 0, -Math.sin(platz.dreh));
  // Mikrofon vor dem Mund, leicht zur Seite, damit das Gesicht frei bleibt
  var mikPos = V().set(platz.x, 1.8, platz.z).addScaledVector(vor, 0.44).addScaledVector(links, 0.1);
  // Bodenstativ rechts im Bild, der Galgen kommt waagerecht von der Seite
  var fussPos = V().set(mikPos.x + 0.62, 0.07, mikPos.z + 0.12);
  var fuss = netz(new THREE.CylinderGeometry(0.2, 0.23, 0.035, 48), st.graphit);
  fuss.position.copy(fussPos).setY(0.088);
  gruppe.add(fuss);
  var STANGE_H = mikPos.y + 0.1 - 0.1;
  var stange = netz(new THREE.CylinderGeometry(0.016, 0.019, STANGE_H, 16), st.chrom);
  stange.position.copy(fussPos).setY(0.1 + STANGE_H / 2);
  gruppe.add(stange);
  var gelenk = netz(new THREE.SphereGeometry(0.035, 20, 14), st.graphit);
  gelenk.position.copy(fussPos).setY(0.1 + STANGE_H);
  gruppe.add(gelenk);
  var galgenEnde = mikPos.clone().add(V().set(0.06, 0.13, 0.0));
  var galgenStart = gelenk.position.clone().add(V().set(0.2, -0.02, 0.02));
  var galgen = netz(new THREE.TubeGeometry(new THREE.LineCurve3(galgenStart, galgenEnde), 1, 0.012, 10), st.chrom);
  gruppe.add(galgen);
  var gegengewicht = netz(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 20), st.graphit);
  gegengewicht.position.copy(galgenStart);
  gegengewicht.quaternion.setFromUnitVectors(V().set(0, 1, 0), galgenEnde.clone().sub(galgenStart).normalize());
  gruppe.add(gegengewicht);
  gruppe.add(bei(k.welt.kontaktSchatten(0.7, 0.7, 0.5), fussPos.x, 0.075, fussPos.z));
  // Mikrofon in Spinne
  var mik = new THREE.Group();
  mik.position.copy(mikPos);
  mik.lookAt(V().set(platz.x, mikPos.y, platz.z));
  gruppe.add(mik);
  var koerper = netz(new THREE.LatheGeometry([new THREE.Vector2(0.001, -0.15), new THREE.Vector2(0.03, -0.148), new THREE.Vector2(0.042, -0.12), new THREE.Vector2(0.046, -0.02), new THREE.Vector2(0.047, 0.02)], 40), champagner);
  mik.add(koerper);
  var korb = netz(new THREE.SphereGeometry(0.05, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2), gitter);
  korb.scale.set(1, 1.9, 1); korb.position.y = 0.02;
  mik.add(korb);
  var korbRing = netz(new THREE.TorusGeometry(0.048, 0.006, 10, 40), st.goldGlanz);
  korbRing.rotation.x = Math.PI / 2; korbRing.position.y = 0.022;
  mik.add(korbRing);
  var spinne = netz(new THREE.TorusGeometry(0.085, 0.007, 10, 48), st.graphit);
  spinne.rotation.x = Math.PI / 2; spinne.position.y = -0.06;
  mik.add(spinne);
  for (var i = 0; i < 4; i++) {
    var a = i * Math.PI / 2 + 0.4;
    var gummi = netz(new THREE.CylinderGeometry(0.0025, 0.0025, 0.07, 6), st.gummi, false);
    gummi.position.set(Math.cos(a) * 0.065, -0.06, Math.sin(a) * 0.065);
    gummi.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    mik.add(gummi);
  }
  var buegel = netz(new THREE.TorusGeometry(0.09, 0.006, 8, 32, Math.PI), st.graphit);
  buegel.position.y = -0.06; buegel.rotation.z = Math.PI;
  mik.add(buegel);
  // Popschutz zwischen Mikrofon und Gesicht
  var popRing = netz(new THREE.TorusGeometry(0.1, 0.006, 8, 48), st.graphit);
  popRing.position.set(0, 0.04, 0.17);
  mik.add(popRing);
  var popTuch = new THREE.Mesh(new THREE.CircleGeometry(0.098, 40), schaum);
  popTuch.position.set(0, 0.04, 0.17);
  mik.add(popTuch);
  // zwei Studiolautsprecher hinten
  var lautsprecher = [];
  [[-1.18, -0.78, 0.55], [1.12, -0.82, -0.62]].forEach(function (p) {
    var lg = new THREE.Group();
    lg.position.set(p[0], 0.07, p[1]);
    lg.rotation.y = p[2];
    gruppe.add(lg);
    var saeule = netz(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 16), st.graphit); saeule.position.y = 0.33; lg.add(saeule);
    var teller = netz(new THREE.CylinderGeometry(0.17, 0.19, 0.03, 32), st.graphit); teller.position.y = 0.015; lg.add(teller);
    var box = netz(new RoundedBoxGeometry(0.36, 0.52, 0.32, 4, 0.035), st.lack); box.position.y = 0.9; lg.add(box);
    var membranGeo = new THREE.LatheGeometry([new THREE.Vector2(0.03, -0.045), new THREE.Vector2(0.06, -0.03), new THREE.Vector2(0.1, -0.008), new THREE.Vector2(0.112, 0)], 48);
    var membran = netz(membranGeo, st.gummi); membran.rotation.x = -Math.PI / 2; membran.position.set(0, 0.82, 0.162); lg.add(membran);
    var kappe = netz(new THREE.SphereGeometry(0.036, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), st.graphit); kappe.rotation.x = Math.PI / 2; kappe.position.set(0, 0.82, 0.13); lg.add(kappe);
    var sicke = netz(new THREE.TorusGeometry(0.116, 0.011, 10, 48), st.gummi); sicke.position.set(0, 0.82, 0.162); lg.add(sicke);
    var rahmen = netz(new THREE.TorusGeometry(0.128, 0.006, 8, 48), st.goldGlanz); rahmen.position.set(0, 0.82, 0.164); lg.add(rahmen);
    var hoch = netz(new THREE.SphereGeometry(0.026, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), st.graphit); hoch.rotation.x = Math.PI / 2; hoch.position.set(0, 1.04, 0.162); lg.add(hoch);
    var hochRing = netz(new THREE.TorusGeometry(0.045, 0.007, 8, 32), st.goldGlanz); hochRing.position.set(0, 1.04, 0.164); lg.add(hochRing);
    lg.add(bei(k.welt.kontaktSchatten(0.6, 0.6, 0.45), 0, 0.005, 0));
    lautsprecher.push({ membran: membran, kappe: kappe });
  });
  // Schallwellen: Ringe, die vom Mund nach vorne wandern
  var wellen = [];
  for (i = 0; i < 5; i++) {
    var w = lichtRing(1, 0.006, farbe, k.scanEbenen);
    w.visible = false;
    gruppe.add(w);
    wellen.push(w);
  }
  function pegel(t) {
    var zyklus = t % 3.6;
    var sprechen = weich(seg(zyklus, 0, 0.15)) * (1 - weich(seg(zyklus, 2.75, 2.95)));
    var silbe = Math.pow(Math.max(0, Math.sin(t * 9.4) * 0.6 + Math.sin(t * 3.1) * 0.4 + 0.25), 1.6);
    return klemme(sprechen * silbe, 0, 1);
  }
  var ziel = V(), pol = V(), hq = new THREE.Quaternion(), p = V(), mund = [0, 0, 0, 0, 0], mundWelt = V();
  var letzteAnzeige = -1;
  return {
    j: 3, gruppe: gruppe, oben: 3.2, symbol: 3, platz: platz,
    tick: function (t) {
      var rob = k.rob, g = rob.g, a = pegel(t);
      rob.leben(t);
      g.torso.rotation.set(0.06 + a * 0.03, Math.sin(t * 0.8) * 0.06, Math.sin(t * 0.6) * 0.02);
      rob.wurzel.updateMatrixWorld(true);
      mik.getWorldPosition(p);
      p.y += 0.05;
      rob.blick(p, 0.85);
      g.kopf.rotation.x += a * 0.06 - 0.04;
      g.kopf.rotation.z = Math.sin(t * 1.3) * 0.04;
      rob.augen(rob.blinzeln * (1 - a * 0.25), Math.sin(t * 0.5) * 0.2, -0.1);
      for (var i = 0; i < 5; i++) { mund[i] = a * (0.35 + 0.65 * Math.abs(Math.sin(t * 13.0 + i * 1.7))); }
      rob.mund(mund);
      // rechte Hand erklärt (offene Hand vor dem Körper), linke Hand ruht am Galgen-Kabel
      var geste = Math.sin(t * 1.7) * 0.5 + 0.5;
      rob.punkt(-0.46 + geste * 0.06, 1.3 + Math.sin(t * 2.3) * 0.05 + a * 0.04, 0.5, ziel);
      rob.richtung(-1, -0.7, -0.3, pol);
      rob.handLage(-0.2, 0.25, 1, 0.3, 0.8, 0.1, hq);
      rob.arm(-1, ziel, pol, hq);
      rob.finger(-1, 0.12 + geste * 0.1, 0.15);
      rob.punkt(0.5, 1.02 + Math.sin(t * 1.1) * 0.02, 0.15, ziel);
      rob.richtung(1, -0.3, -0.4, pol);
      rob.arm(1, ziel, pol, null);
      rob.finger(1, 0.4, 0.3);
      // Lautsprecher bewegen sich mit dem Pegel
      for (i = 0; i < lautsprecher.length; i++) {
        var z = 1 + a * (0.22 + 0.08 * Math.sin(t * 61.0 + i));
        lautsprecher[i].membran.scale.set(1, 1, z);
        lautsprecher[i].kappe.position.z = 0.13 + (z - 1) * 0.045;
      }
      // Wellen: alle 0,42 s eine neue, solange gesprochen wird
      g.kopf.updateWorldMatrix(true, false);
      mundWelt.set(0, 0.17, 0.3); g.kopf.localToWorld(mundWelt);
      gruppe.worldToLocal(mundWelt);
      var basis = Math.floor(t / 0.42);
      for (i = 0; i < wellen.length; i++) {
        var nr = basis - i, alter = t - nr * 0.42, w = wellen[i];
        var start = pegel(nr * 0.42);
        var sicht = start * (1 - seg(alter, 0.2, 1.9));
        w.visible = sicht > 0.02 && alter >= 0;
        if (!w.visible) { continue; }
        var r = 0.06 + alter * 0.42;
        w.scale.setScalar(r);
        w.position.copy(mundWelt).addScaledVector(vor, 0.12 + alter * 0.55);
        w.lookAt(p.copy(w.position).add(vor));
        w.material.opacity = sicht * 0.85;
      }
      // Brust-Display: Pegelbalken (20 Bilder pro Sekunde reichen)
      var bild = Math.floor(t * 20);
      if (bild !== letzteAnzeige) { letzteAnzeige = bild; rob.displayMalen(3, farbe, t * 0.25); }
    }
  };
}

/* ===================================================================== 4 Quellen */

export function szeneQuellen(k) {
  var st = k.st, gruppe = new THREE.Group(), farbe = farbeVon(4), rnd = zufall(77);
  var holz = holzTextur([96, 64, 40], [56, 35, 21]);
  var regalHolz = stoff("p", { color: 0xffffff, map: holz, roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.25 });
  var rueckwand = stoff("p", { color: 0x2a1c13, roughness: 0.75 });
  var leder = stoff("p", { color: 0xffffff, roughness: 0.52, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: 0x806040 });
  var papierFarbe = stoff("s", { color: 0xf1ead8, roughness: 0.9 });
  var FARBEN_B = [0x5b1f22, 0x1c2a4a, 0x1f3b2c, 0x4a2f1c, 0x4d1a2a, 0x7a5a1c, 0x2e3440, 0x3d2a52];

  // Regal hinten rechts
  var regal = new THREE.Group();
  regal.position.set(0.8, 0.07, -0.62);
  regal.rotation.y = -0.55;
  gruppe.add(regal);
  var B = 1.12, H = 1.86, T = 0.34;
  [-1, 1].forEach(function (s) { regal.add(bei(netz(new RoundedBoxGeometry(0.045, H, T, 2, 0.01), regalHolz), s * B / 2, H / 2, 0)); });
  var boeden = [0.03, 0.49, 0.95, 1.41, 1.84];
  boeden.forEach(function (y) { regal.add(bei(netz(new RoundedBoxGeometry(B, 0.035, T, 2, 0.008), regalHolz), 0, y, 0)); });
  var wand = new THREE.Mesh(new THREE.PlaneGeometry(B, H), rueckwand);
  wand.position.set(0, H / 2, -T / 2 + 0.005); wand.receiveShadow = true;
  regal.add(wand);
  regal.add(bei(k.welt.kontaktSchatten(1.6, 0.8, 0.55), 0, 0.005, 0.05));
  // Bücher als Instanzen (Farbe je Buch), Goldbänder auf dem Rücken
  var buchGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.06);
  var buecher = [], NB = 0;
  for (var r = 0; r < 4; r++) {
    var x = -B / 2 + 0.04;
    while (x < B / 2 - 0.08) {
      var bw = 0.034 + rnd() * 0.032, bh = 0.3 + rnd() * 0.1, bt = 0.21 + rnd() * 0.05;
      buecher.push({ x: x + bw / 2, y: boeden[r] + 0.0175 + bh / 2, z: T / 2 - bt / 2 - 0.02, w: bw, h: bh, t: bt, farbe: FARBEN_B[Math.floor(rnd() * FARBEN_B.length)], weg: 0 });
      x += bw + 0.004;
    }
  }
  NB = buecher.length;
  var buchMesh = new THREE.InstancedMesh(buchGeo, leder, NB);
  var bandMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), st.goldGlanz, NB * 2);
  buchMesh.castShadow = true; buchMesh.receiveShadow = true;
  regal.add(buchMesh); regal.add(bandMesh);
  var mtx = new THREE.Matrix4(), qn = new THREE.Quaternion(), sk = V(), ps = V(), farbeT = new THREE.Color();
  function buecherStellen() {
    for (var i = 0; i < NB; i++) {
      var b = buecher[i], raus = b.weg;
      var sichtbar = raus < 0.999 ? 1 : 0;
      ps.set(b.x, b.y, b.z + raus * 0.18);
      sk.set(b.w, b.h, b.t).multiplyScalar(sichtbar || 0.0001);
      mtx.compose(ps, qn, sk); buchMesh.setMatrixAt(i, mtx);
      for (var j = 0; j < 2; j++) {
        ps.set(b.x, b.y + (j ? 0.32 : -0.32) * b.h, b.z + b.t / 2 + 0.001 + raus * 0.18);
        sk.set(b.w * 0.92, 0.007, 0.004).multiplyScalar(sichtbar || 0.0001);
        mtx.compose(ps, qn, sk); bandMesh.setMatrixAt(i * 2 + j, mtx);
      }
    }
    buchMesh.instanceMatrix.needsUpdate = true; bandMesh.instanceMatrix.needsUpdate = true;
  }
  for (var i = 0; i < NB; i++) { buchMesh.setColorAt(i, farbeT.setHex(buecher[i].farbe)); }
  buchMesh.instanceColor.needsUpdate = true;
  buecherStellen();
  // Ablage rechts vorne: kleiner runder Tisch, darauf der Stapel geprüfter Bücher
  var tisch = new THREE.Group();
  tisch.position.set(0.95, 0.07, 0.5);
  gruppe.add(tisch);
  tisch.add(bei(netz(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 48), regalHolz), 0, 0.72, 0));
  tisch.add(bei(netz(new THREE.CylinderGeometry(0.03, 0.04, 0.7, 16), st.goldGebuerstet), 0, 0.36, 0));
  tisch.add(bei(netz(new THREE.CylinderGeometry(0.17, 0.2, 0.025, 32), st.goldGebuerstet), 0, 0.012, 0));
  tisch.add(bei(k.welt.kontaktSchatten(0.8, 0.8, 0.5), 0, 0.005, 0));
  var STAPEL = [5, 17, 29, 41].map(function (n) { return Math.min(NB - 1, n); });
  var flieger = STAPEL.map(function (n) {
    var b = buecher[n];
    var m = netz(new RoundedBoxGeometry(b.w, b.h, b.t, 2, 0.006), stoff("p", { color: b.farbe, roughness: 0.52, clearcoat: 0.35 }));
    m.visible = false;
    gruppe.add(m);
    return { n: n, m: m };
  });
  var haken = hakenRoehre(0.16, farbe, k.scanEbenen);
  haken.visible = false;
  gruppe.add(haken);
  var hakenRing = lichtRing(0.2, 0.006, farbe, k.scanEbenen);
  hakenRing.rotation.x = Math.PI / 2;
  hakenRing.visible = false;
  gruppe.add(hakenRing);

  // Buch in den Händen des Roboters: zwei Deckel, Seitenblock, eine Seite blättert
  var seitenTex = malTextur(256, 360, function (c, w, h) {
    c.fillStyle = "#f3ecda"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#3a3f4d";
    for (var z = 0; z < 13; z++) { var l = 150 + ((z * 37) % 50); c.fillRect(26, 34 + z * 24, l, 7); }
  });
  var seitenStoff = stoff("s", { color: 0xffffff, map: seitenTex, roughness: 0.9, side: THREE.DoubleSide });
  var buch = new THREE.Group();
  gruppe.add(buch);
  var BW = 0.27, BH = 0.37;
  var deckelStoff = stoff("p", { color: 0x8a2f33, roughness: 0.48, clearcoat: 0.45, sheen: 0.3, sheenColor: 0xd08a6a });
  [-1, 1].forEach(function (s) {
    var deckel = netz(new RoundedBoxGeometry(BW, 0.012, BH, 2, 0.004), deckelStoff);
    deckel.position.set(s * BW / 2, -0.012, 0);
    buch.add(deckel);
    var block = netz(new THREE.BoxGeometry(BW - 0.012, 0.022, BH - 0.014), papierFarbe);
    block.position.set(s * (BW / 2 - 0.004), 0.006, 0);
    buch.add(block);
    var seite = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.016, BH - 0.018), seitenStoff);
    seite.rotation.x = -Math.PI / 2;
    seite.position.set(s * (BW / 2 - 0.006), 0.0176, 0);
    buch.add(seite);
  });
  var blatt = new THREE.Group();
  blatt.position.y = 0.019;
  buch.add(blatt);
  var blattSeite = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.016, BH - 0.018), seitenStoff);
  blattSeite.rotation.x = -Math.PI / 2;
  blattSeite.position.x = BW / 2 - 0.008;
  blatt.add(blattSeite);
  // Lesestrahl aus dem Visier (heller Kegel)
  var strahl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1, 32, 1, true), new THREE.MeshBasicMaterial({
    color: new THREE.Color(farbe).multiplyScalar(1.2), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
  }));
  strahl.material.clippingPlanes = k.scanEbenen;
  strahl.geometry.translate(0, -0.5, 0);
  strahl.renderOrder = 3;
  gruppe.add(strahl);
  var strahlZiel = new THREE.Object3D();
  buch.add(strahlZiel);

  var platz = { x: -0.32, z: -0.02, dreh: 0.32 };
  var ziel = V(), pol = V(), hq = new THREE.Quaternion(), p = V(), augeW = V(), stapelPos = V(), a0 = V(), a1 = V(), unten = V().set(0, -1, 0);
  var ZYKLUS = 3.1, RUNDE = ZYKLUS * STAPEL.length + 1.6;
  return {
    j: 4, gruppe: gruppe, oben: 3.0, symbol: 4, platz: platz,
    tick: function (t) {
      var rob = k.rob, g = rob.g;
      var tr = t % RUNDE, runde = Math.floor(t / RUNDE);
      // fliegende Bücher: aus dem Regal ziehen, im Bogen zur Ablage, flach auf den Stapel
      var hakenSicht = 0;
      for (var i = 0; i < flieger.length; i++) {
        var f = flieger[i], b = buecher[f.n], t0 = i * ZYKLUS + 0.3;
        var raus = seg(tr, t0, t0 + 0.45), flug = seg(tr, t0 + 0.45, t0 + 1.45);
        var zurueck = seg(tr, RUNDE - 1.4, RUNDE - 0.3);
        b.weg = zurueck > 0 ? (zurueck < 1 ? 1 : 0) : (flug > 0 ? 1 : raus * 0.999);
        f.m.visible = flug > 0 && zurueck < 1;
        if (!f.m.visible) { continue; }
        a0.set(b.x, b.y, b.z + 0.18); regal.localToWorld(a0); gruppe.worldToLocal(a0);
        stapelPos.set(0, 0.74 + 0.018 + i * 0.037, 0); tisch.localToWorld(stapelPos); gruppe.worldToLocal(stapelPos);
        var u = weich(flug);
        if (zurueck > 0) { u = 1 - weich(zurueck); }
        f.m.position.lerpVectors(a0, stapelPos, u);
        f.m.position.y += Math.sin(u * Math.PI) * 0.55;
        f.m.rotation.set(-u * Math.PI / 2, regal.rotation.y * (1 - u) + u * (0.3 + i * 0.2), u * Math.PI / 2);
        if (flug >= 1 && zurueck <= 0) { hakenSicht = Math.max(hakenSicht, 1 - seg(tr, t0 + 1.45, t0 + 2.6)); }
      }
      buecherStellen();
      haken.visible = hakenRing.visible = hakenSicht > 0.01;
      if (haken.visible) {
        stapelPos.set(0, 1.25, 0); tisch.localToWorld(stapelPos); gruppe.worldToLocal(stapelPos);
        haken.position.copy(stapelPos); haken.position.y += (1 - hakenSicht) * 0.15;
        k.welt.kamera.getWorldPosition(p); gruppe.worldToLocal(p); haken.lookAt(p);
        haken.material.opacity = hakenSicht;
        hakenRing.position.copy(stapelPos); hakenRing.position.y -= 0.42;
        hakenRing.scale.setScalar(1 + (1 - hakenSicht) * 0.8);
        hakenRing.material.opacity = hakenSicht * 0.8;
      }
      // Roboter liest im Buch: Kopf folgt den Zeilen, alle 2,2 s wird umgeblättert
      rob.leben(t);
      g.torso.rotation.set(0.1, Math.sin(t * 0.5) * 0.05, 0);
      rob.wurzel.updateMatrixWorld(true);
      rob.punkt(0, 1.17, 0.52, p); gruppe.worldToLocal(p);
      buch.position.copy(p);
      buch.rotation.set(0, platz.dreh, 0);
      buch.rotateX(-0.42);
      var blaettern = (t % 2.2) / 2.2, wende = seg(blaettern, 0.78, 1.0);
      blatt.rotation.z = weich(wende) * Math.PI;
      var zeileU = seg(blaettern, 0.05, 0.75);
      strahlZiel.position.set(0.07 + 0.05 * Math.sin(zeileU * 60), 0.02, -0.15 + zeileU * 0.3);
      strahlZiel.getWorldPosition(p);
      rob.blick(p, 1);
      rob.augen(rob.blinzeln, Math.sin(zeileU * 60) * 0.35, -0.6);
      // Strahl vom Visier zur Zeile
      g.kopf.updateWorldMatrix(true, false);
      augeW.set(0, 0.2, 0.3); g.kopf.localToWorld(augeW);
      gruppe.worldToLocal(augeW); gruppe.worldToLocal(p);
      strahl.position.copy(augeW);
      var dist = augeW.distanceTo(p);
      strahl.scale.set(1, dist, 1);
      strahl.quaternion.setFromUnitVectors(unten, a1.copy(p).sub(augeW).normalize());
      strahl.material.opacity = 0.2 * (1 - wende);
      // Hände tragen das Buch von unten an den Seiten: Handflächen nach oben unter den Deckeln,
      // Finger zeigen nach innen und nach vorn unter das Buch
      [1, -1].forEach(function (s) {
        ziel.set(s * 0.19, -0.02, -0.06);
        buch.localToWorld(ziel);
        rob.richtung(s, -0.8, -0.2, pol);
        rob.greifen(s, ziel, -s * 0.5, 0.35, 0.78, 0, 0.91, -0.41, pol);
        rob.finger(s, 0.22, 0.3);
      });
      if (runde !== this._runde) { this._runde = runde; }
    }
  };
}

/* ===================================================================== 5 Freigabe */

// Hologramm-Material: leuchtende Kanten (Fresnel) und feine Zeilen
function hologrammStoff(farbe, ebenen) {
  var m = new THREE.ShaderMaterial({
    uniforms: { uFarbe: { value: new THREE.Color(farbe) }, uSicht: { value: 1 }, uZeit: { value: 0 }, uObenY: { value: 10 } },
    vertexShader: [
      "varying vec3 vN; varying vec3 vV; varying float vY;",
      "#include <clipping_planes_pars_vertex>",
      "void main() {",
      "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
      "  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);",
      "  vY = (modelMatrix * vec4(position, 1.0)).y;",
      "  gl_Position = projectionMatrix * mv;",
      "  vec4 mvPosition = mv;",
      "  #include <clipping_planes_vertex>",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 uFarbe; uniform float uSicht; uniform float uZeit; uniform float uObenY; varying vec3 vN; varying vec3 vV; varying float vY;",
      "#include <clipping_planes_pars_fragment>",
      "void main() {",
      "  #include <clipping_planes_fragment>",
      "  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);",
      "  float zeilen = 0.88 + 0.12 * sin(vY * 160.0 - uZeit * 6.0);",
      "  float oben = 1.0 - smoothstep(uObenY - 0.28, uObenY, vY);",
      "  float a = (0.16 + f * 1.4) * zeilen * oben * uSicht;",
      "  gl_FragColor = vec4(uFarbe * a * 1.25, 1.0);",
      "}"
    ].join("\n"),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, clipping: true, toneMapped: false
  });
  m.clippingPlanes = ebenen;
  return m;
}

function hologrammHand(stoffH) {
  var hand = new THREE.Group();
  var handflaeche = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.1, 0.03, 3, 0.012), stoffH);
  handflaeche.position.y = -0.05;
  hand.add(handflaeche);
  var finger = [];
  [[-0.032, 0.95], [-0.011, 1.05], [0.011, 1.0], [0.031, 0.82]].forEach(function (f, i) {
    var basis = new THREE.Group(); basis.position.set(f[0], -0.1, 0); hand.add(basis);
    var glieder = [], eltern = basis;
    [0.034, 0.024, 0.02].forEach(function (l, j) {
      var gl = new THREE.Group(); eltern.add(gl);
      if (j) { gl.position.y = -[0.034, 0.024, 0.02][j - 1] * f[1]; }
      var m = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095 - j * 0.0012, l * f[1] - 0.012, 4, 10), stoffH);
      m.position.y = -l * f[1] / 2;
      gl.add(m);
      glieder.push(gl);
      eltern = gl;
    });
    finger.push(glieder);
  });
  var daumen = new THREE.Group(); daumen.position.set(0.045, -0.035, 0.01); daumen.rotation.set(0.3, 0, 0.75); hand.add(daumen);
  var d1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.028, 4, 10), stoffH); d1.position.y = -0.02; daumen.add(d1);
  var d2g = new THREE.Group(); d2g.position.y = -0.04; daumen.add(d2g);
  var d2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.018, 4, 10), stoffH); d2.position.y = -0.015; d2g.add(d2);
  var arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.22, 4, 12), stoffH);
  arm.position.y = 0.13;
  hand.add(arm);
  hand.userData = { finger: finger, daumen: [daumen, d2g] };
  return hand;
}

// kleine Helfer für die Etagen der Kiste: dieselbe Formensprache wie der große Roboter (Perlmutt,
// dunkles Visier), statt des Heiligenscheins eine kurze Antenne in der Farbe der Station
function helferTeile() {
  var profil = [[0.012, 0], [0.021, 0.008], [0.029, 0.028], [0.032, 0.048], [0.029, 0.064], [0.018, 0.075], [0.0005, 0.078]];
  var kurve = new THREE.SplineCurve(profil.map(function (p) { return new THREE.Vector2(p[0], p[1]); }));
  return {
    rumpf: new THREE.LatheGeometry(kurve.getPoints(16), 22),
    kopf: new THREE.SphereGeometry(0.027, 22, 16),
    visier: new THREE.SphereGeometry(0.0279, 22, 10, Math.PI / 2 - 0.92, 1.84, 1.08, 0.98),
    auge: new THREE.CapsuleGeometry(0.0032, 0.004, 2, 8),
    arm: new THREE.CapsuleGeometry(0.0078, 0.03, 3, 10),
    hand: new THREE.SphereGeometry(0.0088, 12, 8),
    antenne: new THREE.CylinderGeometry(0.0016, 0.0016, 0.018, 6),
    kugel: new THREE.SphereGeometry(0.0058, 10, 8)
  };
}

function helfer(teile, st, licht) {
  var h = new THREE.Group();
  var leib = new THREE.Group();
  h.add(leib);
  leib.add(netz(teile.rumpf, st.perl));
  var kopf = new THREE.Group();
  kopf.position.y = 0.1;
  kopf.rotation.order = "YXZ";
  leib.add(kopf);
  kopf.add(netz(teile.kopf, st.perl, false));
  kopf.add(netz(teile.visier, st.visier, false));
  [-1, 1].forEach(function (s) {
    var auge = netz(teile.auge, licht, false);
    auge.position.set(s * 0.0088, 0.002, 0.0268);
    auge.scale.z = 0.5;
    kopf.add(auge);
  });
  kopf.add(bei(netz(teile.antenne, st.graphit, false), 0, 0.034, 0));
  kopf.add(bei(netz(teile.kugel, licht, false), 0, 0.045, 0));
  var arme = {};
  [1, -1].forEach(function (s) {
    var schulter = new THREE.Group();
    schulter.position.set(s * 0.039, 0.058, 0);
    leib.add(schulter);
    schulter.add(bei(netz(teile.arm, st.perl, false), 0, -0.021, 0));
    schulter.add(bei(netz(teile.hand, st.graphit, false), 0, -0.043, 0));
    arme[s] = schulter;
  });
  return { g: h, leib: leib, kopf: kopf, links: arme[1], rechts: arme[-1] };
}

export function szeneFreigabe(k) {
  var st = k.st, gruppe = new THREE.Group(), farbe = farbeVon(5);
  var fc = new THREE.Color(farbe), fHex = "#" + fc.getHexString();
  var platz = { x: -0.66, z: -0.2, dreh: 0.72 };
  var vor = V().set(Math.sin(platz.dreh), 0, Math.cos(platz.dreh));
  var i, a;

  // Pult vor dem Roboter: Sockel, Korpus und eine fast flache Bedienplatte (so bleiben Knopf und Feld
  // auch von vorn lesbar). Vom Roboter aus rechts der goldene Freigabeknopf, links das Feld, auf dem der
  // Betreiber per Fingerabdruck freigibt. Die Front zeigt zur Kamera: Statusleiste und sechs Leuchtpunkte.
  var pult = new THREE.Group();
  pult.position.set(platz.x + vor.x * 0.6, 0.07, platz.z + vor.z * 0.6);
  pult.rotation.y = platz.dreh + Math.PI;            // Bedienseite (lokal +Z) zum Roboter
  gruppe.add(pult);
  pult.add(bei(k.welt.kontaktSchatten(0.95, 0.75, 0.6), 0, 0.005, 0));
  pult.add(bei(netz(new RoundedBoxGeometry(0.62, 0.06, 0.4, 3, 0.02), st.graphit), 0, 0.03, 0));
  pult.add(bei(netz(new RoundedBoxGeometry(0.6, 0.008, 0.38, 2, 0.004), st.goldGlanz, false), 0, 0.062, 0));
  pult.add(bei(netz(new RoundedBoxGeometry(0.5, 0.76, 0.28, 4, 0.035), st.lack), 0, 0.44, 0));
  pult.add(bei(netz(new RoundedBoxGeometry(0.42, 0.48, 0.008, 3, 0.012), st.goldGlanz, false), 0, 0.47, -0.144));
  pult.add(bei(netz(new RoundedBoxGeometry(0.4, 0.46, 0.014, 3, 0.012), st.visier, false), 0, 0.47, -0.149));
  var leisteStoff = stoff("s", { color: 0x000000, emissive: 0x8090a8, emissiveIntensity: 0.45, roughness: 0.4 });
  pult.add(bei(netz(new RoundedBoxGeometry(0.28, 0.022, 0.008, 2, 0.006), leisteStoff, false), 0, 0.6, -0.158));
  var platte = new THREE.Group();
  platte.position.y = 0.84;
  platte.rotation.x = 0.06;                          // kaum zum Roboter geneigt
  pult.add(platte);
  platte.add(netz(new RoundedBoxGeometry(0.68, 0.04, 0.4, 3, 0.016), st.graphit));
  platte.add(bei(netz(new RoundedBoxGeometry(0.69, 0.01, 0.41, 2, 0.005), st.goldGlanz, false), 0, -0.018, 0));
  // Freigabeknopf: Kragen, Goldring, gewölbte Kappe (fährt beim Drücken ein)
  var knopf = new THREE.Group();
  knopf.position.set(0.14, 0.02, 0.0);
  platte.add(knopf);
  knopf.add(bei(netz(new THREE.CylinderGeometry(0.088, 0.096, 0.04, 44), st.graphit), 0, 0.02, 0));
  var knopfRing = netz(new THREE.TorusGeometry(0.082, 0.009, 12, 52), st.goldGlanz);
  knopfRing.rotation.x = Math.PI / 2; knopfRing.position.y = 0.04;
  knopf.add(knopfRing);
  var kappe = new THREE.Group();
  knopf.add(kappe);
  var kappenStoff = stoff("p", { color: 0xf0c56d, roughness: 0.18, metalness: 1, emissive: 0xffb84a, emissiveIntensity: 0 });
  var kappenForm = netz(new THREE.SphereGeometry(0.07, 44, 22, 0, Math.PI * 2, 0, Math.PI / 2), kappenStoff);
  kappenForm.position.y = 0.038; kappenForm.scale.y = 0.62;
  kappe.add(kappenForm);
  var knopfOben = new THREE.Object3D(); knopfOben.position.set(0, 0.082, 0); kappe.add(knopfOben);
  // Feld für den Fingerabdruck: Glasfläche auf einem goldenen Sockel
  var abdruckTex = malTextur(256, 256, function () {});
  platte.add(bei(netz(new RoundedBoxGeometry(0.17, 0.022, 0.21, 2, 0.008), st.goldGlanz), -0.13, 0.025, 0));
  var feld = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.19), stoff("p", { color: 0x050a10, emissive: 0xffffff, emissiveMap: abdruckTex, emissiveIntensity: 1.3, roughness: 0.05, clearcoat: 1 }));
  feld.rotation.x = -Math.PI / 2;
  feld.position.set(-0.13, 0.0365, 0);
  platte.add(feld);
  var feldPunkt = new THREE.Object3D(); feldPunkt.position.set(-0.13, 0.04, 0); platte.add(feldPunkt);
  // Ruheplätze der Hände auf der Platte (zum Roboter hin, links und rechts)
  var ruheL = new THREE.Object3D(); ruheL.position.set(-0.3, 0.024, 0.16); platte.add(ruheL);
  var ruheR = new THREE.Object3D(); ruheR.position.set(0.3, 0.024, 0.16); platte.add(ruheR);

  // Fingerabdruck: Linien wirbeln um einen Kern, Aufdeckung von der Mitte nach außen
  var rnd = zufall(5), linien = [];
  for (i = 0; i < 26; i++) {
    var r0 = 8 + i * 4.3, pts = [];
    for (a = 0; a <= Math.PI * 2 + 0.01; a += 0.12) {
      var wob = Math.sin(a * 3 + i * 0.7) * 1.6 + Math.sin(a * 5 + i) * 0.8;
      pts.push([128 + Math.cos(a) * (r0 + wob) * 0.82, 136 + Math.sin(a) * (r0 + wob) * (1.05 + i * 0.006) - (a > Math.PI ? 0 : i * 0.25)]);
    }
    linien.push({ r: r0, pts: pts, luecke: rnd() * Math.PI * 2 });
  }
  function abdruck(fort, bestaetigt) {
    var c = abdruckTex.userData.ctx;
    c.fillStyle = "#000"; c.fillRect(0, 0, 256, 256);
    c.lineWidth = 2.4; c.lineCap = "round";
    var grenze = fort * 125;
    for (var i = 0; i < linien.length; i++) {
      var L = linien[i];
      if (L.r > grenze) { break; }
      c.strokeStyle = bestaetigt ? fHex : "rgba(150,200,255,0.9)";
      c.beginPath();
      for (var j = 0; j < L.pts.length; j++) {
        var aa = j * 0.12;
        if (Math.abs(((aa - L.luecke + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.25) { c.moveTo(L.pts[j][0], L.pts[j][1]); continue; }
        if (j) { c.lineTo(L.pts[j][0], L.pts[j][1]); } else { c.moveTo(L.pts[j][0], L.pts[j][1]); }
      }
      c.stroke();
    }
    abdruckTex.needsUpdate = true;
  }
  abdruck(0, false);
  var holo = hologrammStoff(0xffe2b0, k.scanEbenen);
  var hand = hologrammHand(holo);
  hand.scale.setScalar(1.6);
  gruppe.add(hand);
  var ring = lichtRing(0.12, 0.005, farbe, k.scanEbenen);
  ring.visible = false;
  gruppe.add(ring);

  // Kiste mit sechs Etagen rechts vor dem Roboter: baut sich nach dem Knopfdruck Etage für Etage auf;
  // in jeder Etage arbeitet ein kleiner Helfer an seiner Station (Farbe der Station an Leuchtstreifen,
  // Rückwand und Antenne)
  var kiste = new THREE.Group();
  kiste.position.set(1.02, 0.07, 0.3);
  kiste.rotation.y = -0.42;
  kiste.scale.setScalar(1.22);
  gruppe.add(kiste);
  kiste.add(bei(k.welt.kontaktSchatten(1.3, 1.0, 0.6), 0, 0.005, 0));
  var KB = 0.86, KT = 0.44, EH = 0.23, N_ETAGE = 6;
  var boden = netz(new RoundedBoxGeometry(KB + 0.06, 0.06, KT + 0.06, 3, 0.02), st.graphit);
  boden.position.y = 0.03;
  kiste.add(boden);
  var rueck = netz(new RoundedBoxGeometry(KB, EH * N_ETAGE, 0.02, 2, 0.008), st.nacht);
  rueck.position.set(0, 0.06 + EH * N_ETAGE / 2, -KT / 2 + 0.01);
  kiste.add(rueck);
  var pfosten = [];
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (e) {
    var pf = netz(new THREE.CylinderGeometry(0.012, 0.012, 1, 10), st.goldGebuerstet);
    pf.geometry.translate(0, 0.5, 0);
    pf.position.set(e[0] * (KB / 2 + 0.01), 0.06, e[1] * (KT / 2 - 0.005));
    kiste.add(pf);
    pfosten.push(pf);
  });
  var dach = netz(new RoundedBoxGeometry(KB + 0.06, 0.035, KT + 0.06, 3, 0.012), st.graphit);
  kiste.add(dach);
  var dachLeiste = netz(new RoundedBoxGeometry(0.3, 0.01, 0.012, 2, 0.004), st.goldGlanz, false);
  dach.add(bei(dachLeiste, 0, 0.0, KT / 2 + 0.032));
  var etagen = [];
  var platteGeo = new RoundedBoxGeometry(KB - 0.02, 0.022, KT - 0.03, 2, 0.008);
  var streifenGeo = new THREE.BoxGeometry(KB - 0.06, 0.012, 0.012);
  var wandGeo = new THREE.PlaneGeometry(KB - 0.05, EH - 0.022);
  // Rückwand jeder Etage: von unten warm aufgehellt, wie ein beleuchteter Raum
  var wandTex = malTextur(16, 64, function (c, w, h) {
    var gr = c.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, "#fff"); gr.addColorStop(0.5, "rgba(255,255,255,0.4)"); gr.addColorStop(1, "rgba(255,255,255,0.1)");
    c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  var teile = helferTeile();
  for (i = 0; i < N_ETAGE; i++) {
    var eg = new THREE.Group();
    kiste.add(eg);
    var y0 = 0.06 + i * EH;
    eg.position.y = y0;
    eg.add(netz(platteGeo, st.graphit));
    var ledStoff = stoff("s", { color: 0x000000, emissive: FARBE6[i], emissiveIntensity: 0 });
    eg.add(bei(netz(streifenGeo, ledStoff, false), 0, 0.012, KT / 2 - 0.02));
    var wandStoff = stoff("s", { color: 0x000000, emissive: FARBE6[i], emissiveMap: wandTex, emissiveIntensity: 0, roughness: 0.9 });
    eg.add(bei(netz(wandGeo, wandStoff, false), 0, EH / 2, -KT / 2 + 0.023));
    var werk = new THREE.Group();
    werk.position.y = 0.011;
    eg.add(werk);
    var hf = helfer(teile, st, ledStoff);
    hf.g.scale.setScalar(1.1);
    werk.add(hf.g);
    etagen.push({ g: eg, y0: y0, led: ledStoff, wand: wandStoff, werk: werk, helfer: hf, teile: {} });
  }
  // Etage 1 (Thema): der Helfer richtet eine kleine Antenne aus, Wellen laufen nach rechts
  (function (e) {
    var fuss = netz(new THREE.CylinderGeometry(0.02, 0.03, 0.08, 16), st.graphit); fuss.position.set(-0.04, 0.04, 0.07); e.werk.add(fuss);
    var dreh = new THREE.Group(); dreh.position.set(-0.04, 0.09, 0.07); e.werk.add(dreh);
    var schalenStoff = stoff("p", { color: 0xf0c56d, roughness: 0.16, metalness: 1, side: THREE.DoubleSide });
    var schuessel = netz(new THREE.SphereGeometry(0.065, 24, 10, 0, Math.PI * 2, 0, 1.1), schalenStoff); schuessel.rotation.z = 1.92; dreh.add(schuessel);
    var stab = netz(new THREE.CylinderGeometry(0.004, 0.004, 0.045, 6), st.chrom); stab.rotation.z = -1.22; stab.position.set(0.021, 0.008, 0); dreh.add(stab);
    for (var j = 0; j < 3; j++) { var ring_ = lichtRing(0.04 + j * 0.035, 0.0025, FARBE6[0], k.scanEbenen); ring_.position.set(0.12 + j * 0.08, 0.09, 0.07); ring_.rotation.y = Math.PI / 2; e.werk.add(ring_); e.teile["welle" + j] = ring_; }
    e.teile.dreh = dreh;
    e.helfer.g.position.set(-0.17, 0, 0.06);
    e.helfer.g.rotation.y = 1.4;
  })(etagen[0]);
  // Etage 2 (Skript): der Helfer legt im Takt Blätter auf ein Förderband
  (function (e) {
    var band = netz(new RoundedBoxGeometry(0.56, 0.02, 0.14, 2, 0.008), st.gummi); band.position.set(0.06, 0.012, 0.06); e.werk.add(band);
    [-0.22, 0.34].forEach(function (x) { var rolle = netz(new THREE.CylinderGeometry(0.014, 0.014, 0.15, 12), st.chrom); rolle.rotation.x = Math.PI / 2; rolle.position.set(x, 0.012, 0.06); e.werk.add(rolle); });
    var blattStoff = stoff("s", { color: 0xf3ecda, roughness: 0.9, side: THREE.DoubleSide });
    var blaetter = [];
    for (var j = 0; j < 4; j++) { var b = netz(new THREE.PlaneGeometry(0.07, 0.09), blattStoff, false); b.rotation.x = -Math.PI / 2; e.werk.add(b); blaetter.push(b); }
    e.teile.blaetter = blaetter;
    e.helfer.g.position.set(-0.33, 0, 0.07);
    e.helfer.g.rotation.y = 1.25;
  })(etagen[1]);
  // Etage 3 (Stimme): der Helfer spricht ins Mikrofon, daneben tanzen die Pegelbalken
  (function (e) {
    var balkenStoff = stoff("s", { color: 0x000000, emissive: FARBE6[2], emissiveIntensity: 1.4, roughness: 0.6 });
    var balken = [];
    for (var j = 0; j < 9; j++) { var b = netz(new THREE.BoxGeometry(0.035, 1, 0.035), balkenStoff, false); b.geometry.translate(0, 0.5, 0); b.position.set(-0.32 + j * 0.052, 0.01, -0.04); e.werk.add(b); balken.push(b); }
    e.teile.balken = balken;
    var mikro = new THREE.Group(); mikro.position.set(0, -0.05, 0.006); e.helfer.rechts.add(mikro);
    mikro.add(bei(netz(new THREE.CylinderGeometry(0.0045, 0.0035, 0.03, 8), st.graphit, false), 0, 0.006, 0));
    mikro.add(bei(netz(new THREE.SphereGeometry(0.0095, 12, 8), st.chrom, false), 0, 0.024, 0));
    e.helfer.g.position.set(0.26, 0, 0.08);
    e.helfer.g.rotation.y = -0.55;
  })(etagen[2]);
  // Etage 4 (Quellen): der Helfer geht mit einem Prüflicht die Bücherreihe ab
  (function (e) {
    var farben = [0x5b1f22, 0x1c2a4a, 0x1f3b2c, 0x4a2f1c, 0x4d1a2a, 0x7a5a1c, 0x2e3440, 0x3d2a52];
    for (var j = 0; j < 8; j++) { var b = netz(new RoundedBoxGeometry(0.04, 0.12, 0.1, 2, 0.006), stoff("p", { color: farben[j], roughness: 0.55, clearcoat: 0.3 })); b.position.set(-0.18 + j * 0.052, 0.07, -0.1); e.werk.add(b); }
    var licht = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.14, 0.13), new THREE.MeshBasicMaterial({ color: new THREE.Color(FARBE6[3]).multiplyScalar(1.4), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    licht.material.clippingPlanes = k.scanEbenen;
    licht.position.set(0, 0.075, -0.1);
    e.werk.add(licht);
    e.teile.licht = licht;
    e.helfer.g.position.set(0, 0, 0.1);
  })(etagen[3]);
  // Etage 5 (Freigabe): der Helfer stempelt, bei jedem Stempel leuchtet der Haken auf
  (function (e) {
    var h = hakenRoehre(0.09, FARBE6[4], k.scanEbenen); h.position.set(0.14, 0.09, -0.02); e.werk.add(h); e.teile.haken = h;
    var tisch = netz(new RoundedBoxGeometry(0.075, 0.03, 0.06, 2, 0.006), st.graphit); tisch.position.set(-0.13, 0.015, 0.13); e.werk.add(tisch);
    var zettel = netz(new THREE.PlaneGeometry(0.045, 0.04), stoff("s", { color: 0xf3ecda, roughness: 0.9 }), false); zettel.rotation.x = -Math.PI / 2; zettel.position.set(-0.13, 0.031, 0.13); e.werk.add(zettel);
    var stempel = new THREE.Group(); stempel.position.set(0, -0.05, 0); e.helfer.rechts.add(stempel);
    stempel.add(bei(netz(new THREE.CylinderGeometry(0.011, 0.012, 0.01, 14), st.lack, false), 0, -0.006, 0));
    stempel.add(bei(netz(new THREE.CylinderGeometry(0.0035, 0.0035, 0.016, 8), st.goldGlanz, false), 0, 0.006, 0));
    e.helfer.g.position.set(-0.21, 0, 0.07);
    e.helfer.g.rotation.y = 0.85;
  })(etagen[4]);
  // Etage 6 (Kanäle): drei kleine Telefone leuchten nacheinander, der Helfer zeigt jeweils darauf
  (function (e) {
    var schirme = [], xs = [];
    for (var j = 0; j < 3; j++) {
      var tel = netz(new RoundedBoxGeometry(0.07, 0.13, 0.012, 2, 0.01), st.stahl); tel.position.set(-0.03 + j * 0.15, 0.08, -0.03); tel.rotation.x = -0.15; e.werk.add(tel);
      var sStoff = stoff("s", { color: 0x05070c, emissive: FARBE6[5], emissiveIntensity: 0, roughness: 0.1 });
      var s = netz(new THREE.PlaneGeometry(0.062, 0.12), sStoff, false); s.position.set(0, 0, 0.0065); tel.add(s);
      schirme.push(sStoff);
      xs.push(tel.position.x);
    }
    e.teile.schirme = schirme;
    e.helfer.g.position.set(-0.29, 0, 0.09);
    e.helfer.g.rotation.y = 1.15;
  })(etagen[5]);
  // die sechs Leuchtpunkte auf der Pultfront gehen mit den Etagen an
  var punktGeo = new THREE.SphereGeometry(0.011, 12, 8);
  for (i = 0; i < N_ETAGE; i++) {
    var lp = netz(punktGeo, etagen[i].led, false);
    lp.position.set((i - 2.5) * 0.05, 0.52, -0.157);
    lp.scale.z = 0.4;
    pult.add(lp);
  }

  var ziel = V(), pol = V(), p = V(), q = new THREE.Quaternion(), qg = new THREE.Quaternion();
  var qx90 = new THREE.Quaternion().setFromAxisAngle(V().set(1, 0, 0), Math.PI / 2);
  var stand = { fort: -1, frei: null };
  var ZYK = 9.2;
  return {
    j: 5, gruppe: gruppe, oben: 3.0, symbol: 5, platz: platz,
    aktiviert: function () { k.rob.displaySymbolFrei = null; },
    tick: function (t) {
      var rob = k.rob, g = rob.g, z = t % ZYK, i;
      // 1) Hologramm-Hand des Betreibers: erscheint, legt den Zeigefinger auf das Feld, zieht sich zurück
      var ein = weich(seg(z, 0.1, 0.8)), aus = weich(seg(z, 2.2, 2.9));
      var druck = weich(seg(z, 0.8, 1.1)) * (1 - weich(seg(z, 1.95, 2.25)));
      feldPunkt.getWorldPosition(p); gruppe.worldToLocal(p);
      hand.position.copy(p).add(ziel.set(0.02, 0.285 + (1 - druck) * 0.18 + (1 - ein) * 0.22 + aus * 0.25, 0.04));
      hand.rotation.set(-0.25, 0.4 + platz.dreh, 0.1);
      holo.uniforms.uSicht.value = ein * (1 - aus);
      holo.uniforms.uZeit.value = t;
      hand.getWorldPosition(ziel);
      holo.uniforms.uObenY.value = ziel.y + 0.28;
      hand.visible = holo.uniforms.uSicht.value > 0.01;
      var fg = hand.userData.finger;
      for (i = 0; i < 4; i++) {
        var kr = i === 0 ? 0.08 : 1.1;
        fg[i][0].rotation.x = -kr * 0.9; fg[i][1].rotation.x = -kr * 1.1; fg[i][2].rotation.x = -kr * 0.8;
      }
      hand.userData.daumen[1].rotation.x = -0.6;
      var lesen = seg(z, 1.1, 1.9), frei = z > 1.95 && z < ZYK - 0.5;
      var fort = Math.round((z < 1.1 ? 0 : (z > ZYK - 0.5 ? 0 : lesen)) * 40) / 40;
      if (fort !== stand.fort || frei !== stand.frei) {
        abdruck(fort, frei);
        leisteStoff.emissive.setHex(frei ? farbe : 0x8090a8);
        leisteStoff.emissiveIntensity = frei ? 1.5 : 0.45;
        stand.fort = fort; stand.frei = frei;
      }
      var puls = huegel(z, 1.95, 2.8);
      ring.visible = puls > 0.01;
      if (ring.visible) {
        ring.position.copy(p); ring.position.y += 0.01;
        platte.getWorldQuaternion(q);
        gruppe.getWorldQuaternion(qg).invert();
        ring.quaternion.copy(qg).multiply(q).multiply(qx90);
        ring.scale.setScalar(1 + seg(z, 1.95, 2.8) * 1.1);
        ring.material.opacity = puls;
      }
      // 2) der Roboter drückt danach den Freigabeknopf (die Kappe fährt ein und leuchtet kurz)
      var hin = weich(seg(z, 2.3, 2.85)), drueck = anschlag(z, 2.85, 0.16, 0.3), weg = weich(seg(z, 3.4, 4.1));
      kappe.position.y = -drueck * 0.018;
      kappenStoff.emissiveIntensity = 0.12 + 0.9 * huegel(z, 2.85, 4.2);
      // 3) die Kiste baut sich Etage für Etage auf (von unten), 4) die Helfer arbeiten, 5) Abbau
      var auf0 = 3.0, abbau0 = ZYK - 1.25, ta = t;
      for (i = 0; i < N_ETAGE; i++) {
        var e = etagen[i], hf = e.helfer;
        var rein = weich(seg(z, auf0 + 0.15 + i * 0.22, auf0 + 0.55 + i * 0.22));
        var raus = weich(seg(z, abbau0 + (N_ETAGE - 1 - i) * 0.12, abbau0 + 0.3 + (N_ETAGE - 1 - i) * 0.12));
        var da = rein * (1 - raus);
        e.g.visible = da > 0.001;
        e.g.position.x = (1 - da) * 0.75;
        e.g.scale.setScalar(Math.max(0.001, 0.6 + 0.4 * da));
        var arbeit = weich(seg(z, auf0 + 0.6 + i * 0.22, auf0 + 0.9 + i * 0.22)) * (1 - raus);
        e.led.emissiveIntensity = 2.0 * arbeit + 0.2 * da;
        e.wand.emissiveIntensity = 0.42 * arbeit;
        e.werk.visible = da > 0.5;
        if (!e.werk.visible) { continue; }
        hf.leib.position.y = 0;
        hf.leib.rotation.set(0, 0, 0);
        hf.kopf.rotation.set(0, 0, 0);
        if (i === 0) {
          var schwenk = Math.sin(ta * 0.8);
          e.teile.dreh.rotation.y = schwenk * 0.8;
          hf.kopf.rotation.set(-0.1, schwenk * 0.25, 0);
          hf.rechts.rotation.set(-1.9 - schwenk * 0.12, 0, -0.2);
          hf.links.rotation.set(-0.15, 0, 0.12);
          for (var w = 0; w < 3; w++) { var r_ = e.teile["welle" + w]; var al = ((ta * 0.9 + w / 3) % 1); r_.scale.setScalar(0.6 + al * 0.8); r_.material.opacity = (1 - al) * arbeit * 0.75; }
        } else if (i === 1) {
          var takt = ta % 1, reichen = Math.sin(Math.min(1, takt / 0.45) * Math.PI);
          hf.rechts.rotation.set(-0.45 - reichen * 0.85, 0, -0.1);
          hf.links.rotation.set(-0.45 - reichen * 0.85, 0, 0.1);
          hf.leib.rotation.x = reichen * 0.1;
          hf.kopf.rotation.x = 0.28;
          for (var bi = 0; bi < 4; bi++) { var u = ((ta * 0.25 + bi / 4) % 1); var bl = e.teile.blaetter[bi]; bl.position.set(-0.19 + u * 0.5, 0.026, 0.06); bl.visible = arbeit > 0.05 && u > 0.03; }
        } else if (i === 2) {
          hf.rechts.rotation.set(-2.15, 0, -0.32);
          hf.links.rotation.set(-0.2 + Math.sin(ta * 3.5) * 0.14, 0, 0.18);
          hf.kopf.rotation.x = Math.sin(ta * 7.0) * 0.07;
          hf.leib.rotation.z = Math.sin(ta * 3.5) * 0.05;
          for (var ba = 0; ba < 9; ba++) { e.teile.balken[ba].scale.y = Math.max(0.01, (0.03 + 0.12 * Math.abs(Math.sin(ta * 7.0 + ba * 0.8) * Math.sin(ta * 2.3 + ba))) * arbeit); }
        } else if (i === 3) {
          var gx = Math.sin(ta * 0.8) * 0.17, gv = Math.cos(ta * 0.8);
          hf.g.position.x = gx;
          hf.g.rotation.y = Math.PI - 0.6 * gv;
          hf.leib.position.y = Math.abs(Math.sin(ta * 8.0)) * 0.004 * Math.abs(gv);
          hf.rechts.rotation.set(-1.35, 0, -0.15);
          hf.links.rotation.set(-1.35, 0, 0.15);
          e.teile.licht.position.x = gx;
          e.teile.licht.material.opacity = 0.6 * arbeit;
        } else if (i === 4) {
          var sp = (ta / 1.4) % 1;
          var heben = sp < 0.6 ? weich(sp / 0.6) : (sp < 0.7 ? 1 - (sp - 0.6) / 0.1 : 0);
          hf.rechts.rotation.set(-0.5 - heben * 1.6, 0, -0.06);
          hf.links.rotation.set(-0.3, 0, 0.12);
          hf.kopf.rotation.x = 0.3;
          var nach = sp >= 0.7 ? sp - 0.7 : sp + 0.3;
          e.teile.haken.material.opacity = arbeit * (0.3 + 0.7 * Math.exp(-nach * 7));
          e.teile.haken.visible = arbeit > 0.02;
        } else {
          var summe = 0, mitte = 0;
          for (var si = 0; si < 3; si++) {
            var hw = Math.max(0, Math.sin(ta * 2.2 - si * 1.2));
            e.teile.schirme[si].emissiveIntensity = arbeit * (0.25 + 1.0 * hw);
            summe += hw * hw + 1e-4; mitte += si * (hw * hw + 1e-4);
          }
          mitte /= summe;
          hf.kopf.rotation.set(0.12, 0.25 - mitte * 0.22, 0);
          hf.rechts.rotation.set(-1.45 + mitte * 0.12, 0, -0.2 - mitte * 0.1);
          hf.links.rotation.set(-0.2, 0, 0.12);
        }
      }
      var ganz = weich(seg(z, auf0 + 0.1, auf0 + 0.5)) * (1 - weich(seg(z, abbau0 + 0.8, abbau0 + 1.1)));
      var hoeheKiste = 0.06 + EH * N_ETAGE * weich(seg(z, auf0, auf0 + 0.15 + N_ETAGE * 0.22)) * (1 - weich(seg(z, abbau0, abbau0 + 1.0)));
      for (i = 0; i < pfosten.length; i++) { pfosten[i].scale.y = Math.max(0.001, hoeheKiste - 0.06); pfosten[i].visible = ganz > 0.01; }
      rueck.visible = ganz > 0.01;
      rueck.scale.y = Math.max(0.001, (hoeheKiste - 0.06) / (EH * N_ETAGE));
      rueck.position.y = 0.06 + (hoeheKiste - 0.06) / 2;
      dach.position.y = hoeheKiste + 0.017;
      dach.visible = ganz > 0.01;
      // Roboter: beide Hände liegen auf dem Pult; er schaut auf das Feld, drückt den Knopf, wendet sich
      // der wachsenden Kiste zu und nickt
      rob.leben(t);
      var zurKiste = weich(seg(z, 3.1, 3.7)) * (1 - weich(seg(z, ZYK - 0.9, ZYK - 0.3)));
      var nicken = huegel(z, 4.6, 5.3);
      g.torso.rotation.set(0.07 + hin * 0.07 * (1 - weg), zurKiste * 0.16, 0);
      rob.wurzel.updateMatrixWorld(true);
      feldPunkt.getWorldPosition(p);
      kiste.localToWorld(ziel.set(0, 0.7, 0));
      p.lerp(ziel, zurKiste);
      knopfOben.getWorldPosition(ziel);
      p.lerp(ziel, hin * (1 - weg) * (1 - zurKiste) * 0.6);
      rob.blick(p, 0.95);
      g.kopf.rotation.x += nicken * 0.22;
      rob.augen(rob.blinzeln * (frei ? 0.8 : 1), 0.2, -0.35);
      // linke Hand ruht flach auf dem Pult
      ruheL.getWorldPosition(ziel);
      rob.richtung(1, -0.6, -0.4, pol);
      rob.greifen(1, ziel, 0, -0.45, 1, 0, -1, -0.25, pol);
      rob.finger(1, 0.28, 0.3);
      // rechte Hand: ruht neben dem Knopf, hebt sich im Bogen, drückt flach auf die Kappe, legt sich zurück
      var anKnopf = weicher(hin * (1 - weg));
      ruheR.getWorldPosition(p);
      knopfOben.getWorldPosition(ziel);
      ziel.y += 0.012 - drueck * 0.016;
      p.lerp(ziel, anKnopf);
      p.y += Math.sin(Math.PI * anKnopf) * 0.1;
      rob.richtung(-1, -0.6, -0.45, pol);
      rob.greifen(-1, p, 0, -0.45, 1, 0, -1, -0.2, pol);
      rob.finger(-1, mische(0.28, 0.12, anKnopf), mische(0.3, 0.2, anKnopf));
      if (rob.displaySymbolFrei !== frei) { rob.displaySymbolFrei = frei; rob.displayMalen(5, frei ? farbe : 0x8090a8, 1); }
    }
  };
}

/* ===================================================================== 6 Kanäle */

export function szeneKanaele(k) {
  var st = k.st, gruppe = new THREE.Group(), farbe = farbeVon(6);
  var fc = new THREE.Color(farbe), fHex = "#" + fc.getHexString();
  // vier Telefone auf Sockeln in einem Bogen
  var telefone = [];
  var orte = [[0.15, 0.66, 0.42], [0.72, 0.36, 0.52], [1.1, -0.14, 0.62], [1.02, -0.7, 0.72]];
  orte.forEach(function (o, i) {
    var tg = new THREE.Group();
    tg.position.set(o[0], 0.07, o[1]);
    gruppe.add(tg);
    // schlanker Ständer: Fuß, Stange, Halteschale
    var fuss = netz(new THREE.CylinderGeometry(0.1, 0.115, 0.03, 40), st.lack);
    fuss.position.y = 0.015;
    tg.add(fuss);
    var fussRing = netz(new THREE.TorusGeometry(0.104, 0.005, 8, 40), st.goldGlanz);
    fussRing.rotation.x = Math.PI / 2; fussRing.position.y = 0.03;
    tg.add(fussRing);
    var stab = netz(new THREE.CylinderGeometry(0.014, 0.017, o[2], 16), st.goldGebuerstet);
    stab.position.y = o[2] / 2;
    tg.add(stab);
    tg.add(bei(k.welt.kontaktSchatten(0.5, 0.5, 0.5), 0, 0.005, 0));
    var tel = new THREE.Group();
    tel.position.y = o[2] + 0.23;
    tel.scale.setScalar(1.2);
    tg.add(tel);
    tel.add(netz(new RoundedBoxGeometry(0.17, 0.34, 0.018, 4, 0.024), st.stahl));
    var tex = malTextur(256, 512, function () {});
    var schirm = new THREE.Mesh(new RoundedBoxGeometry(0.156, 0.322, 0.002, 4, 0.0009), st.displayStoff(tex));
    schirm.position.z = 0.0095;
    tel.add(schirm);
    var kam = netz(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 12), st.lack, false);
    kam.rotation.x = Math.PI / 2; kam.position.set(0, 0.15, 0.011);
    tel.add(kam);
    var halter = netz(new RoundedBoxGeometry(0.11, 0.045, 0.05, 2, 0.01), st.graphit);
    halter.position.set(0, o[2] + 0.02, 0);
    tg.add(halter);
    telefone.push({ g: tg, tel: tel, tex: tex, stand: -1 });
  });
  function schirmMalen(t, an, haken) {
    var c = t.tex.userData.ctx, w = 256, h = 512;
    c.fillStyle = "#05070c"; c.fillRect(0, 0, w, h);
    if (an <= 0.01) { t.tex.needsUpdate = true; return; }
    c.globalAlpha = an;
    var gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#1a2c5c"); gr.addColorStop(0.55, "#3b2e5e"); gr.addColorStop(1, "#d7843e");
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = "rgba(255,236,190,0.9)"; c.beginPath(); c.arc(128, 300, 40, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(255,226,160,0.95)"; c.lineWidth = 7;
    c.beginPath(); c.ellipse(128, 236, 34, 10, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = "rgba(10,14,30,0.55)"; c.fillRect(0, 410, w, 102);
    c.fillStyle = "rgba(255,255,255,0.3)"; c.fillRect(24, 470, 208, 6);
    c.fillStyle = "#f2c14e"; c.fillRect(24, 470, 208 * an, 6);
    if (haken > 0) {
      c.globalAlpha = an * haken;
      c.fillStyle = fHex; c.beginPath(); c.arc(206, 52, 26, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#08101e"; c.lineWidth = 7; c.lineCap = "round"; c.lineJoin = "round";
      c.beginPath(); c.moveTo(194, 53); c.lineTo(203, 62); c.lineTo(219, 43); c.stroke();
    }
    c.globalAlpha = 1;
    t.tex.needsUpdate = true;
  }
  telefone.forEach(function (t) { schirmMalen(t, 0, 0); });
  // Sendemast hinten links: Gittermast mit Leuchtfeuer und Signalringen
  var mast = new THREE.Group();
  mast.position.set(-1.12, 0.07, -0.95);
  gruppe.add(mast);
  var MH = 2.3, eck = [];
  for (var i = 0; i < 3; i++) {
    var a = i / 3 * Math.PI * 2;
    eck.push([Math.cos(a), Math.sin(a)]);
    var stab = netz(new THREE.CylinderGeometry(0.012, 0.018, MH, 8), st.stahl);
    var unten = V().set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22), oben = V().set(Math.cos(a) * 0.05, MH, Math.sin(a) * 0.05);
    stab.position.copy(unten).add(oben).multiplyScalar(0.5);
    stab.quaternion.setFromUnitVectors(V().set(0, 1, 0), oben.clone().sub(unten).normalize());
    stab.scale.y = unten.distanceTo(oben) / MH;
    mast.add(stab);
  }
  var streben = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0055, 0.0055, 1, 6), st.stahl, 3 * 9);
  var mt = new THREE.Matrix4(), qq = new THREE.Quaternion(), s3 = V(), p3 = V(), n = 0;
  for (var e = 0; e < 9; e++) {
    var y0 = e * MH / 9, y1 = (e + 1) * MH / 9;
    for (i = 0; i < 3; i++) {
      var r0 = mische(0.22, 0.05, y0 / MH), r1 = mische(0.22, 0.05, y1 / MH);
      var A = V().set(eck[i][0] * r0, y0, eck[i][1] * r0), Bp = V().set(eck[(i + 1) % 3][0] * r1, y1, eck[(i + 1) % 3][1] * r1);
      p3.copy(A).add(Bp).multiplyScalar(0.5);
      qq.setFromUnitVectors(V().set(0, 1, 0), Bp.clone().sub(A).normalize());
      s3.set(1, A.distanceTo(Bp), 1);
      mt.compose(p3, qq, s3); streben.setMatrixAt(n++, mt);
    }
  }
  streben.castShadow = true;
  mast.add(streben);
  var antenne = netz(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 8), st.chrom); antenne.position.y = MH + 0.2; mast.add(antenne);
  var feuer = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 10), stoff("s", { color: 0x000000, emissive: 0xff3b30, emissiveIntensity: 4 }));
  feuer.position.y = MH + 0.42; mast.add(feuer);
  mast.add(bei(k.welt.kontaktSchatten(0.8, 0.8, 0.5), 0, 0.005, 0));
  var signale = [];
  for (i = 0; i < 3; i++) {
    var sg = lichtRing(1, 0.004, farbe, k.scanEbenen);
    sg.rotation.x = Math.PI / 2;
    sg.position.set(mast.position.x, MH + 0.42 + 0.07, mast.position.z);
    gruppe.add(sg);
    signale.push(sg);
  }
  // Datenpaket mit Leuchtspur
  var paketStoff = stoff("s", { color: 0x000000, emissive: farbe, emissiveIntensity: 3 });
  var paket = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 1), paketStoff);
  gruppe.add(paket);
  var SPUR = 14, spur = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshBasicMaterial({ color: fc.clone().multiplyScalar(2), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), SPUR);
  spur.material.clippingPlanes = k.scanEbenen;
  spur.frustumCulled = false;
  gruppe.add(spur);

  var platz = { x: -0.62, z: -0.1, dreh: 0.78 };
  var ziel = V(), pol = V(), hq = new THREE.Quaternion(), hqA = new THREE.Quaternion(), hqW = new THREE.Quaternion();
  var p = V(), start = V(), ende = V(), mitte = V(), kam = V(), blickZiel = V();
  var TAKT = 1.3, ZYK = TAKT * 4 + 2.2;
  function bezier(a, b, c, u, aus) {
    var v = 1 - u;
    return aus.set(v * v * a.x + 2 * v * u * b.x + u * u * c.x, v * v * a.y + 2 * v * u * b.y + u * u * c.y, v * v * a.z + 2 * v * u * b.z + u * u * c.z);
  }
  return {
    j: 6, gruppe: gruppe, oben: 3.2, symbol: 6, platz: platz,
    tick: function (t) {
      var rob = k.rob, g = rob.g, z = t % ZYK;
      var nr = Math.min(3, Math.floor(z / TAKT)), tz = z - nr * TAKT, ausklingen = seg(z, ZYK - 0.7, ZYK);
      // Telefone: leuchten auf, sobald ihr Paket ankommt
      k.welt.kamera.getWorldPosition(kam);
      for (var i = 0; i < telefone.length; i++) {
        var tf = telefone[i], ank = i * TAKT + 1.05;
        var an = weich(seg(z, ank, ank + 0.25)) * (1 - ausklingen), hk = weich(seg(z, ank + 0.25, ank + 0.5)) * (1 - ausklingen);
        var stufe = Math.round(an * 12) * 100 + Math.round(hk * 12);
        if (stufe !== tf.stand) { tf.stand = stufe; schirmMalen(tf, an, hk); }
        p.copy(kam); tf.g.worldToLocal(p);
        tf.tel.rotation.y = Math.atan2(p.x, p.z) * 0.8;
        tf.tel.position.y = orte[i][2] + 0.23 + huegel(z, ank, ank + 0.4) * 0.03;
      }
      // Roboter: holt aus, wirft das Paket, schaut ihm nach; nach dem letzten Wurf senkt er die Hand und
      // dreht sich weich zum ersten Telefon zurück (keine Sprünge zwischen den Würfen und am Zyklusende)
      rob.leben(t);
      var ausholen = weich(seg(tz, 0.0, 0.35)) * (1 - weich(seg(tz, 0.35, 0.5)));
      var wurf = weich(seg(tz, 0.35, 0.5)) * (1 - weich(seg(tz, 0.7, 1.2)));
      var aktiv = z < TAKT * 4;
      var weiter = aktiv && nr < 3 ? weich(seg(tz, 1.05, 1.3)) : 0;
      var zurueck = aktiv ? 0 : weich(seg(z, TAKT * 4 + 0.2, ZYK - 0.2));
      var unten = aktiv ? 0 : weich(seg(z, TAKT * 4, TAKT * 4 + 0.6)) * (1 - weich(seg(z, ZYK - 0.7, ZYK - 0.05)));
      var gier = aktiv ? -0.25 + (nr + weiter) * 0.17 + ausholen * 0.12 - wurf * 0.1 : mische(-0.25 + 3 * 0.17, -0.25, zurueck);
      g.torso.rotation.set(0.05, gier, 0);
      rob.wurzel.updateMatrixWorld(true);
      telefone[nr].tel.getWorldPosition(ende);
      var flug = aktiv ? seg(tz, 0.45, 1.05) : 0;
      // Hand: in Ruhe nach oben offen (das nächste Paket liegt darin), beim Ausholen neben dem Kopf mit
      // der Handfläche nach vorn, beim Wurf Finger nach vorn; nach dem letzten Wurf hängt sie locker
      rob.punkt(mische(-0.35, -0.45, ausholen), mische(1.35, 1.8, ausholen) - wurf * 0.15, mische(0.38, 0.05, ausholen) + wurf * 0.35, ziel);
      rob.punkt(-0.48, 1.0, 0.2, p);
      ziel.lerp(p, unten);
      rob.richtung(-1, -0.7, -0.4, pol);
      rob.handLage(0.1, 0.15, 1, 0, 1, -0.1, hq);
      rob.handLage(0, 1, 0.15, 0, 0.2, 1, hqA);
      rob.handLage(0, 0.25, 1, 0, -0.45, 1, hqW);
      hq.slerp(hqA, ausholen).slerp(hqW, wurf);
      rob.handLage(0, -1, 0.05, 1, 0, 0.25, hqA);
      hq.slerp(hqA, weicher(unten));
      rob.arm(-1, ziel, pol, hq);
      rob.finger(-1, mische(mische(0.5, 0.1, wurf), 0.35, unten), 0.3);
      g.arm[-1].hand.getWorldPosition(start);
      // Blick: dem Paket nach, dann weich zum nächsten Telefon
      telefone[aktiv ? Math.min(3, nr + 1) : 0].tel.getWorldPosition(p);
      blickZiel.copy(ende).lerp(p, aktiv ? weiter : zurueck);
      rob.blick(blickZiel, 0.8);
      rob.augen(rob.blinzeln, 0.4, 0);
      rob.punkt(0.5, 1.0 + Math.sin(t * 1.1) * 0.02, 0.2, ziel);
      rob.richtung(1, -0.3, -0.4, pol);
      rob.arm(1, ziel, pol, null);
      rob.finger(1, 0.4, 0.3);
      // Paket fliegt im Bogen von der Hand zum Telefon
      gruppe.worldToLocal(start); gruppe.worldToLocal(ende);
      mitte.copy(start).add(ende).multiplyScalar(0.5); mitte.y += 0.65;
      paket.visible = flug > 0 && flug < 1;
      spur.visible = paket.visible;
      if (paket.visible) {
        var u = weich(flug);
        bezier(start, mitte, ende, u, paket.position);
        paket.rotation.set(t * 4, t * 3, 0);
        for (var s = 0; s < SPUR; s++) {
          var us = Math.max(0, u - s * 0.022);
          bezier(start, mitte, ende, us, p);
          var gr = (1 - s / SPUR) * 0.9;
          mt.compose(p, qq.identity(), s3.set(gr, gr, gr));
          spur.setMatrixAt(s, mt);
        }
        spur.instanceMatrix.needsUpdate = true;
      } else if (aktiv && tz < 0.45) {
        paket.visible = true;
        paket.position.copy(start);
        paket.scale.setScalar(weich(seg(tz, 0.05, 0.3)));
      }
      if (flug > 0) { paket.scale.setScalar(1); }
      // Leuchtfeuer blinkt, Signale wandern nach außen
      feuer.material.emissiveIntensity = (Math.sin(t * 4.0) > 0.2) ? 3 : 0.35;
      for (i = 0; i < signale.length; i++) {
        var alter = (t * 0.6 + i / 3) % 1;
        signale[i].scale.setScalar(0.06 + alter * 0.55);
        signale[i].material.opacity = (1 - alter) * 0.75;
      }
    }
  };
}

/* ===================================================================== 7 Ziel */

export function szeneZiel(k) {
  var st = k.st, gruppe = new THREE.Group();
  // Flügel aus goldenen Lichtpunkten: eine geschwungene Vorderkante, dichte Deckfedern daran und
  // vierzehn Schwungfedern, die nach außen länger werden
  var JE_FLUEGEL = 900 + 14 * 300, N = JE_FLUEGEL * 2;
  var pos = new Float32Array(N * 3), auf = new Float32Array(N), zuf = new Float32Array(N), rnd = zufall(12), n = 0;
  var pt = V(), dir = V(), quer = V(), vorn = V().set(0, 0, 1);
  function setzePunkt(p, a) {
    pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
    auf[n] = a; zuf[n] = rnd(); n++;
  }
  [1, -1].forEach(function (s) {
    var kante = new THREE.CatmullRomCurve3([V().set(s * 0.22, 1.8, -0.3), V().set(s * 0.62, 2.2, -0.42), V().set(s * 1.05, 2.44, -0.5), V().set(s * 1.52, 2.52, -0.56)]);
    for (var i = 0; i < 900; i++) {
      var u = rnd();
      kante.getPoint(u, pt);
      pt.x += (rnd() - 0.5) * 0.05; pt.y -= rnd() * 0.16 * (1 - u * 0.4); pt.z += (rnd() - 0.5) * 0.04;
      setzePunkt(pt, u * 0.55);
    }
    for (var f = 0; f < 14; f++) {
      var u0 = f / 13, basis = kante.getPoint(0.1 + u0 * 0.9);
      var laenge = 0.55 + u0 * 0.78;
      dir.set(s * (0.12 + u0 * 1.0), -1 + u0 * 0.3, -0.08).normalize();
      quer.crossVectors(dir, vorn).normalize();
      for (i = 0; i < 300; i++) {
        var v = Math.pow(rnd(), 0.85), q = (rnd() - 0.5) * 0.075 * (1 - v * 0.45);
        pt.copy(basis).addScaledVector(dir, laenge * v).addScaledVector(quer, q);
        pt.z += (rnd() - 0.5) * 0.03;
        setzePunkt(pt, Math.min(1, 0.25 + u0 * 0.5 + v * 0.35));
      }
    }
  });
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("auf", new THREE.BufferAttribute(auf, 1));
  geo.setAttribute("zuf", new THREE.BufferAttribute(zuf, 1));
  var fluegelStoff = new THREE.ShaderMaterial({
    uniforms: { uZeit: { value: 0 }, uEntfalten: { value: 0 }, uPixel: { value: 1 }, uScanY: k.scanUniforms.uScanY },
    vertexShader: [
      "attribute float auf; attribute float zuf; uniform float uZeit; uniform float uEntfalten; uniform float uPixel; uniform float uScanY;",
      "varying float vA;",
      "void main() {",
      "  vec3 p = position;",
      "  vec3 wurzel = vec3(sign(p.x) * 0.22, 1.8, -0.3);",
      "  float e = smoothstep(0.0, 1.0, clamp(uEntfalten * 1.4 - auf * 0.4, 0.0, 1.0));",
      "  p = wurzel + (p - wurzel) * e;",
      "  p.y += sin(uZeit * 1.7 + auf * 2.0) * 0.07 * auf * e;",
      "  p.z += sin(uZeit * 1.7 + auf * 2.0 + 1.0) * 0.05 * auf;",
      "  p += vec3(sin(uZeit * 0.9 + zuf * 30.0), cos(uZeit * 1.1 + zuf * 20.0), 0.0) * 0.012;",
      "  vec4 w = modelMatrix * vec4(p, 1.0);",
      "  vec4 mv = viewMatrix * w;",
      "  gl_Position = projectionMatrix * mv;",
      "  gl_PointSize = uPixel * (1.2 + zuf * 2.4) * (10.0 / -mv.z);",
      "  float funkeln = 0.6 + 0.4 * sin(uZeit * 3.0 + zuf * 50.0);",
      "  vA = e * funkeln * (0.35 + 0.65 * (1.0 - auf * 0.6)) * step(w.y, uScanY);",
      "}"
    ].join("\n"),
    fragmentShader: [
      "varying float vA;",
      "void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, r); gl_FragColor = vec4(vec3(1.0, 0.78, 0.42) * a * vA * 1.1, 1.0); }"
    ].join("\n"),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
  });
  var fluegel = new THREE.Points(geo, fluegelStoff);
  fluegel.frustumCulled = false;
  gruppe.add(fluegel);
  // goldene Laternen, die langsam aufsteigen
  var papier = stoff("p", { color: 0xffd9a0, emissive: 0xffa94d, emissiveIntensity: 1.5, roughness: 0.7, transparent: true });
  var laternen = [];
  var lprofil = [[0.001, -0.13], [0.06, -0.125], [0.1, -0.06], [0.11, 0.02], [0.09, 0.1], [0.05, 0.135], [0.001, 0.14]];
  var lkurve = new THREE.SplineCurve(lprofil.map(function (p) { return new THREE.Vector2(p[0], p[1]); }));
  var lgeo = new THREE.LatheGeometry(lkurve.getPoints(30), 32);
  for (var i = 0; i < 6; i++) {
    var l = new THREE.Group();
    var huelle = new THREE.Mesh(lgeo, papier); l.add(huelle);
    [-0.125, 0.135].forEach(function (y) { var r = netz(new THREE.TorusGeometry(y < 0 ? 0.06 : 0.05, 0.006, 8, 24), st.goldGlanz, false); r.rotation.x = Math.PI / 2; r.position.y = y; l.add(r); });
    l.userData = { x: mische(-1.3, 1.3, (i * 0.37) % 1), z: mische(-0.9, 0.5, (i * 0.61) % 1), ph: i / 6 };
    gruppe.add(l);
    laternen.push(l);
  }
  var ziel = V(), pol = V(), hq = new THREE.Quaternion(), kam = V();
  return {
    j: 7, gruppe: gruppe, oben: 3.6, symbol: 0,
    platz: { x: 0, z: 0.05, dreh: 0 },
    beginn: 0,
    tick: function (t, u) {
      var rob = k.rob, g = rob.g;
      rob.leben(t);
      g.basis.position.y += 0.22;
      g.torso.rotation.set(-0.06, Math.sin(t * 0.5) * 0.05, 0);
      rob.wurzel.updateMatrixWorld(true);
      k.welt.kamera.getWorldPosition(kam);
      rob.blick(kam, 0.8);
      rob.augen(rob.blinzeln, 0, 0.15);
      // Arme weit geöffnet, Handflächen nach vorne oben
      [1, -1].forEach(function (s) {
        rob.punkt(s * 0.82, 1.98 + Math.sin(t * 1.2 + s) * 0.03, 0.22, ziel);
        rob.richtung(s * 0.4, -1, -0.5, pol);
        rob.handLage(s * 0.9, 0.5, 0.2, 0, 0.5, 1, hq);
        rob.arm(s, ziel, pol, hq);
        rob.finger(s, 0.12, 0.1);
      });
      fluegel.position.y = g.basis.position.y - 0.44;
      fluegelStoff.uniforms.uZeit.value = t;
      fluegelStoff.uniforms.uPixel.value = k.welt.pixel * k.welt.css / 600;
      fluegelStoff.uniforms.uEntfalten.value = weich(klemme(u === undefined ? 1 : u * 1.6, 0, 1));
      for (var i = 0; i < laternen.length; i++) {
        var l = laternen[i], d = l.userData, a = ((t / 9) + d.ph) % 1;
        l.position.set(d.x + Math.sin(t * 0.6 + i) * 0.08, 0.35 + a * 3.0, d.z);
        l.rotation.y = t * 0.3 + i;
        var sk = weich(seg(a, 0, 0.12)) * (1 - weich(seg(a, 0.78, 1)));
        l.scale.setScalar(Math.max(0.001, sk));
      }
    }
  };
}
