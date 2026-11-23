/* Code-drawn looping art panels for steps without photos (window.LMS_DRAW.art), ferroelectric course.
   Contract: LMS_DRAW.art['fe.<name>'] = function (ctx, w, h, t, params): draws the whole panel, t in seconds, loops,
   deterministic from t, no DOM work. Crystal convention as in the course: x-cut film normal is x, waveguides along y,
   electrode field and TE polarization along z (TE sees n_e along y), TM along x sees n_o; the pyroelectric coefficient
   is negative, so heating leaves the +z face negative. Reuses the palette and helpers of anims/fe_draw.js. */
window.LMS_DRAW = window.LMS_DRAW || {};
window.LMS_DRAW.art = window.LMS_DRAW.art || {};
(function () {
  'use strict';
  var root = window;
  var A = root.LMS_DRAW.art;
  var fe = root.LMS_DRAW.fe || {};
  var P = fe.P || {
    film: '#a499a3', filmHi: '#b2a8b1', filmLo: '#91858f', slab: '#8bab9a', au: '#efcb72', auHi: '#fde7a6', auLo: '#c99a40', auEdge: '#8c6a26',
    si: '#26282d', chuck: '#56595f', light: '#63e6ff', lightTM: '#ff6b6b', rfP: '#ff3d3d', rfN: '#2f6dff',
    ok: '#3fae69', bad: '#e0524c', warn: '#e3b04b', ink: '#e9eef3', inkDim: '#a9b4bf', panel: 'rgba(10,14,19,0.84)', screen: '#0a0e13'
  };
  var PI = Math.PI, TAU = 2 * PI;
  var SANS = 'ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
  var MONO = 'ui-monospace, Menlo, Consolas, monospace';
  var C = {   // extra colours on top of the fe palette
    zAx: '#ffc46b', yAx: '#9fe3ff', xAx: '#ffffff', paper: '#f1ece1', paperLo: '#d9d1c1', ink: '#2b2f36', red: '#d8453f',
    navy: '#0d1620', deep: '#070a0e', violet: '#b48cff', pink: '#ff7ad9', lime: '#b6f36b', hot: '#ff8a3d', cold: '#5fb2ff'
  };

  /* ---------- math ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function seg(u, a, b) { return clamp((u - a) / (b - a), 0, 1); }
  function es(u, a, b) { return ease(seg(u, a, b)); }
  function cyc(t, T, ph) { var v = (t / T + (ph || 0)) % 1; return v < 0 ? v + 1 : v; }
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function pulse(u, a, b) { return Math.sin(PI * seg(u, a, b)); }
  function hexA(hex, a) {
    if (fe.hexA) return fe.hexA(hex, a);
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  }
  function mix(c1, c2, t) {
    var a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16); t = clamp(t, 0, 1);
    var r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t)), g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }

  /* ---------- units: s = px per design px of a 480 x 360 panel ---------- */
  function units(w, h, bw, bh) {
    var s = Math.min(w / (bw || 480), h / (bh || 360));
    return { w: w, h: h, s: s, f: function (n) { return Math.max(Math.round(8 * Math.min(1, w / 300)), Math.round(n * s)); } };
  }
  // a units object in the shape fe_draw helpers expect (900-px design frame)
  function feU(U, k) { var s = U.s * (k || 1); return { W: U.w, H: U.h, s: s, dpr: 1, f: function (n) { return Math.max(8, Math.round(n * s)); } }; }

  /* ---------- drawing primitives ---------- */
  function font(ctx, px, wgt, mono) { ctx.font = (wgt ? wgt + ' ' : '') + px + 'px ' + (mono ? MONO : SANS); }
  function text(ctx, s, x, y, px, col, align, wgt, base, mono) {
    font(ctx, px, wgt, mono); ctx.fillStyle = col; ctx.textAlign = align || 'center'; ctx.textBaseline = base || 'middle'; ctx.fillText(s, x, y);
  }
  function bg(ctx, U, c0, c1, cx, cy) {
    var g = ctx.createRadialGradient(U.w * (cx == null ? 0.5 : cx), U.h * (cy == null ? 0.42 : cy), 0, U.w * 0.5, U.h * 0.5, Math.hypot(U.w, U.h) * 0.62);
    g.addColorStop(0, c0 || '#1b2430'); g.addColorStop(1, c1 || '#07090c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, U.w, U.h);
  }
  function dots(ctx, U, step, col) {
    var p = step * U.s; ctx.fillStyle = col || 'rgba(140,160,180,0.16)';
    for (var x = p / 2; x < U.w; x += p) for (var y = p / 2; y < U.h; y += p) ctx.fillRect(x, y, Math.max(1, U.s), Math.max(1, U.s));
  }
  function glow(ctx, x, y, r, col, a) {
    if (a <= 0.01 || r <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,' + (0.9 * a).toFixed(3) + ')'); g.addColorStop(0.28, hexA(col, 0.85 * a)); g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
  }
  function arrow(ctx, x0, y0, x1, y1, col, lw, hs) {
    var a = Math.atan2(y1 - y0, x1 - x0); hs = hs || lw * 4;
    ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - hs * 0.8 * Math.cos(a), y1 - hs * 0.8 * Math.sin(a)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hs * Math.cos(a - 0.4), y1 - hs * Math.sin(a - 0.4)); ctx.lineTo(x1 - hs * Math.cos(a + 0.4), y1 - hs * Math.sin(a + 0.4)); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function line(ctx, x0, y0, x1, y1, col, lw, dash) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
  }
  function box(ctx, x, y, w, h, fill, stroke, lw) {
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
  }
  // speech bubble with a tail pointing at (tx, ty); returns its rect
  function bubble(ctx, U, x, y, lines, o) {
    o = o || {}; lines = [].concat(lines);
    var px = U.f(o.size || 15), pad = px * 0.6; font(ctx, px, o.wgt || '700');
    var tw = 0; lines.forEach(function (l) { tw = Math.max(tw, ctx.measureText(l).width); });
    var bw = tw + 2 * pad, bh = lines.length * px * 1.25 + 2 * pad - px * 0.25;
    var bx = clamp(x - bw / 2, 4 * U.s, U.w - bw - 4 * U.s), by = clamp(y - bh / 2, 4 * U.s, U.h - bh - 4 * U.s);
    var sc = o.scale == null ? 1 : o.scale;
    ctx.save(); ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(sc, sc); ctx.translate(-(bx + bw / 2), -(by + bh / 2));
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    ctx.fillStyle = o.bg || '#ffffff';
    if (o.tx != null) {
      var cx = clamp(o.tx, bx + bw * 0.2, bx + bw * 0.8), cyb = o.ty > by + bh ? by + bh - 1 : by + 1;
      ctx.beginPath(); ctx.moveTo(cx - 10 * U.s, cyb); ctx.lineTo(o.tx, o.ty); ctx.lineTo(cx + 10 * U.s, cyb); ctx.closePath(); ctx.fill();
    }
    ctx.fillRect(bx, by, bw, bh);
    if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 2 * U.s; ctx.strokeRect(bx, by, bw, bh); }
    ctx.fillStyle = o.col || '#11161c'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach(function (l, i) { ctx.fillText(l, bx + pad, by + pad + i * px * 1.25); });
    ctx.restore();
    return { x: bx, y: by, w: bw, h: bh };
  }
  // rubber stamp slamming in (v: 0 before, ramps 0..1 over the slam)
  function stamp(ctx, U, label, col, v, x, y, size, rot) {
    if (v <= 0) return;
    var sc = 1 + 0.6 * Math.pow(1 - clamp(v / 0.2, 0, 1), 2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot == null ? -0.18 : rot); ctx.scale(sc, sc);
    ctx.globalAlpha *= clamp(v / 0.08, 0, 1) * 0.92;
    var px = U.f(size || 24); font(ctx, px, '800');
    var tw = ctx.measureText(label).width + px * 0.9, th = px * 1.55;
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, 3 * U.s);
    ctx.strokeRect(-tw / 2, -th / 2, tw, th); ctx.lineWidth = Math.max(1, 1.4 * U.s);
    ctx.strokeRect(-tw / 2 + 4 * U.s, -th / 2 + 4 * U.s, tw - 8 * U.s, th - 8 * U.s);
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, px * 0.05);
    ctx.restore();
  }
  // wafer disc with a primary flat; fa = canvas angle of the flat's outward normal
  function waferPath(ctx, cx, cy, r, fa) {
    var d = 0.38; ctx.beginPath(); ctx.arc(cx, cy, r, fa + d, fa - d + TAU); ctx.closePath();
  }
  function wafer(ctx, cx, cy, r, fa, o) {
    o = o || {};
    ctx.save();
    waferPath(ctx, cx, cy, r, fa);
    var g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, o.c0 || '#d9cfe0'); g.addColorStop(0.5, o.c1 || '#a597b2'); g.addColorStop(1, o.c2 || '#c6b8d2');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, r * 0.015); ctx.stroke();
    if (o.sheen !== false) {
      ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      var sh = o.sheen == null ? 0.3 : o.sheen;
      var gs = ctx.createLinearGradient(cx - r, cy + r * (sh - 0.5) * 3, cx + r, cy - r + r * (sh - 0.5) * 3);
      gs.addColorStop(0.35, 'rgba(255,255,255,0)'); gs.addColorStop(0.5, 'rgba(255,255,255,0.16)'); gs.addColorStop(0.65, 'rgba(255,255,255,0)');
      ctx.fillStyle = gs; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    }
    ctx.restore();
  }
  // crystal axes glyph (y and z in plane, x out of plane), rot = canvas angle of +y
  function axes(ctx, U, x, y, rot, o) {
    o = o || {}; var L = (o.len || 30) * U.s, lw = Math.max(1.5, 2.2 * U.s);
    var cy = Math.cos(rot), sy = Math.sin(rot);
    var flip = o.mirror ? -1 : 1;
    var yx = x + L * cy, yy = y + L * sy, zx = x + flip * L * sy, zy = y - flip * L * cy;
    if (o.box) box(ctx, x - L * 1.25, y - L * 1.25, L * 2.5, L * 2.5, 'rgba(8,11,15,0.6)');
    arrow(ctx, x, y, yx, yy, o.yCol || C.yAx, lw, 7 * U.s);
    arrow(ctx, x, y, zx, zy, o.zCol || C.zAx, lw, 7 * U.s);
    ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, 1.2 * U.s); ctx.beginPath(); ctx.arc(x, y, 4 * U.s, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 1.4 * U.s, 0, TAU); ctx.fill(); ctx.restore();
    var fs = U.f(o.size || 12);
    text(ctx, o.yLab || 'y', yx + 9 * U.s * cy, yy + 9 * U.s * sy, fs, o.yCol || C.yAx, 'center', '700');
    text(ctx, o.zLab || 'z', zx + flip * 9 * U.s * sy, zy - flip * 9 * U.s * cy, fs, o.zCol || C.zAx, 'center', '700');
  }
  // small x-cut MZM die seen from above: waveguides along the die's local x (crystal y), electrodes either side;
  // mark: corner index 0..3 for an ink dot (0 = top left), axesOn: draw the crystal glyph in the die corner
  function die(ctx, cx, cy, s, rot, o) {
    o = o || {};
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot || 0);
    var hw = s / 2, hh = s * (o.aspect || 0.62) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-hw + s * 0.03, -hh + s * 0.04, 2 * hw, 2 * hh);
    ctx.fillStyle = o.film || P.film; ctx.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, s * 0.01); ctx.strokeRect(-hw, -hh, 2 * hw, 2 * hh);
    var yc = -hh * 0.05, sp = hh * 0.16;
    // gold GSG
    var ga = ctx.createLinearGradient(0, -hh, 0, hh); ga.addColorStop(0, P.auHi); ga.addColorStop(0.5, P.au); ga.addColorStop(1, P.auLo);
    ctx.fillStyle = ga;
    ctx.fillRect(-hw * 0.55, yc - sp * 0.55, hw * 1.1, sp * 1.1);
    ctx.fillRect(-hw * 0.55, yc - sp * 3.6, hw * 1.1, sp * 2.4);
    ctx.fillRect(-hw * 0.55, yc + sp * 1.2, hw * 1.1, sp * 2.4);
    ctx.fillRect(-hw * 0.62, yc - sp * 3.6, hw * 0.07, hh * 1.35);   // pads toward the input end
    // waveguides
    ctx.strokeStyle = o.wg || P.slab; ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.beginPath(); ctx.moveTo(-hw, yc); ctx.lineTo(-hw * 0.75, yc);
    [-1, 1].forEach(function (sg) { ctx.moveTo(-hw * 0.75, yc); ctx.lineTo(-hw * 0.6, yc + sg * sp * 0.85); ctx.lineTo(hw * 0.6, yc + sg * sp * 0.85); ctx.lineTo(hw * 0.75, yc); });
    ctx.moveTo(hw * 0.75, yc); ctx.lineTo(hw, yc); ctx.stroke();
    if (o.light) {   // light pulse running along the arms
      var lx = lerp(-hw, hw, o.light % 1);
      ctx.restore(); ctx.save();
      var c0 = Math.cos(rot || 0), s0 = Math.sin(rot || 0);
      var lyA = yc + (Math.abs(lx) < hw * 0.6 ? sp * 0.85 : Math.abs(lx) < hw * 0.75 ? sp * 0.85 * (hw * 0.75 - Math.abs(lx)) / (hw * 0.15) : 0);
      [1, -1].forEach(function (sg) { var py = Math.abs(lx) < hw * 0.75 ? yc + sg * (lyA - yc) : yc; glow(ctx, cx + lx * c0 - py * s0, cy + lx * s0 + py * c0, s * 0.07, o.lightCol || P.light, 0.95); });
      ctx.restore(); ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot || 0);
    }
    if (o.mark != null) {
      var mx = [-1, 1, 1, -1][o.mark] * hw * 0.84, my = [-1, -1, 1, 1][o.mark] * hh * 0.78;
      ctx.fillStyle = o.markCol || '#e23b3b'; ctx.beginPath(); ctx.arc(mx, my, s * 0.04, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // anonymous figure in a cleanroom suit, seen from behind (no face); x, y = centre of the shoulder line; k = scale
  function figure(ctx, x, y, k, o) {
    o = o || {};
    var slump = o.slump || 0, col = o.col || '#e6ebf0', shade = o.shade || '#aeb9c4';
    ctx.save(); ctx.translate(x, y);
    var g = ctx.createLinearGradient(-60 * k, 0, 60 * k, 0); g.addColorStop(0, shade); g.addColorStop(0.5, col); g.addColorStop(1, shade);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-58 * k, 120 * k); ctx.quadraticCurveTo(-62 * k, 8 * k, -30 * k, 0); ctx.lineTo(30 * k, 0); ctx.quadraticCurveTo(62 * k, 8 * k, 58 * k, 120 * k); ctx.closePath(); ctx.fill();
    // hood, sinking with slump
    var hy = -34 * k + slump * 22 * k;
    var gh = ctx.createRadialGradient(-8 * k, hy - 10 * k, 4 * k, 0, hy, 34 * k); gh.addColorStop(0, col); gh.addColorStop(1, shade);
    ctx.fillStyle = gh; ctx.beginPath(); ctx.ellipse(0, hy, 27 * k, 32 * k, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(90,100,112,0.55)'; ctx.lineWidth = Math.max(1, 1.5 * k);
    ctx.beginPath(); ctx.moveTo(0, hy - 30 * k); ctx.lineTo(0, hy + 26 * k); ctx.stroke();   // hood seam
    ctx.beginPath(); ctx.moveTo(0, 6 * k); ctx.lineTo(0, 120 * k); ctx.stroke();               // back zip
    ctx.restore();
  }
  // trigonal crystal boule shown as a translucent hexagonal prism
  function crystal(ctx, cx, cy, r, hgt, ph, o) {
    o = o || {};
    var pts = [], i, a;
    for (i = 0; i < 6; i++) { a = ph + i * TAU / 6; pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.38]); }
    var col = o.col || '#c9a7ff';
    ctx.save(); ctx.translate(cx, cy);
    // side faces (only those facing the viewer: positive y component of the face normal)
    for (i = 0; i < 6; i++) {
      var p = pts[i], q = pts[(i + 1) % 6], mid = ph + (i + 0.5) * TAU / 6;
      if (Math.sin(mid) < 0) continue;
      var lum = 0.35 + 0.45 * (0.5 + 0.5 * Math.cos(mid - 1.0));
      ctx.fillStyle = hexA(mix('#3a2a5c', col, lum), o.alpha == null ? 0.88 : o.alpha);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0], q[1] - hgt); ctx.lineTo(p[0], p[1] - hgt); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.fillStyle = hexA(mix(col, '#ffffff', 0.35), 0.92);
    ctx.beginPath(); pts.forEach(function (p, j) { if (j) ctx.lineTo(p[0], p[1] - hgt); else ctx.moveTo(p[0], p[1] - hgt); }); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
    ctx.restore();
  }
  // cached figure images (drawn when loaded; a plain card until then)
  var IMG = {};
  function img(src) {
    if (!root.Image) return null;
    var im = IMG[src];
    if (!im) { im = IMG[src] = new root.Image(); im.src = src; }
    return im.complete && im.naturalWidth ? im : null;
  }
  // signature-like scribble, seeded; returns points in a w x h box
  function scribble(seed, n) {
    var pts = [], i;
    for (i = 0; i <= n; i++) {
      var u = i / n, x = u;
      var y = 0.5 + 0.28 * Math.sin(u * 23 + seed) * Math.sin(u * 5.3 + seed * 0.7) + 0.16 * Math.sin(u * 61 + seed * 2.1) * (0.4 + 0.6 * rnd(seed + Math.floor(u * 9)));
      x += 0.025 * Math.sin(u * 61 + seed * 2.1);
      pts.push([x, y]);
    }
    return pts;
  }

  /* ---------- emblems (small icons, unit size r) ---------- */
  function emblem(ctx, kind, x, y, r, col, t) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1.2, r * 0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    t = t || 0;
    switch (kind) {
      case 'axes':
        arrow(ctx, -r * 0.6, r * 0.5, r * 0.75, r * 0.5, col, r * 0.13, r * 0.35); arrow(ctx, -r * 0.6, r * 0.5, -r * 0.6, -r * 0.8, col, r * 0.13, r * 0.35); break;
      case 'charge':
        font(ctx, Math.round(r * 1.1), '800'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+', -r * 0.45, -r * 0.05); ctx.fillText('−', r * 0.45, -r * 0.05); break;
      case 'sweep':
        arrow(ctx, -r * 0.8, -r * 0.3, r * 0.8, -r * 0.3, col, r * 0.13, r * 0.35); arrow(ctx, r * 0.8, r * 0.35, -r * 0.8, r * 0.35, col, r * 0.13, r * 0.35); break;
      case 'mirror':
        ctx.setLineDash([r * 0.22, r * 0.18]); ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.lineTo(0, r * 0.9); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(-r * 0.75, -r * 0.75); ctx.lineTo(r * 0.75, r * 0.75); ctx.stroke(); break;
      case 'wafer':
        ctx.beginPath(); ctx.arc(0, 0, r * 0.8, PI / 2 + 0.45, PI / 2 - 0.45 + TAU); ctx.closePath(); ctx.stroke(); break;
      case 'ring':
        ctx.beginPath(); ctx.arc(0, -r * 0.12, r * 0.55, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * 0.9, r * 0.62); ctx.lineTo(r * 0.9, r * 0.62); ctx.stroke(); break;
      case 'dip':
        ctx.beginPath(); for (var i = 0; i <= 30; i++) { var xx = -0.9 + 1.8 * i / 30, d = (xx + 0.1) / 0.22; var yy = 0.5 - 1.2 / (1 + d * d); if (i) ctx.lineTo(xx * r, yy * r); else ctx.moveTo(xx * r, yy * r); } ctx.stroke(); break;
      case 'flame':
        ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.bezierCurveTo(r * 0.7, -r * 0.2, r * 0.6, r * 0.8, 0, r * 0.8); ctx.bezierCurveTo(-r * 0.6, r * 0.8, -r * 0.7, -r * 0.1, 0, -r * 0.9); ctx.stroke(); break;
      case 'sine':
        ctx.beginPath(); for (var j = 0; j <= 30; j++) { var x2 = -0.9 + 1.8 * j / 30; var y2 = -0.55 * Math.sin(x2 * PI * 1.2); if (j) ctx.lineTo(x2 * r, y2 * r); else ctx.moveTo(x2 * r, y2 * r); } ctx.stroke(); break;
      case 'mesh':
        var m = [[-0.8, 0.6], [0, -0.8], [0.8, 0.6], [0, 0.15]];
        ctx.beginPath(); ctx.moveTo(m[0][0] * r, m[0][1] * r); ctx.lineTo(m[1][0] * r, m[1][1] * r); ctx.lineTo(m[2][0] * r, m[2][1] * r); ctx.closePath();
        [0, 1, 2].forEach(function (k) { ctx.moveTo(m[3][0] * r, m[3][1] * r); ctx.lineTo(m[k][0] * r, m[k][1] * r); }); ctx.stroke(); break;
      case 'crystal':
        ctx.beginPath(); for (var h = 0; h < 6; h++) { var a = h * TAU / 6 + PI / 6; if (h) ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); else ctx.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); } ctx.closePath(); ctx.stroke(); break;
      case 'eight':
        for (var e = 0; e < 8; e++) { var ae = e * TAU / 8 + t; ctx.beginPath(); ctx.arc(Math.cos(ae) * r * 0.65, Math.sin(ae) * r * 0.65, r * 0.14, 0, TAU); ctx.fill(); } break;
    }
    ctx.restore();
  }

  /* ---------- category icons (eight sources of orientation misconduct) ---------- */
  var CATS = [
    { key: 'tool', col: '#5fd0ff' }, { key: 'soft', col: '#b48cff' }, { key: 'third', col: '#ffb45f' }, { key: 'peer', col: '#7ee08a' },
    { key: 'cross', col: '#ff7ad9' }, { key: 'dom', col: '#ffd84d' }, { key: 'qpq', col: '#ff8a5f' }, { key: 'hostile', col: '#ff4f4f' }
  ];
  function catIcon(ctx, key, x, y, r, col, t) {
    t = t || 0;
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1.3, r * 0.1); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var i;
    switch (key) {
      case 'tool':   // gear turning
        ctx.rotate(t * 1.2);
        ctx.beginPath(); for (i = 0; i < 16; i++) { var a = i * TAU / 16, rr = i % 2 ? r * 0.62 : r * 0.82; ctx.lineTo(Math.cos(a - 0.12) * rr, Math.sin(a - 0.12) * rr); ctx.lineTo(Math.cos(a + 0.12) * rr, Math.sin(a + 0.12) * rr); } ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, TAU); ctx.stroke(); break;
      case 'soft':   // window with code brackets and a cursor
        ctx.strokeRect(-r * 0.85, -r * 0.65, r * 1.7, r * 1.3); ctx.beginPath(); ctx.moveTo(-r * 0.85, -r * 0.38); ctx.lineTo(r * 0.85, -r * 0.38); ctx.stroke();
        font(ctx, Math.round(r * 0.7), '800', true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('{ }', 0, r * 0.15);
        if ((t * 2) % 2 < 1) ctx.fillRect(r * 0.45, -r * 0.1, r * 0.08, r * 0.5); break;
      case 'third':  // parcel box
        ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.3); ctx.lineTo(0, -r * 0.7); ctx.lineTo(r * 0.8, -r * 0.3); ctx.lineTo(r * 0.8, r * 0.55); ctx.lineTo(0, r * 0.9); ctx.lineTo(-r * 0.8, r * 0.55); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.3); ctx.lineTo(0, r * 0.1); ctx.lineTo(r * 0.8, -r * 0.3); ctx.moveTo(0, r * 0.1); ctx.lineTo(0, r * 0.9); ctx.stroke(); break;
      case 'peer':   // two heads passing a die
        [-1, 1].forEach(function (sg) { ctx.beginPath(); ctx.arc(sg * r * 0.5, -r * 0.35, r * 0.22, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(sg * r * 0.5, r * 0.45, r * 0.38, PI, 0); ctx.stroke(); });
        ctx.fillRect(-r * 0.12 + Math.sin(t * 2) * r * 0.3, r * 0.05, r * 0.24, r * 0.16); break;
      case 'cross':  // two buildings with a letter between them
        [-1, 1].forEach(function (sg) { ctx.strokeRect(sg * r * 0.55 - r * 0.25, -r * 0.4, r * 0.5, r * 1.2); ctx.beginPath(); ctx.moveTo(sg * r * 0.55 - r * 0.3, -r * 0.4); ctx.lineTo(sg * r * 0.55, -r * 0.7); ctx.lineTo(sg * r * 0.55 + r * 0.3, -r * 0.4); ctx.stroke(); });
        var ex = Math.sin(t * 1.6) * r * 0.22; ctx.strokeRect(ex - r * 0.17, -r * 0.05, r * 0.34, r * 0.24); break;
      case 'dom':    // house
        ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.05); ctx.lineTo(0, -r * 0.8); ctx.lineTo(r * 0.8, -r * 0.05); ctx.stroke();
        ctx.strokeRect(-r * 0.6, -r * 0.1, r * 1.2, r * 0.95); ctx.strokeRect(-r * 0.15, r * 0.35, r * 0.3, r * 0.5); break;
      case 'qpq':    // balance
        var tilt = Math.sin(t * 1.4) * 0.25;
        ctx.beginPath(); ctx.moveTo(0, -r * 0.75); ctx.lineTo(0, r * 0.8); ctx.moveTo(-r * 0.45, r * 0.8); ctx.lineTo(r * 0.45, r * 0.8); ctx.stroke();
        ctx.save(); ctx.translate(0, -r * 0.55); ctx.rotate(tilt); ctx.beginPath(); ctx.moveTo(-r * 0.85, 0); ctx.lineTo(r * 0.85, 0); ctx.stroke(); ctx.restore();
        [-1, 1].forEach(function (sg) { var px = sg * r * 0.85 * Math.cos(tilt), py = -r * 0.55 + sg * r * 0.85 * Math.sin(tilt); ctx.beginPath(); ctx.moveTo(px - r * 0.25, py + r * 0.35); ctx.lineTo(px + r * 0.25, py + r * 0.35); ctx.lineTo(px, py); ctx.closePath(); ctx.stroke(); }); break;
      case 'hostile':   // flame with sparks
        ctx.beginPath(); ctx.moveTo(0, -r * 0.85); ctx.bezierCurveTo(r * 0.75, -r * 0.15, r * 0.6, r * 0.85, 0, r * 0.85); ctx.bezierCurveTo(-r * 0.6, r * 0.85, -r * 0.75, -r * 0.05, -r * 0.15, -r * 0.45); ctx.stroke();
        for (i = 0; i < 3; i++) { var sp = (t * 1.5 + i / 3) % 1; ctx.globalAlpha = 1 - sp; ctx.beginPath(); ctx.arc(r * (0.3 + 0.4 * rnd(i)), -r * (0.4 + 0.7 * sp), r * 0.07, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1; break;
    }
    ctx.restore();
  }

  /* ===================== Module 0 ===================== */

  // Enforcement: narration ring locks Next until it closes; leaving the tab pauses everything, the crystal included
  A['fe.enforce'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 10, 0.12);
    bg(ctx, U, '#1a2230', '#06080b'); dots(ctx, U, 22);
    var away = es(u, 0.58, 0.64) * (1 - es(u, 0.86, 0.92));
    // browser tab strip
    var tbH = 30 * s; box(ctx, 0, 0, w, tbH, '#0c1016');
    var tw = Math.min(170 * s, w * 0.36);
    box(ctx, 10 * s, 6 * s, tw, tbH - 6 * s, away > 0.5 ? '#141a22' : '#1d2632', 'rgba(255,255,255,0.12)');
    box(ctx, 14 * s + tw, 6 * s, tw, tbH - 6 * s, away > 0.5 ? '#1d2632' : '#11161d', 'rgba(255,255,255,0.08)');
    text(ctx, 'Photonic Conduct', 18 * s, 6 * s + (tbH - 6 * s) / 2, U.f(11), P.ink, 'left', '600');
    text(ctx, 'Anything else', 22 * s + tw, 6 * s + (tbH - 6 * s) / 2, U.f(11), P.inkDim, 'left');
    // cursor travels to the other tab and back
    var cx0 = w * 0.62, cy0 = h * 0.72, cx1 = 14 * s + tw * 1.5, cy1 = 18 * s;
    var cm = es(u, 0.5, 0.6) * (1 - es(u, 0.84, 0.94));
    var cux = lerp(cx0, cx1, cm), cuy = lerp(cy0, cy1, cm);
    // crystal on the left, the narration ring and Next button on the right
    var crx = w * 0.27, cry = h * 0.66;
    var tc = u * 10, eff = tc - clamp(tc - 6.1, 0, 2.8);   // the crystal stops while the course is paused
    crystal(ctx, crx, cry, 62 * s, 120 * s, 0.5 * eff, { col: '#c9a7ff' });
    glow(ctx, crx, cry - 60 * s, 90 * s, '#9b6bff', 0.25 * (1 - away));
    var rx = w * 0.7, ry = h * 0.52, rr = Math.min(70 * s, w * 0.16);
    var prog = clamp(u / 0.45, 0, 1);
    ctx.save(); ctx.lineWidth = 7 * s; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(rx, ry, rr, 0, TAU); ctx.stroke();
    var rg = ctx.createLinearGradient(rx - rr, ry, rx + rr, ry); rg.addColorStop(0, '#63e6ff'); rg.addColorStop(1, '#b48cff');
    ctx.strokeStyle = rg; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(rx, ry, rr, -PI / 2, -PI / 2 + prog * TAU); ctx.stroke(); ctx.restore();
    // narration bars inside the ring
    for (var i = 0; i < 9; i++) {
      var bh = (0.25 + 0.75 * Math.abs(Math.sin(t * 7 + i * 1.3) * Math.sin(t * 2.3 + i))) * rr * 0.55 * (prog < 1 ? 1 : 0.15);
      box(ctx, rx - rr * 0.55 + i * rr * 0.13, ry - bh / 2 - rr * 0.08, rr * 0.07, bh, prog < 1 ? '#63e6ff' : 'rgba(99,230,255,0.3)');
    }
    // Next button with a padlock that opens when the ring closes
    var open = es(u, 0.45, 0.5) * (1 - es(u, 0.95, 1));
    var bw = 120 * s, bhh = 36 * s, bx = rx - bw / 2, by = ry + rr + 22 * s;
    box(ctx, bx, by, bw, bhh, open > 0.5 ? P.ok : '#2a313b', open > 0.5 ? '#8ff0b0' : 'rgba(255,255,255,0.2)', 1.5 * s);
    text(ctx, 'Next', bx + bw * 0.6, by + bhh / 2, U.f(15), open > 0.5 ? '#ffffff' : '#7d8794', 'center', '700');
    var lx = bx + bw * 0.24, ly = by + bhh * 0.58;
    ctx.save(); ctx.strokeStyle = open > 0.5 ? '#ffffff' : '#9aa4b0'; ctx.lineWidth = 2.2 * s;
    ctx.beginPath(); ctx.arc(lx + open * 6 * s, ly - 6 * s - open * 4 * s, 5.5 * s, PI, 0); ctx.stroke();
    ctx.fillStyle = open > 0.5 ? '#ffffff' : '#9aa4b0'; ctx.fillRect(lx - 7 * s, ly - 6 * s, 14 * s, 11 * s); ctx.restore();
    // paused overlay
    if (away > 0.01) {
      ctx.fillStyle = 'rgba(4,6,9,' + (0.62 * away).toFixed(3) + ')'; ctx.fillRect(0, tbH, w, h - tbH);
      ctx.save(); ctx.globalAlpha = away; var px = w * 0.5, py = h * 0.55, pr = 40 * s;
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(px - pr * 0.55, py - pr * 0.7, pr * 0.38, pr * 1.4); ctx.fillRect(px + pr * 0.17, py - pr * 0.7, pr * 0.38, pr * 1.4);
      ctx.restore();
      text(ctx, 'Paused', w * 0.5, h * 0.55 + 62 * s, U.f(14), 'rgba(255,255,255,' + away.toFixed(3) + ')', 'center', '700');
    }
    // cursor
    ctx.save(); ctx.translate(cux, cuy); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 17 * s); ctx.lineTo(4.5 * s, 13 * s); ctx.lineTo(8 * s, 20 * s); ctx.lineTo(10.5 * s, 19 * s); ctx.lineTo(7 * s, 12 * s); ctx.lineTo(12.5 * s, 12 * s); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  };

  // Mantra medal: four beats as four animated icons (axes, charge, two-way sweep, a crossed-out mirror plane)
  A['fe.mantra'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#2a1f3f', '#07060b', 0.5, 0.45);
    var cx = w / 2, cy = h * 0.5, R = Math.min(w, h) * 0.36;
    // sunburst
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.15);
    for (var i = 0; i < 24; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,214,120,0.07)' : 'rgba(180,140,255,0.08)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, Math.hypot(w, h), i * TAU / 24, (i + 1) * TAU / 24); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // ribbon tails
    [-1, 1].forEach(function (sg) {
      ctx.fillStyle = sg < 0 ? '#6a3fd1' : '#3f7bd1';
      ctx.beginPath(); ctx.moveTo(cx + sg * R * 0.25, cy + R * 0.6); ctx.lineTo(cx + sg * R * 0.62, cy + R * 1.25); ctx.lineTo(cx + sg * R * 0.38, cy + R * 1.12); ctx.lineTo(cx + sg * R * 0.2, cy + R * 1.3); ctx.lineTo(cx + sg * R * 0.02, cy + R * 0.7); ctx.closePath(); ctx.fill();
    });
    // medal
    var g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
    g.addColorStop(0, '#fff1c4'); g.addColorStop(0.55, '#e7b74e'); g.addColorStop(1, '#9a6a1c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#14101e'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.78, 0, TAU); ctx.fill();
    // four quadrants light in turn
    var kinds = ['axes', 'charge', 'sweep', 'mirror'], cols = ['#9fe3ff', '#ffc46b', '#7ee08a', '#ff7ad9'];
    var active = Math.floor(cyc(t, 6) * 4);
    kinds.forEach(function (k, j) {
      var a = -PI * 0.75 + j * PI / 2, qx = cx + Math.cos(a) * R * 0.42, qy = cy + Math.sin(a) * R * 0.42;
      var on = j === active ? 1 : 0.35;
      if (j === active) glow(ctx, qx, qy, R * 0.42, cols[j], 0.45);
      ctx.save(); ctx.globalAlpha = on;
      if (k === 'axes') { ctx.translate(qx, qy); ctx.rotate(Math.sin(t * 1.3) * 0.5); emblem(ctx, k, 0, 0, R * 0.24, cols[j]); }
      else if (k === 'charge') { emblem(ctx, k, qx, qy, R * 0.24 * (1 + 0.12 * Math.sin(t * 5)), cols[j]); }
      else if (k === 'sweep') { emblem(ctx, k, qx + Math.sin(t * 2.2) * R * 0.05, qy, R * 0.24, cols[j]); }
      else emblem(ctx, k, qx, qy, R * 0.24, cols[j]);
      ctx.restore();
    });
    ctx.strokeStyle = 'rgba(231,183,78,0.5)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(cx - R * 0.78, cy); ctx.lineTo(cx + R * 0.78, cy); ctx.moveTo(cx, cy - R * 0.78); ctx.lineTo(cx, cy + R * 0.78); ctx.stroke();
    // glint
    var gx = cx + Math.cos(t * 0.9) * R * 0.7, gy = cy - R * 0.6 + Math.sin(t * 0.9) * R * 0.1;
    glow(ctx, gx, gy, 18 * s, '#fff1c4', 0.5 + 0.5 * Math.sin(t * 3));
    for (var sp = 0; sp < 10; sp++) { var ph = cyc(t, 3, rnd(sp)); var aa = rnd(sp + 9) * TAU; glow(ctx, cx + Math.cos(aa) * R * (1.05 + ph * 0.4), cy + Math.sin(aa) * R * (1.05 + ph * 0.4), 6 * s, '#ffe08a', (1 - ph) * 0.8); }
  };

  // Confidence gauge: a needle that cannot settle; the far end flashes a warning
  A['fe.gauge'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#1d2733', '#06080b', 0.5, 0.7); dots(ctx, U, 20);
    var R = Math.min(w * 0.4, h * 0.6), cx = w / 2, cy = Math.min(h * 0.74, h / 2 + R * 0.45);
    var cols = ['#e0524c', '#ef8a3d', '#e3b04b', '#3fae69', '#b48cff'];
    for (var i = 0; i < 5; i++) {
      var a0 = PI + i * PI / 5 + 0.02, a1 = PI + (i + 1) * PI / 5 - 0.02;
      ctx.strokeStyle = cols[i]; ctx.lineWidth = R * 0.2; ctx.beginPath(); ctx.arc(cx, cy, R * 0.85, a0, a1); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5 * s;
    for (var k = 0; k <= 50; k++) { var ak = PI + k * PI / 50, r0 = R * 0.62, r1 = R * (k % 5 ? 0.66 : 0.7); ctx.beginPath(); ctx.moveTo(cx + Math.cos(ak) * r0, cy + Math.sin(ak) * r0); ctx.lineTo(cx + Math.cos(ak) * r1, cy + Math.sin(ak) * r1); ctx.stroke(); }
    // needle: wanders, overshoots into the last segment now and then
    var v = 0.5 + 0.22 * Math.sin(t * 0.9) + 0.12 * Math.sin(t * 2.7 + 1) + 0.05 * Math.sin(t * 9.1);
    var kick = Math.pow(Math.max(0, Math.sin(t * 0.45 - 1.2)), 12) * 0.45; v = clamp(v + kick, 0.03, 0.97);
    var an = PI + v * PI;
    if (v > 0.8) { var fl = 0.5 + 0.5 * Math.sin(t * 20); glow(ctx, cx + Math.cos(PI * 1.9) * R * 0.85, cy + Math.sin(PI * 1.9) * R * 0.85, R * 0.35, '#e0524c', 0.6 * fl); }
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(an);
    ctx.fillStyle = '#f4f6f8'; ctx.beginPath(); ctx.moveTo(0, -5 * s); ctx.lineTo(R * 0.92, 0); ctx.lineTo(0, 5 * s); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#2a313b'; ctx.beginPath(); ctx.arc(cx, cy, 13 * s, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f4f6f8'; ctx.lineWidth = 2 * s; ctx.stroke();
    // a small crystal watching from the side
    crystal(ctx, w * 0.5, Math.min(h * 0.97, cy + 60 * s), 20 * s, 40 * s, t * 0.4, { col: '#c9a7ff' });
  };

  // Acknowledgement: a signature is drawn on the attestation and the seal comes down. params: { seed, col, emblem }
  A['fe.sign'] = function (ctx, w, h, t, p) {
    p = p || {}; var U = units(w, h), s = U.s, u = cyc(t, 8, 0.05);
    bg(ctx, U, '#2a2620', '#0b0a08', 0.5, 0.4);
    // desk grain
    ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = '#ffffff'; for (var g = 0; g < 14; g++) { ctx.beginPath(); ctx.moveTo(0, h * g / 14 + Math.sin(g) * 6 * s); ctx.bezierCurveTo(w * 0.3, h * g / 14 + 8 * s, w * 0.6, h * g / 14 - 8 * s, w, h * g / 14 + 3 * s); ctx.stroke(); } ctx.restore();
    var pw = Math.min(w * 0.78, h * 1.05), ph = pw * 0.72, px = w / 2 - pw / 2, py = h / 2 - ph / 2;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-0.035); ctx.translate(-w / 2, -h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px + 6 * s, py + 8 * s, pw, ph);
    var pg = ctx.createLinearGradient(px, py, px + pw, py + ph); pg.addColorStop(0, C.paper); pg.addColorStop(1, C.paperLo);
    ctx.fillStyle = pg; ctx.fillRect(px, py, pw, ph);
    // header band and text lines
    ctx.fillStyle = p.col || '#3f5d8a'; ctx.fillRect(px, py, pw, ph * 0.09);
    for (var l = 0; l < 6; l++) { var lw = pw * (0.78 - 0.1 * rnd(l + (p.seed || 0))); ctx.fillStyle = 'rgba(43,47,54,0.28)'; ctx.fillRect(px + pw * 0.08, py + ph * (0.18 + l * 0.075), l === 5 ? lw * 0.5 : lw, Math.max(2, ph * 0.022)); }
    // signature line
    var sx = px + pw * 0.1, sy = py + ph * 0.8, sw = pw * 0.5;
    ctx.strokeStyle = 'rgba(43,47,54,0.7)'; ctx.lineWidth = Math.max(1, 1.2 * s); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy); ctx.stroke();
    // the signature
    var pts = scribble(p.seed || 3, 160), prog = es(u, 0.08, 0.55), n = Math.floor(prog * pts.length);
    ctx.strokeStyle = '#1b2f6b'; ctx.lineWidth = Math.max(1.4, 2.2 * s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (var i = 0; i < n; i++) { var X = sx + pts[i][0] * sw, Y = sy - ph * 0.17 + pts[i][1] * ph * 0.17; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
    ctx.stroke();
    // pen
    if (u < 0.62 && n > 0) {
      var q = pts[Math.min(n, pts.length - 1)], penx = sx + q[0] * sw, peny = sy - ph * 0.17 + q[1] * ph * 0.17;
      ctx.save(); ctx.translate(penx, peny); ctx.rotate(-0.75);
      ctx.fillStyle = '#20242b'; ctx.fillRect(0, -4 * s, 120 * s, 8 * s); ctx.fillStyle = '#c9a24a'; ctx.fillRect(34 * s, -4 * s, 6 * s, 8 * s);
      ctx.fillStyle = '#c9ccd2'; ctx.beginPath(); ctx.moveTo(0, -4 * s); ctx.lineTo(-12 * s, 0); ctx.lineTo(0, 4 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // seal
    var sv = (u - 0.62) / 0.3, scx = px + pw * 0.8, scy = py + ph * 0.72, sr = ph * 0.17;
    if (sv > 0) {
      var sc = 1 + 0.7 * Math.pow(1 - clamp(sv / 0.25, 0, 1), 2);
      ctx.save(); ctx.translate(scx, scy); ctx.scale(sc, sc); ctx.rotate(0.2); ctx.globalAlpha = clamp(sv / 0.1, 0, 1) * 0.9;
      var sealCol = p.sealCol || '#c0392b';
      ctx.strokeStyle = sealCol; ctx.lineWidth = Math.max(2, 3 * s); ctx.beginPath(); ctx.arc(0, 0, sr, 0, TAU); ctx.stroke();
      ctx.lineWidth = Math.max(1, 1.3 * s); ctx.beginPath(); ctx.arc(0, 0, sr * 0.8, 0, TAU); ctx.stroke();
      for (var d = 0; d < 24; d++) { var ad = d * TAU / 24; ctx.beginPath(); ctx.arc(Math.cos(ad) * sr * 0.9, Math.sin(ad) * sr * 0.9, Math.max(0.8, 1.1 * s), 0, TAU); ctx.fillStyle = sealCol; ctx.fill(); }
      emblem(ctx, p.emblem || 'crystal', 0, -sr * 0.12, sr * 0.42, sealCol, t);
      text(ctx, 'ACKNOWLEDGED', 0, sr * 0.5, Math.max(6, Math.round(sr * 0.17)), sealCol, 'center', '800');
      ctx.restore();
    }
    ctx.restore();
    // fade at loop end
    var fo = es(u, 0.95, 1); if (fo > 0) { ctx.fillStyle = 'rgba(11,10,8,' + fo.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
  };

  /* ===================== Module 1: crystal orientation ===================== */

  // 3D helpers: crystal frame (cx = film normal x up, y and z in the film plane), turned by phi about x, camera elevation el
  function proj3(U, cx0, cy0, k, phi, el) {
    var cp = Math.cos(phi), sp = Math.sin(phi), ce = Math.cos(el), se = Math.sin(el);
    return function (x, y, z) {   // crystal coords -> screen
      var a = y * cp - z * sp, b = y * sp + z * cp;   // in-plane after turn (a to the right, b into the screen)
      return [cx0 + k * a, cy0 - k * (x * ce - b * se), b * ce + x * se];
    };
  }
  function hull(pts) {
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var cr = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
    var lo = [], up = [], i;
    for (i = 0; i < pts.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], pts[i]) <= 0) lo.pop(); lo.push(pts[i]); }
    for (i = pts.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], pts[i]) <= 0) up.pop(); up.push(pts[i]); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  function poly(ctx, pts) { ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); }
  // x-cut film slab (square, side 2) drawn in the crystal frame, with a waveguide along y and a light pulse
  function slab3(ctx, U, pr, o) {
    o = o || {};
    var th = 0.08, c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    var top = c.map(function (q) { return pr(0, q[0], q[1]); }), bot = c.map(function (q) { return pr(-th, q[0], q[1]); });
    for (var i = 0; i < 4; i++) { var j = (i + 1) % 4; ctx.fillStyle = '#4a3f52'; poly(ctx, [top[i], top[j], bot[j], bot[i]]); ctx.fill(); }
    var g = ctx.createLinearGradient(top[0][0], top[0][1], top[2][0], top[2][1]); g.addColorStop(0, P.filmHi); g.addColorStop(1, P.filmLo);
    ctx.fillStyle = g; poly(ctx, top); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.stroke();
    if (o.wg !== false) {
      var wa = o.wgAng || 0;   // waveguide direction in the film plane, angle from +y toward +z
      var d0 = pr(0, -0.95 * Math.cos(wa), -0.95 * Math.sin(wa)), d1 = pr(0, 0.95 * Math.cos(wa), 0.95 * Math.sin(wa));
      line(ctx, d0[0], d0[1], d1[0], d1[1], P.slab, Math.max(2, 4 * U.s));
      if (o.light != null) {
        var lp = -0.95 + 1.9 * o.light, q = pr(0.02, lp * Math.cos(wa), lp * Math.sin(wa));
        glow(ctx, q[0], q[1], 22 * U.s, o.lightCol || P.light, 1);
        if (o.te) {   // TE field: in plane, perpendicular to the guide
          var e = 0.22 * Math.sin(o.light * 40), f0 = pr(0.02, lp * Math.cos(wa) + e * Math.sin(wa), lp * Math.sin(wa) - e * Math.cos(wa)), f1 = pr(0.02, lp * Math.cos(wa) - e * Math.sin(wa), lp * Math.sin(wa) + e * Math.cos(wa));
          arrow(ctx, f1[0], f1[1], f0[0], f0[1], '#ffffff', Math.max(1.5, 2 * U.s), 7 * U.s);
        }
      }
    }
  }

  // Index ellipsoid riding on an x-cut film: semi-axes n_o along x and y, n_e (smaller) along z; both turn together
  A['fe.ellipsoid'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#1c2534', '#05070a', 0.5, 0.35); dots(ctx, U, 24);
    var phi = t * 0.45, el = 0.42, k = Math.min(w * 0.36, h * 0.42);
    var pr = proj3(U, w * 0.5, h * 0.7, k, phi, el);
    slab3(ctx, U, pr, { light: cyc(t, 2.2), te: true });
    // crystal axes on the slab corner
    var o0 = pr(0, 0, 0);
    // ellipsoid above the slab: the birefringence is drawn larger than life so the shape reads
    var no = 0.5, ne = 0.5 * 0.78, X0 = 0.95, pts = [];
    for (var i = 0; i < 18; i++) for (var j = 0; j <= 12; j++) {
      var th = i * TAU / 18, pp = -PI / 2 + j * PI / 12;
      pts.push(pr(X0 + no * Math.sin(pp), no * Math.cos(pp) * Math.cos(th), ne * Math.cos(pp) * Math.sin(th)));
    }
    var hl = hull(pts), c0 = pr(X0, 0, 0);
    var g = ctx.createRadialGradient(c0[0] - k * 0.15, c0[1] - k * 0.18, k * 0.05, c0[0], c0[1], k * 0.6);
    g.addColorStop(0, 'rgba(230,215,255,0.85)'); g.addColorStop(0.6, 'rgba(150,110,240,0.55)'); g.addColorStop(1, 'rgba(70,40,150,0.5)');
    ctx.fillStyle = g; poly(ctx, hl); ctx.fill();
    // principal sections
    function ring(f, col, lw) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      for (var q = 0; q <= 64; q++) { var a = q * TAU / 64, p3 = f(a); if (q) ctx.lineTo(p3[0], p3[1]); else ctx.moveTo(p3[0], p3[1]); }
      ctx.stroke();
    }
    ring(function (a) { return pr(X0, no * Math.cos(a), ne * Math.sin(a)); }, 'rgba(255,255,255,0.8)', Math.max(1.2, 1.6 * s));
    ring(function (a) { return pr(X0 + no * Math.cos(a), no * Math.sin(a), 0); }, 'rgba(255,255,255,0.35)', 1);
    ring(function (a) { return pr(X0 + no * Math.cos(a), 0, ne * Math.sin(a)); }, 'rgba(255,255,255,0.35)', 1);
    // axes through the centre: z (n_e) gold, y (n_o) cyan, x (n_o) white
    var ax = [[0, 1, 0, C.yAx, 'y'], [0, 0, 1, C.zAx, 'z'], [1, 0, 0, C.xAx, 'x']];
    ax.forEach(function (a) {
      var L = a[2] ? ne + 0.22 : no + 0.22, e0 = pr(X0, 0, 0), e1 = pr(X0 + a[0] * L, a[1] * L, a[2] * L);
      arrow(ctx, e0[0], e0[1], e1[0], e1[1], a[3], Math.max(1.5, 2.2 * s), 8 * s);
      var e2 = pr(X0 + a[0] * (L + 0.1), a[1] * (L + 0.1), a[2] * (L + 0.1));
      text(ctx, a[4], e2[0], e2[1], U.f(13), a[3], 'center', '700');
    });
    var zt = pr(X0, 0, ne), yt = pr(X0, no, 0);
    text(ctx, 'nₑ', zt[0] + 12 * s, zt[1] + 12 * s, U.f(13), C.zAx, 'left', '700');
    text(ctx, 'nₒ', yt[0] + 12 * s, yt[1] + 12 * s, U.f(13), C.yAx, 'left', '700');
    glow(ctx, o0[0], o0[1], 4 * s, '#ffffff', 0.2);
    text(ctx, 'x-cut', 14 * s, h - 16 * s, U.f(12), P.inkDim, 'left', '700');
  };

  // Rotating the crystal by +theta equals rotating the coordinates by -theta
  A['fe.rotateRoom'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#17202b', '#05070a');
    var th = 0.6 * Math.sin(t * 0.8) * 0.5 + 0.3 * Math.sin(t * 0.8) ;
    th = 0.62 * (0.5 - 0.5 * Math.cos(t * 0.9));
    var wide = w / h > 1.1;
    var panes = wide ? [[0, 0, w / 2, h], [w / 2, 0, w / 2, h]] : [[0, 0, w, h / 2], [0, h / 2, w, h / 2]];
    panes.forEach(function (pn, i) {
      var cx = pn[0] + pn[2] / 2, cy = pn[1] + pn[3] * 0.53, R = Math.min(pn[2], pn[3]) * 0.36;
      ctx.save(); ctx.beginPath(); ctx.rect(pn[0], pn[1], pn[2], pn[3]); ctx.clip();
      // lab grid (rotates by -theta in the right pane)
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(i ? -th : 0);
      ctx.strokeStyle = 'rgba(99,230,255,0.22)'; ctx.lineWidth = 1;
      var gp = 22 * s; for (var gx = -12; gx <= 12; gx++) { ctx.beginPath(); ctx.moveTo(gx * gp, -12 * gp); ctx.lineTo(gx * gp, 12 * gp); ctx.moveTo(-12 * gp, gx * gp); ctx.lineTo(12 * gp, gx * gp); ctx.stroke(); }
      arrow(ctx, 0, 0, R * 1.25, 0, 'rgba(99,230,255,0.85)', Math.max(1.5, 2 * s), 8 * s);
      arrow(ctx, 0, 0, 0, -R * 1.25, 'rgba(99,230,255,0.85)', Math.max(1.5, 2 * s), 8 * s);
      ctx.restore();
      // the die (rotates by +theta in the left pane; canvas angles are clockwise, so +theta is drawn as -th)
      var rot = i ? 0 : -th;
      die(ctx, cx, cy, R * 1.5, rot, { mark: 0, light: cyc(t, 2) });
      axes(ctx, U, cx + Math.cos(rot) * R * 0.0, cy, rot, { len: 26 });
      // angle arc
      ctx.strokeStyle = i ? 'rgba(99,230,255,0.95)' : C.zAx; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, i ? 0 : -th, i ? th : 0, false); ctx.stroke();
      ctx.restore();
      text(ctx, i ? 'coordinates  −θ' : 'crystal  +θ', pn[0] + 12 * s, pn[1] + 18 * s, U.f(13), i ? '#63e6ff' : C.zAx, 'left', '700');
    });
    var mx = wide ? w / 2 : w * 0.92, my = wide ? h * 0.12 : h / 2;
    line(ctx, wide ? w / 2 : 0, wide ? 0 : h / 2, wide ? w / 2 : w, wide ? h : h / 2, 'rgba(255,255,255,0.18)', 1);
    box(ctx, mx - 15 * s, my - 15 * s, 30 * s, 30 * s, '#0b0f14', 'rgba(255,255,255,0.35)');
    text(ctx, '=', mx, my + 1 * s, U.f(20), '#ffffff', 'center', '800');
  };

  // Rotation code that matches at 0 and 90 degrees and fails at 45: f(theta) against the code's f(-theta)
  A['fe.rotTest'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 9, 0.1);
    bg(ctx, U, '#141b24', '#05070a');
    var f = function (d) { var a = d * PI / 180; return 0.5 + 0.25 * Math.cos(2 * a) + 0.22 * Math.sin(2 * a); };
    var g = function (d) { return f(-d); };
    var r = { x: w * 0.13, y: h * 0.16, w: w * 0.8, h: h * 0.56 };
    box(ctx, r.x, r.y, r.w, r.h, 'rgba(10,14,19,0.75)', 'rgba(200,210,220,0.4)');
    var X = function (d) { return r.x + d / 180 * r.w; }, Y = function (v) { return r.y + r.h - v * r.h; };
    [0, 45, 90, 135, 180].forEach(function (d) { line(ctx, X(d), r.y, X(d), r.y + r.h, 'rgba(120,140,160,0.18)', 1); text(ctx, d + '°', X(d), r.y + r.h + 12 * s, U.f(11), P.inkDim, 'center', '600', 'middle', true); });
    text(ctx, 'rotated coefficient', r.x, r.y - 10 * s, U.f(11), P.inkDim, 'left', '600');
    var dc = es(u, 0.05, 0.7) * 180;
    function tr(fn, col, lw, dash, upto) {
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash); ctx.beginPath();
      for (var d = 0; d <= upto; d += 2) { if (d) ctx.lineTo(X(d), Y(fn(d))); else ctx.moveTo(X(d), Y(fn(d))); }
      ctx.stroke(); ctx.restore();
    }
    tr(f, '#e9eef3', Math.max(2, 2.6 * s), null, dc);
    tr(g, P.bad, Math.max(2, 2.6 * s), [7 * s, 5 * s], dc);
    // test points
    [[0, 0.05], [90, 0.4], [45, 0.25]].forEach(function (q) {
      if (dc < q[0]) return;
      var x = X(q[0]), y0 = Y(f(q[0])), y1 = Y(g(q[0]));
      if (q[0] === 45) {
        line(ctx, x, y0, x, y1, '#ffffff', Math.max(1.5, 2 * s), [3 * s, 3 * s]);
        var pf = 0.5 + 0.5 * Math.sin(t * 8);
        glow(ctx, x, (y0 + y1) / 2, 26 * s, P.bad, 0.5 + 0.3 * pf);
        ctx.strokeStyle = P.bad; ctx.lineWidth = 3 * s; var c = 9 * s, my = y1 + 20 * s;
        ctx.beginPath(); ctx.moveTo(x + 16 * s - c, my - c); ctx.lineTo(x + 16 * s + c, my + c); ctx.moveTo(x + 16 * s + c, my - c); ctx.lineTo(x + 16 * s - c, my + c); ctx.stroke();
      } else {
        ctx.fillStyle = P.ok; ctx.beginPath(); ctx.arc(x, y0, 6 * s, 0, TAU); ctx.fill();
        ctx.strokeStyle = P.ok; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x + 6 * s, y0 - 18 * s); ctx.lineTo(x + 11 * s, y0 - 12 * s); ctx.lineTo(x + 21 * s, y0 - 26 * s); ctx.stroke();
      }
    });
    // little die turning with the cursor
    die(ctx, w * 0.5, h * 0.88, 54 * s, -dc * PI / 180, { mark: 0 });
    text(ctx, 'true', r.x + r.w - 62 * s, r.y + 14 * s, U.f(11), '#e9eef3', 'left', '700');
    text(ctx, 'code', r.x + r.w - 62 * s, r.y + 30 * s, U.f(11), P.bad, 'left', '700');
  };

  // x-cut vs z-cut film: where the optic axis lies; light turns in the plane on both
  A['fe.xcutFilm'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#1a2331', '#05070a', 0.5, 0.3);
    var wide = w / h > 1.05, k = wide ? Math.min(w * 0.165, h * 0.3) : Math.min(w * 0.3, h * 0.2);
    var wa = t * 0.6;
    [0, 1].forEach(function (i) {
      var cx = wide ? w * (0.27 + 0.46 * i) : w * 0.5, cy = wide ? h * 0.6 : h * (0.32 + 0.45 * i);
      var pr = proj3(U, cx, cy, k, 0.5, 0.5);
      slab3(ctx, U, pr, { wgAng: wa, light: cyc(t, 1.6), te: true, lightCol: P.light });
      // optic axis
      var a0 = pr(0.05, 0, 0), a1 = i ? pr(1.05, 0, 0) : pr(0.05, 0, 1.25);
      arrow(ctx, a0[0], a0[1], a1[0], a1[1], C.zAx, Math.max(2.5, 3.4 * s), 10 * s);
      text(ctx, 'z', a1[0] + 10 * s, a1[1] - 6 * s, U.f(14), C.zAx, 'left', '800');
      var lb = pr(-0.1, -1.1, 1.0);
      text(ctx, i ? 'z-cut' : 'x-cut', wide ? cx : cx - k * 1.25, wide ? h * 0.12 : cy - k * 0.85, U.f(15), '#ffffff', 'center', '800');
    });
  };

  // Incident case file: a folder with a live polaroid of the incident and a LOGGED stamp. params: { scene }
  A['fe.caseFile'] = function (ctx, w, h, t, p) {
    p = p || {}; var U = units(w, h), s = U.s, u = cyc(t, 9, 0.08);
    bg(ctx, U, '#232a33', '#07090c', 0.5, 0.4);
    var fw = Math.min(w * 0.94, h * 1.4), fh = fw * 0.66, fx = w / 2 - fw / 2, fy = h / 2 - fh / 2 + 8 * s;
    // folder back and tab
    ctx.fillStyle = '#b8894a'; ctx.fillRect(fx, fy - 16 * s, fw * 0.3, 18 * s); ctx.fillRect(fx, fy, fw, fh);
    ctx.fillStyle = '#d6aa64'; ctx.fillRect(fx + 6 * s, fy + 6 * s, fw - 12 * s, fh - 12 * s);
    // paper on the right
    var qx = fx + fw * 0.5, qy = fy + fh * 0.1, qw = fw * 0.44, qh = fh * 0.82;
    ctx.fillStyle = C.paper; ctx.fillRect(qx, qy, qw, qh);
    ctx.fillStyle = '#3a4250'; ctx.fillRect(qx + qw * 0.08, qy + qh * 0.08, qw * 0.5, Math.max(3, qh * 0.045));
    for (var l = 0; l < 7; l++) { ctx.fillStyle = 'rgba(43,47,54,0.25)'; ctx.fillRect(qx + qw * 0.08, qy + qh * (0.22 + l * 0.09), qw * (0.8 - 0.25 * rnd(l + 3)), Math.max(2, qh * 0.025)); }
    // polaroid on the left, swinging slightly on its clip
    var pw = fw * 0.42, ph = pw * 1.12, pcx = fx + fw * 0.26, pcy = fy + fh * 0.5;
    var sw = 0.05 * Math.sin(t * 1.1) - 0.04;
    ctx.save(); ctx.translate(pcx, pcy - ph / 2); ctx.rotate(sw); ctx.translate(-pcx, -(pcy - ph / 2));
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(pcx - pw / 2 + 5 * s, pcy - ph / 2 + 6 * s, pw, ph);
    ctx.fillStyle = '#f7f7f2'; ctx.fillRect(pcx - pw / 2, pcy - ph / 2, pw, ph);
    var iw = pw * 0.88, ih = iw, ix = pcx - iw / 2, iy = pcy - ph / 2 + pw * 0.06;
    ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
    caseScene(ctx, U, p.scene, ix, iy, iw, ih, t, u);
    ctx.restore();
    ctx.fillStyle = '#9aa0a8'; ctx.fillRect(pcx - 10 * s, pcy - ph / 2 - 8 * s, 20 * s, 16 * s);   // clip
    ctx.restore();
    stamp(ctx, U, 'LOGGED', C.red, (u - 0.55) / 0.35, qx + qw * 0.5, qy + qh * 0.62, 22, -0.2);
  };
  function caseScene(ctx, U, scene, x, y, w, h, t, u) {
    var s = U.s, cx = x + w / 2, cy = y + h / 2, i;
    if (scene === 'flat') {   // aligner chuck: flat at three o'clock, waveguides exposed parallel to it, UV flash
      ctx.fillStyle = '#3a3f46'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,190,40,0.12)'; ctx.fillRect(x, y, w, h);
      var r = w * 0.4, fa = 0;   // flat normal pointing right (three o'clock)
      wafer(ctx, cx, cy, r, fa, { sheen: cyc(t, 4) });
      ctx.save(); waferPath(ctx, cx, cy, r, fa); ctx.clip();
      var expo = es(u, 0.15, 0.3);
      ctx.strokeStyle = 'rgba(60,90,80,' + (0.75 * expo).toFixed(3) + ')'; ctx.lineWidth = Math.max(1, 1.4 * s);
      for (i = -7; i <= 7; i++) { ctx.beginPath(); ctx.moveTo(cx + i * r / 7.5, y); ctx.lineTo(cx + i * r / 7.5, y + h); ctx.stroke(); }
      ctx.restore();
      var fl = pulse(u, 0.12, 0.24); if (fl > 0) { ctx.fillStyle = 'rgba(190,140,255,' + (0.55 * fl).toFixed(3) + ')'; ctx.fillRect(x, y, w, h); }
      ctx.strokeStyle = '#ff5a4f'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.arc(cx + r * 0.95, cy, r * 0.22, 0, TAU); ctx.stroke();
    } else if (scene === 'rods') {   // PANDA end face: rods vertical, at twelve o'clock
      ctx.fillStyle = '#0a0c10'; ctx.fillRect(x, y, w, h);
      var R = w * 0.4; var gc = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      gc.addColorStop(0, '#5c6672'); gc.addColorStop(1, '#2c333b'); ctx.fillStyle = gc; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      [-1, 1].forEach(function (sg) { ctx.fillStyle = '#1a1d22'; ctx.beginPath(); ctx.arc(cx, cy + sg * R * 0.46, R * 0.27, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ff5a4f'; ctx.lineWidth = 2 * s; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); ctx.stroke(); ctx.globalAlpha = 1; });
      glow(ctx, cx, cy, R * 0.2, P.lightTM, 0.9);
      arrow(ctx, cx, cy + R * 0.22, cx, cy - R * 0.22, '#ffffff', 2 * s, 7 * s);
    } else if (scene === 'hotplug') {   // cable nut meets the connector: one spark
      ctx.fillStyle = '#15181d'; ctx.fillRect(x, y, w, h);
      var mv = es(u, 0.05, 0.35), px = lerp(x + w * 0.95, cx + w * 0.12, mv);
      ctx.fillStyle = '#6f757d'; ctx.fillRect(x, cy - h * 0.18, w * 0.42, h * 0.36);
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(x + w * 0.42, cy - h * 0.08, w * 0.08, h * 0.16);
      ctx.fillStyle = '#b8bec6'; ctx.fillRect(px, cy - h * 0.1, w * 0.16, h * 0.2);
      ctx.strokeStyle = '#222'; ctx.lineWidth = h * 0.12; ctx.beginPath(); ctx.moveTo(px + w * 0.16, cy); ctx.lineTo(x + w * 1.1, cy - h * 0.1); ctx.stroke();
      var sp = pulse(u, 0.33, 0.42);
      if (sp > 0) { glow(ctx, x + w * 0.52, cy, w * 0.35 * sp, '#9fd8ff', sp); for (i = 0; i < 8; i++) { var a = rnd(i) * TAU; line(ctx, x + w * 0.52, cy, x + w * 0.52 + Math.cos(a) * w * 0.25 * sp, cy + Math.sin(a) * w * 0.25 * sp, '#e8f6ff', 1.5 * s); } }
      var led = u < 0.36 ? '#3fae69' : '#2a2f36'; ctx.fillStyle = led; ctx.beginPath(); ctx.arc(x + w * 0.1, cy - h * 0.28, 5 * s, 0, TAU); ctx.fill();
      if (u > 0.4) { ctx.strokeStyle = 'rgba(200,200,200,' + (0.4 * (1 - seg(u, 0.4, 1))).toFixed(3) + ')'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x + w * 0.52, cy - h * 0.05); ctx.bezierCurveTo(x + w * 0.45, cy - h * 0.25, x + w * 0.6, cy - h * 0.35, x + w * 0.5, y + h * 0.05); ctx.stroke(); }
    } else {   // 'turned': chip on the chuck turned 180 degrees, RF probe at the far end
      var gch = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.75); gch.addColorStop(0, '#6a6e75'); gch.addColorStop(1, '#2f3237');
      ctx.fillStyle = gch; ctx.fillRect(x, y, w, h);
      var rot = PI * es(u, 0.05, 0.35);
      die(ctx, cx, cy, w * 0.8, rot, { mark: 0, light: cyc(t, 1.8) });
      axes(ctx, U, cx, cy + w * 0.34, rot, { len: 18, size: 10 });
    }
  }

  // Reflection: an anonymous figure from behind; params.scene 'inbox' (reply-all storm) or 'snap' (the amplifier)
  A['fe.feelings'] = function (ctx, w, h, t, p) {
    p = p || {}; var U = units(w, h), s = U.s, u = cyc(t, 10, 0.1);
    bg(ctx, U, '#141a22', '#040506', 0.5, 0.25);
    var mx = w / 2, my = h * 0.38, mw = Math.min(w * 0.7, h * 0.95), mh = mw * 0.56;
    if (p.scene === 'snap') {
      // bench with a driver amplifier
      ctx.fillStyle = '#20252c'; ctx.fillRect(0, h * 0.62, w, h * 0.38);
      var ax = mx - mw * 0.35, ay = h * 0.4, aw = mw * 0.7, ah = mh * 0.5;
      ctx.fillStyle = '#3b4149'; ctx.fillRect(ax, ay, aw, ah); ctx.fillStyle = '#2b3037'; ctx.fillRect(ax, ay, aw, ah * 0.18);
      for (var f = 0; f < 10; f++) { ctx.fillStyle = '#23272d'; ctx.fillRect(ax + aw * (0.08 + f * 0.085), ay + ah * 0.35, aw * 0.04, ah * 0.45); }
      var dead = u > 0.3;
      ctx.fillStyle = dead ? '#30353c' : '#3fae69'; ctx.beginPath(); ctx.arc(ax + aw * 0.92, ay + ah * 0.55, 5 * s, 0, TAU); ctx.fill();
      if (!dead) glow(ctx, ax + aw * 0.92, ay + ah * 0.55, 12 * s, '#3fae69', 0.6);
      var sp = pulse(u, 0.28, 0.34);
      if (sp > 0) { glow(ctx, ax - 6 * s, ay + ah * 0.55, 80 * s * sp, '#bfe6ff', sp); }
      if (u > 0.32) {
        for (var k = 0; k < 3; k++) {
          var ph = cyc(t, 3, k / 3); ctx.strokeStyle = 'rgba(190,190,190,' + (0.35 * (1 - ph)).toFixed(3) + ')'; ctx.lineWidth = 4 * s;
          ctx.beginPath(); ctx.moveTo(ax - 4 * s, ay + ah * 0.5 - ph * 90 * s); ctx.bezierCurveTo(ax - 20 * s, ay - ph * 90 * s, ax + 10 * s, ay - 30 * s - ph * 90 * s, ax - 6 * s, ay - 60 * s - ph * 90 * s); ctx.stroke();
        }
      }
      ctx.strokeStyle = '#111'; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(ax - 4 * s, ay + ah * 0.55); ctx.bezierCurveTo(ax - 60 * s, ay + ah, ax - 80 * s, h * 0.7, 0, h * 0.68); ctx.stroke();
    } else {
      // monitor with an inbox; the summary arrives and replies pile up
      ctx.fillStyle = '#0e1116'; ctx.fillRect(mx - mw / 2 - 6 * s, my - mh / 2 - 6 * s, mw + 12 * s, mh + 12 * s);
      ctx.fillStyle = '#eef2f6'; ctx.fillRect(mx - mw / 2, my - mh / 2, mw, mh);
      ctx.fillStyle = '#dfe5ec'; ctx.fillRect(mx - mw / 2, my - mh / 2, mw * 0.22, mh);
      var n = Math.min(6, Math.floor(seg(u, 0.1, 0.8) * 7));
      for (var r = 0; r < 6; r++) {
        var ry = my - mh / 2 + mh * (0.06 + r * 0.15), on = r < n;
        if (!on) continue;
        var first = r === n - 1;
        ctx.fillStyle = first ? '#ffe9e7' : '#f7f9fb'; ctx.fillRect(mx - mw / 2 + mw * 0.23, ry, mw * 0.75, mh * 0.13);
        ctx.fillStyle = r === 0 ? '#c0392b' : '#3a4250'; ctx.fillRect(mx - mw / 2 + mw * 0.26, ry + mh * 0.03, mw * (r === 0 ? 0.32 : 0.12), Math.max(2, mh * 0.03));
        ctx.fillStyle = 'rgba(58,66,80,0.4)'; ctx.fillRect(mx - mw / 2 + mw * 0.26, ry + mh * 0.08, mw * 0.5, Math.max(2, mh * 0.022));
        if (r > 0) text(ctx, 'RE:', mx - mw / 2 + mw * 0.42, ry + mh * 0.045, Math.max(7, U.f(8)), '#3a4250', 'left', '700');
      }
      var dotA = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.fillStyle = hexA('#e0524c', 0.6 + 0.4 * dotA); ctx.beginPath(); ctx.arc(mx - mw / 2 + mw * 0.11, my - mh / 2 + mh * 0.12, Math.max(4, mh * 0.05) * (1 + 0.15 * dotA), 0, TAU); ctx.fill();
      ctx.fillStyle = '#0e1116'; ctx.fillRect(mx - 10 * s, my + mh / 2 + 6 * s, 20 * s, h * 0.1);
    }
    figure(ctx, w * 0.5, h * 0.8, Math.min(w, h) / 360 * 0.9, { slump: es(u, 0.35, 0.7) * (1 - es(u, 0.94, 1)) });
  };

  // Lot 7, technically: the mask stays put, the wafer was loaded turned, so the guides run along z
  A['fe.flatWrong'] = function (ctx, w, h, t) {
    var wide = w / h > 2, U = wide ? units(w, h, 600, 200) : units(w, h), s = U.s, u = cyc(t, 10, 0.05);
    bg(ctx, U, '#1a2230', '#05070a');
    var rot = PI / 2 * es(u, 0.15, 0.4) * (1 - es(u, 0.85, 0.97));
    var cx = wide ? w * 0.2 : w * 0.36, cy = h * 0.5, r = wide ? h * 0.4 : Math.min(w * 0.3, h * 0.4);
    wafer(ctx, cx, cy, r, PI / 2 - rot, { sheen: cyc(t, 5) });
    // crystal axes ride on the wafer: z along the flat normal direction rotated
    axes(ctx, U, cx - r * 0.45, cy - r * 0.05, -rot, { len: 28 });
    // mask waveguides fixed horizontal (designed along y)
    ctx.save(); waferPath(ctx, cx, cy, r, PI / 2 - rot); ctx.clip();
    for (var i = -3; i <= 3; i++) { var yy = cy + i * r * 0.17; line(ctx, cx - r, yy, cx + r, yy, 'rgba(70,110,95,0.95)', Math.max(1.5, 2 * s)); }
    var lx = cx - r + 2 * r * cyc(t, 2.2); glow(ctx, lx, cy, 14 * s, P.light, 0.9);
    // TE field arrow on the light (vertical in the mask frame)
    var a = 10 * s * Math.sin(t * 12); arrow(ctx, lx, cy + a, lx, cy - a, '#ffffff', 2 * s, 6 * s);
    ctx.restore();
    // meter: n_e^3 r33 when TE and the field lie along z; n_o^3 r22 (about an eighth) when both lie along y
    var al = Math.abs(Math.cos(rot));   // TE along z fraction (vertical = z at rot 0)
    var bx = wide ? w * 0.4 : w * 0.74, by = h * 0.2, bw = wide ? w * 0.07 : w * 0.16, bh = h * 0.6;
    box(ctx, bx, by, bw, bh, 'rgba(10,14,19,0.75)', 'rgba(200,210,220,0.35)');
    var fill = bh * (0.12 + 0.88 * al * al);
    var g = ctx.createLinearGradient(0, by + bh, 0, by); g.addColorStop(0, '#2f6dff'); g.addColorStop(1, '#ffc46b');
    ctx.fillStyle = g; ctx.fillRect(bx + 4 * s, by + bh - fill, bw - 8 * s, fill - 4 * s);
    text(ctx, rot < 0.8 ? 'r₃₃' : 'r₂₂', bx + bw / 2, by - 10 * s, U.f(14), rot < 0.8 ? C.zAx : C.yAx, 'center', '800');
    var lab = rot < 0.3 ? 'waveguide along y' : rot > 1.3 ? 'waveguide along z' : '';
    if (wide) {
      text(ctx, lab, w * 0.52, h * 0.35, U.f(17), rot > 1.3 ? P.bad : P.ok, 'left', '800');
      if (lab) text(ctx, rot > 1.3 ? 'TE and field along y' : 'TE and field along z', w * 0.52, h * 0.6, U.f(14), '#ffffff', 'left', '600');
    } else text(ctx, lab, cx, Math.min(h - 10 * s, cy + r + 14 * s), U.f(13), rot > 1.3 ? P.bad : P.ok, 'center', '700');
  };

  // Lot 7 wafer map: guides parallel to the flat, V pi map all hot; the reply-all button waits
  A['fe.waferMap'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 8);
    bg(ctx, U, '#161d27', '#05070a'); dots(ctx, U, 20);
    var cx = w * 0.4, cy = h * 0.5, r = Math.min(w * 0.34, h * 0.42), fa = 0;
    wafer(ctx, cx, cy, r, fa, { sheen: cyc(t, 6) });
    ctx.save(); waferPath(ctx, cx, cy, r, fa); ctx.clip();
    var n = 7, d = 2 * r / n, scan = u * (n * n + 6);
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      var x = cx - r + i * d, y = cy - r + j * d, idx = j * n + i;
      if (Math.hypot(x + d / 2 - cx, y + d / 2 - cy) > r * 0.92) continue;
      var v = 0.55 + 0.45 * rnd(idx + 4);
      var shown = idx < scan;
      ctx.fillStyle = shown ? hexA(mix('#e3b04b', '#e0524c', v), 0.85) : 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 1.5 * s, y + 1.5 * s, d - 3 * s, d - 3 * s);
      ctx.strokeStyle = 'rgba(30,40,40,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + d * 0.45, y + 3 * s); ctx.lineTo(x + d * 0.45, y + d - 3 * s); ctx.moveTo(x + d * 0.58, y + 3 * s); ctx.lineTo(x + d * 0.58, y + d - 3 * s); ctx.stroke();
      if (Math.floor(scan) === idx) glow(ctx, x + d / 2, y + d / 2, d * 0.8, '#ffffff', 0.5);
    }
    ctx.restore();
    // flat marker
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * s; ctx.setLineDash([4 * s, 4 * s]); ctx.beginPath(); ctx.moveTo(cx + r * 1.04, cy - r * 0.5); ctx.lineTo(cx + r * 1.04, cy + r * 0.5); ctx.stroke(); ctx.setLineDash([]);
    text(ctx, 'flat', cx + r * 1.1, cy - r * 0.6, U.f(12), '#ffffff', 'left', '700');
    // colour bar
    var bx = w * 0.86, by = h * 0.22, bh = h * 0.5;
    var g = ctx.createLinearGradient(0, by + bh, 0, by); g.addColorStop(0, '#3fae69'); g.addColorStop(0.5, '#e3b04b'); g.addColorStop(1, '#e0524c');
    ctx.fillStyle = g; ctx.fillRect(bx, by, 14 * s, bh);
    text(ctx, 'Vπ', bx + 7 * s, by - 12 * s, U.f(13), '#ffffff', 'center', '800');
    // reply-all button pulsing
    var pz = 0.5 + 0.5 * Math.sin(t * 3.2);
    var rbw = 96 * s, rbh = 28 * s, rbx = w * 0.82 - rbw / 2, rby = h * 0.86 - rbh / 2;
    glow(ctx, rbx + rbw / 2, rby + rbh / 2, 60 * s, '#63e6ff', 0.25 * pz);
    box(ctx, rbx, rby, rbw, rbh, '#1f6fd1', '#9fd2ff', 1.5 * s);
    text(ctx, 'Reply all', rbx + rbw / 2, rby + rbh / 2, U.f(13), '#ffffff', 'center', '700');
  };

  // Speak-up: the irreversible steps freeze when the phrase is said. params: { phrases: [[...], ...] }
  A['fe.speakUp'] = function (ctx, w, h, t, p) {
    p = p || {}; var U = units(w, h), s = U.s;
    var T = 6, k = Math.floor(t / T), u = cyc(t, T);
    var phrases = p.phrases || [['Pause, please.', 'Orientation check.'], ['Pause, please.', 'Charge check.']];
    var ph = phrases[k % phrases.length];
    bg(ctx, U, '#1b1f2a', '#05060a', 0.5, 0.6);
    var steps = ['expose', 'etch', 'bond', 'dice', 'plug in', 'power on'];
    var n = steps.length, rr = Math.min(w / (n * 2.4), h * 0.11), y0 = h * 0.8;
    var freeze = es(u, 0.25, 0.32), act = k % n;
    for (var i = 0; i < n; i++) {
      var x = w * (i + 0.5) / n, on = i === act;
      var spin = (on ? (1 - freeze) : 1) * t;
      box(ctx, x - rr, y0 - rr, 2 * rr, 2 * rr, on ? 'rgba(224,82,76,0.25)' : 'rgba(255,255,255,0.05)', on ? hexA(P.bad, 0.6 + 0.4 * freeze) : 'rgba(255,255,255,0.18)', on ? 2 * s : 1);
      stepIcon(ctx, steps[i], x, y0, rr * 0.62, on ? '#ffffff' : 'rgba(200,210,220,0.65)', spin);
      text(ctx, steps[i], x, y0 + rr + 11 * s, U.f(10), on ? '#ffffff' : P.inkDim, 'center', '600');
    }
    // raised hand
    var hk = Math.min(w, h) / 360, hx = w * 0.2, hy = y0 - rr - 136 * 0.9 * hk;
    var up = es(u, 0.05, 0.2);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, y0 - rr - 4 * s); ctx.clip();
    hand(ctx, hx, hy + (1 - up) * 40 * s, 0.9 * hk, '#ffd1a8');
    ctx.restore();
    if (u > 0.18) {
      var sc = 0.6 + 0.4 * es(u, 0.18, 0.26);
      bubble(ctx, U, w * 0.6, h * 0.34, ph, { size: 20, scale: sc, tx: hx + 50 * hk, ty: hy - 10 * hk, alpha: 1 - es(u, 0.93, 1) });
    }
  };
  function hand(ctx, x, y, k, col) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(120,70,40,0.7)'; ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.moveTo(-34 * k, 10 * k); ctx.lineTo(-34 * k, 60 * k); ctx.quadraticCurveTo(-30 * k, 92 * k, 0, 95 * k); ctx.quadraticCurveTo(32 * k, 92 * k, 36 * k, 55 * k); ctx.lineTo(36 * k, 10 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
    [[-30, -38], [-12, -52], [6, -50], [24, -36]].forEach(function (f) { ctx.beginPath(); ctx.moveTo(f[0] * k - 7 * k, 14 * k); ctx.lineTo(f[0] * k - 7 * k, f[1] * k + 7 * k); ctx.arc(f[0] * k, f[1] * k + 7 * k, 7 * k, PI, 0); ctx.lineTo(f[0] * k + 7 * k, 14 * k); ctx.fill(); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(36 * k, 50 * k); ctx.quadraticCurveTo(62 * k, 30 * k, 58 * k, 14 * k); ctx.quadraticCurveTo(48 * k, 8 * k, 36 * k, 28 * k); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8edf2'; ctx.fillRect(-36 * k, 88 * k, 74 * k, 40 * k);   // glove cuff of the suit sleeve
    ctx.restore();
  }
  function stepIcon(ctx, kind, x, y, r, col, t) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1.3, r * 0.12); ctx.lineCap = 'round';
    switch (kind) {
      case 'expose': ctx.strokeRect(-r * 0.7, -r * 0.8, r * 1.4, r * 0.4); for (var i = -1; i <= 1; i++) { var o = (t * 2 % 1) * r * 0.4; line(ctx, i * r * 0.4, -r * 0.25 + o, i * r * 0.4, r * 0.15 + o, col, Math.max(1.3, r * 0.12)); } ctx.fillRect(-r * 0.8, r * 0.6, r * 1.6, r * 0.15); break;
      case 'etch': ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.8); ctx.lineTo(-r * 0.55, r * 0.7); ctx.lineTo(r * 0.55, r * 0.7); ctx.lineTo(r * 0.55, -r * 0.8); ctx.stroke(); for (var b = 0; b < 3; b++) { var bp = (t * 0.8 + b / 3) % 1; ctx.beginPath(); ctx.arc((b - 1) * r * 0.25, r * 0.6 - bp * r * 1.1, r * 0.09, 0, TAU); ctx.stroke(); } break;
      case 'bond': ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.6); ctx.quadraticCurveTo(0, -r * 1.2 + Math.sin(t * 3) * r * 0.2, r * 0.8, r * 0.6); ctx.stroke(); ctx.fillRect(-r * 0.95, r * 0.55, r * 0.3, r * 0.2); ctx.fillRect(r * 0.65, r * 0.55, r * 0.3, r * 0.2); break;
      case 'dice': ctx.rotate(t * 3); ctx.beginPath(); for (var k = 0; k < 24; k++) { var a = k * TAU / 24, rr = k % 2 ? r * 0.7 : r * 0.85; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, TAU); ctx.stroke(); break;
      case 'plug in': var dx = Math.sin(t * 2) * r * 0.2; ctx.strokeRect(-r * 0.9 + dx, -r * 0.3, r * 0.8, r * 0.6); line(ctx, -r * 0.1 + dx, -r * 0.15, r * 0.25 + dx, -r * 0.15, col, Math.max(1.3, r * 0.12)); line(ctx, -r * 0.1 + dx, r * 0.15, r * 0.25 + dx, r * 0.15, col, Math.max(1.3, r * 0.12)); ctx.strokeRect(r * 0.45, -r * 0.45, r * 0.45, r * 0.9); break;
      case 'power on': ctx.beginPath(); ctx.arc(0, r * 0.05, r * 0.72, -PI / 2 + 0.55, -PI / 2 - 0.55 + TAU); ctx.stroke(); line(ctx, 0, -r * 0.85, 0, -r * 0.05, col, Math.max(1.3, r * 0.12)); break;
    }
    ctx.restore();
  }

  // Takeaway banner: a chapter motif plus the four mantra beats lighting in turn. params: { theme }
  A['fe.banner'] = function (ctx, w, h, t, p) {
    p = p || {}; var U = units(w, h, 600, 200), s = U.s;
    bg(ctx, U, '#1b2333', '#05070a', 0.3, 0.5);
    var wide = w / h > 1.8;
    var mw = wide ? w * 0.62 : w, mh = wide ? h : h * 0.68;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, mw, mh); ctx.clip();
    bannerMotif(ctx, p.theme, 0, 0, mw, mh, t, Math.min(mw / 560, mh / 240));
    ctx.restore();
    // mantra beats
    var icons = ['axes', 'charge', 'sweep', 'mirror'], cols = ['#9fe3ff', '#ffc46b', '#7ee08a', '#ff7ad9'];
    var act = Math.floor(cyc(t, 8) * 4);
    var bx0 = wide ? mw + w * 0.03 : w * 0.06, by0 = wide ? h * 0.2 : mh + (h - mh) * 0.18;
    var cw = wide ? (w - mw - w * 0.06) / 2 : w * 0.88 / 4, ch = wide ? h * 0.3 : (h - mh) * 0.64;
    for (var i = 0; i < 4; i++) {
      var col = wide ? i % 2 : i, row = wide ? Math.floor(i / 2) : 0;
      var x = bx0 + col * cw, y = by0 + row * (ch + h * 0.06), on = i === act;
      box(ctx, x + 3 * s, y, cw - 6 * s, ch, on ? hexA(cols[i], 0.22) : 'rgba(255,255,255,0.04)', on ? cols[i] : 'rgba(255,255,255,0.15)', on ? 2 * s : 1);
      if (on) glow(ctx, x + cw / 2, y + ch / 2, ch, cols[i], 0.25);
      ctx.save(); ctx.globalAlpha = on ? 1 : 0.45; emblem(ctx, icons[i], x + cw / 2, y + ch / 2, Math.min(cw, ch) * 0.3, cols[i], t); ctx.restore();
    }
  };
  function bannerMotif(ctx, theme, x, y, w, h, t, s, mo) {
    mo = mo || {};
    var i, j, cx = x + w / 2, cy = y + h / 2;
    var U = { w: w, h: h, s: s * 1.2, f: function (n) { return Math.max(8, Math.round(n * s * 1.2)); } };
    if (theme === 'orient') {   // a row of wafers, each turning until its flat finds the notch at six o'clock
      var n = Math.max(3, Math.round(w / (h * 0.9))), r = Math.min(w / n * 0.38, h * 0.34);
      for (i = 0; i < n; i++) {
        var wx = x + w * (i + 0.5) / n, ph = cyc(t, 6, i * 0.17), a = PI / 2 + (1 - es(ph, 0, 0.6)) * (rnd(i) - 0.5) * 4;
        wafer(ctx, wx, cy, r, a, { sheen: ph });
        var done = ph > 0.6;
        line(ctx, wx - r * 0.5, cy + r * 1.18, wx + r * 0.5, cy + r * 1.18, done ? P.ok : 'rgba(255,255,255,0.3)', 3 * s);
        if (done) glow(ctx, wx, cy + r * 1.18, r * 0.4, P.ok, 0.5 * (1 - seg(ph, 0.6, 1)));
        axes(ctx, U, wx - r * 0.25, cy + r * 0.05, a - PI / 2, { len: r * 0.45 / U.s, size: 10 });
      }
    } else if (theme === 'cats') {   // the eight category icons gliding by
      var cw = h * 0.62, tot = cw * 8, off = (t * 40 * s) % tot;
      for (i = 0; i < 16; i++) {
        var px = x + i * cw - off, c = CATS[i % 8];
        if (px < x - cw || px > x + w + cw) continue;
        box(ctx, px + cw * 0.08, cy - cw * 0.42, cw * 0.84, cw * 0.84, hexA(c.col, 0.14), hexA(c.col, 0.7), 1.5);
        catIcon(ctx, c.key, px + cw / 2, cy, cw * 0.28, c.col, t + i);
      }
    } else if (theme === 'bends') {   // a meander waveguide; light starts TE and turns TM after the bends
      var amp = h * 0.28, L = w * 0.9, x0 = x + w * 0.05;
      var path = function (q) { return [x0 + q * L, cy + amp * Math.sin(q * TAU * 1.5)]; };
      ctx.strokeStyle = P.slab; ctx.lineWidth = Math.max(4, 8 * s); ctx.beginPath();
      for (i = 0; i <= 120; i++) { var pp = path(i / 120); if (i) ctx.lineTo(pp[0], pp[1]); else ctx.moveTo(pp[0], pp[1]); } ctx.stroke();
      for (i = 0; i < 6; i++) { var q = cyc(t, 4, i / 6), pq = path(q); glow(ctx, pq[0], pq[1], 16 * s, mix(P.light, P.lightTM, seg(q, 0.25, 0.8)), 0.95); }
    } else if (theme === 'pr') {   // resonance comb: the dips walk blue as the laser sits in them
      var pl = { x: x + w * 0.06, y: y + h * 0.15, w: w * 0.88, h: h * 0.7 };
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
      var sh = mo.neutral ? 0 : 0.03 * Math.sin(t * 0.8) - 0.03;
      ctx.strokeStyle = '#63e6ff'; ctx.lineWidth = Math.max(2, 2.5 * s); ctx.beginPath();
      for (i = 0; i <= 300; i++) { var xx = i / 300, v = 1; for (j = 0; j < 5; j++) { var d = (xx - (0.1 + j * 0.2) - sh) / 0.012; v -= 0.8 / (1 + d * d); } var Y = pl.y + pl.h * (1 - 0.9 * v) - pl.h * 0.05; if (i) ctx.lineTo(pl.x + xx * pl.w, Y); else ctx.moveTo(pl.x + xx * pl.w, Y); }
      ctx.stroke();
      if (mo.neutral) { var lx = pl.x + pl.w * cyc(t, 5); line(ctx, lx, pl.y, lx, pl.y + pl.h, 'rgba(255,255,255,0.5)', 1.5 * s); glow(ctx, lx, pl.y, 10 * s, '#63e6ff', 0.9); }
      else arrow(ctx, pl.x + pl.w * 0.55, pl.y + pl.h * 0.12, pl.x + pl.w * 0.42, pl.y + pl.h * 0.12, '#7aa2ff', 3 * s, 10 * s);
    } else if (theme === 'pyro') {   // a z-cut slab on a hot plate: heating leaves the +z face negative
      var hT = 0.5 - 0.5 * Math.cos(t * 0.8), sx = x + w * 0.12, sw = w * 0.76, sy = cy - h * 0.12, sh2 = h * 0.24;
      ctx.fillStyle = mix('#3b3f46', '#ff5a2a', hT * 0.7); ctx.fillRect(x + w * 0.06, sy + sh2, w * 0.88, h * 0.12);
      ctx.fillStyle = '#b49ad8'; ctx.fillRect(sx, sy, sw, sh2);
      var dq = Math.sin(t * 0.8);   // heating while positive
      var nq = Math.round(Math.abs(dq) * 10);
      for (i = 0; i < nq; i++) {
        var qx = sx + sw * (i + 0.5) / 10;
        text(ctx, dq > 0 ? '−' : '+', qx, sy - 10 * s, Math.round(18 * s), dq > 0 ? '#5fb2ff' : '#ff6b6b', 'center', '800');
        text(ctx, dq > 0 ? '+' : '−', qx, sy + sh2 + h * 0.06, Math.round(14 * s), dq > 0 ? '#ff6b6b' : '#5fb2ff', 'center', '800');
      }
      text(ctx, '+z', sx + sw + 8 * s, sy + 6 * s, Math.round(12 * s), '#ffffff', 'left', '700');
      for (i = 0; i < 6; i++) { var hp = cyc(t, 2, i / 6); ctx.strokeStyle = 'rgba(255,140,60,' + (0.4 * hT * (1 - hp)).toFixed(3) + ')'; ctx.lineWidth = 2 * s; ctx.beginPath(); var hx = x + w * (0.15 + i * 0.14); ctx.moveTo(hx, sy + sh2 + h * 0.12 - hp * h * 0.2); ctx.quadraticCurveTo(hx + 8 * s, sy + sh2 + h * 0.05 - hp * h * 0.2, hx, sy + sh2 - hp * h * 0.2); ctx.stroke(); }
    } else if (theme === 'bias') {   // transfer curve with the bias point sliding off quadrature
      var pl2 = { x: x + w * 0.06, y: y + h * 0.12, w: w * 0.88, h: h * 0.72 };
      var dr = 0.5 * (1 - Math.exp(-cyc(t, 8) * 3));
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.strokeRect(pl2.x, pl2.y, pl2.w, pl2.h);
      ctx.strokeStyle = '#e9eef3'; ctx.lineWidth = Math.max(2, 2.5 * s); ctx.beginPath();
      for (i = 0; i <= 200; i++) { var vv = -2 + 4 * i / 200, T2 = Math.pow(Math.sin(PI * (vv - dr) / 2 + PI / 4), 2), X2 = pl2.x + i / 200 * pl2.w, Y2 = pl2.y + pl2.h * (1 - T2); if (i) ctx.lineTo(X2, Y2); else ctx.moveTo(X2, Y2); } ctx.stroke();
      var opX = pl2.x + pl2.w / 2, opY = pl2.y + pl2.h * (1 - Math.pow(Math.sin(-PI * dr / 2 + PI / 4), 2));
      line(ctx, opX, pl2.y, opX, pl2.y + pl2.h, 'rgba(227,176,75,0.6)', 1.5 * s, [5 * s, 4 * s]);
      glow(ctx, opX, opY, 16 * s, '#ffc46b', 1);
    } else {   // 'sim': a triangle mesh lit by a travelling mode
      var nx = Math.max(6, Math.round(w / (36 * s))), ny = Math.max(3, Math.round(h / (36 * s))), dx = w / nx, dy = h / ny;
      for (i = 0; i < nx; i++) for (j = 0; j < ny; j++) {
        var px2 = x + i * dx, py2 = y + j * dy;
        [0, 1].forEach(function (k) {
          var mxp = px2 + dx * (k ? 0.66 : 0.33), myp = py2 + dy * (k ? 0.66 : 0.33);
          var fld = Math.sin((mxp - x) / w * TAU * 2 - t * 2) * Math.exp(-Math.pow((myp - cy) / (h * 0.25), 2));
          ctx.fillStyle = fld > 0 ? hexA('#ff3d3d', 0.75 * fld) : hexA('#2f6dff', -0.75 * fld);
          ctx.beginPath(); if (k) { ctx.moveTo(px2 + dx, py2); ctx.lineTo(px2 + dx, py2 + dy); ctx.lineTo(px2, py2 + dy); } else { ctx.moveTo(px2, py2); ctx.lineTo(px2 + dx, py2); ctx.lineTo(px2, py2 + dy); } ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(200,220,240,0.25)'; ctx.lineWidth = 1; ctx.stroke();
        });
      }
    }
  }

  // Reference list: cards slide past; a card shows its figure when the chapter has one. params: { items: [{ a, j, y, fig }] }
  A['fe.refs'] = function (ctx, w, h, t, p) {
    p = p || {}; var items = p.items || [];
    var U = units(w, h, 600, 200), s = U.s;
    bg(ctx, U, '#1e2430', '#06080b', 0.5, 0.5);
    if (!items.length) return;
    var ch = h * 0.78, cw = ch * 0.74, gap = cw * 0.16, tot = items.length * (cw + gap);
    var reps = Math.max(2, Math.ceil((w + cw) / tot) + 1);
    var off = (t * 28 * Math.max(0.6, s)) % tot;
    var y0 = (h - ch) / 2;
    var pal = ['#2c4a7a', '#6a2c4f', '#2f6b5a', '#7a5a2c', '#4b3a7a', '#2c6a7a', '#7a2c2c', '#3d4a5c'];
    for (var r = 0; r < reps; r++) for (var i = 0; i < items.length; i++) {
      var x = r * tot + i * (cw + gap) - off;
      if (x > w || x + cw < 0) continue;
      var it = items[i], cx = x + cw / 2, lift = Math.max(0, 1 - Math.abs(cx - w / 2) / (cw * 1.2));
      var yy = y0 - lift * 6 * s;
      ctx.save(); ctx.translate(cx, h / 2); var zs = 1 + 0.1 * ease(lift); ctx.scale(zs, zs); ctx.translate(-cx, -h / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x + 4 * s, yy + 6 * s, cw, ch);
      var col = pal[(i + (it.y || 0)) % pal.length];
      ctx.fillStyle = col; ctx.fillRect(x, yy, cw, ch);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, yy, cw, ch * 0.03);
      var fs = Math.max(8, Math.round(cw * 0.085));
      // journal and year at the top, author at the bottom, figure (or a motif) in the middle
      ctx.save(); ctx.beginPath(); ctx.rect(x, yy, cw, ch); ctx.clip();
      wrapText(ctx, it.j || '', x + cw * 0.08, yy + ch * 0.07, cw * 0.84, fs, '#ffffff', '700', 3);
      var fx = x + cw * 0.08, fy = yy + ch * 0.36, fw = cw * 0.84, fh = ch * 0.4;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(fx, fy, fw, fh);
      var im = it.fig ? img(it.fig) : null;
      if (im) {
        var sc = Math.min(fw / im.naturalWidth, fh / im.naturalHeight), iw = im.naturalWidth * sc, ih = im.naturalHeight * sc;
        ctx.drawImage(im, fx + (fw - iw) / 2, fy + (fh - ih) / 2, iw, ih);
      } else {
        ctx.save(); ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip();
        emblem(ctx, it.e || ['crystal', 'axes', 'dip', 'ring', 'sine', 'mesh', 'charge'][i % 7], fx + fw / 2, fy + fh / 2, fh * 0.32, col, t);
        ctx.restore();
      }
      text(ctx, String(it.y || ''), x + cw * 0.08, yy + ch * 0.84, Math.round(fs * 1.3), '#ffe08a', 'left', '800');
      font(ctx, Math.max(8, Math.round(fs * 0.9)), '600'); var au = it.a || '';
      while (au.length > 4 && ctx.measureText(au).width > cw * 0.86) au = au.slice(0, -2);
      if (au !== (it.a || '')) au = au.replace(/\s+\S*$/, '') + '\u2026';
      text(ctx, au, x + cw * 0.08, yy + ch * 0.93, Math.max(8, Math.round(fs * 0.9)), 'rgba(255,255,255,0.85)', 'left', '600');
      ctx.restore(); ctx.restore();
    }
    var g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(6,8,11,0.9)'); g.addColorStop(0.08, 'rgba(6,8,11,0)'); g.addColorStop(0.92, 'rgba(6,8,11,0)'); g.addColorStop(1, 'rgba(6,8,11,0.9)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  };
  function wrapText(ctx, str, x, y, maxW, px, col, wgt, maxLines) {
    font(ctx, px, wgt); ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    var words = String(str).split(' '), lines = [], cur = '';
    words.forEach(function (wd) { var tst = cur ? cur + ' ' + wd : wd; if (ctx.measureText(tst).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = tst; });
    if (cur) lines.push(cur);
    lines.slice(0, maxLines || 9).forEach(function (l, i) { ctx.fillText(l, x, y + i * px * 1.2); });
  }


  /* ===================== Module 2: sources of orientation misconduct ===================== */

  // Eight categories orbit one wafer; the single response lights word by word in the middle
  A['fe.eightCats'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#1d2234', '#05060a'); dots(ctx, U, 22);
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.37, act = Math.floor(cyc(t, 12) * 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    wafer(ctx, cx, cy, R * 0.45, PI / 2 + t * 0.2, { sheen: cyc(t, 5) });
    CATS.forEach(function (c, i) {
      var a = -PI / 2 + i * TAU / 8 + t * 0.12, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, on = i === act, r = (on ? 30 : 22) * s;
      if (on) { glow(ctx, x, y, r * 2.2, c.col, 0.5); line(ctx, cx + Math.cos(a) * R * 0.47, cy + Math.sin(a) * R * 0.47, x - Math.cos(a) * r, y - Math.sin(a) * r, hexA(c.col, 0.7), 2 * s, [4 * s, 4 * s]); }
      box(ctx, x - r, y - r, 2 * r, 2 * r, on ? hexA(c.col, 0.25) : 'rgba(10,14,19,0.85)', hexA(c.col, on ? 1 : 0.55), on ? 2 * s : 1.2 * s);
      catIcon(ctx, c.key, x, y, r * 0.62, c.col, t);
    });
    var words = ['Stop.', 'Mark.', 'Log.', 'Speak up.'], wi = Math.floor(cyc(t, 4) * 4);
    text(ctx, words[wi], cx, cy, U.f(22), '#ffffff', 'center', '800');
  };

  // Category slides. params: { k: 1..8 }
  A['fe.cat'] = function (ctx, w, h, t, p) {
    var k = (p && p.k) || 1, U = units(w, h), s = U.s, c = CATS[k - 1];
    var f = CATSCENE[k] || CATSCENE[1];
    f(ctx, U, w, h, t, s, c.col);
    // category badge in the corner
    var br = 18 * s; box(ctx, 8 * s, 8 * s, 2 * br + 34 * s, 2 * br, 'rgba(8,11,15,0.8)', hexA(c.col, 0.8), 1.5 * s);
    catIcon(ctx, c.key, 8 * s + br, 8 * s + br, br * 0.62, c.col, t);
    text(ctx, k + '/8', 8 * s + 2 * br + 16 * s, 8 * s + br, U.f(13), c.col, 'center', '800');
  };
  var CATSCENE = {};
  // 1 Tool-initiated: the spin coater stops wherever it stops
  CATSCENE[1] = function (ctx, U, w, h, t, s, col) {
    bg(ctx, U, '#1b2430', '#05070a');
    var T = 5, n = Math.floor(t / T), u = cyc(t, T), cx = w * 0.5, cy = h * 0.54, R = Math.min(w, h) * 0.36;
    // bowl
    var gb = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.25); gb.addColorStop(0, '#30363e'); gb.addColorStop(1, '#14171b');
    ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, TAU); ctx.fill();
    var stop = rnd(n + 1) * TAU, prev = rnd(n) * TAU;
    // angle: spin up from the previous stop, coast down to the new one
    var spinT = 0.7, v = seg(u, 0, spinT), a = prev + (1 - Math.pow(1 - v, 3)) * (stop - prev + TAU * 6);
    var blur = Math.sin(PI * v) * (u < spinT ? 1 : 0);
    for (var g = 0; g < 4; g++) if (blur > 0.05) { ctx.save(); ctx.globalAlpha = 0.18 * blur; wafer(ctx, cx, cy, R, a - g * 0.25 * blur, { sheen: false }); ctx.restore(); }
    wafer(ctx, cx, cy, R, a, { sheen: cyc(t, 2) });
    // resist streaks while spinning
    if (blur > 0.1) for (var i = 0; i < 18; i++) { var aa = a + i * TAU / 18; ctx.strokeStyle = 'rgba(255,170,90,' + (0.35 * blur).toFixed(3) + ')'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(cx, cy, R * (0.3 + 0.6 * rnd(i)), aa, aa + 0.5 * blur); ctx.stroke(); }
    // earlier stops as ghost ticks
    for (var j = 0; j < 6; j++) { var pa = rnd(n - j) * TAU; line(ctx, cx + Math.cos(pa) * R * 1.05, cy + Math.sin(pa) * R * 1.05, cx + Math.cos(pa) * R * 1.18, cy + Math.sin(pa) * R * 1.18, hexA(col, 0.25 + 0.12 * (6 - j) / 6), 3 * s); }
    if (u > spinT) { var q = seg(u, spinT, spinT + 0.05); text(ctx, '?', cx + Math.cos(stop) * R * 0.75, cy + Math.sin(stop) * R * 0.75, U.f(30), hexA('#ffffff', q), 'center', '800'); }
  };
  // 2 Software-facilitated: the solver applies the angle to the coordinates
  CATSCENE[2] = function (ctx, U, w, h, t, s, col) {
    bg(ctx, U, '#1e1a2e', '#06050a');
    var u = cyc(t, 8, 0.1), wide = w / h > 1.1;
    // code panel
    var px = wide ? w * 0.05 : w * 0.08, py = wide ? h * 0.22 : h * 0.13, pw = wide ? w * 0.38 : w * 0.84, ph = wide ? h * 0.3 : h * 0.18;
    box(ctx, px, py, pw, ph, '#0c0a14', hexA(col, 0.6), 1.5 * s);
    var code = ['material = LN', 'euler = (0, 45, 0)', 'solve()'], nch = Math.floor(es(u, 0.02, 0.3) * 40);
    code.forEach(function (l, i) { var shown = l.slice(0, clamp(nch - i * 12, 0, l.length)); text(ctx, shown, px + 10 * s, py + ph * (0.22 + i * 0.28), U.f(13), i === 1 ? '#ffc46b' : '#c9b8ff', 'left', '600', 'middle', true); });
    // crystal: intended +45 (ghost) vs applied -45
    var cx = wide ? w * 0.7 : w * 0.5, cy = wide ? h * 0.55 : h * 0.62, R = Math.min(w, h) * (wide ? 0.27 : 0.24);
    var r = es(u, 0.35, 0.6) * PI / 4;
    ctx.save(); ctx.setLineDash([6 * s, 5 * s]); ctx.strokeStyle = 'rgba(126,224,138,0.8)'; ctx.lineWidth = 2 * s;
    ctx.translate(cx, cy); ctx.rotate(-r); ctx.strokeRect(-R, -R * 0.62, 2 * R, 1.24 * R); ctx.restore();
    die(ctx, cx, cy, 2 * R, r, { mark: 0, light: cyc(t, 2) });
    axes(ctx, U, cx, cy, r, { len: 24 });
    if (u > 0.62) {
      text(ctx, 'intended', cx + R * 0.55, cy - R * 1.05, U.f(12), '#7ee08a', 'center', '700');
      text(ctx, 'applied', cx + R * 0.7, cy + R * 1.05, U.f(12), P.bad, 'center', '700');
    }
  };
  // 3 Third-party: ion slicing bonds the implanted face down, so the exposed film is the other polar face
  CATSCENE[3] = function (ctx, U, w, h, t, s, col) {
    bg(ctx, U, '#2a2216', '#080604');
    var u = cyc(t, 10, 0.02), cx = w / 2, bw = w * 0.5, bh = h * 0.16;
    var flip = es(u, 0.32, 0.5), drop = es(u, 0.5, 0.62), split = es(u, 0.68, 0.8);
    // handle wafer at the bottom
    var hy = h * 0.8;
    ctx.fillStyle = '#3d4148'; ctx.fillRect(cx - bw / 2, hy, bw, h * 0.07); ctx.fillStyle = '#8c94a0'; ctx.fillRect(cx - bw / 2, hy - h * 0.02, bw, h * 0.02);
    text(ctx, 'handle', cx + bw / 2 + 8 * s, hy + h * 0.035, U.f(11), P.inkDim, 'left', '600');
    // donor crystal: starts high, flips, comes down, then splits leaving the film
    var dy = lerp(h * 0.33, hy - h * 0.02 - bh / 2, drop) - split * h * 0.22;
    var sy = Math.cos(PI * flip);   // vertical scale through the flip
    ctx.save(); ctx.translate(cx, dy); ctx.scale(1, sy === 0 ? 0.001 : sy);
    ctx.fillStyle = '#b49ad8'; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    // implanted layer near the top face (before the flip)
    var imp = es(u, 0.06, 0.28);
    ctx.fillStyle = 'rgba(255,214,110,' + (0.65 * imp).toFixed(3) + ')'; ctx.fillRect(-bw / 2, -bh / 2 + bh * 0.12, bw, bh * 0.08);
    ctx.restore();
    var topY = dy - Math.abs(sy) * bh / 2 * Math.sign(sy || 1), up = sy >= 0;
    // polar face labels (+ face is the original top face)
    var fy1 = dy - bh / 2 * sy, fy2 = dy + bh / 2 * sy;
    if (Math.abs(sy) > 0.3) { text(ctx, '+', cx - bw / 2 - 14 * s, fy1, U.f(20), '#ff6b6b', 'center', '800'); text(ctx, '−', cx - bw / 2 - 14 * s, fy2, U.f(20), '#5fb2ff', 'center', '800'); }
    // implant ions raining on the top face
    if (u < 0.3) for (var i = 0; i < 24; i++) { var q = cyc(t, 0.7, rnd(i)), ix = cx - bw / 2 + bw * rnd(i + 30), iy = lerp(h * 0.02, dy - bh / 2, q); glow(ctx, ix, iy, 4 * s, '#ffd36e', 0.8 * (1 - es(u, 0.24, 0.3))); }
    // after the split: the film stays on the handle, its exposed face is the original bottom (minus) face
    if (split > 0) {
      var fh = bh * 0.14, fy = hy - h * 0.02 - fh;
      ctx.fillStyle = '#c9b2ec'; ctx.fillRect(cx - bw / 2, fy, bw, fh);
      ctx.save(); ctx.globalAlpha = split; text(ctx, '−', cx - bw / 2 - 14 * s, fy - 2 * s, U.f(20), '#5fb2ff', 'center', '800'); glow(ctx, cx - bw / 2 - 14 * s, fy, 18 * s, '#5fb2ff', 0.4 * (0.5 + 0.5 * Math.sin(t * 5))); ctx.restore();
      text(ctx, 'film', cx + bw / 2 + 8 * s, fy + fh / 2, U.f(11), '#c9b2ec', 'left', '700');
    }
    var lab = u < 0.3 ? 'implant' : u < 0.5 ? 'flip' : u < 0.66 ? 'bond' : 'split';
    text(ctx, lab, w * 0.5, h * 0.1, U.f(15), col, 'center', '800');
  };
  // 4 Peer-to-peer: a shared gel-pak, dies in any orientation, no marks
  CATSCENE[4] = function (ctx, U, w, h, t, s, col) {
    bg(ctx, U, '#17241c', '#040705');
    var gx = w * 0.12, gy = h * 0.18, gw = w * 0.76, gh = h * 0.7;
    ctx.fillStyle = '#0d0f12'; ctx.fillRect(gx - 8 * s, gy - 8 * s, gw + 16 * s, gh + 16 * s);
    var gg = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh); gg.addColorStop(0, '#5a6b78'); gg.addColorStop(1, '#3d4a55');
    ctx.fillStyle = gg; ctx.fillRect(gx, gy, gw, gh);
    var nx = 5, ny = 3, T = 3;
    for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) {
      var id = j * nx + i, x = gx + gw * (i + 0.5) / nx, y = gy + gh * (j + 0.5) / ny;
      var slot = Math.floor(t / T + rnd(id) * 3), ph = cyc(t + rnd(id) * 3 * T, T);
      var a0 = Math.floor(rnd(id * 7 + slot) * 4) * PI / 2, a1 = Math.floor(rnd(id * 7 + slot + 1) * 4) * PI / 2;
      var rot = lerp(a0, a1, es(ph, 0.8, 0.95));
      die(ctx, x, y, gw / nx * 0.72, rot, {});
      if (ph > 0.8 && ph < 0.95) glow(ctx, x, y, gw / nx * 0.4, col, 0.35);
    }
  };
  // 5 Cross-institutional: thirty messages, no axis
  CATSCENE[5] = function (ctx, U, w, h, t, s, col) {
    bg(ctx, U, '#2a1a28', '#070407');
    var bwd = w * 0.16, bhd = h * 0.38, by = h * 0.82;
    [[w * 0.14, 'lab A'], [w * 0.86, 'lab B']].forEach(function (b, i) {
      var x = b[0];
      ctx.fillStyle = '#3a2f3c'; ctx.fillRect(x - bwd / 2, by - bhd, bwd, bhd);
      ctx.fillStyle = '#4a3c4d'; ctx.beginPath(); ctx.moveTo(x - bwd * 0.6, by - bhd); ctx.lineTo(x, by - bhd - bhd * 0.3); ctx.lineTo(x + bwd * 0.6, by - bhd); ctx.closePath(); ctx.fill();
      for (var r = 0; r < 3; r++) for (var c2 = 0; c2 < 2; c2++) { var lit = rnd(r * 3 + c2 + i * 9 + Math.floor(t)) > 0.4; ctx.fillStyle = lit ? 'rgba(255,214,140,0.85)' : 'rgba(40,30,40,0.9)'; ctx.fillRect(x - bwd * 0.3 + c2 * bwd * 0.35, by - bhd * 0.85 + r * bhd * 0.27, bwd * 0.22, bhd * 0.15); }
      text(ctx, b[1], x, by + 12 * s, U.f(12), P.inkDim, 'center', '700');
    });
    // envelopes flying both ways along an arc, each carrying a figure with no axis marker
    for (var e = 0; e < 5; e++) {
      var q = cyc(t, 2.6, e / 5), dir = e % 2 ? -1 : 1, xq = dir > 0 ? lerp(w * 0.22, w * 0.78, q) : lerp(w * 0.78, w * 0.22, q);
      var yq = h * 0.62 - Math.sin(PI * q) * h * 0.22 + (e % 2) * h * 0.08;
      ctx.save(); ctx.translate(xq, yq); ctx.rotate(0.15 * Math.sin(t * 3 + e));
      var ew = 34 * s, eh = 22 * s;
      ctx.fillStyle = '#f2efe6'; ctx.fillRect(-ew / 2, -eh / 2, ew, eh); ctx.strokeStyle = '#9b8f7a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-ew / 2, -eh / 2); ctx.lineTo(0, 2 * s); ctx.lineTo(ew / 2, -eh / 2); ctx.stroke();
      ctx.restore();
    }
    // the thread counter as stacked bubbles
    var nmsg = 1 + Math.floor(cyc(t, 12) * 30);
    var bx = w * 0.5, bty = h * 0.12;
    bubble(ctx, U, bx, bty + 8 * s, 'as discussed', { size: 13, bg: hexA(col, 0.9), col: '#1a0f19' });
    text(ctx, nmsg + ' messages', bx, bty + 36 * s, U.f(12), '#ffffff', 'center', '700');
    text(ctx, '+z ?', w * 0.5, h * 0.88, U.f(18), '#ffc46b', 'center', '800');
  };
  // 6 Domestic: your own bench, late, a rotation mount set from memory
  CATSCENE[6] = function (ctx, U, w, h, t, s, col) {
    ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, w, h);
    var lx = w * 0.3, ly = h * 0.08;
    var g = ctx.createRadialGradient(lx, ly, 0, w * 0.45, h * 0.75, h * 0.9); g.addColorStop(0, 'rgba(255,220,140,0.55)'); g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx - 20 * s, ly); ctx.lineTo(lx + 20 * s, ly); ctx.lineTo(w * 0.95, h); ctx.lineTo(w * 0.0, h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a2d33'; ctx.fillRect(lx - 26 * s, ly - 10 * s, 52 * s, 16 * s);
    // breadboard
    ctx.fillStyle = '#1c1f24'; ctx.fillRect(0, h * 0.72, w, h * 0.28);
    for (var i = 0; i < 20; i++) for (var j = 0; j < 4; j++) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(w * (i + 0.5) / 20, h * (0.76 + j * 0.06), 2.2 * s, 0, TAU); ctx.fill(); }
    // rotation mount
    var cx = w * 0.5, cy = h * 0.47, R = Math.min(w, h) * 0.24;
    ctx.fillStyle = '#2e3238'; ctx.fillRect(cx - R * 0.25, cy, R * 0.5, h * 0.72 - cy);
    var gm = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R); gm.addColorStop(0, '#5b6068'); gm.addColorStop(1, '#2a2e33');
    ctx.fillStyle = gm; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    var ang = 0.6 * Math.sin(t * 0.7) + 0.25 * Math.sin(t * 1.9);   // never quite settles
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    for (var k = 0; k < 72; k++) { var a = k * TAU / 72, r0 = R * (k % 6 ? 0.86 : 0.78); line(ctx, Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, 'rgba(230,235,240,0.7)', 1); }
    ctx.fillStyle = '#0b0c0e'; ctx.beginPath(); ctx.arc(0, 0, R * 0.42, 0, TAU); ctx.fill();
    ctx.restore();
    glow(ctx, cx, cy, R * 0.18, P.light, 0.9);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(cx, cy - R * 1.08); ctx.lineTo(cx - 6 * s, cy - R * 1.22); ctx.lineTo(cx + 6 * s, cy - R * 1.22); ctx.closePath(); ctx.fill();
    // sticky note
    ctx.save(); ctx.translate(w * 0.8, h * 0.3); ctx.rotate(0.08); ctx.fillStyle = col; ctx.fillRect(-36 * s, -30 * s, 72 * s, 60 * s);
    text(ctx, 'TE?', 0, 0, U.f(18), '#3a2f05', 'center', '800'); ctx.restore();
  };
  // 7 Quid pro quo: the scale will not take the trade
  CATSCENE[7] = function (ctx, U, w, h, t, s, col) {
    bg(ctx, U, '#2b1d16', '#080504');
    var cx = w / 2, top = h * 0.2, base = h * 0.86, R = Math.min(w * 0.36, h * 0.42);
    var u = cyc(t, 7), tilt = 0.32 * es(u, 0.1, 0.35) - 0.32 * es(u, 0.45, 0.6) * 1.0 + 0.04 * Math.sin(t * 5) * seg(u, 0.6, 0.7) * (1 - seg(u, 0.7, 0.8));
    ctx.fillStyle = '#6d5536'; ctx.fillRect(cx - 6 * s, top, 12 * s, base - top); ctx.fillRect(cx - R * 0.4, base, R * 0.8, 10 * s);
    ctx.save(); ctx.translate(cx, top); ctx.rotate(tilt); ctx.fillStyle = '#c99a40'; ctx.fillRect(-R, -5 * s, 2 * R, 10 * s); ctx.restore();
    ctx.fillStyle = '#efcb72'; ctx.beginPath(); ctx.arc(cx, top, 10 * s, 0, TAU); ctx.fill();
    [-1, 1].forEach(function (sg) {
      var ex = cx + sg * R * Math.cos(tilt), ey = top + sg * R * Math.sin(tilt), py = ey + R * 0.6;
      line(ctx, ex, ey, ex - R * 0.25, py, 'rgba(239,203,114,0.7)', 1.5 * s); line(ctx, ex, ey, ex + R * 0.25, py, 'rgba(239,203,114,0.7)', 1.5 * s);
      ctx.fillStyle = '#c99a40'; ctx.beginPath(); ctx.ellipse(ex, py, R * 0.32, R * 0.07, 0, 0, TAU); ctx.fill();
      if (sg < 0) {   // a tool-time ticket
        ctx.save(); ctx.translate(ex, py - R * 0.16); ctx.rotate(-0.1); ctx.fillStyle = '#7ec8ff'; ctx.fillRect(-R * 0.22, -R * 0.12, R * 0.44, R * 0.22);
        text(ctx, 'slot', 0, -R * 0.01, U.f(12), '#0d2236', 'center', '800'); ctx.restore();
      } else {         // the check itself (a clipboard)
        ctx.save(); ctx.translate(ex, py - R * 0.22); ctx.fillStyle = '#8a6a44'; ctx.fillRect(-R * 0.16, -R * 0.22, R * 0.32, R * 0.42); ctx.fillStyle = '#f4f1e8'; ctx.fillRect(-R * 0.13, -R * 0.17, R * 0.26, R * 0.34);
        ctx.strokeStyle = P.ok; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(-R * 0.07, 0); ctx.lineTo(-R * 0.01, R * 0.06); ctx.lineTo(R * 0.09, -R * 0.08); ctx.stroke(); ctx.restore();
      }
    });
    stamp(ctx, U, 'NO TRADE', C.red, (u - 0.6) / 0.3, cx, h * 0.55, 26, -0.15);
  };
  // 8 Hostile crystal environment: a hot plate with no ramp, sparks, cracks
  CATSCENE[8] = function (ctx, U, w, h, t, s, col) {
    var u = cyc(t, 6);
    bg(ctx, U, '#3a1510', '#080202', 0.5, 0.8);
    var hx = w * 0.12, hw = w * 0.76, hy = h * 0.68, heat = u < 0.1 ? u / 0.1 : 1;
    var gh = ctx.createLinearGradient(0, hy, 0, hy + h * 0.1); gh.addColorStop(0, mix('#585c63', '#ff5a1e', heat)); gh.addColorStop(1, '#2b2d31');
    ctx.fillStyle = gh; ctx.fillRect(hx, hy, hw, h * 0.1);
    ctx.fillStyle = '#1d1f22'; ctx.fillRect(hx + hw * 0.05, hy + h * 0.1, hw * 0.9, h * 0.12);
    // temperature trace: a step, no ramp
    var px = w * 0.62, py = h * 0.08, pw = w * 0.32, ph = h * 0.2;
    box(ctx, px, py, pw, ph, 'rgba(10,6,6,0.8)', 'rgba(255,120,80,0.5)');
    ctx.strokeStyle = '#ff7a4f'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(px + 4 * s, py + ph * 0.85); ctx.lineTo(px + pw * 0.3, py + ph * 0.85); ctx.lineTo(px + pw * 0.3, py + ph * 0.15); ctx.lineTo(px + pw * 0.3 + (pw * 0.7 - 4 * s) * clamp(u * 3, 0, 1), py + ph * 0.15); ctx.stroke();
    text(ctx, 'T', px - 8 * s, py + ph * 0.15, U.f(12), '#ff9a7a', 'center', '800');
    // wafer on the plate (seen in perspective) with cracks spreading
    var wx = w * 0.42, wy = hy - 4 * s, wr = hw * 0.32;
    ctx.save(); ctx.translate(wx, wy); ctx.scale(1, 0.3); wafer(ctx, 0, 0, wr, PI / 2, { sheen: false, c0: '#d9cfe0', c1: '#b6a7c4', c2: '#cdbfd8' }); ctx.restore();
    var cr = es(u, 0.12, 0.5);
    ctx.strokeStyle = 'rgba(30,20,30,0.85)'; ctx.lineWidth = 1.4 * s;
    for (var c2 = 0; c2 < 5; c2++) { ctx.beginPath(); var x0 = wx + (rnd(c2) - 0.5) * wr * 0.6, y0 = wy; ctx.moveTo(x0, y0); for (var k = 1; k <= 6; k++) { var q = k / 6 * cr; ctx.lineTo(x0 + Math.cos(rnd(c2 + 5) * TAU) * wr * 0.8 * q + (rnd(c2 * 9 + k) - 0.5) * 10 * s, y0 + Math.sin(rnd(c2 + 5) * TAU) * wr * 0.24 * q); } ctx.stroke(); }
    // sparks
    for (var i = 0; i < 14; i++) {
      var q2 = cyc(t, 0.9, rnd(i)), a = -PI / 2 + (rnd(i + 3) - 0.5) * 2.2, d = q2 * h * 0.35;
      var sx = wx + (rnd(i + 11) - 0.5) * wr * 1.4, sy = wy;
      glow(ctx, sx + Math.cos(a) * d, sy + Math.sin(a) * d + q2 * q2 * h * 0.15, 6 * s, '#bfe3ff', (1 - q2) * (u > 0.12 ? 1 : 0));
    }
    // unmarked die box and a sheet of foil
    ctx.fillStyle = '#4a4f57'; ctx.fillRect(w * 0.05, hy - h * 0.16, w * 0.13, h * 0.12); text(ctx, '?', w * 0.115, hy - h * 0.1, U.f(20), '#ffffff', 'center', '800');
    var gf = ctx.createLinearGradient(w * 0.8, 0, w * 0.96, 0); gf.addColorStop(0, '#9aa0a8'); gf.addColorStop(0.5, '#e8ecf0'); gf.addColorStop(1, '#8a9098');
    ctx.fillStyle = gf; ctx.beginPath(); ctx.moveTo(w * 0.8, hy - h * 0.02); ctx.lineTo(w * 0.97, hy - h * 0.04); ctx.lineTo(w * 0.95, hy - h * 0.15); ctx.lineTo(w * 0.82, hy - h * 0.12); ctx.closePath(); ctx.fill();
  };

  // Prealigner: finds the flat, then turns the wafer to the recipe angle, written for another product
  A['fe.prealign'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 8, 0.05);
    bg(ctx, U, '#232016', '#07060a');
    ctx.fillStyle = 'rgba(255,190,40,0.08)'; ctx.fillRect(0, 0, w, h);
    var cx = w * 0.42, cy = h * 0.55, R = Math.min(w * 0.33, h * 0.38);
    // the wafer spins while the edge sensor searches, then turns to the recipe angle
    var search = es(u, 0.02, 0.35), turn = es(u, 0.42, 0.62);
    var fa = PI / 2 + 4.2 * TAU * search + (-PI / 2) * turn;   // ends with the flat at three o'clock
    // expected position for this x-cut product (ghost)
    ctx.save(); ctx.setLineDash([6 * s, 5 * s]); ctx.strokeStyle = 'rgba(126,224,138,0.8)'; ctx.lineWidth = 2 * s; waferPath(ctx, cx, cy, R, PI / 2); ctx.stroke(); ctx.restore();
    wafer(ctx, cx, cy, R, fa, { sheen: cyc(t, 3) });
    axes(ctx, U, cx, cy, fa - PI / 2, { len: 26 });
    // edge sensor
    var ex = cx + R * 1.02, ey = cy;
    ctx.fillStyle = '#2b2f36'; ctx.fillRect(ex, ey - 16 * s, 40 * s, 32 * s);
    var hit = Math.abs(Math.sin((fa - 0) / 2)) < 0.12 && u < 0.38;
    glow(ctx, ex + 4 * s, ey, 14 * s, hit ? '#ff5a4f' : '#ffb347', 0.8);
    // readout
    var ang = Math.round(90 * turn);
    var bx = w * 0.72, by = h * 0.1, bw = w * 0.25, bh = h * 0.22;
    box(ctx, bx, by, bw, bh, 'rgba(6,8,10,0.85)', 'rgba(255,190,40,0.6)', 1.5 * s);
    text(ctx, 'recipe', bx + bw / 2, by + bh * 0.28, U.f(11), '#ffd36e', 'center', '700');
    text(ctx, ang + '.0°', bx + bw / 2, by + bh * 0.66, U.f(20), '#ffffff', 'center', '800', 'middle', true);
    // exposure flash
    var fl = pulse(u, 0.7, 0.8); if (fl > 0) { ctx.fillStyle = 'rgba(190,140,255,' + (0.3 * fl).toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
    if (u > 0.8) text(ctx, 'exposed', cx, cy + R + 16 * s, U.f(13), P.bad, 'center', '800');
  };

  // Simulation frame swap: crystal z placed on the solver z (the film normal) turns x-cut into z-cut
  A['fe.frameSwap'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 8, 0.1);
    bg(ctx, U, '#1a1830', '#05050a');
    var f = es(u, 0.3, 0.5) * (1 - es(u, 0.88, 0.98));   // 0 = z in plane (x-cut), 1 = z on the normal
    var k = Math.min(w * 0.33, h * 0.38), pr = proj3(U, w * 0.5, h * 0.72, k, 0.55 + t * 0.15, 0.45);
    slab3(ctx, U, pr, { light: cyc(t, 2), te: false });
    // ellipsoid: short semi-axis along crystal z, which swings from in-plane (y-z plane) to the normal x
    var no = 0.42, ne = 0.42 * 0.72, X0 = 0.85, a = f * PI / 2;
    var zx = Math.sin(a), zz = Math.cos(a);   // crystal z direction expressed in the solver (film) frame
    var pts = [];
    for (var i = 0; i < 16; i++) for (var j = 0; j <= 10; j++) {
      var th = i * TAU / 16, pp = -PI / 2 + j * PI / 10;
      var e1 = no * Math.cos(pp) * Math.cos(th), e2 = ne * Math.cos(pp) * Math.sin(th), e3 = no * Math.sin(pp);   // along y, along crystal z, along the third axis
      // third axis is perpendicular to y and crystal z
      var tx = Math.cos(a), tz = -Math.sin(a);
      pts.push(pr(X0 + e2 * zx + e3 * tx, e1, e2 * zz + e3 * tz));
    }
    var c0 = pr(X0, 0, 0), g = ctx.createRadialGradient(c0[0] - k * 0.1, c0[1] - k * 0.15, k * 0.05, c0[0], c0[1], k * 0.5);
    g.addColorStop(0, 'rgba(230,215,255,0.85)'); g.addColorStop(1, f > 0.5 ? 'rgba(200,60,90,0.5)' : 'rgba(90,60,170,0.5)');
    ctx.fillStyle = g; poly(ctx, hull(pts)); ctx.fill();
    var z0 = pr(X0, 0, 0), z1 = pr(X0 + zx * 0.7, 0, zz * 0.7);
    arrow(ctx, z0[0], z0[1], z1[0], z1[1], C.zAx, 3 * s, 10 * s);
    text(ctx, 'crystal z', z1[0] + 10 * s, z1[1] - 8 * s, U.f(12), C.zAx, 'left', '700');
    // solver axes in the corner
    var ox = w * 0.1, oy = h * 0.3;
    arrow(ctx, ox, oy, ox, oy - 40 * s, '#ffffff', 2 * s, 7 * s); text(ctx, 'solver z', ox + 6 * s, oy - 44 * s, U.f(11), '#ffffff', 'left', '600');
    text(ctx, f > 0.5 ? 'z-cut' : 'x-cut', w * 0.88, h * 0.1, U.f(18), f > 0.5 ? P.bad : P.ok, 'center', '800');
  };

  // The deck went out to three groups; a correction follows every copy
  A['fe.deckSent'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 8, 0.05);
    bg(ctx, U, '#1a2030', '#05060a'); dots(ctx, U, 22);
    var dx = w * 0.2, dy = h * 0.5, dw = Math.min(w * 0.28, h * 0.42), dh = dw * 0.62;
    for (var l = 2; l >= 0; l--) { box(ctx, dx - dw / 2 + l * 5 * s, dy - dh / 2 - l * 5 * s, dw, dh, l ? '#2a3140' : '#eef1f5', 'rgba(255,255,255,0.3)'); }
    // slide content: a mode plot and a title bar
    ctx.fillStyle = '#3f5d8a'; ctx.fillRect(dx - dw / 2, dy - dh / 2, dw, dh * 0.16);
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2 * s; ctx.beginPath(); for (var i = 0; i <= 30; i++) { var xx = dx - dw * 0.4 + dw * 0.8 * i / 30, yy = dy + dh * 0.25 - dh * 0.45 * Math.exp(-Math.pow((i - 15) / 6, 2)); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke();
    var groups = [[w * 0.82, h * 0.2], [w * 0.86, h * 0.5], [w * 0.82, h * 0.8]];
    groups.forEach(function (g, gi) {
      for (var p = 0; p < 4; p++) { var a = p * TAU / 4 + gi; ctx.fillStyle = CATS[gi * 2 + 1].col; ctx.beginPath(); ctx.arc(g[0] + Math.cos(a) * 14 * s, g[1] + Math.sin(a) * 10 * s, 6 * s, 0, TAU); ctx.fill(); }
      [[0.05, '#f2efe6'], [0.45, C.red]].forEach(function (e, ei) {
        var q = seg(u, e[0] + gi * 0.05, e[0] + gi * 0.05 + 0.25); if (q <= 0 || q >= 1) return;
        var x = lerp(dx + dw * 0.5, g[0] - 24 * s, ease(q)), y = lerp(dy, g[1], ease(q)) - Math.sin(PI * q) * 30 * s;
        ctx.fillStyle = e[1]; ctx.fillRect(x - 13 * s, y - 9 * s, 26 * s, 18 * s);
        ctx.strokeStyle = ei ? '#ffffff' : '#9b8f7a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 13 * s, y - 9 * s); ctx.lineTo(x, y + 1 * s); ctx.lineTo(x + 13 * s, y - 9 * s); ctx.stroke();
        if (ei) glow(ctx, x, y, 20 * s, C.red, 0.4);
      });
      if (u > 0.75 + gi * 0.03) { ctx.strokeStyle = P.ok; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(g[0] + 22 * s, g[1] - 4 * s); ctx.lineTo(g[0] + 27 * s, g[1] + 2 * s); ctx.lineTo(g[0] + 37 * s, g[1] - 10 * s); ctx.stroke(); }
    });
    if (u > 0.4) text(ctx, 'x-cut', dx, dy - dh / 2 - 26 * s, U.f(15), P.bad, 'center', '800');
    if (u > 0.4) { ctx.strokeStyle = P.bad; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(dx - 26 * s, dy - dh / 2 - 26 * s); ctx.lineTo(dx + 26 * s, dy - dh / 2 - 26 * s); ctx.stroke(); }
  };

  // Who knows your axes: six tools turn exactly to their command; the traveler and you hold the crystal frame
  A['fe.sortTools'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#1c2230', '#05060a');
    var names = ['spin coater', 'prealigner', 'theta stage', 'pick-and-place', 'mode solver', 'gel-pak'];
    var cols = 3, rows = 2, tw = w * 0.6 / cols, th = h * 0.8 / rows;
    names.forEach(function (n, i) {
      var cx = w * 0.04 + tw * (i % cols + 0.5), cy = h * 0.1 + th * (Math.floor(i / cols) + 0.45);
      var T = 3, k = Math.floor(t / T + i * 0.37), cmd = Math.floor(rnd(k * 13 + i) * 8) * 45, prv = Math.floor(rnd((k - 1) * 13 + i) * 8) * 45;
      var q = es(cyc(t + i * 0.37 * T, T), 0.15, 0.55), a = lerp(prv, cmd, q);
      box(ctx, cx - tw * 0.45, cy - th * 0.42, tw * 0.9, th * 0.84, 'rgba(10,14,19,0.7)', 'rgba(95,208,255,0.35)');
      die(ctx, cx, cy - th * 0.04, Math.min(tw, th) * 0.48, -a * PI / 180, {});
      text(ctx, n, cx, cy + th * 0.3, U.f(10), P.inkDim, 'center', '600');
      text(ctx, Math.round(cmd) + '°', cx + tw * 0.33, cy - th * 0.3, U.f(10), '#5fd0ff', 'right', '700', 'middle', true);
    });
    // traveler and you
    var px = w * 0.7, pw = w * 0.26;
    ctx.save(); ctx.translate(px + pw / 2, h * 0.3); ctx.rotate(0.04);
    box(ctx, -pw * 0.42, -h * 0.17, pw * 0.84, h * 0.34, C.paper);
    for (var l = 0; l < 4; l++) ctx.fillStyle = 'rgba(43,47,54,0.3)', ctx.fillRect(-pw * 0.34, -h * 0.12 + l * h * 0.05, pw * (0.5 - 0.1 * rnd(l)), 3 * s);
    axes(ctx, U, -pw * 0.1, h * 0.1, 0, { len: 18, size: 10 });
    ctx.restore();
    figure(ctx, px + pw / 2, h * 0.78, Math.min(w, h) / 360 * 0.42, {});
    glow(ctx, px + pw / 2, h * 0.66, 36 * s, '#7ee08a', 0.25 + 0.15 * Math.sin(t * 3));
    text(ctx, 'you', px + pw / 2, h * 0.95, U.f(12), '#7ee08a', 'center', '800');
  };

  // Two suppliers, two flats: the same mask lands along y on one and along z on the other
  A['fe.twoFlats'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 7, 0.05);
    bg(ctx, U, '#2a2214', '#070604');
    var wide = w / h > 1.1, R = wide ? Math.min(w * 0.2, h * 0.32) : Math.min(w * 0.3, h * 0.2);
    var down = es(u, 0.15, 0.45);
    ['old supplier', 'new supplier'].forEach(function (n, i) {
      var cx = wide ? w * (0.27 + 0.46 * i) : w * 0.5, cy = wide ? h * 0.56 : h * (0.3 + 0.44 * i);
      var zrot = i ? -PI / 2 : 0;   // crystal z relative to the flat differs between datasheets
      wafer(ctx, cx, cy, R, PI / 2, { sheen: cyc(t, 4, i * 0.3) });
      axes(ctx, U, cx - R * 0.45, cy + R * 0.2, zrot, { len: 22, size: 11 });
      // the mask drops onto the wafer, aligned to the flat, waveguides horizontal
      ctx.save(); ctx.globalAlpha = 0.25 + 0.75 * down; var my = lerp(cy - R * 1.6, cy, down);
      ctx.strokeStyle = 'rgba(120,200,160,0.95)'; ctx.lineWidth = 2 * s; ctx.strokeRect(cx - R * 0.75, my - R * 0.75, R * 1.5, R * 1.5);
      for (var l = -2; l <= 2; l++) line(ctx, cx - R * 0.7, my + l * R * 0.25, cx + R * 0.7, my + l * R * 0.25, 'rgba(120,200,160,0.95)', 2 * s);
      ctx.restore();
      text(ctx, n, cx, wide ? h * 0.12 : cy - R * 1.15, U.f(13), '#ffd38a', 'center', '700');
      if (u > 0.5) text(ctx, i ? 'along z' : 'along y', cx, cy + R + 14 * s, U.f(13), i ? P.bad : P.ok, 'center', '800');
    });
  };

  // Shared gel-pak: one die picked, carried, set down turned around
  A['fe.diePick'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 6, 0.05);
    bg(ctx, U, '#1f242a', '#060708');
    var gx = w * 0.05, gy = h * 0.2, gw = w * 0.42, gh = h * 0.6, nx = 3, ny = 3, ds = Math.min(gw / nx, gh / ny) * 0.72;
    ctx.fillStyle = '#4a5a66'; ctx.fillRect(gx, gy, gw, gh);
    for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) {
      if (i === 1 && j === 1 && u > 0.15) continue;
      die(ctx, gx + gw * (i + 0.5) / nx, gy + gh * (j + 0.5) / ny, ds, Math.floor(rnd(i * 3 + j) * 4) * PI / 2, {});
    }
    // chuck on the right
    var cx = w * 0.76, cy = h * 0.5, cr = Math.min(w * 0.2, h * 0.3);
    var gc = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr); gc.addColorStop(0, '#73777e'); gc.addColorStop(1, '#3a3d42');
    ctx.fillStyle = gc; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill();
    // expected orientation as a ghost on the chuck
    ctx.save(); ctx.setLineDash([5 * s, 4 * s]); ctx.strokeStyle = 'rgba(126,224,138,0.8)'; ctx.lineWidth = 2 * s; ctx.strokeRect(cx - ds * 0.8, cy - ds * 0.5, ds * 1.6, ds); ctx.restore();
    var x0 = gx + gw / 2, y0 = gy + gh / 2, q = es(u, 0.15, 0.5);
    var x = lerp(x0, cx, q), y = lerp(y0, cy, q) - Math.sin(PI * q) * h * 0.18, rot = Math.floor(rnd(4) * 4) * PI / 2;
    var sz = lerp(ds, ds * 1.6, q);
    die(ctx, x, y, sz, PI, { mark: 0, light: u > 0.55 ? cyc(t, 1.6) : null });
    if (u > 0.5) { axes(ctx, U, cx, cy + cr * 0.72, PI, { len: 20, size: 11 }); var fl = 0.5 + 0.5 * Math.sin(t * 6); glow(ctx, cx, cy, cr * 0.9, P.bad, 0.25 * fl); }
    // tweezers
    if (u < 0.55) tweezers(ctx, x + sz * 0.3, y - sz * 0.25, s, q);
  };
  function tweezers(ctx, x, y, s, q) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.7);
    [-1, 1].forEach(function (sg) { ctx.fillStyle = '#c9ced6'; ctx.beginPath(); ctx.moveTo(0, sg * 2 * s); ctx.lineTo(150 * s, sg * 9 * s); ctx.lineTo(150 * s, sg * 3 * s); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); });
    ctx.restore();
  }

  // You are the bystander: a coworker at the probe station loads dies from the unmarked gel-pak
  A['fe.bystander'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#1a2026', '#040506', 0.6, 0.4);
    // bench and microscope
    ctx.fillStyle = '#23272d'; ctx.fillRect(0, h * 0.66, w, h * 0.34);
    var mx = w * 0.64, my = h * 0.66;
    ctx.fillStyle = '#3b4048'; ctx.fillRect(mx - 50 * s, my - 18 * s, 100 * s, 18 * s); ctx.fillRect(mx + 30 * s, my - 150 * s, 18 * s, 140 * s);
    ctx.fillStyle = '#4a5059'; ctx.save(); ctx.translate(mx + 10 * s, my - 120 * s); ctx.rotate(-0.4); ctx.fillRect(-14 * s, -45 * s, 28 * s, 90 * s); ctx.restore();
    // monitor showing the loaded die
    var vx = w * 0.82, vy = h * 0.22, vw = w * 0.16, vh = vw * 0.7;
    box(ctx, vx - vw / 2, vy - vh / 2, vw, vh, '#0a0c10', '#4a5059', 2 * s);
    die(ctx, vx, vy, vw * 0.7, PI * (Math.floor(t / 3) % 2), {});
    text(ctx, '?', vx + vw * 0.36, vy - vh * 0.32, U.f(14), '#ffd84d', 'center', '800');
    // coworker from behind, hands moving
    figure(ctx, w * 0.56, h * 0.6, Math.min(w, h) / 360 * 0.6, {});
    // you, out of focus in the foreground
    ctx.save(); if ('filter' in ctx) ctx.filter = 'blur(' + Math.round(3 * s) + 'px)';
    figure(ctx, w * 0.16, h * 0.95, Math.min(w, h) / 360 * 1.0, { col: '#cfd6de', shade: '#8995a1' });
    ctx.restore();
    if ('filter' in ctx) ctx.filter = 'none';
    // thought: a die without a mark
    var bx = w * 0.3, by = h * 0.22, pz = 0.5 + 0.5 * Math.sin(t * 2);
    [[w * 0.2, h * 0.52, 4], [w * 0.24, h * 0.42, 6]].forEach(function (d) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(d[0], d[1], d[2] * s, 0, TAU); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.ellipse(bx, by, 62 * s, 40 * s, 0, 0, TAU); ctx.fill();
    die(ctx, bx - 8 * s, by, 56 * s, 0.25 * Math.sin(t), {});
    text(ctx, '?', bx + 38 * s, by - 6 * s, U.f(24), hexA('#e0524c', 0.6 + 0.4 * pz), 'center', '800');
  };

  // Sorting bins for the categories. params: { set: 1 | 2 }
  A['fe.sortBins'] = function (ctx, w, h, t, p) {
    var set = (p && p.set) || 1, U = units(w, h), s = U.s;
    bg(ctx, U, '#1c1f2c', '#05060a');
    var cs = CATS.slice((set - 1) * 4, set * 4), n = 4, bw = w / n;
    cs.forEach(function (c, i) {
      var x = bw * (i + 0.5), y = h * 0.78, r = Math.min(bw * 0.38, h * 0.16);
      // bin
      ctx.fillStyle = hexA(c.col, 0.18); ctx.beginPath(); ctx.moveTo(x - r * 1.1, y - r * 0.6); ctx.lineTo(x + r * 1.1, y - r * 0.6); ctx.lineTo(x + r * 0.85, y + r * 0.9); ctx.lineTo(x - r * 0.85, y + r * 0.9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = c.col; ctx.lineWidth = 2 * s; ctx.stroke();
      catIcon(ctx, c.key, x, y + r * 0.15, r * 0.5, c.col, t);
      // cards falling into this bin, staggered
      for (var k = 0; k < 2; k++) {
        var q = cyc(t, 4, (i * 2 + k) / 8);
        var fall = es(q, 0, 0.6), cx = lerp(w * 0.5 + (rnd(i * 2 + k) - 0.5) * w * 0.3, x, fall), cy = lerp(h * 0.08, y - r * 0.5, fall * fall);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate((1 - fall) * (rnd(k + i * 5) - 0.5) * 1.6);
        ctx.globalAlpha = 1 - seg(q, 0.62, 0.75);
        box(ctx, -24 * s, -15 * s, 48 * s, 30 * s, '#f1ece1', c.col, 2 * s);
        for (var l = 0; l < 3; l++) ctx.fillStyle = 'rgba(43,47,54,0.4)', ctx.fillRect(-18 * s, -9 * s + l * 7 * s, (28 - 8 * rnd(l + k)) * s, 3 * s);
        ctx.restore();
        if (q > 0.6 && q < 0.75) glow(ctx, x, y - r * 0.5, r * 1.2, c.col, 0.6 * (1 - seg(q, 0.6, 0.75)));
      }
    });
  };

  // Top view versus through the substrate: plus 45 becomes minus 45
  A['fe.mirrorView'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 8, 0.05);
    bg(ctx, U, '#2a1a2a', '#070407');
    var flip = es(u, 0.25, 0.45) * (1 - es(u, 0.8, 0.95)), sx = Math.cos(PI * flip);
    var cx = w * 0.5, cy = h * 0.5, R = Math.min(w * 0.36, h * 0.4);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sx === 0 ? 0.001 : sx, 1);
    // die body: top side (film) or back side (substrate) depending on the flip
    var back = sx < 0;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-R + 6 * s, -R * 0.7 + 8 * s, 2 * R, 1.4 * R);
    ctx.fillStyle = back ? '#3d4148' : P.film; ctx.fillRect(-R, -R * 0.7, 2 * R, 1.4 * R);
    // waveguide at +45 degrees (seen from the top), ring of the reference arc
    ctx.strokeStyle = back ? 'rgba(139,171,154,0.55)' : P.slab; ctx.lineWidth = 6 * s;
    ctx.beginPath(); ctx.moveTo(-R * 0.6, R * 0.5); ctx.lineTo(R * 0.6, -R * 0.5); ctx.stroke();
    line(ctx, -R * 0.6, R * 0.5, R * 0.8, R * 0.5, 'rgba(255,255,255,0.5)', 1.5 * s, [5 * s, 4 * s]);
    ctx.strokeStyle = '#ffc46b'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.arc(-R * 0.6, R * 0.5, R * 0.55, -0.69, 0); ctx.stroke();
    glow(ctx, lerp(-R * 0.6, R * 0.6, cyc(t, 1.6)), lerp(R * 0.5, -R * 0.5, cyc(t, 1.6)), 14 * s, P.light, back ? 0.5 : 0.95);
    ctx.restore();
    var lab = sx >= 0 ? '+45°' : '−45°';
    text(ctx, lab, cx + (sx >= 0 ? 1 : -1) * R * 0.2 * Math.abs(sx), cy + R * 0.2, U.f(22), '#ffc46b', 'center', '800');
    text(ctx, sx >= 0 ? 'top view' : 'through the substrate', cx, h * 0.08, U.f(15), sx >= 0 ? '#ffffff' : '#ff7ad9', 'center', '800');
    // eye showing the viewing side
    var ey = sx >= 0 ? h * 0.92 : h * 0.92, eyc = sx >= 0 ? '#ffffff' : '#ff7ad9';
    ctx.strokeStyle = eyc; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.ellipse(w * 0.9, ey - 6 * s, 16 * s, 9 * s, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = eyc; ctx.beginPath(); ctx.arc(w * 0.9, ey - 6 * s, 4 * s, 0, TAU); ctx.fill();
  };

  // Your own die mark, on the wrong corner
  A['fe.dieMark'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 6, 0.05);
    bg(ctx, U, '#2a2610', '#070604');
    var cx = w * 0.46, cy = h * 0.52, S = Math.min(w * 0.62, h * 1.0);
    die(ctx, cx, cy, S, 0, { light: cyc(t, 2) });
    var hw = S / 2, hh = S * 0.31;
    // intended corner (top left, ghost) and the drawn one (bottom right)
    ctx.save(); ctx.setLineDash([4 * s, 4 * s]); ctx.strokeStyle = '#7ee08a'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.arc(cx - hw * 0.84, cy - hh * 0.78, S * 0.05, 0, TAU); ctx.stroke(); ctx.restore();
    var dq = es(u, 0.15, 0.4), mx = cx + hw * 0.84, my = cy + hh * 0.78;
    if (dq > 0) { ctx.fillStyle = '#e23b3b'; ctx.beginPath(); ctx.arc(mx, my, S * 0.04 * dq, 0, TAU); ctx.fill(); }
    // marker pen
    var pq = u < 0.45 ? 1 : 1 - es(u, 0.45, 0.6), px = mx + 8 * s + (1 - pq) * 80 * s, py = my - 8 * s - (1 - pq) * 60 * s;
    ctx.save(); ctx.translate(px, py); ctx.rotate(-0.8 + 0.1 * Math.sin(t * 9) * (u < 0.4 ? 1 : 0));
    ctx.fillStyle = '#e23b3b'; ctx.fillRect(-6 * s, -6 * s, 14 * s, 12 * s); ctx.fillStyle = '#1d1f23'; ctx.fillRect(8 * s, -9 * s, 120 * s, 18 * s); ctx.fillStyle = '#e23b3b'; ctx.fillRect(100 * s, -9 * s, 28 * s, 18 * s);
    ctx.restore();
    if (u > 0.6) { var pz = 0.5 + 0.5 * Math.sin(t * 7); glow(ctx, mx, my, S * 0.12, P.bad, 0.4 * pz); }
  };

  // Notebook: an angle written as seen through the substrate, and the viewing-direction sketch that fixes it
  A['fe.notebook'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 9, 0.05);
    bg(ctx, U, '#231d14', '#060504');
    var nw = Math.min(w * 0.9, h * 1.25), nh = nw * 0.66, nx = w / 2 - nw / 2, ny = h / 2 - nh / 2;
    ctx.fillStyle = '#3b2a1c'; ctx.fillRect(nx - 8 * s, ny - 8 * s, nw + 16 * s, nh + 16 * s);
    [0, 1].forEach(function (i) {
      var px = nx + i * nw / 2;
      ctx.fillStyle = i ? '#f3efe2' : '#efe9da'; ctx.fillRect(px, ny, nw / 2, nh);
      ctx.strokeStyle = 'rgba(90,140,200,0.25)'; ctx.lineWidth = 1;
      for (var g = 1; g < 14; g++) { ctx.beginPath(); ctx.moveTo(px, ny + nh * g / 14); ctx.lineTo(px + nw / 2, ny + nh * g / 14); ctx.stroke(); }
    });
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(nx + nw / 2 - 2 * s, ny, 4 * s, nh);
    // left page: the sketch, an angle written in ink
    var cx = nx + nw * 0.25, cy = ny + nh * 0.5, R = nw * 0.16, mir = es(u, 0.35, 0.55);
    ctx.save(); ctx.strokeStyle = '#1b2f6b'; ctx.lineWidth = 2 * s; ctx.strokeRect(cx - R, cy - R * 0.6, 2 * R, 1.2 * R);
    var a = 0.52 * (1 - 2 * mir);
    ctx.beginPath(); ctx.moveTo(cx - R * 0.7, cy); ctx.lineTo(cx - R * 0.7 + Math.cos(a) * R * 1.4, cy - Math.sin(a) * R * 1.4); ctx.stroke();
    ctx.setLineDash([3 * s, 3 * s]); ctx.beginPath(); ctx.moveTo(cx - R * 0.7, cy); ctx.lineTo(cx + R * 0.8, cy); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(cx - R * 0.7, cy, R * 0.6, -Math.max(a, 0), -Math.min(a, 0)); ctx.stroke();
    ctx.restore();
    text(ctx, mir < 0.5 ? '+30°' : '−30°', cx + R * 0.15, cy + (mir < 0.5 ? -R * 0.85 : R * 0.85), U.f(16), mir < 0.5 ? '#1b2f6b' : C.red, 'center', '800');
    // right page: the viewing direction sketch appears (eye above or below the film)
    var rx = nx + nw * 0.75, ry = ny + nh * 0.5, q = es(u, 0.6, 0.8);
    ctx.save(); ctx.globalAlpha = q; ctx.strokeStyle = '#1b2f6b'; ctx.lineWidth = 2 * s;
    ctx.fillStyle = '#b49ad8'; ctx.fillRect(rx - R, ry - 4 * s, 2 * R, 8 * s); ctx.fillStyle = '#9aa0a8'; ctx.fillRect(rx - R, ry + 4 * s, 2 * R, 22 * s);
    arrow(ctx, rx, ry - R * 0.95, rx, ry - 10 * s, '#1b2f6b', 2 * s, 8 * s);
    ctx.beginPath(); ctx.ellipse(rx, ry - R * 1.1, 13 * s, 7 * s, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = '#1b2f6b'; ctx.beginPath(); ctx.arc(rx, ry - R * 1.1, 3 * s, 0, TAU); ctx.fill();
    text(ctx, 'viewed from the film side', rx, ry + R * 0.9, U.f(10), '#1b2f6b', 'center', '600');
    ctx.restore();
  };

  // Quid pro quo: the stepper slot moves across the calendar, and a check is signed that never happened
  A['fe.trade'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 8, 0.05);
    bg(ctx, U, '#221a24', '#060407');
    var cx0 = w * 0.06, cw = w * 0.52, cy0 = h * 0.12, chh = h * 0.76, cols = 2, rows = 6;
    box(ctx, cx0, cy0, cw, chh, '#11141a', 'rgba(255,255,255,0.18)');
    ['Gary', 'coworker'].forEach(function (n, i) { text(ctx, n, cx0 + cw * (i + 0.5) / cols, cy0 + 12 * s, U.f(11), P.inkDim, 'center', '700'); });
    for (var r = 1; r < rows; r++) line(ctx, cx0, cy0 + chh * r / rows, cx0 + cw, cy0 + chh * r / rows, 'rgba(255,255,255,0.08)', 1);
    line(ctx, cx0 + cw / 2, cy0, cx0 + cw / 2, cy0 + chh, 'rgba(255,255,255,0.12)', 1);
    var q = es(u, 0.15, 0.4), sx = lerp(cx0 + 6 * s, cx0 + cw / 2 + 6 * s, q), sy = cy0 + chh * 2 / rows + 4 * s;
    box(ctx, sx, sy, cw / 2 - 12 * s, chh / rows * 1.6, '#3f7bd1', '#9fd2ff', 1.5 * s);
    text(ctx, 'stepper', sx + 8 * s, sy + 14 * s, U.f(12), '#ffffff', 'left', '800');
    // checklist: the box ticks itself without a microscope
    var lx = w * 0.64, ly = h * 0.3, lw = w * 0.32;
    box(ctx, lx, ly - 20 * s, lw, 120 * s, C.paper);
    text(ctx, 'flat check', lx + 40 * s, ly + 6 * s, U.f(13), C.ink, 'left', '700');
    box(ctx, lx + 12 * s, ly - 4 * s, 20 * s, 20 * s, null, C.ink, 2 * s);
    var tk = es(u, 0.45, 0.55);
    if (tk > 0) { ctx.strokeStyle = '#1b2f6b'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(lx + 15 * s, ly + 6 * s); ctx.lineTo(lx + 15 * s + 6 * s * Math.min(1, tk * 2), ly + 6 * s + 6 * s * Math.min(1, tk * 2)); if (tk > 0.5) ctx.lineTo(lx + 21 * s + 12 * s * (tk - 0.5) * 2, ly + 12 * s - 18 * s * (tk - 0.5) * 2); ctx.stroke(); }
    stamp(ctx, U, 'VOID', C.red, (u - 0.62) / 0.3, lx + lw / 2, ly + 40 * s, 26, -0.25);
  };

  // New hire, first week: three pinned photos of what they found
  A['fe.newHire'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    var g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#8a6a44'); g.addColorStop(1, '#5e4530'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (var d = 0; d < 300; d++) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(rnd(d) * w, rnd(d + 999) * h, 2, 2); }
    var wide = w / h > 1.1, pw = wide ? w * 0.29 : w * 0.42, ph = pw * 1.05;
    var spots = wide ? [[0.18, 0.5, -0.08], [0.5, 0.45, 0.05], [0.82, 0.52, -0.04]] : [[0.27, 0.3, -0.08], [0.73, 0.32, 0.06], [0.5, 0.72, -0.03]];
    spots.forEach(function (sp, i) {
      var x = w * sp[0], y = h * sp[1], wob = sp[2] + 0.02 * Math.sin(t * 1.3 + i);
      ctx.save(); ctx.translate(x, y); ctx.rotate(wob);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-pw / 2 + 4 * s, -ph / 2 + 5 * s, pw, ph);
      ctx.fillStyle = '#f7f7f2'; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      var iw = pw * 0.86, ix = -iw / 2, iy = -ph / 2 + pw * 0.07;
      ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, iw); ctx.clip();
      ctx.fillStyle = '#1b1d21'; ctx.fillRect(ix, iy, iw, iw);
      var cx = ix + iw / 2, cy = iy + iw / 2, uu = cyc(t, 3, i * 0.3);
      if (i === 0) {   // wafer crackling off the hot plate
        wafer(ctx, cx, cy, iw * 0.38, PI / 2, { sheen: false });
        ctx.strokeStyle = 'rgba(20,15,20,0.9)'; ctx.lineWidth = 1.5 * s;
        for (var c2 = 0; c2 < 4; c2++) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(c2 * 1.7) * iw * 0.35 * es(uu, 0, 0.5), cy + Math.sin(c2 * 1.7) * iw * 0.35 * es(uu, 0, 0.5)); ctx.stroke(); }
        if (uu < 0.3) glow(ctx, cx + iw * 0.1, cy - iw * 0.1, iw * 0.2, '#bfe3ff', 1 - uu / 0.3);
      } else if (i === 1) {   // unmarked dies in a box
        ctx.fillStyle = '#4a5a66'; ctx.fillRect(ix + iw * 0.1, iy + iw * 0.1, iw * 0.8, iw * 0.8);
        for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) die(ctx, ix + iw * (0.3 + a * 0.4), iy + iw * (0.3 + b * 0.4), iw * 0.3, Math.floor(rnd(a * 2 + b + Math.floor(t / 3)) * 4) * PI / 2, {});
      } else {   // a test fixture connector with no shorting cap
        ctx.fillStyle = '#6f757d'; ctx.fillRect(ix, cy - iw * 0.15, iw * 0.45, iw * 0.3);
        ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(ix + iw * 0.55, cy, iw * 0.13, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1b1d21'; ctx.beginPath(); ctx.arc(ix + iw * 0.55, cy, iw * 0.07, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e8d08a'; ctx.beginPath(); ctx.arc(ix + iw * 0.55, cy, iw * 0.02, 0, TAU); ctx.fill();
        var zz = 0.5 + 0.5 * Math.sin(t * 9);
        glow(ctx, ix + iw * 0.55, cy, iw * 0.15, '#bfe3ff', 0.35 * zz);
      }
      ctx.restore();
      ctx.fillStyle = '#d33'; ctx.beginPath(); ctx.arc(0, -ph / 2 + 4 * s, 6 * s, 0, TAU); ctx.fill();
      ctx.restore();
    });
  };

  // Personal inventory: a prize wheel of the eight categories (plus one hopeful grey slice)
  A['fe.roulette'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 7);
    bg(ctx, U, '#251a30', '#06040a');
    var cx = w / 2, cy = h * 0.54, R = Math.min(w, h) * 0.4, n = 9;
    var k = Math.floor(t / 7), stop = rnd(k + 2) * TAU, prev = rnd(k + 1) * TAU;
    var v = es(u, 0, 0.75), a = prev + (stop - prev + TAU * 4) * (1 - Math.pow(1 - v, 2));
    for (var i = 0; i < n; i++) {
      var a0 = a + i * TAU / n, a1 = a0 + TAU / n, col = i < 8 ? CATS[i].col : '#5b6270';
      ctx.fillStyle = hexA(col, 0.85); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1a1220'; ctx.lineWidth = 2 * s; ctx.stroke();
      var am = (a0 + a1) / 2;
      if (i < 8) catIcon(ctx, CATS[i].key, cx + Math.cos(am) * R * 0.66, cy + Math.sin(am) * R * 0.66, R * 0.13, '#1a1220', t);
      else text(ctx, '?', cx + Math.cos(am) * R * 0.66, cy + Math.sin(am) * R * 0.66, U.f(18), '#1a1220', 'center', '800');
    }
    ctx.fillStyle = '#1a1220'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.16, 0, TAU); ctx.fill(); ctx.strokeStyle = '#efcb72'; ctx.lineWidth = 3 * s; ctx.stroke();
    for (var b = 0; b < 18; b++) { var ab = b * TAU / 18; var on = (Math.floor(t * 6) + b) % 2; glow(ctx, cx + Math.cos(ab) * R * 1.06, cy + Math.sin(ab) * R * 1.06, 6 * s, '#ffe08a', on ? 0.9 : 0.3); }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(cx, cy - R * 0.92); ctx.lineTo(cx - 12 * s, cy - R * 1.14); ctx.lineTo(cx + 12 * s, cy - R * 1.14); ctx.closePath(); ctx.fill();
  };

  /* ===================== Module 3: mode conversion in bends ===================== */

  // x-cut ring: the pulse launches TE and turns TM where the TE and TM indices cross (four azimuths)
  A['fe.bendGlow'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    var g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.hypot(w, h) * 0.6);
    g.addColorStop(0, P.filmHi); g.addColorStop(0.7, P.film); g.addColorStop(1, '#6f6470'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    var R = Math.min(w, h) * 0.32, cx = w / 2, cy = h * 0.46, tw = Math.max(5, 10 * s);
    var yb = cy + R + tw * 1.15;
    ctx.strokeStyle = P.slab; ctx.lineWidth = tw;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, yb); ctx.lineTo(w, yb); ctx.stroke();
    // TE and TM indices cross where the propagation direction is about 65 degrees from y (as in the course's bend chapter)
    var TC = 65 * PI / 180, ca = [PI / 2 - TC, PI / 2 + TC, -PI / 2 - TC, -PI / 2 + TC];
    ca.forEach(function (a) { line(ctx, cx + (R + 9 * s) * Math.cos(a), cy + (R + 9 * s) * Math.sin(a), cx + (R + 22 * s) * Math.cos(a), cy + (R + 22 * s) * Math.sin(a), '#ffffff', 2.5 * s); });
    var T = 6, u = cyc(t, T), ph;
    // phase: 0-0.15 in the bus, 0.15-0.9 one lap counterclockwise from six o'clock, then out
    var x, y, conv = 0;
    if (u < 0.15) { x = lerp(0, cx, u / 0.15); y = yb; }
    else if (u < 0.9) {
      ph = (u - 0.15) / 0.75; var a = PI / 2 - ph * TAU; x = cx + R * Math.cos(a); y = cy + R * Math.sin(a);
      var passed = 0; ca.forEach(function (c) { for (var n = -1; n <= 1; n++) { var cc = c + n * TAU; if (cc < PI / 2 && cc >= a) passed++; } });
      conv = clamp(passed / 4, 0, 1);
    } else { x = lerp(cx, w, (u - 0.9) / 0.1); y = yb; conv = 1; }
    var col = mix(P.light, P.lightTM, conv);
    for (var i = 1; i < 12; i++) {
      var uu = u - i * 0.006, xx, yy;
      if (uu < 0.15) { xx = lerp(0, cx, Math.max(0, uu) / 0.15); yy = yb; } else if (uu < 0.9) { var a2 = PI / 2 - (uu - 0.15) / 0.75 * TAU; xx = cx + R * Math.cos(a2); yy = cy + R * Math.sin(a2); } else { xx = lerp(cx, w, (uu - 0.9) / 0.1); yy = yb; }
      glow(ctx, xx, yy, 11 * s * (1 - i / 13), col, 0.5 * (1 - i / 12));
    }
    glow(ctx, x, y, 16 * s, col, 1);
    axes(ctx, U, w * 0.86, h * 0.16, 0, { len: 26, box: true });
    // legend
    glow(ctx, 16 * s, 16 * s, 7 * s, P.light, 1); text(ctx, 'TE', 28 * s, 16 * s, U.f(12), '#11161c', 'left', '800');
    glow(ctx, 16 * s, 34 * s, 7 * s, P.lightTM, 1); text(ctx, 'TM', 28 * s, 34 * s, U.f(12), '#11161c', 'left', '800');
  };

  // Top view of a guide turning in an x-cut film: the TE field (in plane) swings between z and y, TM stays on x
  A['fe.teTurn'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    var g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.hypot(w, h) * 0.6);
    g.addColorStop(0, P.filmHi); g.addColorStop(1, '#6f6470'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    var cx = w * 0.5, cy = h * 0.52, L = Math.min(w, h) * 0.4, th = 0.5 * PI * (0.5 - 0.5 * Math.cos(t * 0.6));
    var dx = Math.cos(th), dy = -Math.sin(th);   // propagation direction: from +y (right) toward +z (up)
    line(ctx, cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L, P.slab, Math.max(6, 14 * s));
    // arc showing the angle from y
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.arc(cx, cy, L * 0.35, -th, 0); ctx.stroke();
    var q = cyc(t, 1.4), px = cx + dx * L * (2 * q - 1), py = cy + dy * L * (2 * q - 1);
    // TE: in plane, perpendicular to the guide; colour from z (gold) to y (cyan)
    var nx = -dy, ny = dx, e = 26 * s * Math.sin(t * 9);
    var teCol = mix(C.zAx, C.yAx, th / (PI / 2));
    glow(ctx, px, py, 20 * s, P.light, 0.9);
    arrow(ctx, px - nx * e, py - ny * e, px + nx * e, py + ny * e, teCol, 3 * s, 9 * s);
    // TM: along x, out of the plane (dot and cross alternate)
    var tmx = cx - dx * L * (2 * q - 1) * 0.6 + nx * 40 * s, tmy = cy - dy * L * (2 * q - 1) * 0.6 + ny * 40 * s;
    glow(ctx, tmx, tmy, 16 * s, P.lightTM, 0.8);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(tmx, tmy, 8 * s, 0, TAU); ctx.stroke();
    if (Math.sin(t * 9) > 0) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(tmx, tmy, 2.5 * s, 0, TAU); ctx.fill(); }
    else { line(ctx, tmx - 5 * s, tmy - 5 * s, tmx + 5 * s, tmy + 5 * s, '#ffffff', 2 * s); line(ctx, tmx - 5 * s, tmy + 5 * s, tmx + 5 * s, tmy - 5 * s, '#ffffff', 2 * s); }
    axes(ctx, U, w * 0.13, h * 0.8, 0, { len: 28, box: true });
    text(ctx, 'TE', px + nx * (e + 14 * s), py + ny * (e + 14 * s), U.f(13), '#11161c', 'center', '800');
    text(ctx, 'TM', tmx + 16 * s, tmy - 12 * s, U.f(13), '#11161c', 'left', '800');
  };

  // TM uses r13: cross-section of the x-cut modulator, field along z; TE rides it, TM is polarized along x
  A['fe.r33r13'] = function (ctx, w, h, t) {
    var U = units(w, h, 600, 200), s = U.s;
    bg(ctx, U, '#141b26', '#05070a');
    var sw = w * 0.62, u = cyc(t, 8), te = u < 0.5;
    // cross-section: oxide, LN film with a rib, gold electrodes either side
    var cx = sw / 2, base = h * 0.72, fw = Math.min(sw * 0.9, h * 2.6);
    ctx.fillStyle = '#3a4150'; ctx.fillRect(cx - fw / 2, base, fw, h * 0.2);
    ctx.fillStyle = '#b49ad8'; ctx.fillRect(cx - fw / 2, base - h * 0.06, fw, h * 0.06);
    ctx.fillRect(cx - fw * 0.07, base - h * 0.14, fw * 0.14, h * 0.08);
    var ga = ctx.createLinearGradient(0, base - h * 0.2, 0, base - h * 0.06); ga.addColorStop(0, P.auHi); ga.addColorStop(1, P.auLo);
    ctx.fillStyle = ga; ctx.fillRect(cx - fw * 0.45, base - h * 0.2, fw * 0.3, h * 0.14); ctx.fillRect(cx + fw * 0.15, base - h * 0.2, fw * 0.3, h * 0.14);
    // RF field lines along z (horizontal), breathing with the drive
    var dr = Math.sin(t * 3);
    for (var i = 0; i < 3; i++) {
      var yy = base - h * (0.08 + i * 0.05), a = 0.35 + 0.5 * Math.abs(dr);
      ctx.save(); ctx.globalAlpha = a; arrow(ctx, dr > 0 ? cx - fw * 0.14 : cx + fw * 0.14, yy, dr > 0 ? cx + fw * 0.14 : cx - fw * 0.14, yy, dr > 0 ? P.rfP : P.rfN, 2 * s, 7 * s); ctx.restore();
    }
    // the mode and its polarization
    var mcx = cx, mcy = base - h * 0.1;
    glow(ctx, mcx, mcy, h * 0.12, te ? P.light : P.lightTM, 0.9);
    var e = h * 0.08 * Math.sin(t * 10);
    if (te) arrow(ctx, mcx - e, mcy, mcx + e, mcy, '#ffffff', 2.5 * s, 7 * s); else arrow(ctx, mcx, mcy - e, mcx, mcy + e, '#ffffff', 2.5 * s, 7 * s);
    text(ctx, te ? 'TE, along z' : 'TM, along x', cx, h * 0.14, U.f(15), te ? P.light : P.lightTM, 'center', '800');
    // axes: z horizontal, x up (cross-section frame)
    var ox = cx - fw / 2 + 8 * s, oy = h * 0.42;
    arrow(ctx, ox, oy, ox + 26 * s, oy, C.zAx, 2 * s, 7 * s); text(ctx, 'z', ox + 32 * s, oy, U.f(11), C.zAx, 'left', '700');
    arrow(ctx, ox, oy, ox, oy - 26 * s, '#ffffff', 2 * s, 7 * s); text(ctx, 'x', ox, oy - 34 * s, U.f(11), '#ffffff', 'center', '700');
    // bars: n_e^3 r33 against n_o^3 r13, ratio about 3.2 to 3.4 at RF (clamped values, Weis and Gaylord 1985)
    var bx0 = sw + w * 0.05, bw = (w - sw) * 0.28, bh = h * 0.62, by = h * 0.82;
    [[1, 'nₑ³r₃₃', P.light, te], [1 / 3.3, 'nₒ³r₁₃', P.lightTM, !te]].forEach(function (b, k) {
      var x = bx0 + k * bw * 1.5, hh = bh * b[0];
      box(ctx, x, by - hh, bw, hh, hexA(b[2], b[3] ? 0.9 : 0.35), b[3] ? '#ffffff' : null, 1.5 * s);
      text(ctx, b[1], x + bw / 2, by + 10 * s, U.f(11), b[2], 'center', '700');
    });
  };

  // Launch check with a rotating polarizer: Malus's law on the power meter; the 14 runs get relabelled
  A['fe.polarizer'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#161d27', '#05070a');
    var cy = h * 0.4, x0 = w * 0.06, px = w * 0.42, mx = w * 0.78, th = t * 0.9;
    // beam
    line(ctx, x0, cy, px, cy, hexA(P.light, 0.6), 4 * s);
    var I = Math.pow(Math.cos(th), 2);
    line(ctx, px, cy, mx - 30 * s, cy, hexA(P.light, 0.15 + 0.6 * I), 4 * s);
    ctx.fillStyle = '#c9ced6'; ctx.fillRect(x0 - 10 * s, cy - 5 * s, 24 * s, 10 * s);
    // polarizer disk with its transmission axis
    var R = Math.min(w, h) * 0.17;
    ctx.save(); ctx.translate(px, cy); ctx.scale(0.45, 1);
    ctx.fillStyle = '#2a3038'; ctx.beginPath(); ctx.arc(0, 0, R * 1.15, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(120,160,200,0.35)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.restore();
    line(ctx, px - Math.sin(th) * R * 0.45, cy - Math.cos(th) * R, px + Math.sin(th) * R * 0.45, cy + Math.cos(th) * R, '#ffffff', 2.5 * s);
    // input polarization (vertical arrow) on the beam
    arrow(ctx, w * 0.22, cy + 16 * s, w * 0.22, cy - 16 * s, '#ffffff', 2 * s, 6 * s);
    // power meter
    box(ctx, mx - 30 * s, cy - R, 60 * s, 2 * R, '#0b0f14', 'rgba(255,255,255,0.3)', 1.5 * s);
    var fh = (2 * R - 8 * s) * I; ctx.fillStyle = P.light; ctx.fillRect(mx - 22 * s, cy + R - 4 * s - fh, 44 * s, fh);
    glow(ctx, mx, cy + R - 4 * s - fh, 18 * s, P.light, 0.4 * I);
    // 14 runs relabelled one by one
    var n = 14, k = Math.floor(cyc(t, 8) * (n + 3)), rw = (w * 0.88) / n, ry = h * 0.82;
    for (var i = 0; i < n; i++) {
      var done = i < k, x = w * 0.06 + i * rw;
      box(ctx, x + 2 * s, ry - 12 * s, rw - 4 * s, 24 * s, done ? hexA(P.ok, 0.3) : hexA(P.bad, 0.25), done ? P.ok : P.bad, 1);
      text(ctx, done ? 'TE' : 'TM', x + rw / 2, ry, Math.max(7, U.f(9)), '#ffffff', 'center', '700');
    }
  };

  // Bench 3 at closing time: the end face shows the rods vertical, the bench card says horizontal
  A['fe.pandaFace'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#141820', '#040506');
    var wide = w / h > 1.05, mw = wide ? w * 0.52 : w * 0.56, mh = mw * 0.78, mx = w * 0.05, my = (h - mh) / 2;
    box(ctx, mx - 6 * s, my - 6 * s, mw + 12 * s, mh + 12 * s, '#0c0e12', '#3b4048', 2 * s);
    ctx.fillStyle = '#050608'; ctx.fillRect(mx, my, mw, mh);
    var cx = mx + mw / 2, cy = my + mh / 2, R = mh * 0.38;
    var gc = ctx.createRadialGradient(cx, cy, 0, cx, cy, R); gc.addColorStop(0, '#6b7581'); gc.addColorStop(1, '#2d343c');
    ctx.fillStyle = gc; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    var pz = 0.5 + 0.5 * Math.sin(t * 4);
    [-1, 1].forEach(function (sg) { ctx.fillStyle = '#16191e'; ctx.beginPath(); ctx.arc(cx, cy + sg * R * 0.47, R * 0.27, 0, TAU); ctx.fill(); ctx.strokeStyle = hexA('#ff5a4f', 0.4 + 0.6 * pz); ctx.lineWidth = 2.5 * s; ctx.stroke(); });
    glow(ctx, cx, cy, R * 0.16, '#ffffff', 0.9);
    // bench card
    var bx = wide ? w * 0.64 : w * 0.66, bw = wide ? w * 0.3 : w * 0.3, bh = bw * 1.1, by = h * 0.5 - bh / 2;
    ctx.save(); ctx.translate(bx + bw / 2, by + bh / 2); ctx.rotate(0.05);
    box(ctx, -bw / 2, -bh / 2, bw, bh, C.paper);
    text(ctx, 'bench 3', 0, -bh * 0.38, U.f(11), C.ink, 'center', '800');
    var r2 = bw * 0.22;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.arc(0, bh * 0.05, r2, 0, TAU); ctx.stroke();
    [-1, 1].forEach(function (sg) { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(sg * r2 * 0.5, bh * 0.05, r2 * 0.22, 0, TAU); ctx.fill(); });
    text(ctx, 'rods horizontal', 0, bh * 0.38, U.f(10), C.ink, 'center', '700');
    ctx.restore();
    text(ctx, '≠', (mx + mw + bx) / 2, h * 0.5, U.f(30), hexA('#ff5a4f', 0.5 + 0.5 * pz), 'center', '800');
    // the clock says it is time to go home
    var kx = w * 0.92, ky = h * 0.1, kr = 14 * s;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.stroke();
    line(ctx, kx, ky, kx + Math.sin(t * 2) * kr * 0.8, ky - Math.cos(t * 2) * kr * 0.8, '#ffffff', 1.5 * s);
    line(ctx, kx, ky, kx - kr * 0.5, ky + kr * 0.1, '#ffffff', 2 * s);
  };

  /* ===================== Module 4: photorefractive conduct ===================== */

  function spectrum(ctx, r, x0f, wid, depth, col, lw, upto) {
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y - 4, r.w, r.h + 8); ctx.clip();
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
    var n = 220, first = true;
    for (var i = 0; i <= n; i++) {
      var xf = i / n; if (upto != null && (upto >= 0 ? xf > upto : xf < -upto)) continue;
      var d = (xf - x0f(xf)) / wid, v = 1 - depth / (1 + d * d), X = r.x + xf * r.w, Y = r.y + r.h * (1 - v) + r.h * 0.04;
      if (first) { ctx.moveTo(X, Y); first = false; } else ctx.lineTo(X, Y);
    }
    ctx.stroke(); ctx.restore();
  }
  // Learning objectives: one resonance, two shifts: photorefraction pushes it blue, heating pushes it red
  A['fe.prShift'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#141b2a', '#05070a');
    var r = { x: w * 0.08, y: h * 0.22, w: w * 0.84, h: h * 0.46 };
    // wavelength rainbow strip under the axis (short = blue on the left)
    var gr = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0); gr.addColorStop(0, '#5b6cff'); gr.addColorStop(0.5, '#63e6ff'); gr.addColorStop(1, '#ff6b6b');
    ctx.fillStyle = gr; ctx.globalAlpha = 0.6; ctx.fillRect(r.x, r.y + r.h + 10 * s, r.w, 5 * s); ctx.globalAlpha = 1;
    text(ctx, 'λ', r.x + r.w + 4 * s, r.y + r.h + 12 * s, U.f(14), '#ffffff', 'left', '700');
    var u = cyc(t, 10), pr = u < 0.5, q = pr ? es(u, 0.08, 0.4) : es(u, 0.58, 0.9);
    var sh = (pr ? -1 : 1) * 0.18 * q;
    spectrum(ctx, r, function () { return 0.5; }, 0.035, 0.85, 'rgba(255,255,255,0.25)', 1.5 * s);
    spectrum(ctx, r, function () { return 0.5 + sh; }, 0.035, 0.85, pr ? '#7aa2ff' : '#ff7a5a', 3 * s);
    arrow(ctx, r.x + r.w * 0.5, r.y + r.h * 1.0, r.x + r.w * (0.5 + sh), r.y + r.h * 1.0, pr ? '#7aa2ff' : '#ff7a5a', 3 * s, 10 * s);
    text(ctx, pr ? 'photorefractive' : 'thermal', w / 2, h * 0.1, U.f(16), pr ? '#7aa2ff' : '#ff7a5a', 'center', '800');
    // power knob
    var kx = w * 0.5, ky = h * 0.86, kr = Math.min(18 * s, h * 0.06), ka = -PI * 0.75 + PI * 1.5 * q;
    ctx.fillStyle = '#2a313b'; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.fill(); line(ctx, kx, ky, kx + Math.sin(ka) * kr, ky - Math.cos(ka) * kr, '#ffffff', 2.5 * s);
    text(ctx, 'power', kx + kr + 8 * s, ky, U.f(11), P.inkDim, 'left', '700');
  };

  // A microring under rising power: light circulates, space charge separates across the guide
  A['fe.prRing'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#120e22', '#040308');
    var cx = w / 2, cy = h * 0.48, R = Math.min(w, h) * 0.3, pw = 0.5 - 0.5 * Math.cos(t * 0.5);
    ctx.strokeStyle = '#3a3150'; ctx.lineWidth = Math.max(6, 14 * s); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cy + R + 16 * s); ctx.lineTo(w, cy + R + 16 * s); ctx.stroke();
    // circulating light, brighter with power
    for (var i = 0; i < 40; i++) { var a = -t * 2.2 + i * TAU / 40; glow(ctx, cx + R * Math.cos(a), cy + R * Math.sin(a), (6 + 8 * pw) * s, '#63e6ff', 0.15 + 0.5 * pw * (0.6 + 0.4 * Math.sin(i * 0.9 + t * 3))); }
    // space charge: + inside, - outside, growing with time at power
    var nq = Math.round(24 * pw);
    for (var k = 0; k < nq; k++) {
      var b = k * TAU / 24 + 0.13, jit = 2 * s * Math.sin(t * 5 + k);
      text(ctx, '−', cx + (R + 18 * s + jit) * Math.cos(b), cy + (R + 18 * s + jit) * Math.sin(b), U.f(14), '#5fb2ff', 'center', '800');
      text(ctx, '+', cx + (R - 18 * s) * Math.cos(b), cy + (R - 18 * s) * Math.sin(b), U.f(13), '#ff8a8a', 'center', '800');
    }
    // input laser
    glow(ctx, w * 0.05 + (w * 0.4) * cyc(t, 1.2), cy + R + 16 * s, 10 * s, '#63e6ff', 0.9);
    var bw = w * 0.22, bh = 8 * s, bx = w * 0.06, by = h * 0.08;
    box(ctx, bx, by, bw, bh, 'rgba(255,255,255,0.1)'); box(ctx, bx, by, bw * pw, bh, '#63e6ff');
    text(ctx, 'power', bx, by + bh + 10 * s, U.f(11), P.inkDim, 'left', '700');
  };

  // Sweep direction decides the dip: one direction narrow, the other broad (same ring, same power)
  A['fe.sweepDir'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#141b2a', '#05070a');
    var rows = [{ y: 0.1, dir: 1, col: '#7aa2ff' }, { y: 0.55, dir: -1, col: '#ffb45f' }];
    var u = cyc(t, 6);
    rows.forEach(function (rw) {
      var r = { x: w * 0.1, y: h * rw.y + h * 0.06, w: w * 0.8, h: h * 0.3 };
      box(ctx, r.x, r.y - 4 * s, r.w, r.h + 8 * s, 'rgba(10,14,19,0.6)', 'rgba(255,255,255,0.12)');
      var pos = es(u, 0.05, 0.85), upto = rw.dir > 0 ? pos : -(1 - pos);
      spectrum(ctx, r, function () { return 0.5; }, rw.dir > 0 ? 0.012 : 0.07, 0.8, hexA(rw.col, 0.18), 1.5 * s);
      // narrow dip for short-to-long, broad dip for long-to-short (resonance runs into or ahead of the laser)
      spectrum(ctx, r, function () { return 0.5; }, rw.dir > 0 ? 0.012 : 0.07, 0.8, rw.col, 2.5 * s, upto);
      var lx = r.x + r.w * (rw.dir > 0 ? pos : 1 - pos);
      line(ctx, lx, r.y - 4 * s, lx, r.y + r.h + 4 * s, hexA(rw.col, 0.6), 1.5 * s);
      glow(ctx, lx, r.y - 4 * s, 9 * s, rw.col, 0.9);
      arrow(ctx, w * 0.5 - rw.dir * 30 * s, r.y + r.h + 14 * s, w * 0.5 + rw.dir * 30 * s, r.y + r.h + 14 * s, rw.col, 2.5 * s, 8 * s);
    });
  };

  /* ===================== Module 5: pyroelectric awareness ===================== */

  // Learning objectives: dipoles shrink as the crystal warms; the screening charge cannot keep up
  A['fe.pyroLattice'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    var T = 0.5 - 0.5 * Math.cos(t * 0.7), dT = Math.sin(t * 0.7);   // heating while dT > 0
    bg(ctx, U, mix('#1a1420', '#3a1810', T), '#060406');
    var sx = w * 0.14, sw = w * 0.62, sy = h * 0.26, sh = h * 0.5;
    var g = ctx.createLinearGradient(0, sy, 0, sy + sh); g.addColorStop(0, '#c9b2ec'); g.addColorStop(1, '#9b84c2');
    ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
    // dipoles pointing +z (up); length falls with temperature
    var nx = 6, ny = 3, L = sh / ny * (0.62 - 0.25 * T);
    for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) {
      var x = sx + sw * (i + 0.5) / nx, y = sy + sh * (j + 0.5) / ny + Math.sin(t * 6 + i + j) * 1.5 * s * T;
      arrow(ctx, x, y + L / 2, x, y - L / 2, '#3a2370', 2.5 * s, 7 * s);
    }
    text(ctx, '+z', sx - 8 * s, sy + 8 * s, U.f(13), '#ffffff', 'right', '800');
    // net surface charge on the +z face: heating leaves it negative, cooling positive
    var n = Math.round(Math.abs(dT) * 8), neg = dT > 0;
    for (var k = 0; k < n; k++) {
      var qx = sx + sw * (k + 0.5) / 8;
      text(ctx, neg ? '−' : '+', qx, sy - 12 * s, U.f(18), neg ? '#5fb2ff' : '#ff6b6b', 'center', '800');
      text(ctx, neg ? '+' : '−', qx, sy + sh + 13 * s, U.f(16), neg ? '#ff6b6b' : '#5fb2ff', 'center', '800');
    }
    // thermometer
    var tx = w * 0.86, ty0 = h * 0.18, ty1 = h * 0.8, tr = 9 * s;
    box(ctx, tx - tr * 0.6, ty0, tr * 1.2, ty1 - ty0, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.4)', 1);
    var lev = lerp(ty1, ty0 + 6 * s, 0.15 + 0.8 * T); ctx.fillStyle = mix('#5fb2ff', '#ff5a2a', T); ctx.fillRect(tx - tr * 0.4, lev, tr * 0.8, ty1 - lev);
    ctx.beginPath(); ctx.arc(tx, ty1 + tr * 0.6, tr, 0, TAU); ctx.fill();
    arrow(ctx, tx + 18 * s, h * 0.5 + (dT > 0 ? 14 : -14) * s, tx + 18 * s, h * 0.5 - (dT > 0 ? 14 : -14) * s, dT > 0 ? '#ff7a4f' : '#5fb2ff', 2.5 * s, 8 * s);
  };

  // Where temperature changes at work: one temperature record, three places, charge at every change
  A['fe.tempTour'] = function (ctx, w, h, t) {
    var U = units(w, h, 600, 200), s = U.s;
    bg(ctx, U, '#171b24', '#05060a');
    var r = { x: w * 0.06, y: h * 0.28, w: w * 0.88, h: h * 0.52 };
    // piecewise record: bake up, cool down, cryostat to 4 K, warm back, bench tuning wiggles
    var pts = [[0, 0.62], [0.08, 0.62], [0.16, 0.2], [0.26, 0.2], [0.34, 0.62], [0.42, 0.62], [0.52, 0.98], [0.62, 0.98], [0.7, 0.62], [0.78, 0.62]];
    for (var k = 0; k <= 10; k++) pts.push([0.8 + 0.02 * k, 0.62 - 0.05 * Math.sin(k * 1.7)]);
    var X = function (v) { return r.x + v * r.w; }, Y = function (v) { return r.y + v * r.h; };
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(r.x, r.y, r.w, r.h);
    var cur = cyc(t, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2 * s; ctx.beginPath(); pts.forEach(function (q, k) { if (k) ctx.lineTo(X(q[0]), Y(q[1])); else ctx.moveTo(X(q[0]), Y(q[1])); }); ctx.stroke();
    ctx.lineWidth = 3 * s; ctx.lineJoin = 'round';
    for (var i = 1; i < pts.length; i++) {
      if (pts[i - 1][0] > cur) break;
      var a = pts[i - 1], b = pts[i], f = clamp((cur - a[0]) / (b[0] - a[0]), 0, 1);
      var tv = (a[1] + b[1]) / 2; ctx.strokeStyle = mix('#ff6a3d', '#5fb2ff', (tv - 0.2) / 0.78);
      ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(lerp(a[0], b[0], f)), Y(lerp(a[1], b[1], f))); ctx.stroke();
      // charge sparks where the temperature changes
      if (Math.abs(b[1] - a[1]) > 0.1 && f > 0 && f < 1) glow(ctx, X(lerp(a[0], b[0], f)), Y(lerp(a[1], b[1], f)), 14 * s, '#bfe3ff', 0.9);
    }
    text(ctx, 'T', r.x - 10 * s, r.y + 8 * s, U.f(12), '#ffffff', 'center', '800');
    text(ctx, '4 K', r.x + r.w * 0.57, Y(0.98) + 12 * s, U.f(11), '#5fb2ff', 'center', '700');
    [['hot plate', 0.21, '#ff7a4f'], ['cryostat', 0.57, '#5fb2ff'], ['bench', 0.88, '#7ee08a']].forEach(function (L) {
      var on = Math.abs(cur - L[1]) < 0.12;
      text(ctx, L[0], X(L[1]), h * 0.13, U.f(on ? 14 : 12), on ? L[2] : P.inkDim, 'center', on ? '800' : '600');
    });
  };

  // Fast hot plate step: silicon and z-cut lithium niobate wafers land on the plate; heat spreads through both
  A['fe.heatStep'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 6, 0.1);
    bg(ctx, U, '#1e1512', '#060404');
    var py = h * 0.66;
    var gp = ctx.createLinearGradient(0, py, 0, py + h * 0.1); gp.addColorStop(0, '#ff5a1e'); gp.addColorStop(1, '#3a2a24');
    ctx.fillStyle = gp; ctx.fillRect(w * 0.04, py, w * 0.92, h * 0.1);
    var drop = es(u, 0.05, 0.2), heat = es(u, 0.2, 0.7);
    [['Si', w * 0.28, '#3a3f47', '#6c737d'], ['z-cut LN', w * 0.72, '#b6a7c4', '#e8dcf0']].forEach(function (wf, i) {
      var cx = wf[1], cy = lerp(h * 0.4, py - 6 * s, drop), rx = w * 0.18, ry = rx * 0.28;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.28);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, mix(wf[2], '#ff7a3d', heat * 0.8)); g.addColorStop(clamp(0.3 + heat * 0.7, 0.31, 0.99), mix(wf[2], '#ff7a3d', heat * 0.6)); g.addColorStop(1, wf[2]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.strokeStyle = wf[3]; ctx.lineWidth = 3 * s; ctx.stroke();
      ctx.restore();
      text(ctx, wf[0], cx, py + h * 0.2, U.f(15), '#ffffff', 'center', '800');
    });
    // temperature step trace
    var r = { x: w * 0.36, y: h * 0.05, w: w * 0.28, h: h * 0.2 };
    box(ctx, r.x, r.y, r.w, r.h, 'rgba(10,6,6,0.7)', 'rgba(255,140,90,0.4)');
    ctx.strokeStyle = '#ff7a4f'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(r.x + 4 * s, r.y + r.h * 0.85); ctx.lineTo(r.x + r.w * 0.25, r.y + r.h * 0.85); ctx.lineTo(r.x + r.w * 0.25, r.y + r.h * 0.15); ctx.lineTo(r.x + r.w * 0.25 + (r.w * 0.75 - 4 * s) * seg(u, 0.2, 0.9), r.y + r.h * 0.15); ctx.stroke();
  };

  // A moment for the amplifier: dark LED, flat trace, one flower
  A['fe.ampMoment'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    ctx.fillStyle = '#06070a'; ctx.fillRect(0, 0, w, h);
    var g = ctx.createRadialGradient(w * 0.5, h * 0.1, 0, w * 0.5, h * 0.6, h * 0.8); g.addColorStop(0, 'rgba(255,230,180,0.35)'); g.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(w * 0.45, 0); ctx.lineTo(w * 0.55, 0); ctx.lineTo(w * 0.95, h); ctx.lineTo(w * 0.05, h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b1e23'; ctx.fillRect(0, h * 0.72, w, h * 0.28);
    var aw = Math.min(w * 0.6, h * 0.8), ah = aw * 0.36, ax = w / 2 - aw / 2, ay = h * 0.72 - ah;
    ctx.fillStyle = '#3b4149'; ctx.fillRect(ax, ay, aw, ah); ctx.fillStyle = '#2b3037'; ctx.fillRect(ax, ay, aw, ah * 0.18);
    for (var f = 0; f < 8; f++) { ctx.fillStyle = '#23272d'; ctx.fillRect(ax + aw * (0.08 + f * 0.1), ay + ah * 0.35, aw * 0.05, ah * 0.45); }
    ctx.fillStyle = '#30353c'; ctx.beginPath(); ctx.arc(ax + aw * 0.92, ay + ah * 0.55, 5 * s, 0, TAU); ctx.fill();
    // small scope with a flat line
    var sx = ax + aw * 0.62, sy = ay - ah * 0.9, sw = aw * 0.34, sh = ah * 0.7;
    box(ctx, sx, sy, sw, sh, '#0a120c', '#3b4048', 1.5 * s);
    line(ctx, sx + 4 * s, sy + sh / 2, sx + sw - 4 * s, sy + sh / 2, '#3fae69', 1.5 * s);
    glow(ctx, sx + 4 * s + (sw - 8 * s) * cyc(t, 2.5), sy + sh / 2, 5 * s, '#3fae69', 0.8);
    // a flower in a test tube vase, swaying
    var vx = ax + aw * 0.2, vy = ay;
    ctx.fillStyle = 'rgba(200,220,240,0.35)'; ctx.fillRect(vx - 6 * s, vy - 40 * s, 12 * s, 40 * s);
    var sway = 0.08 * Math.sin(t * 0.9), fx = vx + Math.sin(sway) * 70 * s, fy = vy - 40 * s - Math.cos(sway) * 60 * s;
    ctx.strokeStyle = '#3f8a4f'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(vx, vy - 30 * s); ctx.quadraticCurveTo(vx + sway * 40 * s, vy - 70 * s, fx, fy); ctx.stroke();
    for (var p = 0; p < 6; p++) { var pa = p * TAU / 6 + t * 0.1; ctx.fillStyle = '#ff9ec7'; ctx.beginPath(); ctx.ellipse(fx + Math.cos(pa) * 9 * s, fy + Math.sin(pa) * 9 * s, 7 * s, 4.5 * s, pa, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(fx, fy, 4.5 * s, 0, TAU); ctx.fill();
    // a falling petal now and then
    var pq = cyc(t, 7); if (pq < 0.6) { var px = fx + 10 * s + Math.sin(pq * 12) * 12 * s, py = fy + pq / 0.6 * (h * 0.72 - fy); ctx.fillStyle = 'rgba(255,158,199,' + (1 - pq / 0.6).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(px, py, 6 * s, 3.5 * s, pq * 9, 0, TAU); ctx.fill(); }
  };

  // How much charge: the plate ramps, bound charge builds on floating pads, then a cable meets it
  A['fe.pyroCharge'] = function (ctx, w, h, t) {
    var U = units(w, h, 600, 200), s = U.s, u = cyc(t, 9, 0.05);
    bg(ctx, U, '#1b1418', '#060405');
    var wide = w / h > 2.2;
    // left: temperature ramp and charge record
    var r = { x: w * 0.06, y: h * 0.18, w: wide ? w * 0.3 : w * 0.38, h: h * 0.6 };
    box(ctx, r.x, r.y, r.w, r.h, 'rgba(10,6,8,0.7)', 'rgba(255,255,255,0.15)');
    var ramp = es(u, 0.05, 0.55), plug = u > 0.62;
    ctx.strokeStyle = '#ff7a4f'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h * 0.9); ctx.lineTo(r.x + r.w * ramp * 0.55, r.y + r.h * (0.9 - 0.75 * ramp)); if (u > 0.55) ctx.lineTo(r.x + r.w * (0.55 + 0.45 * seg(u, 0.55, 1)), r.y + r.h * 0.15); ctx.stroke();
    var Q = plug ? ramp * Math.exp(-(u - 0.62) * 60) : ramp;
    ctx.strokeStyle = '#5fb2ff'; ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h * 0.9);
    for (var i = 1; i <= 40; i++) { var uu = 0.05 + i / 40 * (u - 0.05); if (uu < 0.05) continue; var rr = es(uu, 0.05, 0.55), qq = uu > 0.62 ? rr * Math.exp(-(uu - 0.62) * 60) : rr; ctx.lineTo(r.x + r.w * Math.min(1, (uu - 0.05) / 0.95 * 1.05), r.y + r.h * (0.9 - 0.75 * qq)); }
    ctx.stroke();
    text(ctx, 'T', r.x + r.w + 8 * s, r.y + r.h * 0.15, U.f(12), '#ff7a4f', 'left', '800');
    text(ctx, 'σ = pΔT', r.x + 8 * s, r.y - 9 * s, U.f(12), '#5fb2ff', 'left', '800');
    // right: chip on the plate with floating pads, then the cable
    var cx = wide ? w * 0.62 : w * 0.72, cy = h * 0.52, cw = wide ? w * 0.26 : w * 0.38, chh = h * 0.18;
    ctx.fillStyle = mix('#4a4f57', '#ff5a1e', ramp * 0.7); ctx.fillRect(cx - cw * 0.6, cy + chh / 2, cw * 1.2, h * 0.1);
    ctx.fillStyle = '#b49ad8'; ctx.fillRect(cx - cw / 2, cy - chh / 2, cw, chh);
    ctx.fillStyle = P.au; ctx.fillRect(cx - cw * 0.42, cy - chh / 2 - 5 * s, cw * 0.2, 5 * s); ctx.fillRect(cx + cw * 0.22, cy - chh / 2 - 5 * s, cw * 0.2, 5 * s);
    var n = Math.round(Q * 7);
    for (var k = 0; k < n; k++) text(ctx, '−', cx - cw / 2 + cw * (k + 0.5) / 7, cy - chh / 2 - 15 * s, U.f(15), '#5fb2ff', 'center', '800');
    // cable approaches the right pad
    var cq = es(u, 0.5, 0.62), ex = cx + cw * 0.32, ey = cy - chh / 2 - 5 * s - lerp(h * 0.35, 0, cq);
    ctx.strokeStyle = '#15171a'; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + w * 0.08, Math.max(0, ey - h * 0.3)); ctx.stroke();
    ctx.fillStyle = '#b8bec6'; ctx.fillRect(ex - 6 * s, ey - 12 * s, 12 * s, 12 * s);
    var sp = pulse(u, 0.6, 0.68);
    if (sp > 0) { glow(ctx, ex, ey, 50 * s * sp, '#cfeaff', sp); for (var j = 0; j < 7; j++) { var a = rnd(j) * TAU; line(ctx, ex, ey, ex + Math.cos(a) * 34 * s * sp, ey + Math.sin(a) * 34 * s * sp, '#e8f6ff', 1.5 * s); } }
    text(ctx, '+z', cx - cw / 2 - 6 * s, cy - chh / 2 + 6 * s, U.f(11), '#ffffff', 'right', '700');
  };

  // Fixture 3 waits for the same thermal step; the failed amplifier is tagged on the shelf
  A['fe.fixtureWait'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#171b22', '#050608');
    // fixture on a thermoelectric cooler
    var fx = w * 0.32, fy = h * 0.58, fw = Math.min(w * 0.42, h * 0.7), fh = fw * 0.4;
    ctx.fillStyle = '#2c3038'; ctx.fillRect(fx - fw / 2, fy + fh / 2, fw, fh * 0.35);
    ctx.fillStyle = '#5a6068'; ctx.fillRect(fx - fw / 2, fy - fh / 2, fw, fh);
    ctx.fillStyle = '#b49ad8'; ctx.fillRect(fx - fw * 0.18, fy - fh * 0.3, fw * 0.36, fh * 0.35);
    [-1, 1].forEach(function (sg) { ctx.fillStyle = '#c9a24a'; ctx.fillRect(fx + sg * fw * 0.5 - (sg > 0 ? 0 : 14 * s), fy - 7 * s, 14 * s, 14 * s); });
    text(ctx, '3', fx - fw * 0.4, fy - fh * 0.25, U.f(16), '#ffffff', 'center', '800');
    // the queued step on a controller display
    var dx = fx - fw / 2, dy = h * 0.12, dw = fw, dh = h * 0.24;
    box(ctx, dx, dy, dw, dh, '#0a0f0c', '#3b4048', 1.5 * s);
    var bl = Math.floor(t * 2) % 2;
    ctx.strokeStyle = '#3fae69'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(dx + 8 * s, dy + dh * 0.75); ctx.lineTo(dx + dw * 0.45, dy + dh * 0.75); ctx.lineTo(dx + dw * 0.45, dy + dh * 0.25); ctx.lineTo(dx + dw - 8 * s, dy + dh * 0.25); ctx.stroke();
    if (bl) text(ctx, 'queued', dx + dw * 0.72, dy + dh * 0.55, U.f(12), '#3fae69', 'center', '700', 'middle', true);
    // wall clock
    var kx = w * 0.82, ky = h * 0.2, kr = Math.min(w, h) * 0.08;
    ctx.fillStyle = '#e9eef3'; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.fill();
    line(ctx, kx, ky, kx + Math.sin(t * 0.5) * kr * 0.8, ky - Math.cos(t * 0.5) * kr * 0.8, '#11161c', 2 * s);
    line(ctx, kx, ky, kx + Math.sin(t * 0.04 + 2) * kr * 0.5, ky - Math.cos(t * 0.04 + 2) * kr * 0.5, '#11161c', 3 * s);
    // tagged amplifier
    var ax = w * 0.72, ay = h * 0.62, aw = w * 0.22, ah = aw * 0.4;
    ctx.fillStyle = '#3b4149'; ctx.fillRect(ax, ay, aw, ah);
    ctx.save(); ctx.translate(ax + aw * 0.15, ay + ah); ctx.rotate(0.25 + 0.06 * Math.sin(t * 1.5));
    line(ctx, 0, 0, 0, 18 * s, '#d9d1c1', 1);
    ctx.fillStyle = '#e0524c'; ctx.fillRect(-14 * s, 18 * s, 28 * s, 18 * s); text(ctx, 'tag', 0, 27 * s, U.f(9), '#ffffff', 'center', '800');
    ctx.restore();
  };

  /* ===================== Module 6: bias point retention ===================== */

  // DC bias drift: the operating point slides off quadrature while the output strip chart wanders
  A['fe.biasDrift'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#141c22', '#05070a');
    var u = cyc(t, 10), tau = 0.35, dr = 0.6 * (1 - Math.exp(-u / tau));
    var r = { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.42 };
    box(ctx, r.x, r.y, r.w, r.h, 'rgba(10,14,19,0.6)', 'rgba(255,255,255,0.15)');
    var Tf = function (v, d) { var x = Math.sin(PI * (v - d) / 2 + PI / 4); return x * x; };
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5 * s; ctx.beginPath();
    for (var i = 0; i <= 160; i++) { var v = -2 + 4 * i / 160; if (i) ctx.lineTo(r.x + r.w * i / 160, r.y + r.h * (1 - Tf(v, 0))); else ctx.moveTo(r.x, r.y + r.h * (1 - Tf(v, 0))); } ctx.stroke();
    ctx.strokeStyle = '#e9eef3'; ctx.lineWidth = 2.5 * s; ctx.beginPath();
    for (i = 0; i <= 160; i++) { v = -2 + 4 * i / 160; if (i) ctx.lineTo(r.x + r.w * i / 160, r.y + r.h * (1 - Tf(v, dr))); else ctx.moveTo(r.x, r.y + r.h * (1 - Tf(v, dr))); } ctx.stroke();
    var ox = r.x + r.w / 2, oy = r.y + r.h * (1 - Tf(0, dr));
    line(ctx, ox, r.y, ox, r.y + r.h, 'rgba(227,176,75,0.6)', 1.5 * s, [5 * s, 4 * s]);
    glow(ctx, ox, oy, 16 * s, '#ffc46b', 1);
    text(ctx, 'V', r.x + r.w + 6 * s, r.y + r.h, U.f(12), P.inkDim, 'left', '700');
    // strip chart of output at fixed bias
    var c = { x: w * 0.1, y: h * 0.64, w: w * 0.8, h: h * 0.26 };
    box(ctx, c.x, c.y, c.w, c.h, 'rgba(10,14,19,0.6)', 'rgba(255,255,255,0.15)');
    line(ctx, c.x, c.y + c.h * 0.5, c.x + c.w, c.y + c.h * 0.5, 'rgba(126,224,138,0.5)', 1, [4 * s, 4 * s]);
    ctx.strokeStyle = '#ffc46b'; ctx.lineWidth = 2 * s; ctx.beginPath();
    for (i = 0; i <= 100; i++) { var uu = u * i / 100, d2 = 0.6 * (1 - Math.exp(-uu / tau)), y = c.y + c.h * (1 - Tf(0, d2)); if (i) ctx.lineTo(c.x + c.w * uu, y); else ctx.moveTo(c.x, y); } ctx.stroke();
    text(ctx, 'time', c.x + c.w, c.y + c.h + 10 * s, U.f(11), P.inkDim, 'right', '700');
  };

  // Low-frequency V pi: a 1 kHz triangle on the scope, and a frequency dial that wants to go much higher
  A['fe.scopeVpi'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#101615', '#040606');
    var r = { x: w * 0.06, y: h * 0.08, w: w * 0.62, h: h * 0.62 };
    box(ctx, r.x, r.y, r.w, r.h, '#06100c', '#3b4048', 2 * s);
    for (var g = 1; g < 8; g++) line(ctx, r.x + r.w * g / 8, r.y, r.x + r.w * g / 8, r.y + r.h, 'rgba(63,174,105,0.15)', 1);
    for (g = 1; g < 6; g++) line(ctx, r.x, r.y + r.h * g / 6, r.x + r.w, r.y + r.h * g / 6, 'rgba(63,174,105,0.15)', 1);
    var tri = function (x) { var p = (x + t * 0.25) % 1; return p < 0.5 ? 4 * p - 1 : 3 - 4 * p; };
    ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 2 * s; ctx.beginPath();
    for (var i = 0; i <= 200; i++) { var x = i / 200, y = r.y + r.h * (0.3 - 0.2 * tri(x)); if (i) ctx.lineTo(r.x + r.w * x, y); else ctx.moveTo(r.x, y); } ctx.stroke();
    ctx.strokeStyle = '#63e6ff'; ctx.beginPath();
    for (i = 0; i <= 200; i++) { x = i / 200; var v = tri(x) * 1.6, o = Math.pow(Math.sin(PI * v / 2 + PI / 4), 2), y2 = r.y + r.h * (0.92 - 0.38 * o); if (i) ctx.lineTo(r.x + r.w * x, y2); else ctx.moveTo(r.x, y2); } ctx.stroke();
    text(ctx, '1 kHz', r.x + 8 * s, r.y + 12 * s, U.f(12), '#ffd84d', 'left', '700', 'middle', true);
    // frequency dial: kHz ... GHz
    var kx = w * 0.84, ky = h * 0.42, kr = Math.min(w * 0.12, h * 0.2);
    ctx.fillStyle = '#2a313b'; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a96a3'; ctx.lineWidth = 1.5 * s; for (var k = 0; k <= 6; k++) { var a = PI * 0.75 + k * PI * 1.5 / 6; line(ctx, kx + Math.cos(a) * kr * 1.05, ky + Math.sin(a) * kr * 1.05, kx + Math.cos(a) * kr * 1.2, ky + Math.sin(a) * kr * 1.2, '#8a96a3', 1.5 * s); }
    var ka = PI * 0.75 + PI * 1.5 * (0.5 - 0.5 * Math.cos(t * 0.7));
    line(ctx, kx, ky, kx + Math.cos(ka) * kr * 0.85, ky + Math.sin(ka) * kr * 0.85, '#ffffff', 3 * s);
    text(ctx, 'kHz', kx - kr * 0.9, ky + kr * 1.35, U.f(11), P.inkDim, 'center', '700');
    text(ctx, 'GHz', kx + kr * 0.9, ky + kr * 1.35, U.f(11), P.inkDim, 'center', '700');
    text(ctx, 'Vπ ?', w * 0.37, h * 0.86, U.f(18), '#ffffff', 'center', '800');
  };

  // Direction is part of the design: co-propagating light rides the RF crest, counter-propagating light averages it away
  A['fe.travelWave'] = function (ctx, w, h, t) {
    var U = units(w, h, 600, 200), s = U.s, u = cyc(t, 10), co = u < 0.5, q = co ? u / 0.5 : (u - 0.5) / 0.5;
    bg(ctx, U, '#141b26', '#05070a');
    var x0 = w * 0.05, x1 = w * (w / h > 2.2 ? 0.75 : 0.95), ey = h * 0.5, eh = h * 0.18;
    // electrode with the RF wave (red and blue field regions) travelling to the right
    // RF phase velocity equals the optical group velocity here (velocity matched): the co-propagating pulse rides one crest
    var k = TAU / ((x1 - x0) / 2.5), wv = k * (x1 - x0) / 5 * t;
    for (var x = x0; x < x1; x += 3) { var f = Math.cos(k * (x - x0) - wv); ctx.fillStyle = f > 0 ? hexA(P.rfP, 0.55 * f) : hexA(P.rfN, -0.55 * f); ctx.fillRect(x, ey - eh / 2, 3, eh); }
    var ga = ctx.createLinearGradient(0, ey - eh, 0, ey - eh / 2); ga.addColorStop(0, P.auHi); ga.addColorStop(1, P.auLo);
    ctx.fillStyle = ga; ctx.fillRect(x0, ey - eh / 2 - h * 0.09, x1 - x0, h * 0.09); ctx.fillRect(x0, ey + eh / 2, x1 - x0, h * 0.09);
    arrow(ctx, x0 + 10 * s, ey - eh / 2 - h * 0.16, x0 + 70 * s, ey - eh / 2 - h * 0.16, '#ff8a8a', 2.5 * s, 8 * s);
    text(ctx, 'RF', x0 + 78 * s, ey - eh / 2 - h * 0.16, U.f(12), '#ff8a8a', 'left', '800');
    // the light pulse: co rides one phase (velocity matched), counter crosses every phase
    var lx = co ? lerp(x0, x1, q) : lerp(x1, x0, q);
    glow(ctx, lx, ey, 16 * s, P.light, 1);
    arrow(ctx, lx - (co ? 34 : -34) * s, ey + eh / 2 + h * 0.2, lx + (co ? 4 : -4) * s, ey + eh / 2 + h * 0.2, P.light, 2.5 * s, 8 * s);
    text(ctx, co ? 'co-propagating' : 'counter-propagating', w * 0.05, h * 0.1, U.f(14), co ? P.ok : P.bad, 'left', '800');
    // accumulated phase bar
    var acc;
    if (co) acc = q;   // stays on one crest
    else { var L = (x1 - x0), ph = 2 * k * L * q; acc = 0.12 * Math.sin(ph / 2) * Math.sin(ph / 2 + 0.3); }
    var bx = w / h > 2.2 ? w * 0.82 : w * 0.82, bw = w / h > 2.2 ? w * 0.08 : w * 0.1, bt = h * 0.12, bb = h * 0.88;
    if (w / h <= 2.2) { bx = w * 0.86; bw = w * 0.08; }
    box(ctx, bx, bt, bw, bb - bt, 'rgba(10,14,19,0.75)', 'rgba(255,255,255,0.3)');
    var fh = (bb - bt - 6 * s) * clamp(acc, -0.5, 1);
    ctx.fillStyle = co ? P.ok : P.bad; ctx.fillRect(bx + 3 * s, bb - 3 * s - Math.max(0, fh), bw - 6 * s, Math.abs(fh));
    text(ctx, 'Δφ', bx + bw / 2, bt - 8 * s, U.f(12), '#ffffff', 'center', '800');
  };

  // The run sheet: the RF column fills in; the cursor hovers over "Hide column"
  A['fe.runSheet'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s, u = cyc(t, 8, 0.05);
    bg(ctx, U, '#171c24', '#05060a');
    var x0 = w * 0.06, y0 = h * 0.1, tw = w * 0.88, th = h * 0.8, cols = ['chip', 'DC Vπ', 'RF Vπ', 'orientation'], rows = 7;
    box(ctx, x0, y0, tw, th, '#f5f6f8', '#9aa4b0');
    var cw = tw / cols.length, rh = th / (rows + 1);
    box(ctx, x0, y0, tw, rh, '#dfe5ec');
    cols.forEach(function (c, i) { text(ctx, c, x0 + cw * (i + 0.5), y0 + rh / 2, U.f(12), i === 2 ? '#c0392b' : '#2b2f36', 'center', '800'); });
    for (var r = 1; r <= rows; r++) {
      line(ctx, x0, y0 + rh * r, x0 + tw, y0 + rh * r, '#d0d6de', 1);
      var y = y0 + rh * (r + 0.5);
      text(ctx, String(r), x0 + cw * 0.5, y, U.f(11), '#2b2f36', 'center', '600');
      box(ctx, x0 + cw * 1.2, y - rh * 0.15, cw * (0.35 + 0.25 * rnd(r)), rh * 0.3, '#7d8794');
      if (r <= Math.floor(es(u, 0.05, 0.5) * rows + 0.01)) box(ctx, x0 + cw * 2.2, y - rh * 0.15, cw * (0.35 + 0.25 * rnd(r + 9)), rh * 0.3, '#c0392b');
      if (r === 3) { ctx.fillStyle = 'rgba(224,82,76,0.15)'; ctx.fillRect(x0 + cw * 3, y - rh / 2, cw, rh); text(ctx, '180°', x0 + cw * 3.5, y, U.f(11), '#c0392b', 'center', '800'); }
    }
    for (var c2 = 1; c2 < cols.length; c2++) line(ctx, x0 + cw * c2, y0, x0 + cw * c2, y0 + th, '#d0d6de', 1);
    // context menu with a hovering cursor
    if (u > 0.55) {
      var mx = x0 + cw * 2.55, my = y0 + rh * 0.9, mw = cw * 1.3, mh = rh * 2.2;
      box(ctx, mx, my, mw, mh, '#ffffff', '#9aa4b0');
      text(ctx, 'Sort', mx + 10 * s, my + mh * 0.25, U.f(11), '#2b2f36', 'left', '600');
      box(ctx, mx + 2 * s, my + mh * 0.52, mw - 4 * s, mh * 0.42, '#dbe8ff');
      text(ctx, 'Hide column', mx + 10 * s, my + mh * 0.73, U.f(11), '#1f4fa0', 'left', '700');
      var cxp = mx + mw * 0.7 + Math.sin(t * 2) * 6 * s, cyp = my + mh * 0.76;
      ctx.save(); ctx.translate(cxp, cyp); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 17 * s); ctx.lineTo(4.5 * s, 13 * s); ctx.lineTo(8 * s, 20 * s); ctx.lineTo(10.5 * s, 19 * s); ctx.lineTo(7 * s, 12 * s); ctx.lineTo(12.5 * s, 12 * s); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  };

  // Zero tolerance for retaliation: a shield around the reporter; whatever is thrown bounces off
  A['fe.shield'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#152033', '#04060a');
    var cx = w / 2, cy = h * 0.5, R = Math.min(w, h) * 0.3;
    for (var k = 0; k < 6; k++) {   // incoming darts, each bouncing off the shield
      var q = cyc(t, 3, k / 6), a = k * TAU / 6 + 0.4, d = q < 0.5 ? lerp(Math.max(w, h) * 0.6, R * 1.25, q / 0.5) : lerp(R * 1.25, Math.max(w, h) * 0.6, (q - 0.5) / 0.5);
      var x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + (q < 0.5 ? PI : 0)); ctx.fillStyle = q < 0.5 ? '#e0524c' : 'rgba(224,82,76,0.4)';
      ctx.beginPath(); ctx.moveTo(10 * s, 0); ctx.lineTo(-8 * s, -5 * s); ctx.lineTo(-8 * s, 5 * s); ctx.closePath(); ctx.fill(); ctx.restore();
      if (Math.abs(q - 0.5) < 0.05) glow(ctx, cx + Math.cos(a) * R * 1.2, cy + Math.sin(a) * R * 0.96, 24 * s, '#9fd2ff', 1 - Math.abs(q - 0.5) / 0.05);
    }
    // shield
    ctx.save(); ctx.translate(cx, cy);
    var g = ctx.createLinearGradient(-R, -R, R, R); g.addColorStop(0, '#5fb2ff'); g.addColorStop(1, '#2f5fd1');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -R * 1.1); ctx.quadraticCurveTo(R * 0.95, -R * 0.95, R * 0.95, -R * 0.2); ctx.quadraticCurveTo(R * 0.9, R * 0.75, 0, R * 1.15); ctx.quadraticCurveTo(-R * 0.9, R * 0.75, -R * 0.95, -R * 0.2); ctx.quadraticCurveTo(-R * 0.95, -R * 0.95, 0, -R * 1.1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d8ecff'; ctx.lineWidth = 3 * s; ctx.stroke();
    ctx.restore();
    crystal(ctx, cx, cy + R * 0.45, R * 0.42, R * 0.8, t * 0.5, { col: '#e7dcff' });
    var pz = 0.5 + 0.5 * Math.sin(t * 2); ctx.strokeStyle = hexA('#9fd2ff', 0.2 + 0.3 * pz); ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.arc(cx, cy, R * (1.3 + 0.05 * pz), 0, TAU); ctx.stroke();
  };

  // Pressure: a deadline circled, a gauge climbing, a stopwatch running
  A['fe.pressure'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#221616', '#070404');
    var tall = h / w > 0.9;
    // calendar
    var cw = Math.min(w * 0.8, h * (tall ? 0.6 : 1.0)) * (tall ? 1 : 0.55), ch = cw * 0.8, cx = tall ? w / 2 - cw / 2 : w * 0.06, cy = tall ? h * 0.06 : h * 0.12;
    box(ctx, cx, cy, cw, ch, '#f4f1e8'); box(ctx, cx, cy, cw, ch * 0.16, '#c0392b');
    var days = ['M', 'T', 'W', 'T', 'F'];
    days.forEach(function (d, i) {
      var x = cx + cw * (i + 0.5) / 5;
      text(ctx, d, x, cy + ch * 0.08, U.f(11), '#ffffff', 'center', '800');
      for (var r = 0; r < 3; r++) box(ctx, x - cw * 0.07, cy + ch * (0.24 + r * 0.25), cw * 0.14, ch * 0.18, r === 1 && i === 4 ? null : '#e2dccd');
    });
    var fx = cx + cw * 0.9, fy = cy + ch * 0.58, pz = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.strokeStyle = hexA('#c0392b', 0.7 + 0.3 * pz); ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.ellipse(fx, fy, cw * 0.12 + 2 * s * pz, ch * 0.16 + 2 * s * pz, 0.2, 0, TAU); ctx.stroke();
    // gauge
    var gx = tall ? w * 0.3 : w * 0.78, gy = tall ? h * 0.82 : h * 0.58, gr = Math.min(w, h) * (tall ? 0.2 : 0.22);
    var cols = ['#3fae69', '#e3b04b', '#e0524c'];
    for (var i = 0; i < 3; i++) { ctx.strokeStyle = cols[i]; ctx.lineWidth = gr * 0.22; ctx.beginPath(); ctx.arc(gx, gy, gr, PI + i * PI / 3 + 0.03, PI + (i + 1) * PI / 3 - 0.03); ctx.stroke(); }
    var v = clamp(0.55 + 0.3 * cyc(t, 6) + 0.05 * Math.sin(t * 13), 0, 0.98), an = PI + v * PI;
    line(ctx, gx, gy, gx + Math.cos(an) * gr * 0.95, gy + Math.sin(an) * gr * 0.95, '#ffffff', 3 * s);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(gx, gy, 6 * s, 0, TAU); ctx.fill();
    // stopwatch
    var sx = tall ? w * 0.74 : w * 0.5, sy = tall ? h * 0.76 : h * 0.62, sr = Math.min(w, h) * 0.11;
    ctx.fillStyle = '#e9eef3'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill(); ctx.fillRect(sx - 4 * s, sy - sr - 9 * s, 8 * s, 9 * s);
    line(ctx, sx, sy, sx + Math.sin(t * 3) * sr * 0.85, sy - Math.cos(t * 3) * sr * 0.85, '#c0392b', 2.5 * s);
  };

  /* ===================== Module 7: simulation integrity ===================== */

  function meshDisk(ctx, cx, cy, R, t, o) {
    o = o || {};
    var n = 9, pts = [];
    for (var i = -n; i <= n; i++) for (var j = -n; j <= n; j++) {
      var x = i / n + (j % 2 ? 0.5 / n : 0), y = j / n * 0.866;
      if (x * x + y * y > 1.0) continue;
      pts.push([x + 0.02 * Math.sin(i * 3.1 + j), y + 0.02 * Math.cos(j * 2.3 + i)]);
    }
    var tri = [];
    for (var a = -n; a < n; a++) for (var b = -n; b < n; b++) {
      var p00 = [a / n + (b % 2 ? 0.5 / n : 0), b / n * 0.866], p10 = [(a + 1) / n + (b % 2 ? 0.5 / n : 0), b / n * 0.866];
      var p01 = [a / n + ((b + 1) % 2 ? 0.5 / n : 0), (b + 1) / n * 0.866], p11 = [(a + 1) / n + ((b + 1) % 2 ? 0.5 / n : 0), (b + 1) / n * 0.866];
      tri.push([p00, p10, b % 2 ? p11 : p01]); tri.push([b % 2 ? p00 : p10, p11, p01]);
    }
    tri.forEach(function (tr) {
      var mx = (tr[0][0] + tr[1][0] + tr[2][0]) / 3, my = (tr[0][1] + tr[1][1] + tr[2][1]) / 3, r = Math.hypot(mx, my);
      if (r > 1.0 || (o.quarter && (mx < 0 || my > 0))) return;
      var ang = Math.atan2(my, mx);
      // whispering-gallery-like mode near the rim, azimuthal order 6, rotating
      var f = Math.exp(-Math.pow((r - 0.78) / 0.12, 2)) * Math.cos(6 * ang - t * 1.5);
      ctx.fillStyle = f > 0 ? hexA('#ff3d3d', 0.15 + 0.75 * f) : hexA('#2f6dff', 0.15 - 0.75 * f);
      ctx.beginPath(); ctx.moveTo(cx + tr[0][0] * R, cy + tr[0][1] * R); ctx.lineTo(cx + tr[1][0] * R, cy + tr[1][1] * R); ctx.lineTo(cx + tr[2][0] * R, cy + tr[2][1] * R); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(220,230,240,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    });
  }
  function pmlRing(ctx, cx, cy, r0, r1, a) {
    for (var k = 0; k < 10; k++) { ctx.strokeStyle = 'rgba(120,90,200,' + ((0.06 + 0.05 * k) * (a == null ? 1 : a)).toFixed(3) + ')'; ctx.lineWidth = (r1 - r0) / 10 + 1; ctx.beginPath(); ctx.arc(cx, cy, r0 + (k + 0.5) * (r1 - r0) / 10, 0, TAU); ctx.stroke(); }
  }
  // Learning objectives: a meshed resonator, its mode, the absorbing shell, symmetry planes on probation
  A['fe.simMesh'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#121624', '#040508');
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.3;
    pmlRing(ctx, cx, cy, R * 1.15, R * 1.55);
    meshDisk(ctx, cx, cy, R, t);
    // radiated ripples into the absorber
    for (var k = 0; k < 3; k++) { var q = cyc(t, 2.4, k / 3); ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 * (1 - q)).toFixed(3) + ')'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.arc(cx, cy, R * (1.02 + 0.5 * q), 0, TAU); ctx.stroke(); }
    // symmetry planes flicker with a crossed-out mark
    var on = (Math.floor(t * 1.2) % 3) === 0;
    if (on) {
      line(ctx, cx, cy - R * 1.6, cx, cy + R * 1.6, 'rgba(255,196,107,0.85)', 2 * s, [6 * s, 5 * s]);
      line(ctx, cx - R * 1.6, cy, cx + R * 1.6, cy, 'rgba(255,196,107,0.85)', 2 * s, [6 * s, 5 * s]);
      emblem(ctx, 'mirror', cx + R * 1.3, cy - R * 1.3, 16 * s, '#e0524c');
    }
  };

  // Simulation integrity hazards: four tiles, four logged cases
  A['fe.simHazards'] = function (ctx, w, h, t) {
    var U = units(w, h, 600, 200), s = U.s;
    bg(ctx, U, '#121624', '#040508');
    var n = 4, cols = w / h > 2.2 ? 4 : 2, rows = n / cols, tw = w / cols, th = h / rows;
    var labs = ['absorber', 'cyclic symmetry', 'terminals', 'pipeline'];
    for (var i = 0; i < n; i++) {
      var x = (i % cols) * tw, y = Math.floor(i / cols) * th, cx = x + tw / 2, cy = y + th * 0.55, R = Math.min(tw, th) * 0.32;
      box(ctx, x + 3, y + 3, tw - 6, th - 6, 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.12)');
      text(ctx, labs[i], x + 10 * s, y + 13 * s, U.f(11), P.inkDim, 'left', '700');
      if (i === 0) {   // waves into an absorber that fades them
        for (var k = 0; k < 5; k++) { var q = cyc(t, 2, k / 5), rr = R * 0.2 + q * R * 1.2; ctx.strokeStyle = 'rgba(99,230,255,' + (0.8 * (1 - q) * (rr > R ? Math.max(0, 1 - (rr - R) / (R * 0.4)) : 1)).toFixed(3) + ')'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke(); }
        pmlRing(ctx, cx, cy, R, R * 1.4, 0.9);
      } else if (i === 1) {   // a sector copied around; one copy flips like a mirror
        for (var sct = 0; sct < 6; sct++) {
          var a0 = sct * TAU / 6 + t * 0.2, bad = sct === Math.floor(t) % 6;
          ctx.fillStyle = bad ? 'rgba(224,82,76,0.55)' : 'rgba(180,140,255,0.35)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a0 + TAU / 6); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.stroke();
          var am = a0 + (bad ? 0.75 : 0.25) * TAU / 6; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx + Math.cos(am) * R * 0.65, cy + Math.sin(am) * R * 0.65, 3 * s, 0, TAU); ctx.fill();
        }
      } else if (i === 2) {   // Voltage terminal = short, zero-charge Charge terminal = open
        var sh = Math.floor(t / 2) % 2 === 0;
        ctx.fillStyle = '#b49ad8'; ctx.fillRect(cx - R * 0.6, cy - R * 0.35, R * 1.2, R * 0.7);
        ctx.fillStyle = P.au; ctx.fillRect(cx - R * 0.6, cy - R * 0.5, R * 1.2, R * 0.15); ctx.fillRect(cx - R * 0.6, cy + R * 0.35, R * 1.2, R * 0.15);
        ctx.strokeStyle = sh ? '#7ee08a' : '#ffb45f'; ctx.lineWidth = 2.5 * s; ctx.beginPath();
        ctx.moveTo(cx + R * 0.6, cy - R * 0.42); ctx.lineTo(cx + R * 0.95, cy - R * 0.42); ctx.lineTo(cx + R * 0.95, sh ? cy + R * 0.42 : cy - R * 0.08);
        if (!sh) { ctx.moveTo(cx + R * 0.95, cy + R * 0.08); ctx.lineTo(cx + R * 0.95, cy + R * 0.42); }
        ctx.lineTo(cx + R * 0.6, cy + R * 0.42); ctx.stroke();
        text(ctx, sh ? 'V: short' : 'Q = 0: open', cx, cy + R * 0.85, U.f(11), sh ? '#7ee08a' : '#ffb45f', 'center', '700');
      } else {   // datasets flowing; one arrives as zero
        for (var b = 0; b < 4; b++) {
          var q2 = cyc(t, 3, b / 4), bx = lerp(cx - R * 1.2, cx + R * 1.2, q2), zero = b === 2 && q2 > 0.5;
          box(ctx, bx - 12 * s, cy - 9 * s, 24 * s, 18 * s, zero ? 'rgba(224,82,76,0.8)' : 'rgba(95,208,255,0.7)');
          if (zero) text(ctx, '0', bx, cy, U.f(11), '#ffffff', 'center', '800');
        }
        line(ctx, cx, cy - R * 0.6, cx, cy + R * 0.6, 'rgba(255,255,255,0.3)', 1.5 * s, [4 * s, 3 * s]);
      }
    }
  };

  // Quarter model versus full model: mirror planes trap the wave, the full model lets it leak to the absorber
  A['fe.symQ'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#121624', '#040508');
    var wide = w / h > 1.05;
    [0, 1].forEach(function (i) {
      var cx = wide ? w * (0.25 + 0.5 * i) : w * 0.5, cy = wide ? h * 0.5 : h * (0.27 + 0.47 * i), R = wide ? Math.min(w * 0.14, h * 0.24) : Math.min(w * 0.2, h * 0.14);
      var quarter = i === 0;
      pmlRing(ctx, cx, cy, R * 1.15, R * 1.5, quarter ? 0.5 : 1);
      if (quarter) {
        ctx.save(); ctx.beginPath(); ctx.rect(cx, cy - R * 1.7, R * 1.7, R * 1.7); ctx.clip(); meshDisk(ctx, cx, cy, R, t, {}); ctx.restore();
        line(ctx, cx, cy - R * 1.7, cx, cy, '#ffc46b', 2.5 * s); line(ctx, cx, cy, cx + R * 1.7, cy, '#ffc46b', 2.5 * s);
        for (var k = 0; k < 3; k++) { var q = cyc(t, 1.5, k / 3); ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 * (1 - q)).toFixed(3) + ')'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(cx, cy, R * (0.3 + 0.7 * q), -PI / 2, 0); ctx.stroke(); }
      } else {
        meshDisk(ctx, cx, cy, R, t, {});
        for (var k2 = 0; k2 < 3; k2++) { var q2 = cyc(t, 2, k2 / 3); ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - q2)).toFixed(3) + ')'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.arc(cx, cy, R * (1.0 + 0.6 * q2), 0, TAU); ctx.stroke(); }
      }
      text(ctx, quarter ? 'quarter' : 'full', cx, wide ? h * 0.1 : cy - R * 1.75, U.f(14), '#ffffff', 'center', '800');
      text(ctx, quarter ? 'Q = 10¹³' : 'Q ≈ 10³', cx, wide ? h * 0.9 : cy + R * 1.8, U.f(14), quarter ? '#ffc46b' : '#7ee08a', 'center', '800', 'middle', true);
    });
  };

  // Weakening the absorber: the slider goes down, the computed Q goes up
  A['fe.pmlSlider'] = function (ctx, w, h, t) {
    var U = units(w, h), s = U.s;
    bg(ctx, U, '#121624', '#040508');
    var v = 0.5 + 0.5 * Math.cos(t * 0.6);   // absorber strength 1 -> 0 -> 1
    var cx = w * 0.34, cy = h * 0.5, R = Math.min(w * 0.18, h * 0.26);
    pmlRing(ctx, cx, cy, R * 1.15, R * 1.5, 0.2 + 0.8 * v);
    meshDisk(ctx, cx, cy, R, t, {});
    // slider
    var sx = w * 0.84, y0 = h * 0.15, y1 = h * 0.8;
    line(ctx, sx, y0, sx, y1, 'rgba(255,255,255,0.3)', 4 * s);
    var ky = lerp(y1, y0, v); box(ctx, sx - 14 * s, ky - 7 * s, 28 * s, 14 * s, '#b48cff', '#ffffff', 1.5 * s);
    text(ctx, 'absorber', sx, y1 + 16 * s, U.f(11), P.inkDim, 'center', '700');
    // Q readout climbs as the absorber weakens
    var qx = w * 0.7, qb = h * 0.8, qh = (h * 0.62) * (0.15 + 0.85 * (1 - v));
    box(ctx, qx - 12 * s, h * 0.18, 24 * s, h * 0.62, 'rgba(10,14,19,0.75)', 'rgba(255,255,255,0.3)');
    ctx.fillStyle = '#ffc46b'; ctx.fillRect(qx - 9 * s, qb - qh, 18 * s, qh);
    text(ctx, 'Q', qx, h * 0.12, U.f(16), '#ffc46b', 'center', '800');
  };

  // No public source: a stack of lab notebooks, pages turning
  A['fe.labNotes'] = function (ctx, w, h, t) {
    var U = units(w, h, 600, 200), s = U.s;
    bg(ctx, U, '#1e1a14', '#060504');
    var n = Math.max(3, Math.round(w / (h * 0.9)));
    for (var i = 0; i < n; i++) {
      var cx = w * (i + 0.5) / n, cy = h * 0.55, bw = Math.min(w / n * 0.7, h * 0.75), bh = bw * 0.7;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((rnd(i) - 0.5) * 0.12);
      ctx.fillStyle = ['#2c4a7a', '#6a2c4f', '#2f6b5a', '#7a5a2c', '#4b3a7a'][i % 5]; ctx.fillRect(-bw / 2 - 4 * s, -bh / 2 - 4 * s, bw + 8 * s, bh + 8 * s);
      ctx.fillStyle = '#f3efe2'; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      for (var l = 1; l < 7; l++) line(ctx, -bw / 2, -bh / 2 + bh * l / 7, bw / 2, -bh / 2 + bh * l / 7, 'rgba(90,140,200,0.3)', 1);
      ctx.strokeStyle = '#1b2f6b'; ctx.lineWidth = 1.5 * s; ctx.beginPath();
      for (var k = 0; k < 40; k++) { var x = -bw * 0.4 + bw * 0.35 * k / 40, y = -bh * 0.25 + Math.sin(k * 0.9 + i) * bh * 0.05; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
      ctx.strokeRect(bw * 0.05, -bh * 0.3, bw * 0.3, bh * 0.3);
      // page turning
      var q = cyc(t, 4, i / n), sx = Math.cos(PI * es(q, 0.2, 0.6));
      ctx.save(); ctx.scale(sx, 1); ctx.fillStyle = sx > 0 ? '#f7f4ea' : '#e6e0cf'; ctx.fillRect(0, -bh / 2, bw / 2, bh); ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.strokeRect(0, -bh / 2, bw / 2, bh); ctx.restore();
      line(ctx, 0, -bh / 2, 0, bh / 2, 'rgba(0,0,0,0.3)', 2 * s);
      ctx.restore();
    }
  };

  /* ===================== Final assessment ===================== */

  // Exam question panel: the chapter motif and a running stopwatch. params: { theme, n }
  A['fe.exam'] = function (ctx, w, h, t, p) {
    p = p || {}; var U = units(w, h), s = U.s, n = p.n || 0;
    // n only varies the tint and phase, so two questions on the same topic never look identical
    bg(ctx, U, mix('#1a2030', ['#2a1a30', '#1a2a24', '#2a2418'][n % 3], 0.6), '#05060a', 0.3 + 0.4 * rnd(n), 0.4);
    bannerMotif(ctx, p.theme || 'sim', 0, h * 0.08, w, h * 0.84, t + n * 1.7, Math.min(w / 560, h / 240) * 1.1, { neutral: true });
    var r = Math.min(w, h) * 0.09, x = w - r - 10 * s, y = r + 10 * s;
    ctx.fillStyle = 'rgba(8,11,15,0.85)'; ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e9eef3'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffc46b'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc(x, y, r * 0.8, -PI / 2, -PI / 2 + TAU * cyc(t, 10)); ctx.stroke();
  };
})();
