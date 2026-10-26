/*
  Die feste Skala um den Kreis (2D-Canvas über dem 3D-Bild): sechs bunte Bögen in den Farben der
  Stationen, die beim Scrollen im Kreis laufen, ein gegenläufiger Strichkranz, der Goldring mit dem
  Fortschritt und eine feine Fassung wie bei einem Objektiv. Dazu treibender Goldstaub außerhalb.
*/
import { namen, SCHRIFT, ZIFFERN } from "./sprache.js";

const PI = Math.PI, PI2 = Math.PI * 2;

function klemme(x, a, b) { return x < a ? a : (x > b ? b : x); }
function rgba(c, a) {
  a = a < 0 ? 0 : (a > 1 ? 1 : a);
  return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + (a < 0.004 ? "0" : a.toFixed(3)) + ")";
}
function zufall(start) {
  var n = start | 0;
  return function () {
    n = (n + 0x6D2B79F5) | 0;
    var t = Math.imul(n ^ (n >>> 15), 1 | n);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Skala {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.W = 1; this.H = 1; this.dpr = 1;
    this.lay = { x: 0, y: 0, r: 100 };
    var rnd = zufall(21);
    this.staub = [];
    for (var i = 0; i < 46; i++) { this.staub.push([rnd(), rnd(), 0.3 + rnd() * 0.7, rnd()]); }
  }

  messen(W, H, dpr, lay) {
    this.W = W; this.H = H; this.dpr = dpr; this.lay = lay;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
  }

  zeichne(Z, zeit, P) {
    var ctx = this.ctx, lay = this.lay, R = lay.r, x = lay.x, y = lay.y, s = Z.s, i, k;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    // Goldstaub außerhalb des Kreises
    for (i = 0; i < this.staub.length; i++) {
      var p = this.staub[i], tiefe = p[2];
      var sx = ((p[0] + zeit * 0.004 * tiefe) % 1) * this.W;
      var sy = (((p[1] - s * 0.05 * tiefe) % 1) + 1) % 1 * this.H;
      var dx = sx - x, dy = sy - y;
      if (dx * dx + dy * dy < R * R * 1.35) { continue; }
      ctx.fillStyle = rgba(P.gold, 0.5 * (0.25 + 0.5 * p[3]) * tiefe);
      ctx.beginPath(); ctx.arc(sx, sy, 0.6 + 1.4 * tiefe, 0, PI2); ctx.fill();
    }
    // Fassung: dunkler Innenrand und ein Lichtbogen oben links (wie Glas über dem Bild)
    var fass = ctx.createRadialGradient(x, y, R * 0.86, x, y, R);
    fass.addColorStop(0, "rgba(0,0,0,0)"); fass.addColorStop(1, "rgba(2,4,10,0.55)");
    ctx.fillStyle = fass; ctx.beginPath(); ctx.arc(x, y, R, 0, PI2); ctx.fill();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,248,230,0.16)"; ctx.lineWidth = Math.max(1, R * 0.012);
    ctx.beginPath(); ctx.arc(x, y, R * 0.965, PI * 1.08, PI * 1.42); ctx.stroke();
    // Strichkranz (dreht gegenläufig)
    var n = 120, d2 = -s * 0.3 - zeit * 0.01;
    ctx.lineCap = "butt";
    for (i = 0; i < n; i++) {
      var a = d2 + i * PI2 / n, lang = i % 10 === 0 ? 0.05 : (i % 5 === 0 ? 0.034 : 0.022);
      ctx.strokeStyle = rgba(P.gold, i % 10 === 0 ? 0.6 : 0.3);
      ctx.lineWidth = Math.max(1, R * (i % 10 === 0 ? 0.004 : 0.0025));
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * R * 1.035, y + Math.sin(a) * R * 1.035);
      ctx.lineTo(x + Math.cos(a) * R * (1.035 - lang * 0.6), y + Math.sin(a) * R * (1.035 - lang * 0.6));
      ctx.stroke();
    }
    // Goldring
    ctx.lineWidth = Math.max(1.4, R * 0.008); ctx.strokeStyle = rgba(P.gold, 0.95);
    ctx.beginPath(); ctx.arc(x, y, R, 0, PI2); ctx.stroke();
    // Fortschritt: feiner heller Bogen auf dem Goldring
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(2, R * 0.016); ctx.strokeStyle = rgba(P.licht, 0.92);
    ctx.beginPath(); ctx.arc(x, y, R, -PI / 2, -PI / 2 + PI2 * Z.fort); ctx.stroke();
    // Überblick: Beschriftung der acht Schichten mit feinen Hinweislinien (wie in einer technischen Zeichnung)
    if (Z.auf > 0.02 && Z.etiketten && Z.etiketten.length) {
      var px = Math.max(8.5, Math.min(13, R * 0.034)), NAMEN = namen();
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, R * 0.985, 0, PI2); ctx.clip();
      ctx.font = "700 " + px.toFixed(1) + "px " + SCHRIFT;
      ctx.textBaseline = "middle"; ctx.textAlign = "right";
      if ("letterSpacing" in ctx) { ctx.letterSpacing = (px * 0.16).toFixed(1) + "px"; }
      for (i = 0; i < Z.etiketten.length; i++) {
        var et = Z.etiketten[i];
        if (!et) { continue; }
        var verz = klemme(Z.auf * 1.6 - i * 0.07, 0, 1);
        if (verz <= 0.01) { continue; }
        var fa = et.j >= 1 && et.j <= 6 ? P.farben[et.j - 1] : P.gold;
        var lx = et.x - Math.max(10, R * 0.06) * verz, ly = et.y;
        ctx.strokeStyle = rgba(P.licht, 0.45 * verz); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(et.x - 2, ly); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.fillStyle = rgba(fa, verz);
        ctx.beginPath(); ctx.arc(et.x, ly, Math.max(2, px * 0.22), 0, PI2); ctx.fill();
        ctx.fillStyle = rgba(P.licht, 0.92 * verz);
        ctx.fillText(NAMEN[et.j], lx - px * 0.5, ly + 0.5);
        if (et.j >= 1 && et.j <= 6) {
          var bName = ctx.measureText(NAMEN[et.j]).width;
          ctx.font = "600 " + px.toFixed(1) + "px " + ZIFFERN;
          ctx.fillText("0" + et.j, lx - px * 0.5 - bName - px * 0.8, ly + 0.5);
          ctx.font = "700 " + px.toFixed(1) + "px " + SCHRIFT;
        }
      }
      if ("letterSpacing" in ctx) { ctx.letterSpacing = "0px"; }
      ctx.restore();
    }
    // sechs Bögen in den Farben der Stationen, die beim Scrollen im Kreis laufen
    var dreh = -PI / 2 + s * 0.55 + zeit * 0.02, spanne = PI2 / 6, luecke = 0.16;
    for (k = 0; k < 6; k++) {
      var aktiv = klemme(1 - Math.abs(Z.station - (k + 1)) / 0.9, 0, 1);
      var erreicht = Z.station > k + 0.6 ? 1 : 0;
      var a0 = dreh + k * spanne + luecke / 2, a1 = dreh + (k + 1) * spanne - luecke / 2;
      var rr = R * (1.085 + 0.012 * aktiv);
      ctx.lineWidth = Math.max(2.2, R * (0.017 + 0.012 * aktiv));
      ctx.strokeStyle = rgba(P.farben[k], 0.32 + 0.38 * erreicht + 0.3 * aktiv);
      ctx.beginPath(); ctx.arc(x, y, rr, a0, a1); ctx.stroke();
      ctx.fillStyle = rgba(P.licht, 0.5 + 0.5 * aktiv);
      ctx.beginPath(); ctx.arc(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr, Math.max(1.2, R * 0.006), 0, PI2); ctx.fill();
    }
  }
}
