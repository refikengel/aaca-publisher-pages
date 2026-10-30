/*
  Der Roboter-Agent von IT-Engel: eigenes Modell aus einfachen, sauber gerundeten Körpern
  (keine fremden Dateien). Schwebt auf einem Lichtring, trägt einen Heiligenschein.

  Gelenke: wurzel (Platz auf der Bühne) → basis (Schweben) → torso → kopf / schulter → oberarm →
  ellbogen → handgelenk → hand → finger. Arme werden über inverse Kinematik geführt (Ziel der Hand
  in Weltkoordinaten), damit Hände genau auf Tasten, Knöpfe und Bücher treffen.
*/
import * as THREE from "../vendor/three/build/three.module.min.js";
import { RoundedBoxGeometry } from "../vendor/three/addons/geometries/RoundedBoxGeometry.js";
import { leinwand } from "./stoff.js?v=18";

const L1 = 0.38;   // Schulter bis Ellbogen
const L2 = 0.36;   // Ellbogen bis Handgelenk

function drehkoerper(punkte, segmente, schritte) {
  var kurve = new THREE.SplineCurve(punkte.map(function (p) { return new THREE.Vector2(p[0], p[1]); }));
  return new THREE.LatheGeometry(kurve.getPoints(schritte || 48), segmente || 48);
}

function netz(geo, stoff, schatten) {
  var m = new THREE.Mesh(geo, stoff);
  m.castShadow = schatten !== false;
  m.receiveShadow = true;
  return m;
}

export class Roboter {
  constructor(st) {
    this.st = st;
    this.ledStoff = st.led;
    var g = this.g = {};
    var w = this.wurzel = new THREE.Group();
    w.name = "roboter";

    /* ---------------- Unterkörper mit Schub-Ring */
    var basis = g.basis = new THREE.Group();
    basis.position.y = 0.22;
    w.add(basis);
    var rock = netz(drehkoerper([[0.1, 0], [0.13, 0.03], [0.175, 0.13], [0.245, 0.31], [0.3, 0.48], [0.33, 0.6], [0.325, 0.68], [0.29, 0.735]], 56, 40), st.perl);
    basis.add(rock);
    var ringUnten = netz(new THREE.TorusGeometry(0.105, 0.022, 16, 48), st.gold);
    ringUnten.rotation.x = Math.PI / 2; ringUnten.position.y = 0.012;
    basis.add(ringUnten);
    var schub = netz(new THREE.CircleGeometry(0.088, 40), st.schub, false);
    schub.rotation.x = Math.PI / 2; schub.position.y = 0.004;
    basis.add(schub);
    g.schub = schub;
    var naht = netz(new THREE.TorusGeometry(0.306, 0.006, 8, 64), st.graphit, false);
    naht.rotation.x = Math.PI / 2; naht.position.y = 0.5;
    basis.add(naht);

    /* ---------------- Torso */
    var torso = g.torso = new THREE.Group();
    torso.position.y = 0.74;
    basis.add(torso);
    var huefte = netz(new THREE.TorusGeometry(0.27, 0.045, 18, 56), st.graphit);
    huefte.rotation.x = Math.PI / 2; huefte.scale.set(1, 0.84, 1);
    torso.add(huefte);
    var torsoProfil = [[0.27, 0], [0.31, 0.04], [0.335, 0.12], [0.37, 0.25], [0.4, 0.37], [0.396, 0.45], [0.372, 0.52], [0.32, 0.585], [0.22, 0.632], [0.1, 0.652], [0.0005, 0.656]];
    var brust = netz(drehkoerper(torsoProfil, 64, 48), st.perl);
    brust.scale.set(1, 1, 0.8);
    torso.add(brust);
    var kragen = netz(new THREE.TorusGeometry(0.255, 0.02, 14, 56), st.gold);
    kragen.rotation.x = Math.PI / 2; kragen.position.y = 0.605; kragen.scale.set(1, 0.8, 1);
    torso.add(kragen);
    var bauchNaht = netz(new THREE.TorusGeometry(0.352, 0.0055, 8, 72), st.graphit, false);
    bauchNaht.rotation.x = Math.PI / 2; bauchNaht.position.y = 0.17; bauchNaht.scale.set(1, 0.8, 1);
    torso.add(bauchNaht);
    // gewölbtes Brust-Display: ein Ausschnitt derselben Drehform, minimal größer, mit eigener Leinwand
    var kurve = new THREE.SplineCurve(torsoProfil.map(function (p) { return new THREE.Vector2(p[0], p[1]); }));
    var displayPunkte = kurve.getPoints(160).filter(function (p) { return p.y >= 0.255 && p.y <= 0.49; })
      .map(function (p) { return new THREE.Vector2(p.x * 1.012, p.y); });
    var dc = leinwand(512, 256);
    var dtex = this.displayTex = new THREE.CanvasTexture(dc);
    dtex.colorSpace = THREE.SRGBColorSpace;
    dtex.anisotropy = 8;
    this.displayCtx = dc.getContext("2d");
    var displayStoff = this.displayStoff = st.displayStoff(dtex);
    var display = netz(new THREE.LatheGeometry(displayPunkte, 40, -0.62, 1.24), displayStoff, false);
    display.scale.set(1, 1, 0.8);
    torso.add(display);
    this.displayMalen(0, 0xf2c14e, 0);

    /* ---------------- Hals und Kopf */
    var hals = netz(new THREE.CylinderGeometry(0.068, 0.078, 0.11, 24), st.graphit);
    hals.position.y = 0.69;
    torso.add(hals);
    var halsRing = netz(new THREE.TorusGeometry(0.075, 0.01, 10, 32), st.gold);
    halsRing.rotation.x = Math.PI / 2; halsRing.position.y = 0.67;
    torso.add(halsRing);
    var kopf = g.kopf = new THREE.Group();
    kopf.position.y = 0.73;
    kopf.rotation.order = "YXZ";
    torso.add(kopf);
    var kopfMitte = new THREE.Vector3(0, 0.21, 0.01);
    var KS = new THREE.Vector3(0.3, 0.262, 0.282);
    var schale = netz(new THREE.SphereGeometry(1, 64, 40), st.perl);
    schale.scale.copy(KS); schale.position.copy(kopfMitte);
    kopf.add(schale);
    var visierGeo = new THREE.SphereGeometry(1, 64, 32, Math.PI / 2 - 0.98, 1.96, 1.04, 1.02);
    var visier = netz(visierGeo, st.visier);
    visier.scale.copy(KS).multiplyScalar(1.014); visier.position.copy(kopfMitte);
    kopf.add(visier);
    // Augen auf dem Visier
    var self = this;
    function aufVisier(theta, phi, aus) {
      var x = -Math.cos(phi) * Math.sin(theta), y = Math.cos(theta), z = Math.sin(phi) * Math.sin(theta);
      var s = KS.clone().multiplyScalar(1.014);
      var p = new THREE.Vector3(x * s.x, y * s.y, z * s.z).add(kopfMitte);
      var n = new THREE.Vector3(x / s.x, y / s.y, z / s.z).normalize();
      return { p: p.addScaledVector(n, aus || 0.003), n: n };
    }
    g.augen = [];
    [1, -1].forEach(function (s) {
      var a = aufVisier(1.5, Math.PI / 2 + s * 0.33, 0.002);
      var halter = new THREE.Group();
      halter.position.copy(a.p);
      halter.lookAt(a.p.clone().add(a.n));
      var auge = netz(new THREE.CapsuleGeometry(0.021, 0.034, 6, 14), self.st.augen, false);
      auge.scale.z = 0.32;
      halter.add(auge);
      kopf.add(halter);
      g.augen.push({ halter: halter, auge: auge, grund: a.p.clone(), n: a.n.clone() });
    });
    // Mund: fünf Pegelbalken, nur beim Sprechen zu sehen
    g.mund = [];
    for (var i = 0; i < 5; i++) {
      var m = aufVisier(1.86, Math.PI / 2 + (i - 2) * 0.085, 0.0015);
      var mh = new THREE.Group();
      mh.position.copy(m.p); mh.lookAt(m.p.clone().add(m.n));
      var balken = netz(new THREE.BoxGeometry(0.011, 0.05, 0.004), st.augen, false);
      balken.scale.y = 0.001;
      balken.visible = false;
      mh.add(balken);
      kopf.add(mh);
      g.mund.push(balken);
    }
    // Ohren mit Leuchtring
    g.ohren = [];
    [1, -1].forEach(function (s) {
      var ohr = netz(new THREE.CylinderGeometry(0.07, 0.074, 0.075, 32), st.gold);
      ohr.rotation.z = Math.PI / 2;
      ohr.position.set(s * 0.292, 0.205, 0.0);
      kopf.add(ohr);
      var ring = netz(new THREE.TorusGeometry(0.043, 0.009, 10, 36), st.led, false);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(s * 0.333, 0.205, 0.0);
      kopf.add(ring);
      var kappe = netz(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24), st.graphit);
      kappe.rotation.z = Math.PI / 2;
      kappe.position.set(s * 0.332, 0.205, 0.0);
      kopf.add(kappe);
      g.ohren.push(ring);
    });
    // Heiligenschein
    var halo = g.halo = netz(new THREE.TorusGeometry(0.25, 0.017, 20, 96), st.halo, false);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 0.52, -0.01);
    kopf.add(halo);

    /* ---------------- Arme */
    g.arm = {};
    [1, -1].forEach(function (s) {
      var a = {};
      var schulter = a.schulter = new THREE.Group();
      schulter.position.set(s * 0.43, 0.52, -0.01);
      torso.add(schulter);
      schulter.add(netz(new THREE.SphereGeometry(0.112, 32, 24), st.gold));
      var oberarm = a.oberarm = new THREE.Group();
      schulter.add(oberarm);
      var ring1 = netz(new THREE.TorusGeometry(0.09, 0.015, 10, 36), st.graphit);
      ring1.rotation.x = Math.PI / 2; ring1.position.y = -0.09;
      oberarm.add(ring1);
      var obr = netz(new THREE.CapsuleGeometry(0.083, 0.19, 10, 28), st.perl);
      obr.position.y = -0.205;
      oberarm.add(obr);
      var ellbogen = a.ellbogen = new THREE.Group();
      ellbogen.position.y = -L1;
      oberarm.add(ellbogen);
      ellbogen.add(netz(new THREE.SphereGeometry(0.074, 28, 20), st.graphit));
      var ring2 = netz(new THREE.TorusGeometry(0.073, 0.012, 10, 32), st.gold);
      ring2.rotation.x = Math.PI / 2;
      ellbogen.add(ring2);
      var unterarm = netz(drehkoerper([[0.056, 0], [0.072, 0.03], [0.085, 0.11], [0.08, 0.2], [0.067, 0.27], [0.058, 0.3]], 40, 30), st.perl);
      unterarm.rotation.x = Math.PI; unterarm.position.y = -0.035;
      ellbogen.add(unterarm);
      var manschette = netz(new THREE.TorusGeometry(0.062, 0.013, 10, 32), st.gold);
      manschette.rotation.x = Math.PI / 2; manschette.position.y = -0.3;
      ellbogen.add(manschette);
      var handgelenk = a.handgelenk = new THREE.Group();
      handgelenk.position.y = -L2;
      ellbogen.add(handgelenk);
      handgelenk.add(netz(new THREE.SphereGeometry(0.048, 20, 14), st.graphit));
      var hand = a.hand = new THREE.Group();
      handgelenk.add(hand);
      var handflaeche = netz(new RoundedBoxGeometry(0.12, 0.13, 0.05, 3, 0.019), st.graphit);
      handflaeche.position.y = -0.075;
      hand.add(handflaeche);
      var knoechel = netz(new RoundedBoxGeometry(0.113, 0.024, 0.055, 2, 0.01), st.gold);
      knoechel.position.y = -0.134;
      hand.add(knoechel);
      a.finger = [];
      for (var f = 0; f < 3; f++) {
        var basisF = new THREE.Group();
        basisF.position.set((f - 1) * 0.038, -0.143, 0);
        hand.add(basisF);
        var glied1 = netz(new THREE.CapsuleGeometry(0.016, 0.034, 6, 12), st.graphit);
        glied1.position.y = -0.032;
        basisF.add(glied1);
        var gelenk = new THREE.Group();
        gelenk.position.y = -0.064;
        basisF.add(gelenk);
        gelenk.add(netz(new THREE.SphereGeometry(0.0163, 12, 10), st.gold, false));
        var glied2 = netz(new THREE.CapsuleGeometry(0.015, 0.026, 6, 12), st.graphit);
        glied2.position.y = -0.029;
        gelenk.add(glied2);
        a.finger.push([basisF, gelenk]);
      }
      var daumenB = new THREE.Group();
      daumenB.position.set(s * 0.062, -0.065, 0.014);
      daumenB.rotation.set(0.35, 0, s * 0.62);
      hand.add(daumenB);
      var d1 = netz(new THREE.CapsuleGeometry(0.017, 0.03, 6, 12), st.graphit);
      d1.position.y = -0.032;
      daumenB.add(d1);
      var dg = new THREE.Group();
      dg.position.y = -0.06;
      daumenB.add(dg);
      var d2 = netz(new THREE.CapsuleGeometry(0.0155, 0.02, 6, 12), st.graphit);
      d2.position.y = -0.024;
      dg.add(d2);
      a.daumen = [daumenB, dg];
      a.s = s;
      g.arm[s] = a;
    });

    // Hilfswerte (keine Speicherzuteilung pro Bild)
    this._v = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3(), p: new THREE.Vector3() };
    this._q = { a: new THREE.Quaternion(), b: new THREE.Quaternion(), c: new THREE.Quaternion() };
    this._m = new THREE.Matrix4();
    this._m2 = new THREE.Matrix4();
    this._ax = new THREE.Vector3(); this._ay = new THREE.Vector3(); this._az = new THREE.Vector3(); this._al = new THREE.Vector3();
    this._hx = new THREE.Vector3(); this._hy = new THREE.Vector3(); this._hz = new THREE.Vector3();
    this._x1 = new THREE.Vector3(1, 0, 0);
    this._y1 = new THREE.Vector3(0, 1, 0);
    this._qe = new THREE.Quaternion(); this._qf = new THREE.Quaternion(); this._qh = new THREE.Quaternion();
    this._qr = new THREE.Quaternion(); this._qt = new THREE.Quaternion(); this._qw = new THREE.Quaternion();
    this._q1 = new THREE.Quaternion();
    // natürliche Lage der Hand zum Unterarm: Handfläche zum Körper, leicht gebeugt
    this._natur = {};
    this._natur[1] = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, -0.9, 0, "YXZ"));
    this._natur[-1] = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, 0.9, 0, "YXZ"));
    this._e = new THREE.Euler();
    this.haloDreh = 0;
    this.blinzeln = 0;
    this.augenFarbe = new THREE.Color(0xffd07a);
    this.grundPose();
  }

  /* ------------------------------------------------------- Brust-Display */

  // Symbol der Station auf das gewölbte Display malen; phase 0..1 für bewegte Anzeigen
  displayMalen(symbol, farbe, phase) {
    var c = this.displayCtx, w = 512, h = 256;
    var f = "#" + new THREE.Color(farbe).getHexString();
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#070d1d";
    c.fillRect(0, 0, w, h);
    var gl = c.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.55, w * 0.55);
    gl.addColorStop(0, "rgba(40,60,110,0.55)"); gl.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gl; c.fillRect(0, 0, w, h);
    c.fillStyle = "rgba(255,255,255,0.035)";
    for (var y = 0; y < h; y += 4) { c.fillRect(0, y, w, 1); }
    // Rahmen
    c.strokeStyle = "rgba(233,189,104,0.9)"; c.lineWidth = 5;
    c.beginPath(); c.roundRect ? c.roundRect(14, 14, w - 28, h - 28, 26) : c.rect(14, 14, w - 28, h - 28); c.stroke();
    c.lineCap = "round"; c.lineJoin = "round";
    c.strokeStyle = f; c.fillStyle = f; c.lineWidth = 10;
    var cx = w / 2, cy = h / 2 + 4, i;
    switch (symbol) {
      case 1: // Thema: Trendkurve mit Punkten
        c.beginPath();
        var pkt = [[120, 175], [180, 150], [235, 160], [290, 110], [345, 118], [395, 72]];
        pkt.forEach(function (p, k) { k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); });
        c.stroke();
        pkt.forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 9, 0, Math.PI * 2); c.fill(); });
        break;
      case 2: // Skript: Zeilen und Schreibmarke
        for (i = 0; i < 4; i++) {
          var lang = [250, 210, 260, 150][i] * Math.min(1, Math.max(0, phase * 4 - i));
          c.beginPath(); c.moveTo(130, 82 + i * 32); c.lineTo(130 + lang, 82 + i * 32); c.stroke();
        }
        break;
      case 3: // Stimme: Pegel
        for (i = 0; i < 11; i++) {
          var hh = 18 + Math.abs(Math.sin(phase * 12.0 + i * 0.9) * Math.sin(phase * 5.0 + i * 0.37)) * 120;
          c.fillRect(132 + i * 23 - 6, cy - hh / 2, 12, hh);
        }
        break;
      case 4: // Quellen: aufgeschlagenes Buch mit Haken
        c.beginPath(); c.moveTo(cx, 80); c.lineTo(cx, 190); c.moveTo(cx, 80); c.quadraticCurveTo(cx - 70, 62, cx - 130, 82); c.lineTo(cx - 130, 192); c.quadraticCurveTo(cx - 70, 172, cx, 190);
        c.moveTo(cx, 80); c.quadraticCurveTo(cx + 70, 62, cx + 130, 82); c.lineTo(cx + 130, 192); c.quadraticCurveTo(cx + 70, 172, cx, 190); c.stroke();
        break;
      case 5: // Freigabe: Haken im Kreis
        c.beginPath(); c.arc(cx, cy, 70, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.moveTo(cx - 32, cy + 2); c.lineTo(cx - 8, cy + 26); c.lineTo(cx + 36, cy - 24); c.stroke();
        break;
      case 6: // Kanäle: Sendewellen
        c.beginPath(); c.arc(cx, cy + 40, 12, 0, Math.PI * 2); c.fill();
        for (i = 1; i <= 3; i++) { c.beginPath(); c.arc(cx, cy + 40, 12 + i * 34, -Math.PI * 0.8, -Math.PI * 0.2); c.stroke(); }
        break;
      default: // IT-Engel und Ziel: Heiligenschein
        c.beginPath(); c.ellipse(cx, cy - 6, 96, 30, 0, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 0.45; c.beginPath(); c.ellipse(cx, cy - 6, 120, 42, 0, 0, Math.PI * 2); c.lineWidth = 3; c.stroke(); c.globalAlpha = 1;
    }
    this.displayTex.needsUpdate = true;
  }

  /* ------------------------------------------------------------- Posen */

  grundPose() {
    var g = this.g;
    g.torso.rotation.set(0, 0, 0);
    g.kopf.rotation.set(0, 0, 0);
    [1, -1].forEach(function (s) {
      var a = g.arm[s];
      a.oberarm.rotation.set(0.12, 0, s * 0.16);
      a.ellbogen.rotation.set(-0.35, 0, 0);
      a.handgelenk.rotation.set(0, -s * 0.9, 0);
    });
    this.finger(1, 0.35, 0.3); this.finger(-1, 0.35, 0.3);
  }

  // vor jeder neuen Szene: alles, was Szenen verstellen, in den Grundzustand
  zuruecksetzen() {
    var g = this.g;
    this.grundPose();
    g.basis.position.set(0, 0.22, 0);
    g.basis.rotation.set(0, 0, 0);
    g.kopf.rotation.set(0, 0, 0);
    this.mund([0, 0, 0, 0, 0]);
    [1, -1].forEach(function (s) { g.arm[s].daumen[0].rotation.set(0.35, 0, s * 0.62); });
    this.augen(1, 0, 0);
    this.haloAusrichten();
  }

  // Finger krümmen: k für die drei Finger, d für den Daumen (0 = gestreckt, 1 = Faust)
  finger(s, k, d, einzeln) {
    var a = this.g.arm[s];
    for (var f = 0; f < 3; f++) {
      var kk = einzeln && einzeln[f] !== undefined ? einzeln[f] : k;
      a.finger[f][0].rotation.x = -kk * 1.25;
      a.finger[f][1].rotation.x = -kk * 1.45;
    }
    a.daumen[0].rotation.x = 0.35 - d * 0.6;
    a.daumen[1].rotation.x = -d * 1.1;
  }

  // Kopf auf einen Punkt in Weltkoordinaten richten (mit Grenzen), staerke 0..1
  blick(ziel, staerke) {
    var g = this.g, v = this._v;
    g.torso.updateWorldMatrix(true, false);
    v.a.copy(ziel);
    g.torso.worldToLocal(v.a);
    v.a.sub(g.kopf.position).sub(v.b.set(0, 0.21, 0));
    var gier = Math.atan2(v.a.x, v.a.z);
    var nick = -Math.atan2(v.a.y, Math.sqrt(v.a.x * v.a.x + v.a.z * v.a.z));
    gier = Math.max(-1.0, Math.min(1.0, gier));
    nick = Math.max(-0.5, Math.min(0.6, nick));
    g.kopf.rotation.y = gier * staerke;
    g.kopf.rotation.x = nick * staerke;
    this.haloAusrichten();
  }

  // der Heiligenschein schwebt waagerecht, auch wenn Kopf und Oberkörper sich neigen oder drehen:
  // Ziel in der Welt = Drehung des Kopfes um die Hochachse, dann flach gelegt, dann der eigene Schimmer
  haloAusrichten() {
    var g = this.g, q = this._q, e = this._e;
    g.kopf.updateWorldMatrix(true, false);
    g.kopf.getWorldQuaternion(q.b);
    e.setFromQuaternion(q.b, "YXZ");
    e.set(Math.PI / 2, e.y, this.haloDreh || 0, "YXZ");
    q.c.setFromEuler(e);
    g.halo.quaternion.copy(q.b.invert()).multiply(q.c);
  }

  // Augen: offen 0..1, Blick in Visier-Koordinaten (-1..1), Farbe optional
  augen(offen, bx, by) {
    var g = this.g;
    for (var i = 0; i < g.augen.length; i++) {
      var a = g.augen[i];
      a.auge.scale.y = Math.max(0.08, offen);
      a.auge.position.set(bx * 0.02, by * 0.016, 0);
    }
  }

  mund(pegel) {
    var g = this.g;
    for (var i = 0; i < g.mund.length; i++) {
      var p = pegel[i] || 0;
      g.mund[i].scale.y = Math.max(0.001, p);
      g.mund[i].visible = p > 0.01;
    }
  }

  /* ------------------------------------------------------ inverse Kinematik */

  // Richtung in Roboter-Koordinaten (vorn = +Z, oben = +Y, links = +X) in die Welt umrechnen
  richtung(x, y, z, ziel) {
    this.wurzel.getWorldQuaternion(this._q.a);
    return ziel.set(x, y, z).applyQuaternion(this._q.a);
  }

  // Punkt in Roboter-Koordinaten in die Welt umrechnen
  punkt(x, y, z, ziel) {
    return this.wurzel.localToWorld(ziel.set(x, y, z));
  }

  // Lage der Hand in der Welt aus Fingerrichtung F und Handflächen-Normale N (beide in Roboter-Koordinaten)
  handLage(fx, fy, fz, nx, ny, nz, ziel) {
    var Y = this._hy.set(-fx, -fy, -fz).normalize();
    var Z = this._hz.set(nx, ny, nz);
    Z.addScaledVector(Y, -Z.dot(Y)).normalize();
    var X = this._hx.crossVectors(Y, Z).normalize();
    this._m2.makeBasis(X, Y, Z);
    ziel.setFromRotationMatrix(this._m2);
    this.wurzel.getWorldQuaternion(this._q.a);
    return ziel.premultiply(this._q.a);
  }

  // greifen: die Handfläche (nicht das Handgelenk) an den Weltpunkt legen, Hand nach Fingerrichtung F und
  // Handflächen-Normale N (Roboter-Koordinaten) ausgerichtet; das Handgelenk sitzt dahinter
  greifen(s, punkt, fx, fy, fz, nx, ny, nz, pol) {
    var hq = this._hq || (this._hq = new THREE.Quaternion());
    this.handLage(fx, fy, fz, nx, ny, nz, hq);
    var off = this._go || (this._go = new THREE.Vector3());
    off.set(0, -0.085, 0.04).applyQuaternion(hq);           // Mitte der Handfläche, knapp vor ihr
    var ziel = this._gz || (this._gz = new THREE.Vector3());
    ziel.copy(punkt).sub(off);
    this.arm(s, ziel, pol, hq);
  }

  // Handgelenk von Arm s an den Weltpunkt ziel führen; pol = Richtung, in die der Ellbogen zeigt (Welt);
  // handQ = gewünschte Lage der Hand in der Welt (optional)
  arm(s, ziel, pol, handQ) {
    var a = this.g.arm[s], v = this._v, q = this._q, m = this._m;
    a.schulter.updateWorldMatrix(true, false);
    var S = v.a.setFromMatrixPosition(a.schulter.matrixWorld);
    var d = v.b.copy(ziel).sub(S);
    var dist = d.length();
    var dir = d.multiplyScalar(1 / Math.max(1e-6, dist));
    dist = Math.max(0.12, Math.min(L1 + L2 - 1e-4, dist));
    var cosA = (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist);
    var A = Math.acos(Math.max(-1, Math.min(1, cosA)));
    var pp = v.c.copy(pol);
    pp.addScaledVector(dir, -pp.dot(dir));
    if (pp.lengthSq() < 1e-8) { pp.set(0, -1, 0).addScaledVector(dir, -dir.y); }
    pp.normalize();
    var E = v.d.copy(S).addScaledVector(dir, L1 * Math.cos(A)).addScaledVector(pp, L1 * Math.sin(A));
    var u1 = v.e.copy(E).sub(S).normalize();                         // Richtung Oberarm
    var W = v.p.copy(S).addScaledVector(dir, dist);                    // erreichbares Ziel
    var u2 = W.sub(E).normalize();                                     // Richtung Unterarm
    // Achsen des Oberarms: Y entgegen der Knochenrichtung, X senkrecht zur Beugeebene
    var X = this._ax.crossVectors(u1, u2);
    if (X.lengthSq() < 1e-8) { X.crossVectors(u1, pp); }
    X.normalize();
    var Y = this._ay.copy(u1).negate();
    var Z = this._az.crossVectors(X, Y).normalize();
    m.makeBasis(X, Y, Z);
    var Qu = q.a.setFromRotationMatrix(m);
    // in den Raum der Schulter umrechnen
    a.schulter.getWorldQuaternion(q.b);
    a.oberarm.quaternion.copy(q.b).invert().multiply(Qu);
    // Ellbogen: Drehung um X in der Beugeebene
    var lok = this._al.copy(u2).applyQuaternion(q.c.copy(Qu).invert());
    var theta = Math.atan2(-lok.z, -lok.y);
    var Qe = this._qe.setFromAxisAngle(this._x1, theta);
    var Qf = this._qf.copy(Qu).multiply(Qe);                           // Welt-Lage des Unterarms (ohne Drehung)
    // ohne Vorgabe: natürliche Hand in Verlängerung des Unterarms, Handfläche zum Körper
    if (!handQ) { handQ = this._qh.copy(Qf).multiply(this._natur[s]); }
    // Drehung Unterarm -> Hand zerlegen: Anteil um die Unterarmachse (Y) übernimmt der Unterarm
    // (Ein- und Auswärtsdrehen), den Rest beugt das Handgelenk; beides mit Grenzen wie beim Menschen
    var R = this._qr.copy(Qf).invert().multiply(handQ);
    var T = this._qt.set(0, R.y, 0, R.w);
    if (T.lengthSq() < 1e-10) { T.identity(); } else { T.normalize(); }
    var alpha = 2 * Math.atan2(T.y, T.w);
    if (alpha > Math.PI) { alpha -= 2 * Math.PI; } else if (alpha < -Math.PI) { alpha += 2 * Math.PI; }
    alpha = Math.max(-1.75, Math.min(1.75, alpha));
    T.setFromAxisAngle(this._y1, alpha);
    var W = this._qw.copy(T).invert().multiply(R);
    if (W.w < 0) { W.set(-W.x, -W.y, -W.z, -W.w); }
    var beta = 2 * Math.acos(Math.min(1, W.w));
    if (beta > 1.35) { W.slerp(this._q1, 1 - 1.35 / beta); }
    a.ellbogen.quaternion.copy(Qe).multiply(T);
    a.handgelenk.quaternion.copy(W);
  }

  /* ------------------------------------------------------- Leben im Leerlauf */

  // Schweben, Heiligenschein, Blinzeln; zeit in Sekunden. welle: nur für die Schleife der Bildfolge (siehe
  // szeneStart in szenen.js), dann blinzelt der Roboter einmal je Schleife von 3,6 Sekunden
  leben(zeit, welle) {
    var g = this.g;
    g.basis.position.y = 0.22 + Math.sin(zeit * 1.7) * 0.022 + Math.sin(zeit * 0.63) * 0.01;
    g.basis.rotation.z = Math.sin(zeit * 0.9) * 0.012;
    this.haloDreh = zeit * 0.35;
    g.halo.position.y = 0.52 + Math.sin(zeit * 1.3 + 1.0) * 0.012;
    // alle 3,7 Sekunden ein kurzes Blinzeln
    var b = welle === undefined ? (zeit % 3.7) / 3.7 : (welle % 3.6) / 3.6, offen = 1;
    if (b > 0.94) { offen = Math.abs(Math.cos((b - 0.94) / 0.06 * Math.PI)); }
    this.blinzeln = offen;
    g.schub.material.emissiveIntensity = 2.2 + Math.sin(zeit * 11.0) * 0.18 + Math.sin(zeit * 7.3) * 0.14;
  }
}
