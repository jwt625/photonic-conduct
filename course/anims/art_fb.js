/* Feedback course: looping code-drawn art panels, window.LMS_DRAW.art['fb.<name>'] = fn(ctx, w, h, t, params).
   t in seconds; every panel loops, draws the whole frame, and is deterministic from t. No DOM work: the reference
   strip only reads already-registered literature figures through a small Image cache.
   Layout: an 800 x 600 stage centred in a virtual frame that grows along the longer side of the canvas, so the
   same function works in a 4:3 side panel, a wide banner and a phone-width stack. Text never drops below about
   11 CSS px. Physics: Fresnel reflections at real index steps, isolator arrows pointing away from the laser,
   Faraday rotation adding in the same sense both ways, ring doublets from the coupled-mode model
   (Kippenberg et al. 2002), etalon period lambda^2 / (2 n L), mode-hop model as in fb_draw.js. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  root.LMS_DRAW = root.LMS_DRAW || {};
  var ART = root.LMS_DRAW.art = root.LMS_DRAW.art || {};
  var TAU = Math.PI * 2;
  var P = {
    ink: '#e6ebf0', ink2: '#a3aeba', ink3: '#66727e', line: '#2a333d', scr: '#05080b', grid: '#16212b', axis: '#4a5866',
    fwd: '#56d4ff', back: '#ff5a4f', warn: '#f2b84b', ok: '#3fb950', bad: '#e5534b', gold: '#f2c94c', pink: '#ff6fd8',
    violet: '#a98bff', orange: '#ff9a52', teal: '#38e0b8', lime: '#b6f36a',
    oxide: '#6e6a94', oxideLo: '#4b4770', wg: '#c2c9f2', inp: '#8a8f99', jacket: '#e8c547', steel: '#aeb5bd', paper: '#eef1f5'
  };
  var S = { c: null, W: 800, H: 600, k: 1, mf: 11, narrow: false, ox: 0, oy: 0 };

  /* ---------- frame ---------- */
  function begin(ctx, w, h, o) {
    o = o || {};
    var k = w / h > 4 / 3 ? h / 600 : w / 800, css = (ctx.canvas && ctx.canvas.clientWidth) || w;
    S.c = ctx; S.k = k; S.W = w / k; S.H = h / k; S.mf = 11 * (w / Math.max(1, css)) / k; S.narrow = css < 430;
    S.ox = (S.W - 800) / 2; S.oy = (S.H - 600) / 2;
    ctx.save(); ctx.scale(k, k);
    var g = ctx.createRadialGradient(S.W / 2, S.H * 0.42, 10, S.W / 2, S.H / 2, Math.hypot(S.W, S.H) * 0.62);
    g.addColorStop(0, o.bg0 || '#13202e'); g.addColorStop(1, o.bg1 || '#05080c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.textBaseline = 'middle'; ctx.setLineDash([]);
    if (!o.free) ctx.translate(S.ox, S.oy);
  }
  /* def(name, period s, fn(u 0..1 phase, t s, params), opts) */
  function def(name, period, fn, o) {
    ART['fb.' + name] = function (ctx, w, h, t, p) {
      begin(ctx, w, h, o); t = +t || 0;
      try { fn(((t % period) + period) % period / period, t, p || {}); } finally { S.c.restore(); }
    };
  }

  /* ---------- math ---------- */
  function clamp(v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return v < a ? a : v > b ? b : v; }
  function ease(x) { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function seg(u, a, b) { return ease((u - a) / (b - a)); }
  function lin(u, a, b) { return clamp((u - a) / (b - a)); }
  function lerp(a, b, x) { return a + (b - a) * x; }
  function bump(u, a, b) { var x = lin(u, a, b); return Math.sin(Math.PI * x); }
  function inout(u, a, b, c, d) { return Math.min(seg(u, a, b), 1 - seg(u, c, d)); }
  function hash(n) { var s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); }
  function noise(x) { var i = Math.floor(x), f = x - i, a = hash(i), b = hash(i + 1); return a + (b - a) * f * f * (3 - 2 * f); }
  function lor(x, x0, g) { var d = (x - x0) / g; return 1 / (1 + d * d); }

  /* ---------- primitives ---------- */
  var SANS = '"Helvetica Neue", Arial, system-ui, sans-serif', MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  function font(px, wt, mono) { var s = Math.max(px, S.mf); S.c.font = (wt || 500) + ' ' + s.toFixed(1) + 'px ' + (mono ? MONO : SANS); return s; }
  function txt(s, x, y, px, col, al, wt, mono) { var c = S.c; font(px, wt, mono); c.fillStyle = col || P.ink; c.textAlign = al || 'center'; c.fillText(s, x, y); return c.measureText(s).width; }
  function tw(s, px, wt, mono) { font(px, wt, mono); return S.c.measureText(s).width; }
  function wrap(s, maxW, px, wt) {
    var words = String(s).split(' '), out = [], cur = '';
    words.forEach(function (w) { var n = cur ? cur + ' ' + w : w; if (tw(n, px, wt) > maxW && cur) { out.push(cur); cur = w; } else cur = n; });
    if (cur) out.push(cur); return out;
  }
  function rect(x, y, w, h, fill, stroke, lw) { var c = S.c; if (fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.strokeRect(x, y, w, h); } }
  function line(pts, col, w, dash, off) {
    if (pts.length < 2) return; var c = S.c; c.strokeStyle = col; c.lineWidth = w || 2;
    if (dash) { c.setLineDash(dash); c.lineDashOffset = off || 0; }
    c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke();
    if (dash) { c.setLineDash([]); c.lineDashOffset = 0; }
  }
  function seg2(x0, y0, x1, y1, col, w, dash, off) { line([[x0, y0], [x1, y1]], col, w, dash, off); }
  function dot(x, y, r, col) { var c = S.c; c.fillStyle = col; c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); c.fill(); }
  function circ(x, y, r, col, w, dash, off) { var c = S.c; c.strokeStyle = col; c.lineWidth = w || 2; if (dash) { c.setLineDash(dash); c.lineDashOffset = off || 0; } c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); c.stroke(); if (dash) c.setLineDash([]); }
  function poly(pts, fill, stroke, lw) { var c = S.c; c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); } }
  function alpha(a, fn) { var c = S.c; c.save(); c.globalAlpha *= clamp(a); fn(); c.restore(); }
  function at(x, y, sc, rot, fn) { var c = S.c; c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (sc !== 1) c.scale(sc, sc); fn(); c.restore(); }
  function glow(pts, col, w, blur, a) {
    if (pts.length < 2) return; var c = S.c; c.save(); c.globalAlpha *= a === undefined ? 1 : clamp(a); c.shadowColor = col; c.shadowBlur = blur || 16;
    line(pts, col, w || 5); c.restore();
  }
  function flash(x, y, r, col, a) { if (a <= 0) return; var c = S.c; c.save(); c.globalAlpha *= clamp(a); var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore(); }
  function arrowHead(x, y, ang, sz, col) { var c = S.c; c.fillStyle = col; c.beginPath(); c.moveTo(x, y); c.lineTo(x - sz * Math.cos(ang - 0.45), y - sz * Math.sin(ang - 0.45)); c.lineTo(x - sz * Math.cos(ang + 0.45), y - sz * Math.sin(ang + 0.45)); c.closePath(); c.fill(); }
  function arrow(x0, y0, x1, y1, col, w, sz) { seg2(x0, y0, x1, y1, col, w || 3); arrowHead(x1, y1, Math.atan2(y1 - y0, x1 - x0), sz || 16, col); }
  /* light flowing along a path: faint core plus moving dashes; dir = +1 along the points, -1 against */
  function flow(pts, col, w, t, dir, a) {
    alpha(a === undefined ? 1 : a, function () {
      glow(pts, col, (w || 4) * 0.6, 10, 0.35);
      var c = S.c; c.save(); c.shadowColor = col; c.shadowBlur = 14; line(pts, col, w || 4, [16, 26], -(dir || 1) * t * 120); c.restore();
    });
  }
  function mkPath(pts) { var L = [0]; for (var i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { p: pts, L: L, len: L[L.length - 1] }; }
  function ptAt(pa, s) {
    var d = clamp(s) * pa.len, i = 1; while (i < pa.L.length - 1 && pa.L[i] < d) i++;
    var a = pa.p[i - 1], b = pa.p[i], sl = pa.L[i] - pa.L[i - 1] || 1, f = (d - pa.L[i - 1]) / sl;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }
  function subPts(pa, s0, s1) {
    s0 = clamp(s0); s1 = clamp(s1); if (s1 <= s0) return [];
    var out = [ptAt(pa, s0)], d0 = s0 * pa.len, d1 = s1 * pa.len;
    for (var i = 1; i < pa.p.length - 1; i++) if (pa.L[i] > d0 && pa.L[i] < d1) out.push(pa.p[i]);
    out.push(ptAt(pa, s1)); return out;
  }
  /* pulse with head at s (0..1 along pa), length ln (fraction) */
  function pulse(pa, s, col, ln, w, a) { ln = ln || 0.08; if (s <= 0 || s - ln >= 1) return; glow(subPts(pa, s - ln, s), col, w || 7, 18, a); var h = ptAt(pa, clamp(s)); if (s <= 1) flash(h[0], h[1], (w || 7) * 2.2, col, 0.5 * (a === undefined ? 1 : a)); }
  function P2(x0, y0, x1, y1) { return mkPath([[x0, y0], [x1, y1]]); }

  /* ---------- screens and plots ---------- */
  /* dark instrument screen; returns a map with X(v), Y(v) over xr, yr */
  function screen(x, y, w, h, xr, yr, o) {
    o = o || {};
    rect(x - 8, y - 8, w + 16, h + 16, '#141a21', '#323d48', 2);
    rect(x, y, w, h, P.scr, null);
    var nx = o.nx || 8, ny = o.ny || 5, i;
    for (i = 1; i < nx; i++) seg2(x + w * i / nx, y, x + w * i / nx, y + h, P.grid, 1.2);
    for (i = 1; i < ny; i++) seg2(x, y + h * i / ny, x + w, y + h * i / ny, P.grid, 1.2);
    var m = { x: x, y: y, w: w, h: h, xr: xr || [0, 1], yr: yr || [0, 1] };
    m.X = function (v) { return x + (v - m.xr[0]) / (m.xr[1] - m.xr[0]) * w; };
    m.Y = function (v) { return y + h - (v - m.yr[0]) / (m.yr[1] - m.yr[0]) * h; };
    if (o.xl) txt(o.xl, x + w / 2, y + h + 30, 20, P.ink3, 'center', 600);
    if (o.yl) at(x - 26, y + h / 2, 1, -Math.PI / 2, function () { txt(o.yl, 0, 0, 20, P.ink3, 'center', 600); });
    return m;
  }
  function trace(m, f, col, lw, x0, x1, n, glowIt) {
    var pts = [], N = n || 300; x0 = x0 === undefined ? m.xr[0] : x0; x1 = x1 === undefined ? m.xr[1] : x1; if (x1 <= x0) return;
    for (var i = 0; i <= N; i++) { var v = x0 + (x1 - x0) * i / N, yv = f(v); if (yv === null || isNaN(yv)) continue; pts.push([m.X(v), clamp(m.Y(yv), m.y, m.y + m.h)]); }
    var c = S.c; c.save(); c.beginPath(); c.rect(m.x, m.y, m.w, m.h); c.clip();
    if (glowIt !== false) glow(pts, col, lw || 3, 12, 0.5);
    line(pts, col, lw || 3); c.restore();
  }

  /* ---------- hardware ---------- */
  /* laser die, side view: x, y = die centre; o.dir = 1 emits to +x; o.alarm 0..1 = noisy red halo; returns the front facet */
  function laser(x, y, s, o, t) {
    o = o || {}; s = s || 1; var d = o.dir || 1, c = S.c, al = o.alarm || 0;
    var jx = al ? (noise((t || 0) * 40) - 0.5) * 4 * al : 0;
    x += jx;
    if (al) flash(x, y, 90 * s, 'rgba(255,90,79,0.9)', al * (0.45 + 0.3 * noise((t || 0) * 23)));
    var g = c.createLinearGradient(x, y - 22 * s, x, y + 22 * s); g.addColorStop(0, '#a8adb6'); g.addColorStop(0.5, P.inp); g.addColorStop(1, '#5a5f68');
    c.fillStyle = g; c.fillRect(x - 50 * s, y - 22 * s, 100 * s, 44 * s);
    rect(x - 50 * s, y - 28 * s, 100 * s, 7 * s, '#d6af58', null);
    rect(x - 50 * s, y - 3 * s, 100 * s, 6 * s, al ? '#ff7a5c' : P.orange, null);
    glow([[x - 46 * s, y], [x + 46 * s, y]], al ? P.back : P.orange, 3 * s, 10, 0.7);
    rect(x - 50 * s, y - 28 * s, 100 * s, 50 * s, null, 'rgba(0,0,0,0.55)', 1.5);
    var fx = x + d * 50 * s;
    flash(fx, y, 26 * s, o.col || P.fwd, 0.8);
    return [fx, y];
  }
  /* inline fiber isolator: centre x, y, length L; arrow along dir (+1 = +x) */
  function isolator(x, y, L, o) {
    o = o || {}; var c = S.c, d = o.dir === undefined ? 1 : o.dir, h = o.h || 34;
    var g = c.createLinearGradient(x, y - h / 2, x, y + h / 2); g.addColorStop(0, '#d9dee4'); g.addColorStop(0.45, '#8d949c'); g.addColorStop(1, '#c5cbd2');
    c.fillStyle = g; c.fillRect(x - L / 2, y - h / 2, L, h);
    rect(x - L / 2 - 8, y - h / 2 + 5, 8, h - 10, '#6c737b', null); rect(x + L / 2, y - h / 2 + 5, 8, h - 10, '#6c737b', null);
    rect(x - L / 2, y - h / 2, L, h, null, 'rgba(0,0,0,0.5)', 1.5);
    var ac = o.col || '#11161c';
    seg2(x - d * L * 0.3, y, x + d * L * 0.22, y, ac, 4);
    arrowHead(x + d * L * 0.32, y, d > 0 ? 0 : Math.PI, 18, ac);
    if (o.label) txt(o.label, x, y + h / 2 + 22, 18, o.labelCol || P.ink2, 'center', 700, true);
  }
  /* FC ferrule end: x = face, faces +x when dir = 1; o.angled draws the 8 degree face; o.hot = red reflection glow */
  function ferrule(x, y, s, o) {
    o = o || {}; s = s || 1; var d = o.dir || 1, c = S.c;
    var bx = x - d * 60 * s;
    rect(Math.min(bx, x), y - 9 * s, 60 * s, 18 * s, '#d9dde2', null);
    var sk = o.angled ? 9 * s * d : 0;
    poly([[x - d * 4 * s - sk, y - 9 * s], [x + sk - d * 4 * s + d * 4 * s, y - 9 * s], [x - sk, y + 9 * s], [x - d * 4 * s - sk, y + 9 * s]], '#f4f6f8', null);
    seg2(x + sk, y - 9 * s, x - sk, y + 9 * s, o.angled ? P.ok : '#ffffff', 2.5 * s);
    rect(Math.min(bx - d * 50 * s, bx), y - 15 * s, 50 * s, 30 * s, o.angled ? '#2e8b57' : '#2d6fd0', null);
    if (o.hot) flash(x, y, 40 * s, 'rgba(255,90,79,0.95)', o.hot);
  }
  function fiber(pts, col, w) { line(pts, '#5c4a10', (w || 6) + 2); line(pts, col || P.jacket, w || 6); }
  function chipSurf(x, y, w, h) {
    var c = S.c, g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#7c78a2'); g.addColorStop(1, '#4f4b76');
    c.fillStyle = g; c.fillRect(x, y, w, h); rect(x, y, w, h, null, 'rgba(210,205,240,0.5)', 2);
  }
  function wgLine(pts, w) { line(pts, '#3a3660', (w || 4) + 4); line(pts, P.wg, w || 4); }
  function gcFan(x, y, s, ang) { at(x, y, s || 1, ang || 0, function () { var c = S.c; c.fillStyle = 'rgba(194,201,242,0.35)'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 34, -0.4, 0.4); c.closePath(); c.fill(); c.strokeStyle = 'rgba(230,235,255,0.9)'; c.lineWidth = 1.6; for (var i = 0; i < 6; i++) { c.beginPath(); c.arc(0, 0, 14 + i * 3.6, -0.45, 0.45); c.stroke(); } }); }
  function mirror(x, y, h, col) { rect(x - 6, y - h / 2, 12, h, col || '#9fb3c8', 'rgba(255,255,255,0.6)', 1.5); for (var i = 0; i < 6; i++) seg2(x + 6, y - h / 2 + 8 + i * (h - 16) / 5, x + 16, y - h / 2 + 18 + i * (h - 16) / 5, '#566473', 2); }
  function detector(x, y, s, o) { o = o || {}; s = s || 1; rect(x, y - 30 * s, 54 * s, 60 * s, '#20262d', '#4a5560', 2); rect(x - 4 * s, y - 16 * s, 6 * s, 32 * s, o.hot ? '#ff8f86' : '#8fa0b2', null); if (o.hot) flash(x, y, 36 * s, 'rgba(255,90,79,0.9)', o.hot); }
  /* wax-style seal / stamp ring with text around it */
  function ringText(s, x, y, r, px, col, rot) {
    var c = S.c, n = s.length; font(px, 800); c.fillStyle = col; c.textAlign = 'center';
    for (var i = 0; i < n; i++) { var a = (rot || 0) + i / n * TAU; c.save(); c.translate(x + r * Math.sin(a), y - r * Math.cos(a)); c.rotate(a); c.fillText(s[i], 0, 0); c.restore(); }
  }
  /* rubber stamp imprint: k 0..1 impact progress */
  function stampMark(x, y, word, col, k, rot) {
    if (k <= 0) return;
    var sc = 1 + 1.4 * (1 - seg(k, 0, 0.35)), a = seg(k, 0, 0.2);
    at(x, y, sc, rot === undefined ? -0.2 : rot, function () {
      alpha(a, function () {
        var w = tw(word, 44, 900) + 46; rect(-w / 2, -38, w, 76, null, col, 6); rect(-w / 2 + 9, -29, w - 18, 58, null, col, 2);
        txt(word, 0, 2, 44, col, 'center', 900);
      });
    });
    if (k > 0.33 && k < 0.6) for (var i = 0; i < 10; i++) { var an = i / 10 * TAU + 0.3, rr = 70 + 80 * lin(k, 0.33, 0.6); dot(x + rr * Math.cos(an) * 1.6, y + rr * Math.sin(an), 4 * (1 - lin(k, 0.33, 0.6)), col); }
  }

  /* ---------- mini vignettes (local 200 x 140 box), used by grids, cycles and badges ---------- */
  var V = {};
  V.feedback = function (t) {
    laser(52, 70, 0.55, { col: P.fwd }, t); mirror(178, 70, 70);
    var u = (t / 2.2) % 1, pa = P2(80, 70, 172, 70), pb = P2(172, 70, 80, 70);
    if (u < 0.5) pulse(pa, u * 2.2, P.fwd, 0.25, 6); else pulse(pb, (u - 0.5) * 2.2, P.back, 0.25, 4);
    if (u > 0.95 || u < 0.03) flash(80, 70, 30, 'rgba(255,90,79,0.9)', 0.8);
  };
  V.retaliation = function (t) {
    rect(10, 10, 180, 120, P.scr, '#2b3640', 1.5);
    var wdt = 4 + 26 * (0.5 + 0.5 * Math.sin(t * 2.1)), j = (noise(t * 6) - 0.5) * 18, pts = [];
    for (var i = 0; i <= 80; i++) { var x = 14 + i * 172 / 80, yy = 124 - 100 * lor(x, 100 + j, wdt) * (6 / Math.sqrt(wdt * 6)) * 1.3 - 3 * hash(i + Math.floor(t * 20)); pts.push([x, Math.max(16, yy)]); }
    glow(pts, P.back, 2.5, 10, 0.8); line(pts, '#ff9d96', 2.5);
  };
  V.cavity = function (t) {
    rect(40, 25, 10, 90, '#9fb3c8', null); rect(150, 25, 10, 90, '#9fb3c8', null);
    var u = (t / 1.4) % 1, x = u < 0.5 ? lerp(52, 148, u * 2) : lerp(148, 52, (u - 0.5) * 2);
    glow([[x - 22, 70], [x + 22, 70]], P.violet, 6, 18, 0.9); flash(x, 70, 20, P.violet, 0.6);
    for (var k = 0; k < 3; k++) { var xx = 160 + ((t * 60 + k * 20) % 40); dot(xx, 70, 3 - k * 0.6, 'rgba(169,139,255,0.7)'); }
  };
  V.hop = function (t) {
    rect(10, 10, 180, 120, P.scr, '#2b3640', 1.5);
    var m = Math.floor(t / 1.2) % 4, sel = [3, 4, 4, 5][m];
    for (var i = 0; i < 9; i++) { var x = 22 + i * 19.5, on = i === sel; seg2(x, 124, x, on ? 28 : 112 - 18 * lor(i, 4.2, 2), on ? P.fwd : '#6d7884', on ? 4 : 2); if (on) flash(x, 28, 16, P.fwd, 0.8); }
  };
  V.blush = function (t) { laser(100, 70, 0.9, { alarm: 0.6 + 0.4 * Math.sin(t * 3) * Math.sin(t * 3) }, t); };
  V.mirror = function (t) {
    seg2(70, 115, 150, 35, '#cfe3f5', 6); for (var i = 0; i < 6; i++) seg2(78 + i * 13, 115 - i * 13, 88 + i * 13, 122 - i * 13, '#566473', 2);
    var u = (t / 1.8) % 1, pin = P2(20, 30, 108, 76), pout = P2(108, 76, 196, 30);
    if (u < 0.5) pulse(pin, u * 2.2, P.fwd, 0.3, 6); else pulse(pout, (u - 0.5) * 2.2, P.violet, 0.3, 6);
    flash(108, 76, 26, '#ffffff', bump(u, 0.4, 0.62));
  };
  V.isolated = function (t) {
    laser(40, 70, 0.4, {}, t); isolator(110, 70, 70, { h: 26 }); seg2(152, 70, 196, 70, P.jacket, 4);
    var u = (t / 1.6) % 1;
    if (u < 0.5) pulse(P2(62, 70, 196, 70), u * 2.2, P.fwd, 0.22, 5); else { pulse(P2(196, 70, 140, 70), (u - 0.5) * 2.4, P.back, 0.3, 4); flash(142, 70, 26, 'rgba(255,90,79,0.9)', bump(u, 0.82, 1)); }
  };
  V.logged = function (t) {
    rect(40, 12, 120, 116, P.paper, '#9aa4b0', 1.5); for (var i = 0; i < 6; i++) seg2(52, 32 + i * 16, 148, 32 + i * 16, '#c9d1db', 1.2);
    var u = (t / 2.5) % 1, n = Math.floor(u * 6), f = (u * 6) % 1;
    for (i = 0; i <= n && i < 6; i++) { var e = i < n ? 1 : f, pts = []; for (var k = 0; k <= 20 * e; k++) pts.push([54 + k * 4.4, 28 + i * 16 - 3 * Math.sin(k * 1.7 + i) - 1]); line(pts, '#1d4fa8', 1.8); if (i === n) dot(pts[pts.length - 1][0], pts[pts.length - 1][1], 3, '#1d4fa8'); }
  };
  V.split = function (t) {
    rect(10, 10, 180, 120, P.scr, '#2b3640', 1.5);
    var g = 0.5 + 0.5 * Math.sin(t * 1.4), pts = [];
    for (var i = 0; i <= 120; i++) { var x = 14 + i * 172 / 120, dd = (x - 100) / 14, k = 1; var tr = 1 - 0.8 * lor(dd, -2.2 * g, 1) - 0.8 * lor(dd, 2.2 * g, 1); pts.push([x, 22 + 96 * clamp(1 - tr) * k]); }
    glow(pts, P.pink, 2.5, 10, 0.8); line(pts, P.pink, 2.5);
  };
  V.overcoupled = function (t) {
    seg2(10, 118, 190, 118, P.wg, 5); circ(100, 66, 44, P.wg, 5);
    flow(arcPath(100, 66, 44, 0, TAU, 40), P.fwd, 4, t, 1);
    flow([[10, 118], [190, 118]], P.fwd, 4, t, 1, 0.8); flash(100, 113, 34, P.gold, 0.5 + 0.3 * Math.sin(t * 5));
  };
  function arcPath(cx, cy, r, a0, a1, n) { var p = []; n = n || 48; for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; }
  V.comb = V.hop;
  V.ring = function (t) {
    seg2(10, 122, 190, 122, P.wg, 4); circ(100, 66, 46, P.wg, 4);
    var a = t * 2.2; glow(arcPath(100, 66, 46, a, a + 1.2, 16), P.fwd, 5, 14, 0.9); glow(arcPath(100, 66, 46, -a + 3, -a + 4.2, 16), P.pink, 5, 14, 0.9);
    dot(100 + 46 * Math.cos(-0.9), 66 + 46 * Math.sin(-0.9), 4, '#ffffff'); flash(100 + 46 * Math.cos(-0.9), 66 + 46 * Math.sin(-0.9), 16, '#ffffff', 0.5 + 0.5 * Math.sin(t * 6));
  };
  V.meter = function (t) {
    rect(26, 26, 148, 88, '#161b21', '#3a4550', 2); rect(36, 38, 128, 44, '#05080a', null);
    var v = (1550.37 + 0.0004 * Math.sin(t)).toFixed(3); txt(v, 100, 61, 22, '#7fe8a2', 'center', 600, true);
    var tel = noise(t * 9) > 0.5 ? 1 : 0; dot(46, 98, 5, tel ? P.gold : '#444');
  };
  V.nine = function (t) { for (var i = 0; i < 9; i++) { var x = 58 + (i % 3) * 42, y = 28 + Math.floor(i / 3) * 42, on = Math.floor(t * 2.5) % 9 === i; rect(x - 16, y - 16, 32, 32, on ? P.gold : '#24303c', on ? '#fff3c4' : '#3b4a58', 2); txt(String(i + 1), x, y + 1, 18, on ? '#1b1405' : P.ink2, 'center', 800); } };
  V.laser = function (t) { laser(70, 70, 0.8, {}, t); flow([[110, 70], [196, 70]], P.fwd, 5, t, 1); };
  V.regimes = function (t) { var k = Math.floor(t / 1.2) % 5; for (var i = 0; i < 5; i++) { var on = i === k; rect(22 + i * 33, 120 - (i + 1) * 20, 26, (i + 1) * 20, on ? P.gold : '#2a3642', null); } txt(['I', 'II', 'III', 'IV', 'V'][k], 100, 22, 22, P.gold, 'center', 800); };
  V.isolator = function (t) { isolator(100, 70, 110, { h: 40 }); var u = (t / 1.4) % 1; flash(100 + lerp(-60, 60, u), 70, 18, P.fwd, 0.6); };
  function vig(kind, x, y, w, h, t) { var f = V[kind]; if (!f) return; var sc = Math.min(w / 200, h / 140); at(x + (w - 200 * sc) / 2, y + (h - 140 * sc) / 2, sc, 0, function () { f(t); }); }

  /* =====================================================================
     Module 0
     ===================================================================== */
  /* policy document arrives, fills, and is stamped; a padlock closes on the Next button */
  def('stamp', 6, function (u, t, p) {
    var slide = seg(u, 0, 0.14), fade = 1 - seg(u, 0.93, 1), word = p.word || 'MANDATORY';
    alpha(fade, function () {
      at(400, 300 + (1 - slide) * 420, 1, -0.04, function () {
        rect(-190 + 10, -245 + 12, 380, 490, 'rgba(0,0,0,0.45)', null);
        rect(-190, -245, 380, 490, P.paper, '#9aa4b0', 1.5);
        rect(-190, -245, 380, 54, '#27303a', null);
        txt(p.head || 'PHC-1550.4', -170, -218, 24, '#c9d3dd', 'left', 700, true);
        var nl = 9, typed = lin(u, 0.14, 0.45) * nl;
        for (var i = 0; i < nl; i++) { var f = clamp(typed - i); if (f <= 0) break; var L = (i % 3 === 2 ? 220 : 320) * f; rect(-160, -160 + i * 36, L, 12, i === 0 ? '#5b6673' : '#c3cad3', null); }
        /* Next button with padlock */
        rect(30, 160, 130, 48, '#0b5cab', null); txt(p.button || 'Next', 74, 185, 24, '#ffffff', 'center', 700);
        var lk = seg(u, 0.62, 0.7), lx = 132, ly = 184;
        rect(lx - 13, ly - 4, 26, 20, P.gold, null); var c = S.c; c.strokeStyle = P.gold; c.lineWidth = 4; c.beginPath(); c.arc(lx, ly - 4 - 6 * (1 - lk), 9, Math.PI, 0); c.stroke();
        stampMark(-40, 110, word, '#c62828', lin(u, 0.46, 0.9), -0.22);
      });
    });
    if (u > 0.47 && u < 0.55) flash(360, 410, 260, 'rgba(255,255,255,0.35)', 1 - lin(u, 0.47, 0.55));
  });

  /* something sent out comes back: a pulse leaves the laser, 3.3 percent of it returns from a glass face */
  def('echo', 4, function (u, t) {
    var y = 300, out = P2(190, y, 560, y), back = P2(560, y, 190, y), thru = P2(560, y, 790, y);
    /* glass block (n = 1.444): the flat face at x = 560 reflects ((n-1)/(n+1))^2 = 3.3 percent */
    var c = S.c, g = c.createLinearGradient(560, 0, 760, 0); g.addColorStop(0, 'rgba(150,210,255,0.32)'); g.addColorStop(1, 'rgba(150,210,255,0.08)');
    c.fillStyle = g; c.fillRect(560, 150, 230, 300); seg2(560, 150, 560, 450, '#d8ecff', 3);
    var al = bump(u, 0.7, 1) * 0.8;
    laser(130, y, 1.1, { alarm: al }, t);
    seg2(190, y, 560, y, 'rgba(86,212,255,0.12)', 2);
    pulse(out, lin(u, 0, 0.36) * 1.15, P.fwd, 0.18, 12);
    if (u > 0.33) { pulse(back, lin(u, 0.33, 0.72) * 1.12, P.back, 0.16, 3.2); pulse(thru, lin(u, 0.33, 0.6) * 1.2, 'rgba(86,212,255,0.85)', 0.25, 11); }
    var hit = bump(u, 0.31, 0.5); flash(560, y, 80, '#ffffff', hit * 0.8);
    for (var k = 0; k < 3; k++) { var r = lin(u, 0.33 + k * 0.05, 0.75 + k * 0.05); if (r > 0 && r < 1) circ(560, y, 20 + r * 160, 'rgba(255,255,255,' + (0.35 * (1 - r)).toFixed(3) + ')', 2); }
    for (k = 0; k < 3; k++) { var r2 = lin(u, 0.72 + k * 0.06, 1); if (r2 > 0 && r2 < 1) circ(180, y, 20 + r2 * 120, 'rgba(255,90,79,' + (0.5 * (1 - r2)).toFixed(3) + ')', 2.5); }
  });

  /* far-end grating coupler reflection ripples the light versus current curve */
  def('liRipple', 7, function (u, t) {
    chipSurf(40, 70, 720, 120);
    var y = 130;
    laser(105, y, 0.9, { alarm: 0.25 + 0.25 * Math.sin(u * TAU * 4) }, t);
    wgLine([[150, y], [650, y]], 5); gcFan(652, y, 1.3);
    flow([[152, y], [650, y]], P.fwd, 4, t, 1, 0.9);
    var rb = (u * 3) % 1; pulse(P2(648, y, 152, y), rb * 1.1, P.back, 0.12, 4, 0.9); flash(652, y, 40, 'rgba(255,90,79,0.9)', bump(rb, 0, 0.15));
    var m = screen(110, 250, 620, 290, [0, 120], [0, 9.5], { xl: 'Current', yl: 'Optical power' });
    var Ith = 18, liP = function (I) { if (I < Ith) return 0.06 * I * I / (Ith * Ith); var d = I - Ith; return 0.06 + 0.085 * d * (1 + 0.05 * Math.sin(TAU * d / 27 - 0.6)); };
    var Ie = 120 * seg(u, 0.02, 0.85); trace(m, liP, P.gold, 3.5, 0, Ie, 300);
    if (Ie > 1) { flash(m.X(Ie), m.Y(liP(Ie)), 22, P.gold, 0.9); }
    for (var k = 1; k <= 3; k++) { var Ik = Ith + 27 * k - 13; if (Ie > Ik + 6) alpha(0.85, function () { circ(m.X(Ik), m.Y(liP(Ik)), 16, P.back, 2.5); }); }
  });

  /* living tiles: a 2 x 2 (or n-column) grid on the stage, one row across a wide banner; the active tile is lit */
  function wideBanner() { return S.W / S.H >= 2; }
  function tiles(names, kinds, act, t, col) {
    var n = names.length, wide = wideBanner(), cols = wide ? n : Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
    var x0 = wide ? 30 : S.ox + 20, y0 = wide ? 24 : S.oy + 20, W = wide ? S.W - 60 : 760, H = wide ? S.H - 48 : 560, gap = 20;
    var tw2 = (W - gap * (cols - 1)) / cols, th = (H - gap * (rows - 1)) / rows, lp = Math.max(26, S.mf);
    for (var i = 0; i < n; i++) {
      var x = x0 + (i % cols) * (tw2 + gap), y = y0 + Math.floor(i / cols) * (th + gap), on = i === act;
      (function (i, x, y, on) {
        alpha(on ? 1 : 0.45, function () {
          rect(x, y, tw2, th, on ? 'rgba(86,212,255,0.07)' : 'rgba(255,255,255,0.02)', on ? (col || P.fwd) : '#2c3843', on ? 3 : 1.5);
          vig(kinds[i], x + 10, y + lp * 1.6, tw2 - 20, th - lp * 1.6 - 10, t);
          S.c.save(); S.c.beginPath(); S.c.rect(x, y, tw2 - 4, th); S.c.clip(); txt(names[i], x + 12, y + lp * 0.9, lp, on ? P.ink : P.ink2, 'left', 700); S.c.restore();
        });
      })(i, x, y, on);
    }
  }
  /* four key terms */
  def('glossary', 10, function (u, t, p) {
    tiles(p.terms || ['Feedback', 'Retaliation', 'Parasitic cavity', 'Mode hop'], ['feedback', 'retaliation', 'cavity', 'hop'], Math.floor(u * 4), t);
  }, { free: true });

  /* =====================================================================
     Badge, signature, references (one per module, parametrized)
     ===================================================================== */
  /* mantra badge with the module motif and the mantra beats lighting in turn */
  def('mantra', 8, function (u, t, p) {
    var beats = p.beats || ['Every interface reflects.', 'Every reflection is a cavity.', 'Every cavity hops.', 'Isolate. Angle. Verify.'];
    var hue = p.col || P.gold, W = S.W, H = S.H, n = beats.length, act = Math.floor(u * n), px = Math.max(44, S.mf);
    var cw = beats.map(function (b) { return tw(b, px, 700) + 44; }), chh = px * 1.9, gap = 22;
    var R = Math.min(H * 0.36, W * 0.2, 230), bx, by, layout;
    var rowW = cw.reduce(function (a, b) { return a + b; }, 0) + gap * (n - 1), col2 = Math.max(cw[0] + cw[1], cw[2] + cw[3]) + gap;
    if (W - (2 * R + 120) > rowW + 40) layout = 'row';
    else if (W - (2 * R + 120) > col2 + 40 && H > 2 * chh + gap + 60) layout = 'grid';
    else if (W > 2 * R + 140 + Math.max.apply(null, cw) && H > n * (chh + 14) + 40) layout = 'col';
    else layout = 'one';
    if (layout === 'one' && H > 2 * R + chh + 120) { bx = W / 2; by = H / 2 - chh / 2 - 20; } else { bx = Math.max(R + 40, (W - (2 * R + 60 + (layout === 'row' ? rowW : layout === 'grid' ? col2 : Math.max.apply(null, cw)))) / 2 + R); by = H / 2; }
    /* badge */
    flash(bx, by, R * 1.6, hue, 0.18 + 0.08 * Math.sin(t * 2));
    dot(bx, by, R, '#0c131b'); circ(bx, by, R, hue, 6); circ(bx, by, R * 0.86, hue, 2, [6, 10], -t * 30);
    for (var i = 0; i < 24; i++) { var a = i / 24 * TAU + t * 0.25; seg2(bx + R * 1.05 * Math.cos(a), by + R * 1.05 * Math.sin(a), bx + R * 1.14 * Math.cos(a), by + R * 1.14 * Math.sin(a), hue, 3); }
    S.c.save(); S.c.beginPath(); S.c.arc(bx, by, R * 0.8, 0, TAU); S.c.clip(); vig(p.motif || 'laser', bx - R * 0.75, by - R * 0.55, R * 1.5, R * 1.1, t); S.c.restore();
    /* beats */
    function chip(i, x, y) {
      var on = i === act, done = i < act, w = cw[i];
      rect(x, y - chh / 2, w, chh, on ? hue : done ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', on ? '#ffffff' : '#3a4654', on ? 3 : 1.5);
      if (on) flash(x + w / 2, y, w * 0.6, hue, 0.25);
      txt(beats[i], x + w / 2, y + 1, px, on ? '#1b1405' : done ? P.ink : P.ink3, 'center', 700);
    }
    var x0 = bx + R + 60;
    if (layout === 'row') { var x = x0; for (i = 0; i < n; i++) { chip(i, x, by); x += cw[i] + gap; } }
    else if (layout === 'grid') { for (i = 0; i < n; i++) chip(i, x0 + (i % 2 ? cw[i - 1] + gap : 0), by + (i < 2 ? -1 : 1) * (chh / 2 + gap / 2)); }
    else if (layout === 'col') { for (i = 0; i < n; i++) chip(i, x0, by + (i - (n - 1) / 2) * (chh + 14)); }
    else { var ci = act, w1 = cw[ci]; if (H > 2 * R + chh + 120) chip(ci, W / 2 - w1 / 2, by + R + chh / 2 + 40); else chip(ci, Math.min(x0, W - w1 - 10), by); }
  }, { free: true });

  /* attestation: a signature is drawn, the box is ticked, the seal comes down */
  def('signature', 7, function (u, t, p) {
    var seed = p.seed || 1, col = p.col || '#b3261e', fade = 1 - seg(u, 0.94, 1);
    alpha(fade, function () {
      rect(140, 70, 540, 470, 'rgba(0,0,0,0.4)', null); rect(130, 60, 540, 470, P.paper, '#9aa4b0', 1.5);
      for (var i = 0; i < 6; i++) rect(170, 110 + i * 34, i === 5 ? 260 : 460, 11, '#c3cad3', null);
      /* checkbox */
      rect(170, 330, 34, 34, '#ffffff', '#5b6673', 2.5); rect(222, 342, 300, 11, '#9aa4b0', null);
      var tk = seg(u, 0.6, 0.68); if (tk > 0) line([[178, 347], [178 + 8 * Math.min(1, tk * 2), 347 + 8 * Math.min(1, tk * 2)]].concat(tk > 0.5 ? [[186 + 14 * (tk - 0.5) * 2, 355 - 22 * (tk - 0.5) * 2]] : []), '#1f7a3a', 5);
      seg2(170, 470, 520, 470, '#5b6673', 2);
      /* signature: a looping trochoid with a seeded envelope */
      var e = seg(u, 0.1, 0.55), N = 220, pts = [];
      for (var k = 0; k <= N * e; k++) {
        var s = k / N, ph = s * TAU * 6.5, env = 0.55 + 0.45 * noise(s * 7 + seed * 3.1);
        pts.push([185 + s * 300 - 15 * Math.sin(ph) * env, 452 - 26 * env * Math.cos(ph) * (0.6 + 0.4 * Math.sin(s * 9 + seed)) - 10 * Math.sin(s * Math.PI)]);
      }
      line(pts, '#173a8a', 3.2);
      if (pts.length && e < 1) { var q = pts[pts.length - 1]; at(q[0], q[1], 1, -0.7, function () { rect(0, -5, 120, 10, '#2b2f35', null); rect(-14, -3, 14, 6, '#c9a24a', null); }); }
      if (e >= 1) { var fl = seg(u, 0.55, 0.6); line([[200, 482], [200 + 290 * fl, 476 - 6 * Math.sin(fl * 3)]], '#173a8a', 2.6); }
      /* seal */
      var sk = lin(u, 0.68, 0.92);
      if (sk > 0) {
        var sc = 1 + 1.2 * (1 - seg(sk, 0, 0.3));
        at(590, 430, sc, -0.15, function () {
          alpha(seg(sk, 0, 0.15), function () {
            dot(0, 0, 66, col); circ(0, 0, 66, 'rgba(0,0,0,0.25)', 4); circ(0, 0, 48, 'rgba(255,255,255,0.75)', 2);
            ringText('PHC-1550.4 ATTESTED ', 0, 0, 56, 12, 'rgba(255,255,255,0.9)', 0);
            txt(p.mark || String(seed), 0, 2, 40, '#ffffff', 'center', 900);
          });
        });
      }
    });
  });

  /* reference strip: the module's literature figures slide past on white cards */
  var IMG = {};
  function img(src) {
    if (typeof Image === 'undefined') return null;
    var im = IMG[src]; if (!im) { im = IMG[src] = new Image(); im.src = src; }
    return im.complete && im.naturalWidth ? im : null;
  }
  def('litSlide', 1, function (u, t, p) {
    var figs = p.figs || [], W = S.W, H = S.H; if (!figs.length) return;
    var ch = H * 0.6, pad = 40, lab = Math.max(22, S.mf);
    var ws = figs.map(function (f) { return ch * (f[2] || 1.3); }), total = ws.reduce(function (a, b) { return a + b + pad; }, 0);
    var speed = 70, off = (t * speed) % total, cy = H * 0.44;
    for (var rep = -1; rep <= Math.ceil(W / total) + 1; rep++) {
      var x = rep * total - off;
      figs.forEach(function (f, i) {
        var w = ws[i], cx = x + w / 2, dist = Math.abs(cx - W / 2) / (W / 2), sc = 1.06 - 0.12 * clamp(dist);
        if (x + w > -50 && x < W + 50) {
          at(cx, cy, sc, 0, function () {
            rect(-w / 2 + 8, -ch / 2 + 10, w, ch, 'rgba(0,0,0,0.5)', null);
            rect(-w / 2, -ch / 2, w, ch, '#ffffff', null);
            var im = img(f[0]);
            if (im) { var iw = im.naturalWidth, ih = im.naturalHeight, s2 = Math.min((w - 20) / iw, (ch - 20) / ih); S.c.drawImage(im, -iw * s2 / 2, -ih * s2 / 2, iw * s2, ih * s2); }
            else for (var k = 0; k < 5; k++) rect(-w / 2 + 20, -ch / 2 + 24 + k * ch / 6, (w - 40) * (k % 2 ? 0.7 : 1), 10, '#d8dde3', null);
            alpha(0.55 * clamp(dist), function () { rect(-w / 2, -ch / 2, w, ch, '#0b1118', null); });
          });
          txt(f[1], cx, cy + ch * sc / 2 + lab * 1.1, lab, dist < 0.25 ? P.ink : P.ink3, 'center', 600);
        }
        x += w + pad;
      });
    }
  }, { free: true });

  /* =====================================================================
     Module 1: recognizing feedback
     ===================================================================== */
  /* returned field adds to the cavity field with the round-trip phase: power, phase and delay */
  def('feedbackDelay', 8, function (u, t) {
    var y = 210, d = 470 + 70 * Math.sin(u * TAU), lam = 56, ph = 2 * TAU * (d - 190) / lam;
    var fac = laser(120, y, 1.05, {}, t);
    mirror(d, y, 130);
    var pts = [], bp = [];
    for (var x = fac[0]; x <= d - 6; x += 3) { pts.push([x, y - 30 + 16 * Math.sin(TAU * (x - t * 60) / lam)]); bp.push([x, y + 30 + 6 * Math.sin(TAU * (x + t * 60) / lam + ph)]); }
    glow(pts, P.fwd, 3, 12, 0.9); glow(bp, P.back, 2.5, 10, 0.9);
    arrowHead(d - 14, y - 30, 0, 16, P.fwd); arrowHead(fac[0] + 6, y + 30, Math.PI, 14, P.back);
    seg2(fac[0], y + 92, d, y + 92, '#55606c', 2); arrowHead(d, y + 92, 0, 12, '#55606c'); arrowHead(fac[0], y + 92, Math.PI, 12, '#55606c');
    /* phasor: cavity field plus a small returned field at the round-trip phase */
    var cx = 330, cy = 460, A = 150, a = 48, ex = cx + A + a * Math.cos(ph), ey = cy - a * Math.sin(ph);
    circ(cx + A, cy, a, 'rgba(255,90,79,0.35)', 2, [5, 7]);
    arrow(cx, cy, cx + A, cy, P.fwd, 5, 18); arrow(cx + A, cy, ex, ey, P.back, 4, 14); arrow(cx, cy, ex, ey, '#ffffff', 3, 16);
    var pw = Math.pow(Math.hypot(ex - cx, ey - cy) / (A + a), 2);
    rect(600, 380, 46, 160, '#0c1218', '#3a4654', 2); rect(606, 534 - 148 * pw, 34, 148 * pw, P.gold, null); flash(623, 534 - 148 * pw, 30, P.gold, 0.6);
  });

  /* reflections light up at every interface; the isolator after the taper absorbs all but the first */
  def('linkReflect', 6, function (u, t) {
    var y = 390;
    chipSurf(150, y - 80, 420, 160);
    var fac = laser(96, y, 0.8, {}, t);
    poly([[200, y - 20], [250, y - 4], [250, y + 4], [200, y + 20]], '#8f89c4', '#c2c9f2', 1.5);
    isolator(305, y, 70, { h: 30 });
    wgLine([[340, y], [420, y]], 4); wgLine([[420, y], [460, y - 40], [520, y - 40]], 4); wgLine([[420, y], [460, y + 40], [520, y + 40]], 4);
    gcFan(522, y - 40, 0.9); gcFan(522, y + 40, 0.9);
    fiber([[560, y - 40], [640, y - 40]], P.jacket, 5); ferrule(660, y - 40, 0.55, {});
    var path = mkPath([[fac[0], y], [420, y], [460, y - 40], [660, y - 40]]), u2 = lin(u, 0, 0.6);
    pulse(path, u2 * 1.1, P.fwd, 0.12, 8);
    var refl = [[250, 0.18, 0.12], [420, 0.4, 0.5], [522, 0.6, 0.85], [660, 0.86, 1]];
    refl.forEach(function (r, i) {
      var s0 = r[1] * 0.6 / 1.1; if (u < s0) return;
      var back = mkPath([[r[0], y + (i >= 2 ? -40 : 0)], [i >= 2 ? 460 : r[0], y + (i >= 2 ? -40 : 0)], [i >= 2 ? 420 : r[0], y]].concat([[fac[0], y]]));
      flash(r[0], y + (i >= 2 ? -40 : 0), 40, 'rgba(255,90,79,0.9)', bump(u, s0, s0 + 0.08));
      var stop = i === 0 ? 1 : (back.len - (340 - fac[0])) / back.len, pr = lin(u, s0, s0 + 0.35) * 1.1;
      if (pr < stop + 0.01) pulse(back, Math.min(pr, stop), P.back, 0.1, i === 0 ? 2 : 4);
      if (i > 0) flash(340, y, 34, 'rgba(255,154,82,0.9)', bump(pr, stop - 0.02, stop + 0.2));
    });
    /* light returned to the laser: only the taper, before the isolator, reaches it; it stays under the budget line */
    var bx = 70, bt = 170, bh = 140, lv = 0.28 * bump(u, refl[0][1] * 0.6 / 1.1 + 0.05, refl[0][1] * 0.6 / 1.1 + 0.3);
    rect(bx, bt, 52, bh, '#0c1218', '#3a4654', 2); rect(bx + 6, bt + bh - 4 - (bh - 8) * lv, 40, (bh - 8) * lv, P.ok, null);
    seg2(bx - 10, bt + bh * 0.55, bx + 62, bt + bh * 0.55, P.gold, 2.5, [7, 5]); txt('-50 dB', bx + 72, bt + bh * 0.55, 20, P.gold, 'left', 700);
    arrow(bx + 26, bt + bh + 6, bx + 26, y - 40, '#55606c', 2, 10);
  });

  /* laser line on a spectrum screen. mode 'regimes' steps the feedback through regimes I to V (Tkach and
     Chraplyvy 1986); 'cycle' shows narrowing, broadening, hops and coherence collapse; 'moving' moves a flat
     connector near the laser while the collapsed line stays broad */
  def('linewidth', 10, function (u, t, p) {
    var mode = p.mode || 'regimes', top = mode === 'moving' ? 230 : 150;
    var m = screen(110, top, 600, 520 - top, [-1, 1], [0, 1.1]);
    var x0 = 0, wdt = 0.02, amp = 1, hops = false, label = '', k;
    if (mode === 'regimes') {
      k = Math.floor(u * 5);
      wdt = [0.025 + 0.015 * Math.sin(t * 2.5), 0.02, 0.008, 0.35, 0.006][k]; amp = [1, 1, 1, 0.32, 1][k]; hops = k === 1; label = ['I', 'II', 'III', 'IV', 'V'][k];
      for (var i = 0; i < 5; i++) { var on = i <= k; rect(30, 470 - (i + 1) * 60, 44, 54, on ? (i === 3 ? P.back : P.gold) : '#1e2832', i === k ? '#ffffff' : null, 2); }
      txt(label, 52, 120, 40, k === 3 ? P.back : P.gold, 'center', 800);
    } else if (mode === 'cycle') {
      k = Math.floor(u * 4); var f = (u * 4) % 1;
      wdt = [lerp(0.05, 0.006, seg(f, 0.1, 0.7)), lerp(0.02, 0.12, seg(f, 0.1, 0.7)), 0.015, 0.4][k]; amp = [1, lerp(1, 0.55, seg(f, 0.1, 0.7)), 1, 0.3][k]; hops = k === 2;
      label = (p.words || ['narrowing', 'broadening', 'mode hops', 'coherence collapse'])[k];
      txt(label, 410, 110, 32, k === 3 ? P.back : P.gold, 'center', 700);
    } else {
      wdt = 0.38; amp = 0.3;
      var cxp = 430 + 120 * Math.sin(u * TAU);
      laser(150, 120, 0.9, { alarm: 0.7 }, t); fiber([[196, 120], [760, 120]], P.jacket, 5);
      ferrule(cxp, 120, 0.7, { hot: 0.5 + 0.3 * Math.sin(t * 9) }); ferrule(cxp + 6, 120, 0.7, { dir: -1 });
      pulse(P2(cxp, 120, 200, 120), (u * 4) % 1, P.back, 0.2, 4);
    }
    if (hops) x0 = [-0.3, 0, 0.3, 0][Math.floor(hash(Math.floor(t * 3)) * 4)];
    var jit = wdt > 0.2 ? (noise(t * 5) - 0.5) * 0.06 : 0;
    var col = wdt > 0.2 ? P.back : P.fwd;
    trace(m, function (x) { var v = amp * lor(x, x0 + jit, wdt); if (wdt > 0.2) v *= 1 + 0.18 * (hash(Math.floor(x * 140) + Math.floor(t * 12)) - 0.5); return v + 0.012; }, col, 3, -1, 1, 500);
  });

  /* delayed self-heterodyne beat note: 'restore' drops the isolator back in and the beat narrows;
     'compare' shows the same laser on a setup without and with an input isolator */
  def('beatNote', 7, function (u, t, p) {
    function beat(m, wd, a) { trace(m, function (x) { var v = a * lor(x, 0, wd); if (wd > 0.15) v *= 1 + 0.2 * (hash(Math.floor(x * 120) + Math.floor(t * 10)) - 0.5); return v + 0.015; }, wd > 0.15 ? P.back : P.teal, 3, -1, 1, 400); }
    if (p.mode === 'compare') {
      [0, 1].forEach(function (i) {
        var x = 40 + i * 390, iso = i === 1;
        laser(x + 60, 140, 0.55, { alarm: iso ? 0 : 0.5 }, t); fiber([[x + 90, 140], [x + 350, 140]], P.jacket, 4);
        if (iso) isolator(x + 190, 140, 90, { h: 28 }); else { ferrule(x + 220, 140, 0.5, { hot: 0.6 + 0.3 * Math.sin(t * 7) }); pulse(P2(x + 215, 140, x + 95, 140), (u * 3) % 1, P.back, 0.3, 3); }
        var m = screen(x + 10, 230, 330, 300, [-1, 1], [0, 1.1], { nx: 6, ny: 5 });
        beat(m, iso ? 0.05 : 0.45, iso ? 1 : 0.3);
        seg2(x + 175, 230, x + 175, 530, 'rgba(255,255,255,0.12)', 1.5, [6, 6]);
      });
      return;
    }
    var drop = seg(u, 0.25, 0.4) * (1 - seg(u, 0.88, 0.98)), y = 130;
    laser(110, y, 0.8, { alarm: 0.6 * (1 - drop) }, t);
    fiber([[150, y], [300, y]], P.jacket, 5); fiber([[460, y], [740, y]], P.jacket, 5);
    seg2(300, y, 460, y, 'rgba(232,197,71,' + (0.6 * (1 - drop)).toFixed(2) + ')', 5, [10, 8]);
    isolator(380, y - (1 - drop) * 110, 150, { h: 40 });
    if (drop < 0.5) pulse(P2(740, y, 150, y), (u * 3) % 1, P.back, 0.15, 4);
    var m = screen(110, 250, 580, 300, [-1, 1], [0, 1.1]);
    beat(m, lerp(0.45, 0.04, drop), lerp(0.3, 1, drop));
  });

  /* the isolator is lifted out to win back its insertion loss: the meter goes up, and so does the laser's temper */
  def('isoRemove', 8, function (u, t) {
    var out = seg(u, 0.15, 0.3) * (1 - seg(u, 0.75, 0.9)), y = 300;
    laser(110, y, 1, { alarm: out * (0.7 + 0.3 * Math.sin(t * 8)) }, t);
    fiber([[160, y], [300, y]], P.jacket, 6); fiber([[480, y], [600, y]], P.jacket, 6);
    seg2(300, y, 480, y, 'rgba(232,197,71,' + (0.9 * out).toFixed(2) + ')', 6);
    flow([[160, y], [600, y]], P.fwd, 5, t, 1, 0.8);
    isolator(390, y - out * 150, 170, { h: 44 });
    ferrule(620, y, 0.8, { hot: out * (0.5 + 0.4 * Math.sin(t * 6)) });
    if (out > 0.5) pulse(P2(615, y, 165, y), (u * 4) % 1, P.back, 0.18, 4);
    /* power meter: up by the insertion loss */
    rect(650, 120, 110, 150, '#161b21', '#3a4550', 2); rect(662, 140, 86, 110, '#05080a', null);
    var lv = 0.62 + 0.1 * out; rect(690, 246 - 100 * lv, 30, 100 * lv, P.ok, null);
    if (out > 0.5) { arrow(705, 120 - 10, 705, 80, P.ok, 4, 16); }
  });

  /* speak up: the approved phrase types into a bubble over a small scene */
  def('speakUp', 9, function (u, t, p) {
    var text = p.text || 'I noticed something on the optical path. Can we pause and check it together?';
    var pop = seg(u, 0.02, 0.1), fade = 1 - seg(u, 0.93, 1);
    alpha(fade, function () {
      /* scene */
      var icon = p.icon || 'isolator', y = 470;
      if (icon === 'isolator') { laser(140, y, 0.9, { alarm: 0.5 }, t); fiber([[186, y], [330, y]], P.jacket, 5); ferrule(350, y, 0.6, {}); ferrule(500, y, 0.6, { dir: -1 }); fiber([[530, y], [700, y]], P.jacket, 5); isolator(425, y - 80 - 8 * Math.sin(t * 2), 120, { h: 34 }); seg2(370, y, 480, y, 'rgba(232,197,71,0.35)', 4, [8, 8]); }
      else if (icon === 'clock') {
        var cx = 400, cy = y; dot(cx, cy, 90, '#141b23'); circ(cx, cy, 90, P.ink2, 4);
        for (var i = 0; i < 12; i++) { var a = i / 12 * TAU; seg2(cx + 78 * Math.sin(a), cy - 78 * Math.cos(a), cx + 88 * Math.sin(a), cy - 88 * Math.cos(a), P.ink2, 3); }
        var hm = t * TAU / 4, hh = hm / 12 + 5.2; arrow(cx, cy, cx + 50 * Math.sin(hh), cy - 50 * Math.cos(hh), P.ink, 5, 12); arrow(cx, cy, cx + 74 * Math.sin(hm), cy - 74 * Math.cos(hm), P.gold, 3, 12);
        vig('split', 560, y - 70, 200, 140, t); vig('split', 40, y - 70, 200, 140, t + 1);
      }
      /* bubble */
      at(400, 210, 0.6 + 0.4 * pop, 0, function () {
        var lines = wrap(text, 560, 34, 600), lh = Math.max(34, S.mf) * 1.3, bh = lines.length * lh + 56, bw = 620;
        rect(-bw / 2 + 8, -bh / 2 + 10, bw, bh, 'rgba(0,0,0,0.45)', null);
        rect(-bw / 2, -bh / 2, bw, bh, '#ffffff', null);
        poly([[-40, bh / 2 - 1], [10, bh / 2 - 1], [-60, bh / 2 + 50]], '#ffffff', null);
        var n = text.length, shown = Math.floor(n * lin(u, 0.1, 0.6)), cnt = 0;
        lines.forEach(function (l, i) { var s = l.slice(0, Math.max(0, shown - cnt)); cnt += l.length + 1; txt(s, -bw / 2 + 30, -bh / 2 + 28 + lh * (i + 0.5), 34, '#141a20', 'left', 600); });
        for (var k = 0; k < 3; k++) { var r = ((t * 0.9 + k / 3) % 1); circ(bw / 2 - 10, -bh / 2 + 10, 20 + r * 60, 'rgba(56,224,184,' + (0.6 * (1 - r)).toFixed(2) + ')', 3); }
      });
    });
  });

  /* =====================================================================
     Module 2: every interface is a cavity
     ===================================================================== */
  /* two cleaved silicon facets (R = 0.31 each, n = 3.48): a pulse rings down between them; every round trip
     adds a transmitted pulse (field ratio r1 r2 = 0.31), and the transmission fringes build from the partial sums */
  def('etalon', 7, function (u, t) {
    var R = 0.31, r = Math.sqrt(R), y = 420, xa = 250, xb = 520;
    var c = S.c, g = c.createLinearGradient(xa, 0, xb, 0); g.addColorStop(0, '#5d6676'); g.addColorStop(1, '#454d5b');
    c.fillStyle = g; c.fillRect(xa, y - 80, xb - xa, 160); seg2(xa, y - 80, xa, y + 80, '#dfe8f5', 4); seg2(xb, y - 80, xb, y + 80, '#dfe8f5', 4);
    var rt = 0.16, tin = lin(u, 0, 0.12);
    pulse(P2(40, y, xa, y), tin * 1.15, P.fwd, 0.35, 10);
    var nb = 7, s0 = 0.12;
    for (var k = 0; k < nb; k++) {
      var a0 = s0 + k * rt / 2, f = lin(u, a0, a0 + rt / 2); if (f <= 0) break;
      var dir = k % 2 ? -1 : 1, amp = Math.pow(r, k), x0 = dir > 0 ? xa : xb, x1 = dir > 0 ? xb : xa;
      if (f < 1) pulse(P2(x0, y, x1, y), f * 1.1, P.violet, 0.3, 3 + 8 * amp, 0.25 + 0.75 * amp);
      if (dir > 0) { var ae = Math.pow(r, k), tf = lin(u, a0 + rt / 2, a0 + rt / 2 + 0.25); if (tf > 0) pulse(P2(xb, y - 0, 790, y - 0), tf * 1.15, P.fwd, 0.3, 3 + 8 * ae, 0.2 + 0.8 * ae); flash(xb, y, 50, P.violet, bump(u, a0 + rt / 2 - 0.02, a0 + rt / 2 + 0.06) * (0.3 + 0.7 * amp)); }
    }
    var N = 1 + Math.floor(lin(u, s0 + rt, s0 + rt * 4) * 4);
    var m = screen(140, 70, 520, 200, [0, 3 * TAU], [0, 1.08], { nx: 6, ny: 4 });
    trace(m, function (ph) { var re = 0, im = 0; for (var k2 = 0; k2 < N; k2++) { re += Math.pow(R, k2) * Math.cos(k2 * ph); im += Math.pow(R, k2) * Math.sin(k2 * ph); } return (1 - R) * (1 - R) * (re * re + im * im); }, P.gold, 3, 0, 3 * TAU, 300);
  });

  /* lossless Airy transmission: the mirrors weaken and strengthen, the period stays exact */
  def('airy', 8, function (u, t) {
    var R = lerp(0.03, 0.6, 0.5 - 0.5 * Math.cos(u * TAU));
    var m = screen(110, 70, 590, 360, [0, 3 * TAU], [0, 1.05], { yl: 'Transmission' });
    var T = function (ph) { return (1 - R) * (1 - R) / (1 + R * R - 2 * R * Math.cos(ph)); };
    trace(m, T, P.gold, 3.5, 0, 3 * TAU, 400);
    var y = 485, xa = m.X(TAU), xb = m.X(2 * TAU);
    seg2(xa, m.y, xa, y, 'rgba(86,212,255,0.5)', 2, [6, 6]); seg2(xb, m.y, xb, y, 'rgba(86,212,255,0.5)', 2, [6, 6]);
    arrow(xa + (xb - xa) / 2, y, xb - 2, y, P.fwd, 3, 14); arrow(xa + (xb - xa) / 2, y, xa + 2, y, P.fwd, 3, 14);
    txt('FSR', (xa + xb) / 2, y + 30, 24, P.fwd, 'center', 700);
    rect(730, 90, 36, 360, '#0c1218', '#3a4654', 2); var hh = 352 * R / 0.6; rect(734, 446 - hh, 28, hh, P.violet, null);
    txt('R', 748, 470, 24, P.violet, 'center', 800);
  });

  /* a high-gain erbium waveguide between two facets: round trips grow, a narrow line rises at the fluorescence peak */
  def('accidentalLaser', 8, function (u, t) {
    var y = 150, xa = 170, xb = 630, gain = seg(u, 0.05, 0.75);
    rect(xa, y - 34, xb - xa, 68, '#2a2236', null);
    var c = S.c, g = c.createLinearGradient(xa, 0, xb, 0); g.addColorStop(0, 'rgba(255,111,216,0.25)'); g.addColorStop(0.5, 'rgba(255,111,216,' + (0.35 + 0.35 * gain).toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,111,216,0.25)');
    c.fillStyle = g; c.fillRect(xa, y - 10, xb - xa, 20);
    seg2(xa, y - 50, xa, y + 50, '#dfe8f5', 4); seg2(xb, y - 50, xb, y + 50, '#dfe8f5', 4);
    for (var i = 0; i < 14; i++) { var px = xa + 20 + ((i * 37 + t * 40) % (xb - xa - 40)); dot(px, y + 22 * Math.sin(i * 2.1), 2, 'rgba(255,170,230,0.7)'); }
    var rt = (t / 1.2) % 1, x = rt < 0.5 ? lerp(xa, xb, rt * 2) : lerp(xb, xa, (rt - 0.5) * 2);
    glow([[x - 40, y], [x + 40, y]], P.pink, 4 + 10 * gain, 20, 0.4 + 0.6 * gain);
    flash(xb + 10, y, 60, P.pink, gain * bump(rt, 0.4, 0.6));
    var m = screen(120, 290, 560, 240, [0, 1], [0, 1.1], { xl: 'Wavelength' });
    var ase = function (x) { return 0.55 * Math.exp(-Math.pow((x - 0.3) / 0.05, 2)) + 0.32 * Math.exp(-Math.pow((x - 0.55) / 0.17, 2)); };
    trace(m, function (x) { return ase(x) * (0.8 + 0.2 * gain) + gain * gain * 0.5 * lor(x, 0.3, 0.004); }, P.pink, 3, 0, 1, 600);
  });

  /* fiber tip to chip facet: the air gap is a cavity, and its period follows the gap, lambda^2 / (2 L) */
  def('gapRipple', 8, function (u, t) {
    var L = Math.round(40 + 15 * Math.sin(u * TAU)), y = 160, fx = 470, s = 3, tip = fx - L * s;
    rect(fx, y - 70, 300, 140, '#4f5664', null); rect(fx, y - 70, 300, 140, null, '#7d8796', 1.5);
    wgLine([[fx, y], [760, y]], 4); seg2(fx, y - 70, fx, y + 70, '#e3ecf7', 3);
    rect(tip - 300, y - 40, 300, 80, 'rgba(200,225,255,0.18)', null); rect(tip - 300, y - 8, 300, 16, 'rgba(120,200,255,0.45)', null); seg2(tip, y - 40, tip, y + 40, '#e3ecf7', 3);
    var b = (t * 2.2) % 1; flash(tip + (fx - tip) * b, y, 18, P.violet, 0.9); flash(tip + (fx - tip) * (1 - b), y, 18, P.violet, 0.6);
    seg2(tip, y + 60, fx, y + 60, P.ink2, 2); arrowHead(tip, y + 60, Math.PI, 10, P.ink2); arrowHead(fx, y + 60, 0, 10, P.ink2);
    var dl = 1550 * 1550 / (2 * L * 1000);
    txt('L = ' + L.toFixed(0) + ' µm', (tip + fx) / 2, y + 92, 24, P.ink, 'center', 700, true);
    txt('Δλ = ' + dl.toFixed(1) + ' nm', 620, 64, 26, P.gold, 'center', 700, true);
    var m = screen(110, 300, 600, 230, [1500, 1600], [-0.75, 0.15], { xl: 'Wavelength' });
    var R1 = 0.034, R2 = 0.03;
    trace(m, function (l) { var ph = 4 * Math.PI * L * 1000 / l; return 10 * Math.log10((1 - R1) * (1 - R2) / (1 + R1 * R2 - 2 * Math.sqrt(R1 * R2) * Math.cos(ph))); }, P.gold, 3, 1500, 1600, 500);
  });

  /* how did Gary feel: puns as living tiles (one big tile on the stage, a row on a wide banner) */
  def('feltCycle', 10, function (u, t, p) {
    var words = p.words || ['Ashamed', 'Reflective', 'Isolated', 'Logged'], kinds = p.kinds || ['blush', 'mirror', 'isolated', 'logged'], n = words.length;
    var k = Math.floor(u * n), f = (u * n) % 1, a = inout(f, 0, 0.12, 0.88, 1);
    if (wideBanner()) { tiles(words, kinds, k, t, P.gold); return; }
    S.c.translate(S.ox, S.oy);
    alpha(a, function () {
      rect(150, 50, 500, 370, 'rgba(255,255,255,0.03)', '#2c3843', 1.5);
      vig(kinds[k], 170, 70, 460, 330, t);
      txt(words[k], 400, 480, 56, P.gold, 'center', 800);
    });
    for (var i = 0; i < n; i++) rect(400 - n * 22 + i * 44, 545, 30, 8, i === k ? P.gold : '#2c3843', null);
  }, { free: true });

  /* index-matching gel fills the gap; the ripple goes away */
  def('gelFill', 8, function (u, t) {
    var fill = seg(u, 0.25, 0.45) * (1 - seg(u, 0.9, 0.98)), y = 450, fx = 470, tip = 420;
    rect(fx, y - 70, 300, 140, '#4f5664', null); wgLine([[fx, y], [760, y]], 4); seg2(fx, y - 70, fx, y + 70, '#e3ecf7', 3);
    rect(tip - 380, y - 40, 380, 80, 'rgba(200,225,255,0.18)', null); rect(tip - 380, y - 8, 380, 16, 'rgba(120,200,255,0.45)', null); seg2(tip, y - 40, tip, y + 40, '#e3ecf7', 3);
    /* syringe and drop */
    rect(430, 270, 30, 60, '#c7d2de', '#7d8796', 1.5); rect(441, 330, 8, 26, '#9aa4b0', null);
    var dropY = lerp(360, y - 20, seg(u, 0.12, 0.25)); if (u > 0.08 && u < 0.27) dot(445, dropY, 10, 'rgba(120,190,255,0.85)');
    if (fill > 0) { rect(tip, y - 60 * fill, fx - tip, 120 * fill, 'rgba(120,190,255,0.55)', null); }
    if (fill < 0.6) { var b = (t * 2.4) % 1; flash(tip + (fx - tip) * b, y, 16, P.violet, 0.8 * (1 - fill)); }
    var m = screen(110, 50, 600, 200, [1500, 1600], [-0.75, 0.15]);
    var R1 = lerp(0.034, 0.0001, fill), R2 = lerp(0.03, 0.0004, fill);
    trace(m, function (l) { var ph = 4 * Math.PI * 50000 / l; return 10 * Math.log10((1 - R1) * (1 - R2) / (1 + R1 * R2 - 2 * Math.sqrt(R1 * R2) * Math.cos(ph))); }, fill > 0.8 ? P.ok : P.gold, 3, 1500, 1600, 500);
  });

  /* a lab log entry is written, the old ripple is corrected, and it is sent */
  def('logbook', 8, function (u, t) {
    rect(100, 80, 600, 420, 'rgba(0,0,0,0.4)', null);
    rect(90, 70, 300, 420, '#f4efe1', '#b9ae92', 1.5); rect(400, 70, 300, 420, '#f4efe1', '#b9ae92', 1.5); seg2(395, 70, 395, 490, '#8a7f63', 4);
    for (var i = 0; i < 12; i++) { seg2(110, 110 + i * 32, 375, 110 + i * 32, '#d8cfb6', 1); seg2(420, 110 + i * 32, 685, 110 + i * 32, '#d8cfb6', 1); }
    /* left page: sketched spectrum with ripple, then struck through */
    var pts = []; for (var x = 0; x <= 230; x += 3) pts.push([125 + x, 260 - 40 * Math.exp(-Math.pow((x - 115) / 70, 2)) - 10 * Math.sin(x / 9)]);
    line(pts, '#1d4fa8', 2.5);
    var sk = seg(u, 0.5, 0.58); if (sk > 0) seg2(120, 300, 120 + 250 * sk, 190, '#c62828', 4);
    var pts2 = []; for (x = 0; x <= 230; x += 3) pts2.push([125 + x, 400 - 40 * Math.exp(-Math.pow((x - 115) / 70, 2))]);
    var e2 = seg(u, 0.58, 0.72); line(pts2.slice(0, Math.max(0, Math.floor(pts2.length * e2))), '#1f7a3a', 3);
    /* right page: handwriting */
    var n = 9, w = lin(u, 0.05, 0.5) * n;
    for (i = 0; i < n; i++) { var f = clamp(w - i); if (f <= 0) break; var p2 = []; for (var k = 0; k <= 60 * f; k++) p2.push([425 + k * 4, 106 + i * 32 - 4 * Math.abs(Math.sin(k * 0.9 + i)) - 2 * Math.sin(k * 2.3)]); line(p2, '#1d4fa8', 2); if (i === Math.floor(w)) at(p2[p2.length - 1][0], p2[p2.length - 1][1], 1, -0.8, function () { rect(0, -5, 110, 10, '#2b2f35', null); }); }
    /* envelope leaves */
    var ev = seg(u, 0.75, 0.95);
    if (ev > 0) at(lerp(560, 860, ev), lerp(420, 120, ev), 1, -0.3 * ev, function () { alpha(1 - lin(ev, 0.8, 1), function () { rect(-60, -38, 120, 76, '#ffffff', '#9aa4b0', 2); line([[-60, -38], [0, 8], [60, -38]], '#9aa4b0', 2); }); });
  });

  /* =====================================================================
     Module 3: classifying feedback (icons and category scenes)
     ===================================================================== */
  V.chipcav = function (t) { chipSurf(10, 40, 180, 60); rect(18, 52, 40, 36, '#c2a868', null); wgLine([[58, 70], [168, 70]], 3); gcFan(170, 70, 0.6); var u = (t / 1.6) % 1, x = u < 0.5 ? lerp(60, 168, u * 2) : lerp(168, 60, (u - 0.5) * 2); flash(x, 70, 18, P.violet, 0.9); };
  V.fiberTip = function (t) { laser(50, 70, 0.5, { alarm: 0.3 }, t); rect(120, 60, 80, 20, 'rgba(200,225,255,0.3)', null); seg2(120, 58, 120, 82, '#e3ecf7', 3); var u = (t / 1.2) % 1; pulse(P2(118, 70, 76, 70), u * 1.2, P.back, 0.3, 4); };
  V.vendor = function (t) { isolator(100, 62, 120, { h: 36 }); rect(60, 92, 80, 30, '#ffffff', '#9aa4b0', 1); txt('1310', 100, 107, 18, '#b3261e', 'center', 800, true); };
  V.splitter = function (t) { fiber([[10, 70], [70, 70]], P.jacket, 4); rect(70, 58, 50, 24, '#b9c0c8', null); [-36, -12, 12, 36].forEach(function (d, i) { fiber([[120, 70 + d * 0.3], [170, 70 + d]], P.jacket, 3); if (i % 2) flash(176, 70 + d, 16, 'rgba(255,90,79,0.9)', 0.5 + 0.5 * Math.sin(t * 5 + i)); }); };
  V.parcel = function (t) { var o = 0.5 + 0.5 * Math.sin(t * 1.5); poly([[60, 60], [140, 60], [140, 125], [60, 125]], '#b9894e', '#6e4f26', 2); poly([[60, 60], [100, 60 - 30 * o], [100, 60]], '#d1a265', null); poly([[140, 60], [100, 60 - 30 * o], [100, 60]], '#c29457', null); rect(82, 60 - 26 * o, 36, 16, '#5d6676', null); };
  V.scale = function (t) { var a = 0.25 * Math.sin(t * 1.3); seg2(100, 40, 100, 120, P.steel, 4); at(100, 44, 1, a, function () { seg2(-70, 0, 70, 0, P.steel, 4); seg2(-70, 0, -70, 30, P.steel, 1.5); seg2(70, 0, 70, 30, P.steel, 1.5); rect(-90, 30, 40, 6, P.steel, null); rect(50, 30, 40, 6, P.steel, null); }); };
  V.web = function (t) { var xs = [30, 62, 94, 126, 158, 182]; xs.forEach(function (x) { seg2(x, 90, x, 124, '#cfe0f0', 3); }); var n = 0; for (var i = 0; i < 6; i++) for (var j = i + 1; j < 6; j++) { var on = Math.floor(t * 4) % 15 === n++; var c = S.c; c.strokeStyle = on ? P.back : 'rgba(255,90,79,0.25)'; c.lineWidth = on ? 3 : 1.2; c.beginPath(); c.moveTo(xs[i], 88); c.quadraticCurveTo((xs[i] + xs[j]) / 2, 88 - (xs[j] - xs[i]) * 0.5, xs[j], 88); c.stroke(); } };
  V.spectrum = V.retaliation;

  /* nine categories as a living grid, one tile at a time */
  def('nineTiles', 9, function (u, t) {
    var kinds = ['chipcav', 'fiberTip', 'meter', 'vendor', 'splitter', 'parcel', 'scale', 'web', 'retaliation'], act = Math.floor(u * 9);
    for (var i = 0; i < 9; i++) {
      var x = 115 + (i % 3) * 195, y = 20 + Math.floor(i / 3) * 190, on = i === act;
      (function (i, x, y, on) {
        alpha(on ? 1 : 0.42, function () {
          rect(x, y, 180, 176, on ? 'rgba(242,201,76,0.08)' : 'rgba(255,255,255,0.02)', on ? P.gold : '#2c3843', on ? 3 : 1.5);
          vig(kinds[i], x + 8, y + 34, 164, 136, t);
          txt(String(i + 1), x + 16, y + 20, 22, on ? P.gold : P.ink3, 'left', 800);
        });
      })(i, x, y, on);
    }
  });

  /* category 1: the whole path from the laser to the far-end grating coupler is the cavity */
  def('chipCavity', 6, function (u, t) {
    chipSurf(40, 150, 720, 300);
    var y = 300, dx = 110;
    rect(dx - 60, y - 60, 120, 120, '#c2a868', '#7d6a40', 2); for (var i = 0; i < 8; i++) seg2(dx - 50 + i * 13, y - 52, dx - 40 + i * 13, y - 62, 'rgba(255,240,200,0.2)', 1);
    var path = [[dx + 60, y], [430, y], [470, y + 60], [660, y + 60]];
    wgLine(path, 5); gcFan(662, y + 60, 1.3);
    var pa = mkPath([[dx - 40, y]].concat(path)), rev = mkPath(pa.p.slice().reverse());
    var build = seg(u, 0.05, 0.7);
    glow(pa.p, P.violet, 6 + 6 * build, 24, 0.15 + 0.5 * build);
    var b = (t / 1.5) % 1; if (b < 0.5) pulse(pa, b * 2.1, P.fwd, 0.15, 7); else pulse(rev, (b - 0.5) * 2.1, P.back, 0.15, 5);
    flash(662, y + 60, 50, 'rgba(255,90,79,0.9)', bump(b, 0.42, 0.6));
    var ry = 410, re = seg(u, 0.35, 0.6);
    if (re > 0) { seg2(dx - 40, ry, lerp(dx - 40, 662, re), ry, P.gold, 3); arrowHead(dx - 40, ry, Math.PI, 12, P.gold); if (re >= 1) arrowHead(662, ry, 0, 12, P.gold); for (i = 0; i <= 20 * re; i++) seg2(dx - 40 + i * (702 - dx) / 20, ry - 8, dx - 40 + i * (702 - dx) / 20, ry, P.gold, 2); }
    txt('4 %', 700, y + 10, 26, P.back, 'center', 800);
  });

  /* every unit shows the same ripple at the same currents */
  def('sameRipple', 6, function (u, t) {
    var Ie = 100 * seg(u, 0.05, 0.8);
    for (var i = 0; i < 6; i++) {
      var x = 30 + (i % 3) * 255, y = 40 + Math.floor(i / 2.999) * 270, mx = x + 12;
      chipSurf(x, y, 230, 50); rect(x + 10, y + 12, 34, 26, '#c2a868', null); wgLine([[x + 44, y + 25], [x + 205, y + 25]], 2); gcFan(x + 207, y + 25, 0.5);
      var m = screen(mx, y + 74, 206, 160, [0, 100], [0, 8], { nx: 4, ny: 4 });
      trace(m, function (I) { if (I < 15) return 0.04 * I * I / 225; var d = I - 15; return 0.04 + 0.085 * d * (1 + 0.06 * Math.sin(TAU * d / 27)); }, P.gold, 2.5, 0, Ie, 200);
      for (var k = 0; k < 3; k++) { var Ik = 15 + 27 * (k + 0.25); if (Ie > Ik) seg2(m.X(Ik), m.y, m.X(Ik), m.y + m.h, 'rgba(255,90,79,0.55)', 2, [5, 5]); }
    }
  });

  /* category 2: a flat fused-silica end in air reflects 3.3 percent (n = 1.444, Malitson 1965); field r = 0.18 */
  def('fresnel', 4, function (u, t) {
    var n = 1.444, r = (n - 1) / (n + 1), tt = 2 * n / (n + 1), xi = 420, lam = 96, A = 62, w = TAU / 4 * 4;
    var c = S.c, g = c.createLinearGradient(40, 0, xi, 0); g.addColorStop(0, 'rgba(150,210,255,0.06)'); g.addColorStop(1, 'rgba(150,210,255,0.24)');
    c.fillStyle = g; c.fillRect(40, 120, xi - 40, 360); seg2(xi, 120, xi, 480, '#e3ecf7', 4);
    rect(40, 270, xi - 40, 60, 'rgba(120,200,255,0.14)', null);
    var ph = u * TAU, inc = [], tr = [], rf = [];
    for (var x = 40; x <= xi; x += 2) inc.push([x, 220 - A * Math.sin(TAU * x * n / lam - ph)]);
    for (x = xi; x <= 780; x += 2) tr.push([x, 220 - A * tt / Math.sqrt(n) * Math.sin(TAU * (xi * n + (x - xi)) / lam - ph)]);
    for (x = 40; x <= xi; x += 2) rf.push([x, 400 - A * r * Math.sin(TAU * (2 * xi - x) * n / lam - ph + Math.PI * 0)]);
    glow(inc, P.fwd, 3.5, 12, 0.9); glow(tr, P.fwd, 3.5, 12, 0.6); glow(rf, P.back, 3, 10, 0.95);
    arrowHead(xi - 20, 160, 0, 18, P.fwd); arrowHead(60, 400, Math.PI, 16, P.back);
    flash(xi, 300, 90, '#ffffff', 0.15 + 0.1 * Math.sin(ph * 2));
    txt('R = 3.3 %', 230, 470, 28, P.back, 'center', 800);
  });

  /* moving a lensed fiber in front of a reflecting facet: the laser output jumps */
  def('fiberWiggle', 6, function (u, t) {
    var z = Math.sin(u * TAU), y = 210;
    rect(40, y - 70, 160, 140, '#2a2f36', '#4d5560', 2); laser(120, y, 0.7, { alarm: 0.3 + 0.3 * Math.abs(Math.sin(u * TAU * 6)) }, t);
    var tip = 520 + 30 * z;
    fiber([[200, y], [tip - 30, y]], P.jacket, 6); poly([[tip - 30, y - 9], [tip - 2, y - 3], [tip, y], [tip - 2, y + 3], [tip - 30, y + 9]], '#e3ecf7', null);
    rect(620, y - 80, 150, 160, '#5d6676', '#8d97a6', 2); seg2(620, y - 80, 620, y + 80, '#e3ecf7', 4);
    flow([[tip, y], [618, y]], P.fwd, 4, t, 1, 0.8); pulse(P2(618, y, tip, y), (t * 1.5) % 1, P.back, 0.4, 3);
    /* output power versus time: a jump each half wavelength of travel (period lambda / 2) */
    var m = screen(110, 360, 580, 180, [0, 6], [0, 1.2], { xl: 'Time' });
    var now = u * 6, Pof = function (tm) { var zz = Math.sin(tm / 6 * TAU); return 0.55 + 0.2 * (Math.floor((zz + 1) * 3) % 2) + 0.06 * Math.sin(tm * 30) * 0; };
    trace(m, Pof, P.gold, 3, 0, now, 600);
    flash(m.X(now), m.Y(Pof(now)), 20, P.gold, 0.9);
  });

  /* period to length: the ripple period measures the distance to the second mirror */
  def('periodToLength', 8, function (u, t) {
    var m = screen(110, 50, 580, 200, [0, 4], [0, 1.1]);
    trace(m, function (x) { return 0.55 + 0.35 * Math.cos(TAU * x); }, P.gold, 3, 0, 4, 300);
    var a = seg(u, 0.1, 0.25); if (a > 0) { var x0 = m.X(1), x1 = m.X(2); seg2(x0, 270, x0 + (x1 - x0) * a, 270, P.fwd, 3); arrowHead(x0, 270, Math.PI, 12, P.fwd); if (a >= 1) arrowHead(x1, 270, 0, 12, P.fwd); txt('FSR', (x0 + x1) / 2, 296, 22, P.fwd, 'center', 700); }
    alpha(seg(u, 0.25, 0.35), function () { txt('L = c / (2 n FSR)', 400, 340, 28, P.ink, 'center', 700, true); });
    chipSurf(40, 380, 720, 170);
    var y = 465; rect(60, y - 30, 70, 60, '#c2a868', null);
    wgLine([[130, y], [700, y]], 4); gcFan(702, y, 1); rect(340, y - 16, 10, 32, '#9fb3c8', null); rect(520, y - 22, 34, 44, 'rgba(194,201,242,0.35)', '#c2c9f2', 1.5);
    var r = seg(u, 0.4, 0.75), xr = lerp(130, 702, r);
    if (r > 0) { seg2(130, y + 60, xr, y + 60, P.fwd, 3); for (var i = 0; i * 28 < xr - 130; i++) seg2(130 + i * 28, y + 52, 130 + i * 28, y + 60, P.fwd, 2); }
    var hit = u > 0.75; flash(702, y, 70, hit ? 'rgba(242,201,76,0.95)' : 'rgba(0,0,0,0)', hit ? 0.5 + 0.4 * Math.sin(t * 6) : 0);
    [345, 537].forEach(function (x) { if (r > 0 && xr > x) flash(x, y, 26, 'rgba(255,255,255,0.4)', 0.4); });
  });

  /* category 3: the instrument's own input reflects into the laser it is measuring */
  def('instrumentFeedback', 6, function (u, t) {
    var y = 300;
    laser(110, y, 0.9, { alarm: 0.55 }, t); fiber([[155, y], [430, y]], P.jacket, 5);
    rect(430, 150, 340, 300, '#1a2027', '#3e4955', 3); rect(430, 150, 340, 40, '#232b34', null);
    for (var i = 0; i < 4; i++) dot(470 + i * 30, 170, 6, i === 0 ? P.ok : '#3a4654');
    ferrule(450, y, 0.6, { hot: 0.5 + 0.4 * Math.sin(t * 7) });
    var m = screen(500, 220, 240, 190, [-1, 1], [0, 1.1], { nx: 5, ny: 4 });
    trace(m, function (x) { return 0.3 * lor(x, (noise(t * 4) - 0.5) * 0.1, 0.4) * (1 + 0.2 * (hash(Math.floor(x * 80) + Math.floor(t * 12)) - 0.5)) + 0.02; }, P.back, 2.5, -1, 1, 200);
    flow([[160, y], [430, y]], P.fwd, 4, t, 1, 0.7);
    pulse(P2(440, y, 160, y), (u * 3) % 1, P.back, 0.25, 4);
  });

  /* category 4: an isolator for 1310 nm in a 1550 nm link. Single-stage Faraday model: rotation 45 deg (1310/lambda)^2,
     isolation -10 log10(sin^2(45 deg - theta) + 1e-4), so the isolation falls away from the design band */
  function isoDb(l) { var th = 45 * Math.pow(1310 / l, 2) * Math.PI / 180, s = Math.sin(Math.PI / 4 - th); return -10 * Math.log10(s * s + 1e-4); }
  def('isoBand', 7, function (u, t) {
    isolator(400, 90, 260, { h: 50 }); var lw = tw('1310 nm', 24, 800, true) + 24; rect(400 - lw / 2, 128, lw, Math.max(40, S.mf * 1.4), '#ffffff', '#9aa4b0', 1.5); txt('1310 nm', 400, 128 + Math.max(40, S.mf * 1.4) / 2, 24, '#b3261e', 'center', 800, true);
    var m = screen(110, 220, 600, 290, [1250, 1650], [0, 42], { yl: 'Isolation' });
    trace(m, isoDb, P.ok, 3.5, 1250, 1650, 400);
    var lm = lerp(1310, 1550, 0.5 - 0.5 * Math.cos(u * TAU)), v = isoDb(lm);
    seg2(m.X(lm), m.y, m.X(lm), m.y + m.h, 'rgba(255,255,255,0.5)', 2, [6, 6]); dot(m.X(lm), m.Y(v), 9, v < 20 ? P.back : P.ok); flash(m.X(lm), m.Y(v), 30, v < 20 ? P.back : P.ok, 0.8);
    [1310, 1550].forEach(function (l) { txt(String(l), m.X(l), m.y + m.h + 26, 22, l === 1550 ? P.back : P.ink2, 'center', 700, true); });
  });

  /* Faraday isolator: input polarizer at 0 deg, rotator, output polarizer at 45 deg. The rotation adds in the same
     sense both ways, so a return arrives at 45 deg + theta at the input polarizer. p.rot (deg) = rotation at the
     operating wavelength: 45 at the design band, about 32 for a 1310 nm part at 1550 nm (Verdet constant ~ 1/lambda^2) */
  def('faraday', 8, function (u, t, p) {
    var th = p.rot === undefined ? 45 : p.rot, y = 300, xp1 = 250, xr0 = 320, xr1 = 480, xp2 = 550, xe = 780;
    var leak = Math.abs(Math.cos((45 + th) * Math.PI / 180)), fwdT = Math.abs(Math.cos((th - 45) * Math.PI / 180));
    laser(100, y, 0.9, { alarm: th !== 45 ? 0.55 * bump(u, 0.85, 1) : 0 }, t);
    function polarizer(x, ang) { rect(x - 7, y - 110, 14, 220, 'rgba(180,200,230,0.25)', '#9fb3c8', 2); at(x, y - 150, 1, ang * Math.PI / 180, function () { arrow(0, 0, 0, -26, P.ink, 3, 10); arrow(0, 0, 0, 26, P.ink, 3, 10); }); }
    polarizer(xp1, 0); polarizer(xp2, 45);
    var c = S.c, g = c.createLinearGradient(0, y - 80, 0, y + 80); g.addColorStop(0, '#6e5a2a'); g.addColorStop(0.5, '#b38f3c'); g.addColorStop(1, '#5a4920');
    c.fillStyle = g; c.fillRect(xr0, y - 80, xr1 - xr0, 160); for (var i = 0; i < 9; i++) seg2(xr0 + 10 + i * 18, y - 80, xr0 + 10 + i * 18, y + 80, 'rgba(255,230,160,0.25)', 2);
    arrow(xr0 + 20, y + 110, xr1 - 20, y + 110, P.violet, 4, 16); txt('B', (xr0 + xr1) / 2, y + 140, 26, P.violet, 'center', 800);
    seg2(150, y, xe, y, 'rgba(255,255,255,0.08)', 2);
    function pol(x, ang, a, col) { if (a < 0.03) return; at(x, y, 1, ang * Math.PI / 180, function () { alpha(a, function () { arrow(0, 0, 0, -50 * a - 12, col, 6, 18); arrow(0, 0, 0, 50 * a + 12, col, 6, 18); }); }); flash(x, y, 50, col, 0.7 * a); }
    if (u < 0.45) {
      var x = lerp(150, xe, lin(u, 0, 0.42)), ang = x < xr0 ? 0 : x < xr1 ? th * (x - xr0) / (xr1 - xr0) : th, a = x < xp2 ? 1 : fwdT;
      pol(x, ang, a, P.fwd);
    } else {
      var xb = lerp(xe, 150, lin(u, 0.47, 0.9)), angb = xb > xr1 ? 45 : xb > xr0 ? 45 + th * (xr1 - xb) / (xr1 - xr0) : 45 + th, ab = xb > xp1 ? 0.8 : 0.8 * leak;
      pol(xb, xb < xp1 ? 0 : angb, ab, P.back);
      if (xb < xp1 + 8) flash(xp1, y, 70, 'rgba(255,90,79,0.9)', 0.7 * (1 - leak) * (1 - lin(u, 0.75, 0.95)));
    }
  });

  /* wrong band on the label: strike it, swap in the right part */
  def('labelSwap', 7, function (u, t) {
    var out = seg(u, 0.45, 0.6), inn = seg(u, 0.6, 0.75), fade = 1 - seg(u, 0.94, 1);
    fiber([[40, 300], [210, 300]], P.jacket, 6); fiber([[590, 300], [760, 300]], P.jacket, 6);
    alpha(fade, function () {
      at(400, 300 + out * 400, 1, 0, function () {
        isolator(0, 0, 360, { h: 90 }); var lw = tw('1310 nm', 28, 800, true) + 28; rect(-lw / 2, 60, lw, 44, '#ffffff', '#9aa4b0', 1.5); txt('1310 nm', 0, 82, 28, '#b3261e', 'center', 800, true);
        var sk = seg(u, 0.25, 0.35); if (sk > 0) seg2(-lw / 2 - 10, 82, -lw / 2 - 10 + (lw + 20) * sk, 82, '#c62828', 5);
      });
      if (u > 0.58) at(400, 300 - (1 - inn) * 400, 1, 0, function () {
        isolator(0, 0, 360, { h: 90 }); var lw2 = tw('1550 nm', 28, 800, true) + 28; rect(-lw2 / 2, 60, lw2, 44, '#ffffff', '#9aa4b0', 1.5); txt('1550 nm', 0, 82, 28, '#1f7a3a', 'center', 800, true);
        if (inn >= 1) { var k = seg(u, 0.75, 0.82); line([[150, -90], [150 + 14 * k, -76 * 1 + 0 * k], [150 + 40 * k, -120 * k]], P.ok, 6); }
      });
      /* magnifier over the label */
      var mx = lerp(220, 400, seg(u, 0.05, 0.22)), my = 380, ma = 1 - seg(u, 0.4, 0.45);
      alpha(ma, function () { circ(mx, my, 70, '#d6dde5', 7); seg2(mx + 50, my + 50, mx + 110, my + 110, '#8a6a3a', 14); flash(mx, my, 70, 'rgba(255,255,255,0.3)', 0.5); });
    });
    if (inn >= 1) flow([[40, 300], [760, 300]], P.fwd, 4, t, 1, 0.6);
  });

  /* small sorting icons (100 x 100 box) */
  var I = {
    gc: function (t) { chipSurf(10, 30, 80, 40); wgLine([[10, 50], [55, 50]], 3); gcFan(58, 50, 0.7); },
    amp: function (t) { rect(10, 38, 80, 24, '#2a2236', null); rect(12, 46, 76, 8, P.pink, null); seg2(10, 32, 10, 68, '#e3ecf7', 3); seg2(90, 32, 90, 68, '#e3ecf7', 3); },
    fibertip: function (t) { rect(10, 40, 66, 20, 'rgba(200,225,255,0.35)', null); seg2(76, 36, 76, 64, '#e3ecf7', 3); rect(10, 46, 66, 8, 'rgba(120,200,255,0.5)', null); },
    dut: function (t) { rect(40, 20, 50, 60, '#5d6676', null); seg2(40, 20, 40, 80, '#e3ecf7', 3); wgLine([[40, 50], [90, 50]], 2); },
    setup: function (t) { rect(20, 25, 60, 50, '#1a2027', '#3e4955', 2); rect(28, 33, 44, 26, '#05080a', null); dot(20, 50, 6, P.back); },
    window: function (t) { rect(30, 20, 40, 60, '#20262d', '#4a5560', 2); rect(24, 32, 6, 36, '#8fa0b2', null); },
    iso1310: function (t) { isolator(50, 44, 70, { h: 22 }); txt('1310', 50, 74, 16, '#ff8f86', 'center', 800, true); },
    pigtail: function (t) { rect(20, 32, 40, 36, '#aeb5bd', '#6c737b', 1.5); fiber([[60, 50], [94, 50]], P.jacket, 3); },
    facet: function (t) { rect(30, 20, 60, 60, '#5d6676', null); seg2(30, 20, 30, 80, '#e3ecf7', 4); },
    apc: function (t) { ferrule(70, 50, 0.6, { angled: true }); },
    arlens: function (t) { var c = S.c; c.fillStyle = 'rgba(160,220,255,0.5)'; c.beginPath(); c.ellipse(50, 50, 14, 36, 0, 0, TAU); c.fill(); c.strokeStyle = P.violet; c.lineWidth = 2; c.stroke(); },
    gel: function (t) { rect(10, 42, 36, 16, 'rgba(200,225,255,0.35)', null); rect(54, 42, 36, 16, 'rgba(200,225,255,0.35)', null); rect(46, 38, 8, 24, 'rgba(120,190,255,0.7)', null); },
    ring: function (t) { circ(50, 44, 26, P.wg, 4); seg2(10, 78, 90, 78, P.wg, 4); },
    iso: function (t) { isolator(50, 50, 70, { h: 24 }); },
    fiber: function (t) { var c = S.c; c.strokeStyle = P.jacket; c.lineWidth = 4; c.beginPath(); c.arc(50, 50, 30, 0, TAU); c.stroke(); c.beginPath(); c.arc(50, 50, 22, 0, TAU); c.stroke(); },
    uniform: function (t) { var c = S.c, g = c.createLinearGradient(15, 0, 85, 0); g.addColorStop(0, 'rgba(120,200,255,0.5)'); g.addColorStop(1, 'rgba(120,200,255,0.5)'); c.fillStyle = g; c.fillRect(15, 25, 70, 50); flow([[5, 50], [95, 50]], P.fwd, 3, t, 1, 0.9); },
    openport: function (t) { ferrule(70, 50, 0.55, { hot: 0.6 }); },
    hops: function (t) { for (var i = 0; i < 5; i++) seg2(20 + i * 15, 80, 20 + i * 15, i === 2 + (Math.floor(t * 2) % 2) ? 20 : 70, i === 2 + (Math.floor(t * 2) % 2) ? P.fwd : '#6d7884', 3); },
    noiso: function (t) { isolator(50, 50, 60, { h: 22 }); seg2(18, 82, 82, 18, P.back, 5); },
    ripple: function (t) { var pts = []; for (var x = 0; x <= 80; x += 2) pts.push([10 + x, 80 - x * 0.7 - 5 * Math.sin(x / 4)]); line(pts, P.gold, 3); },
    collapse: function (t) { var pts = []; for (var x = 0; x <= 80; x += 2) pts.push([10 + x, 80 - 40 * lor(x, 40, 22) - 4 * hash(x + Math.floor(t * 10))]); line(pts, P.back, 3); }
  };
  function icon(k, x, y, s, t) { if (I[k]) at(x - 50 * s, y - 50 * s, s, 0, function () { I[k](t); }); }

  /* items drop into their bins one by one; p.bins = colours, p.items = [[icon, bin], ...] */
  def('sortBins', 12, function (u, t, p) {
    var bins = p.bins || [P.violet, P.fwd, P.gold, P.pink], items = p.items || [], nb = bins.length, ni = items.length;
    var bw = Math.min(260, 720 / nb - 24), gap = (760 - nb * bw) / (nb + 1), by = 330, bh = 250;
    var cnt = bins.map(function () { return 0; });
    bins.forEach(function (col, b) { var x = 20 + gap + b * (bw + gap); rect(x, by, bw, bh, 'rgba(255,255,255,0.03)', col, 3); rect(x, by - 8, bw, 8, col, null); });
    var per = 0.92 / ni;
    items.forEach(function (it, i) {
      var b = it[1], a0 = 0.04 + i * per, f = lin(u, a0, a0 + per * 0.9), xb = 20 + gap + b * (bw + gap) + bw / 2;
      var per2 = nb > 2 ? 2 : 3, slot = cnt[b]++, sx = xb + ((slot % per2) - (per2 - 1) / 2) * (bw / per2), sy = by + bh - 50 - Math.floor(slot / per2) * 90;
      if (u < a0) { if (i < 0) return; var qi = i - Math.floor((u - 0.04) / per); if (qi >= 0 && qi < 4 && u >= 0.04 - per) alpha(qi === 0 ? 1 : 0.3, function () { icon(it[0], 400 + qi * 150, 150, qi === 0 ? 2 : 1.2, t); }); return; }
      var x = lerp(400, sx, seg(f, 0, 1)), y = lerp(150, sy, seg(f, 0, 1)) - 120 * Math.sin(Math.PI * f), sc = lerp(2, 0.85, f);
      icon(it[0], x, y, sc, t);
      if (f >= 1) flash(sx, sy, 50, bins[b], 0.35 * (1 - lin(u, a0 + per, a0 + per * 2)));
    });
  });

  /* categories 5: a shared splitter with open flat ports; p.mode 'noise' adds the noisy lasers that share it */
  def('splitter', 6, function (u, t, p) {
    var y = 300, noisy = p.mode === 'noise';
    if (noisy) {
      for (var i = 0; i < 3; i++) { var ly = 130 + i * 170; laser(90, ly, 0.6, { alarm: 0.35 }, t + i); fiber([[122, ly], [200, ly], [260, y]], P.jacket, 3);
        var m = screen(40, ly + 34, 120, 54, [0, 1], [-1, 1], { nx: 3, ny: 2 }); trace(m, function (x) { return 0.7 * (hash(Math.floor(x * 60) + Math.floor(t * 15) + i * 99) - 0.5); }, P.back, 1.5, 0, 1, 60, false); }
    } else { laser(90, y, 0.8, { alarm: 0.5 }, t); fiber([[132, y], [260, y]], P.jacket, 5); }
    var c = S.c, g = c.createLinearGradient(0, y - 22, 0, y + 22); g.addColorStop(0, '#dfe4ea'); g.addColorStop(0.5, '#8d949c'); g.addColorStop(1, '#c5cbd2');
    c.fillStyle = g; c.fillRect(260, y - 22, 150, 44);
    [-150, -50, 50, 150].forEach(function (d, j) {
      var ex = 640, ey = y + d; fiber([[410, y + d * 0.1], [500, ey], [ex, ey]], P.jacket, 4);
      if (j % 2 === 0) { ferrule(ex + 20, ey, 0.6, { hot: 0.55 + 0.4 * Math.sin(t * 6 + j) }); pulse(mkPath([[ex, ey], [500, ey], [410, y + d * 0.1], [132, y]]), ((t * 0.7 + j * 0.3) % 1) * 1.1, P.back, 0.12, 4); }
      else { ferrule(ex + 20, ey, 0.6, {}); rect(ex + 20, ey - 22, 80, 44, '#1a2027', '#3e4955', 2); }
    });
    flow([[132, y], [410, y]], P.fwd, 4, t, 1, 0.6);
  });

  /* category 6: the chip from the partner arrives; the email said angled, the facet is flat */
  def('parcel', 8, function (u, t) {
    var open = seg(u, 0.05, 0.2), rise = seg(u, 0.2, 0.35), y = 380;
    poly([[250, 380], [550, 380], [550, 540], [250, 540]], '#b9894e', '#6e4f26', 3);
    poly([[250, 380], [400, 380 - 120 * open], [400, 380]], '#d1a265', '#6e4f26', 2); poly([[550, 380], [400, 380 - 120 * open], [400, 380]], '#c29457', '#6e4f26', 2);
    /* chip */
    var cy = lerp(450, 230, rise);
    if (rise > 0) { rect(330, cy - 40, 220, 80, '#5d6676', '#8d97a6', 2); wgLine([[330, cy], [550, cy]], 4); seg2(330, cy - 40, 330, cy + 40, '#e3ecf7', 4); }
    /* the email promise */
    rect(40, 40, 230, 140, '#ffffff', '#9aa4b0', 2); line([[40, 40], [155, 110], [270, 40]], '#9aa4b0', 2);
    at(155, 140, 0.5, 0, function () { rect(-60, -30, 120, 60, '#5d6676', null); poly([[-60, -30], [-48, -30], [-60, 30], [-72, 30]], '#5d6676', null); seg2(-48, -30, -72, 30, P.ok, 4); });
    if (rise >= 1) {
      laser(110, cy, 0.8, { alarm: 0.6 * seg(u, 0.5, 0.6) }, t); flow([[152, cy], [328, cy]], P.fwd, 4, t, 1, 0.8);
      pulse(P2(328, cy, 156, cy), (u * 3) % 1, P.back, 0.3, 4); flash(330, cy, 60, 'rgba(255,90,79,0.9)', 0.5 + 0.3 * Math.sin(t * 7));
    }
  });

  /* flat facet versus angled waveguide: the flat reflection goes home, the angled one does not */
  def('facetAngle', 6, function (u, t) {
    var k = u < 0.5 ? 0 : 1;
    [0, 1].forEach(function (i) {
      var x0 = 40 + i * 390, on = i === k, ang = i ? 7 * Math.PI / 180 : 0, fx = x0 + 300, fy = 300;
      alpha(on ? 1 : 0.45, function () {
        rect(x0, 140, 300, 320, '#4f4b76', on ? (i ? P.ok : P.back) : '#2c3843', on ? 3 : 1.5);
        var a = [fx - 280 * Math.cos(ang), fy + 280 * Math.sin(ang)];
        wgLine([a, [fx, fy]], 6); seg2(fx, 140, fx, 460, '#e3ecf7', 4);
        flow([a, [fx, fy]], P.fwd, 5, t, 1, 0.9);
        var rb = [fx - 260 * Math.cos(ang), fy - 260 * Math.sin(ang)];
        if (on) { var f = (t * 0.9) % 1; pulse(mkPath([[fx, fy], rb]), f * 1.1, P.back, 0.25, i ? 3 : 5, i ? 0.6 : 1); }
        if (!i && on) flash(x0 + 20, fy, 50, 'rgba(255,90,79,0.9)', 0.5 + 0.3 * Math.sin(t * 6));
        var ox = fx + 60 * Math.cos(Math.asin(Math.min(1, 3.2 * Math.sin(ang)))), oy = fy - 60 * Math.sin(Math.asin(Math.min(1, 3.2 * Math.sin(ang))));
        glow([[fx, fy], [fx + 70, fy - 70 * Math.tan(Math.asin(Math.min(1, 3.2 * Math.sin(ang))))]], P.fwd, 4, 12, 0.7);
      });
    });
  });

  /* optical backscatter trace: a probe pulse passes each interface and a peak appears at its distance */
  def('reflectometer', 7, function (u, t) {
    var y = 120, X = [180, 320, 470, 640], hgt = [0.55, 0.7, 0.62, 0.95];
    rect(40, y - 40, 90, 80, '#1a2027', '#3e4955', 2);
    fiber([[130, y], [470, y]], P.jacket, 5); ferrule(180, y, 0.45, {}); ferrule(186, y, 0.45, { dir: -1 }); ferrule(320, y, 0.45, {}); ferrule(326, y, 0.45, { dir: -1 });
    rect(470, y - 26, 50, 52, '#c2a868', null); chipSurf(520, y - 50, 240, 100); wgLine([[520, y], [640, y]], 4); seg2(640, y - 50, 640, y + 50, '#e3ecf7', 3);
    var s = lin(u, 0, 0.7), px = lerp(130, 700, s);
    if (u < 0.72) flash(px, y, 30, P.fwd, 0.9);
    var m = screen(110, 260, 600, 270, [130, 700], [0, 1.05], { xl: 'Distance', yl: 'Reflection' });
    trace(m, function (x) { var v = 0.12 * Math.exp(-(x - 130) / 900); X.forEach(function (xx, i) { if (px > xx) v += hgt[i] * Math.exp(-Math.pow((x - xx) / 5, 2)); }); return x < px ? v : null; }, P.teal, 2.5, 130, 700, 600);
    X.forEach(function (xx, i) { if (px > xx) flash(xx, y, 34, 'rgba(255,90,79,0.9)', bump(px, xx, xx + 80)); });
  });

  /* category 7: quid pro quo, an isolator traded for decibels */
  def('balance', 8, function (u, t) {
    var coins = Math.floor(seg(u, 0.05, 0.5) * 5), tilt = lerp(-0.18, 0.22, seg(u, 0.1, 0.55)) * (1 - seg(u, 0.9, 1)), cx = 400, cy = 200, L = 230;
    seg2(cx, cy, cx, 500, P.steel, 8); rect(cx - 90, 500, 180, 18, P.steel, null);
    var lx = cx - L * Math.cos(tilt), ly = cy - L * Math.sin(tilt), rx = cx + L * Math.cos(tilt), ry = cy + L * Math.sin(tilt);
    seg2(lx, ly, rx, ry, '#d0d6dd', 8); dot(cx, cy, 12, P.gold);
    [[lx, ly], [rx, ry]].forEach(function (q) { seg2(q[0], q[1], q[0] - 70, q[1] + 120, P.steel, 2); seg2(q[0], q[1], q[0] + 70, q[1] + 120, P.steel, 2); rect(q[0] - 90, q[1] + 120, 180, 10, '#d0d6dd', null); });
    var off = seg(u, 0.55, 0.7) * (1 - seg(u, 0.9, 0.98));
    isolator(lx - off * 60, ly + 96 - off * 0 + off * 200, 120, { h: 36 });
    for (var i = 0; i < coins; i++) { dot(rx - 40 + (i % 3) * 40, ry + 104 - Math.floor(i / 3) * 30, 18, P.gold); txt('dB', rx - 40 + (i % 3) * 40, ry + 105 - Math.floor(i / 3) * 30, 14, '#5a4210', 'center', 800); }
    laser(140, 560, 0.7, { alarm: off }, t);
    if (off > 0.5) pulse(P2(700, 560, 180, 560), (u * 4) % 1, P.back, 0.25, 5);
  });

  /* trading the isolator: the customer gains a little, the laser gets a lot back */
  def('tradeoff', 8, function (u, t) {
    var out = seg(u, 0.2, 0.32) * (1 - seg(u, 0.82, 0.94));
    laser(110, 110, 0.8, { alarm: out * 0.8 }, t); fiber([[150, 110], [300, 110]], P.jacket, 5); fiber([[500, 110], [740, 110]], P.jacket, 5);
    seg2(300, 110, 500, 110, 'rgba(232,197,71,' + out.toFixed(2) + ')', 5); isolator(400, 110 - out * 90, 160, { h: 40 });
    var base = 470;
    rect(200, 230, 120, 260, '#0c1218', '#3a4654', 2); rect(480, 230, 120, 260, '#0c1218', '#3a4654', 2);
    var f = 0.62 + 0.06 * out, b = 0.08 + 0.72 * out;
    rect(210, base + 10 - 240 * f, 100, 240 * f, P.fwd, null); rect(490, base + 10 - 240 * b, 100, 240 * b, P.back, null);
    arrow(240, 520, 300, 520, P.fwd, 4, 14); arrow(560, 520, 500, 520, P.back, 4, 14);
    alpha(out, function () { txt('< 1.5 dB', 260, 200, 26, P.fwd, 'center', 800, true); txt('> 25 dB', 540, 200, 26, P.back, 'center', 800, true); });
  });

  /* category 8: N reflectors make N (N - 1) / 2 two-mirror cavities; six make fifteen */
  def('pairs', 9, function (u, t) {
    var xs = [120, 232, 344, 456, 568, 680], y = 430, pairs = [];
    for (var i = 0; i < 6; i++) for (var j = i + 1; j < 6; j++) pairs.push([i, j]);
    var n = Math.min(15, Math.floor(seg(u, 0.03, 0.8) * 15.99)), c = S.c;
    pairs.forEach(function (pq, k) {
      if (k >= n) return; var a = xs[pq[0]], b = xs[pq[1]], hh = (b - a) * 0.62, cur = k === n - 1 && n < 15;
      var col = ['#ff5a4f', '#ff9a52', '#f2c94c', '#56d4ff', '#a98bff', '#ff6fd8'][k % 6];
      c.save(); c.shadowColor = col; c.shadowBlur = cur ? 20 : 6; c.strokeStyle = col; c.globalAlpha = cur ? 1 : 0.55; c.lineWidth = cur ? 5 : 2.5;
      c.beginPath(); c.moveTo(a, y - 80); c.quadraticCurveTo((a + b) / 2, y - 80 - hh, b, y - 80); c.stroke(); c.restore();
    });
    xs.forEach(function (x, i) { rect(x - 7, y - 80, 14, 150, '#cfe0f0', null); flash(x, y - 80, 30, 'rgba(255,90,79,0.9)', 0.3 + 0.3 * Math.sin(t * 4 + i)); });
    flow([[40, y], [760, y]], P.fwd, 4, t, 1, 0.5);
    txt(String(n), 400, 540, 48, P.gold, 'center', 800, true);
  });

  /* category 8 incident: ripples at several periods at once, all moving when someone leans on the table */
  def('multiRipple', 6, function (u, t) {
    var lean = Math.sin(u * TAU);
    at(400, 110, 1, lean * 0.03, function () { rect(-320, -20, 640, 40, '#23272c', null); for (var i = 0; i < 12; i++) dot(-290 + i * 53, 0, 6, '#14171a'); });
    var m = screen(90, 200, 620, 330, [0, 10], [-1.6, 1.6], { xl: 'Wavelength' });
    var f = function (x) { return 0.45 * Math.cos(TAU * x / 2.7 + lean * 3) + 0.3 * Math.cos(TAU * x / 0.9 + lean * 5) + 0.22 * Math.cos(TAU * x / 0.37 + lean * 7) + 0.05 * Math.sin(x * 37); };
    trace(m, f, P.gold, 2.5, 0, 10, 700);
  });

  /* list the reflectors and fix them one at a time */
  def('fixOneByOne', 10, function (u, t) {
    var kinds = ['fibertip', 'openport', 'arlens', 'window', 'facet', 'gc'], n = kinds.length, k = u * (n + 1);
    seg2(40, 330, 760, 330, '#3a4654', 3);
    kinds.forEach(function (kd, i) {
      var x = 90 + i * 124, fixed = k > i + 1, cur = Math.floor(k) === i + 0 && !fixed;
      rect(x - 54, 230, 108, 108, fixed ? 'rgba(63,185,80,0.1)' : 'rgba(255,90,79,0.08)', fixed ? P.ok : cur ? '#ffffff' : P.back, cur ? 3 : 2);
      icon(kd, x, 284, 0.9, t);
      if (!fixed) flash(x, 284, 60, 'rgba(255,90,79,0.9)', 0.25 + 0.2 * Math.sin(t * 5 + i));
      /* checklist row */
      var ry = 400 + Math.floor(i / 2) * 48, rx = 160 + (i % 2) * 280;
      rect(rx, ry - 15, 30, 30, '#ffffff', '#5b6673', 2); rect(rx + 44, ry - 5, 180, 10, '#3a4654', null);
      if (fixed) line([[rx + 6, ry], [rx + 13, ry + 8], [rx + 26, ry - 10]], P.ok, 5);
    });
  });

  /* keep the laser, fix the link: the flat connector becomes angled and the line narrows */
  def('recover', 8, function (u, t) {
    var fix = seg(u, 0.3, 0.45) * (1 - seg(u, 0.92, 1)), y = 120;
    laser(110, y, 0.8, { alarm: 0.75 * (1 - fix) }, t); fiber([[150, y], [300, y]], P.jacket, 5); fiber([[330, y], [740, y]], P.jacket, 5);
    ferrule(300, y, 0.6, { angled: fix > 0.5, hot: (1 - fix) * (0.5 + 0.4 * Math.sin(t * 7)) }); ferrule(330, y, 0.6, { dir: -1, angled: fix > 0.5 });
    if (fix < 0.5) pulse(P2(300, y, 152, y), (u * 4) % 1, P.back, 0.35, 4);
    rect(50, y - 50, 120, 100, null, fix > 0.5 ? P.ok : 'rgba(0,0,0,0)', 3);
    var m = screen(110, 230, 580, 300, [-1, 1], [0, 1.1]);
    var wd = lerp(0.38, 0.012, fix), a = lerp(0.3, 1, fix);
    trace(m, function (x) { var v = a * lor(x, 0, wd); if (wd > 0.15) v *= 1 + 0.2 * (hash(Math.floor(x * 120) + Math.floor(t * 12)) - 0.5); return v + 0.012; }, fix > 0.5 ? P.fwd : P.back, 3, -1, 1, 500);
  });

  /* =====================================================================
     Module 4: mode hops. Model as in fb_draw.js: comb spacing 0.15 nm moving 0.02 nm/K, filter moving 0.10 nm/K;
     the laser keeps its mode until the filter is more than half a spacing plus 0.03 nm away (hysteresis)
     ===================================================================== */
  var HOP = { l0: 1550.0, T0: 25, fsr: 0.15, kf: 0.10, kc: 0.02, d: 0.03 };
  function modeL(m, T) { return HOP.l0 + m * HOP.fsr + HOP.kc * (T - HOP.T0); }
  function filtL(T) { return HOP.l0 + HOP.kf * (T - HOP.T0); }
  function sweepTo(Ta, Tb, m0) {
    var m = m0 === undefined ? Math.round((filtL(Ta) - modeL(0, Ta)) / HOP.fsr) : m0, out = [], n = Math.max(1, Math.round(Math.abs(Tb - Ta) / 0.01));
    for (var i = 0; i <= n; i++) { var T = Ta + (Tb - Ta) * i / n, det = filtL(T) - modeL(m, T); if (det > HOP.fsr / 2 + HOP.d) m++; else if (det < -HOP.fsr / 2 - HOP.d) m--; out.push({ T: T, m: m, l: modeL(m, T) }); }
    return out;
  }
  function hopState(u) { /* up 25 to 35 for u < 0.5, then down */ var up = sweepTo(25, 35); if (u < 0.5) return sweepTo(25, 25 + 20 * u); var e = up[up.length - 1]; return sweepTo(35, 35 - 20 * (u - 0.5), e.m); }

  /* the cavity comb and the filter walk at different rates; the lasing line jumps */
  def('modeHop', 12, function (u, t) {
    var sw = hopState(u), cur = sw[sw.length - 1], T = cur.T, fc = filtL(T);
    var m = screen(150, 60, 600, 380, [1549.75, 1551.3], [0, 1.15], { xl: 'Wavelength' });
    trace(m, function (l) { return lor(l, fc, 0.15); }, P.gold, 3, undefined, undefined, 300);
    for (var k = -4; k < 14; k++) {
      var l = modeL(k, T); if (l < 1549.75 || l > 1551.3) continue; var on = k === cur.m, X = m.X(l);
      seg2(X, m.Y(0), X, m.Y(on ? 1.0 : 0.05 + 0.12 * lor(l, fc, 0.15)), on ? P.fwd : '#7d8995', on ? 5 : 2.5);
      if (on) flash(X, m.Y(1), 34, P.fwd, 0.9);
    }
    var prev = sw.length > 40 ? sw[sw.length - 40] : sw[0]; if (prev.m !== cur.m) flash(m.X(cur.l), m.Y(0.5), 120, 'rgba(255,255,255,0.6)', 0.6);
    /* thermometer */
    var th = (T - 25) / 10; rect(60, 80, 30, 340, '#0c1218', '#3a4654', 2); rect(66, 414 - 328 * th, 18, 328 * th, u < 0.5 ? P.back : P.fwd, null); dot(75, 440, 24, u < 0.5 ? P.back : P.fwd);
    txt(T.toFixed(1) + ' °C', 75, 495, 22, P.ink2, 'center', 700, true);
    txt(cur.l.toFixed(3) + ' nm', 450, 520, 30, '#7fe8a2', 'center', 700, true);
  });

  /* hysteresis: sweeping up and sweeping down hop at different temperatures */
  def('hysteresis', 10, function (u, t) {
    var m = screen(130, 50, 620, 440, [25, 35], [1549.95, 1551.05], { xl: 'Temperature', yl: 'Wavelength' });
    var su = sweepTo(25, 35), sd = sweepTo(35, 25, su[su.length - 1].m), ku = seg(u, 0.02, 0.45), kd = seg(u, 0.5, 0.93);
    function stair(s, k, col) { var n = Math.floor((s.length - 1) * k), pts = []; for (var i = 0; i <= n; i++) { if (i && s[i].m !== s[i - 1].m) pts.push([s[i].T, s[i - 1].l]); pts.push([s[i].T, s[i].l]); } if (pts.length > 1) { trace(m, function () { return null; }, col); line(pts.map(function (q) { return [m.X(q[0]), m.Y(q[1])]; }), col, 4); } return pts.length ? pts[pts.length - 1] : null; }
    var a = stair(su, ku, P.fwd), b = kd > 0 ? stair(sd, kd, P.gold) : null;
    var head = b || a; if (head) flash(m.X(head[0]), m.Y(head[1]), 26, b ? P.gold : P.fwd, 0.9);
    arrow(560, 540, 640, 540, P.fwd, 4, 14); arrow(330, 540, 250, 540, P.gold, 4, 14);
  });

  /* report a removal through the non-retaliation channel */
  def('report', 7, function (u, t) {
    /* call roster: four tiles, one is greyed out and leaves */
    var gone = seg(u, 0.1, 0.25);
    for (var i = 0; i < 4; i++) {
      var x = 60 + (i % 2) * 150, y = 120 + Math.floor(i / 2) * 150, out = i === 3 ? gone : 0;
      alpha(1 - 0.75 * out, function () { rect(x, y, 130, 130, '#1a222b', '#3a4654', 2); dot(x + 65, y + 52, 26, ['#56d4ff', '#f2c94c', '#a98bff', '#38e0b8'][i]); rect(x + 30, y + 86, 70, 28, ['#56d4ff', '#f2c94c', '#a98bff', '#38e0b8'][i], null); });
      if (i === 3 && out > 0.5) seg2(x + 10, y + 10, x + 120, y + 120, P.back, 5);
    }
    /* shield box */
    var sx = 600, sy = 300;
    poly([[sx - 90, sy - 110], [sx + 90, sy - 110], [sx + 90, sy + 10], [sx, sy + 110], [sx - 90, sy + 10]], '#13202c', P.teal, 5);
    var ok = seg(u, 0.7, 0.8); if (ok > 0) line([[sx - 40, sy - 10], [sx - 10, sy + 20 * ok], [sx + 45 * ok, sy - 50 * ok]], P.teal, 9);
    flash(sx, sy, 160, P.teal, 0.15 + 0.25 * bump(u, 0.65, 0.85));
    /* envelope flies from the roster to the shield */
    var e = seg(u, 0.3, 0.68);
    if (e > 0 && e < 1) at(lerp(270, sx, e), lerp(250, sy, e) - 120 * Math.sin(Math.PI * e), lerp(1, 0.5, e), 0, function () { rect(-60, -38, 120, 76, '#ffffff', '#9aa4b0', 2); line([[-60, -38], [0, 8], [60, -38]], '#9aa4b0', 2); });
  });

  /* =====================================================================
     Module 5: reciprocity and isolators
     ===================================================================== */
  /* the isolator lets light through one way and absorbs the return; the angled facet sends its own reflection aside */
  def('isoOneWay', 5, function (u, t) {
    var y = 300;
    laser(90, y, 0.9, {}, t); fiber([[136, y], [250, y]], P.jacket, 5); fiber([[430, y], [560, y]], P.jacket, 5);
    flow([[136, y], [560, y]], P.fwd, 5, t, 1, 0.9);
    isolator(340, y, 180, { h: 48 });
    rect(560, y - 90, 200, 180, '#4f4b76', '#8d86c0', 2);
    var ang = 7 * Math.PI / 180; wgLine([[560, y], [760, y - 200 * Math.tan(ang)]], 4);
    flow([[560, y], [760, y - 200 * Math.tan(ang)]], P.fwd, 4, t, 1, 0.8);
    for (var k = 0; k < 2; k++) { var f = (u + k * 0.5) % 1; pulse(P2(556, y, 430, y), f * 1.25, P.back, 0.3, 5); flash(432, y, 46, 'rgba(255,154,82,0.95)', bump(f, 0.72, 0.95)); }
  });

  /* which way does it point: the isolator spins like a compass needle and settles pointing away from the laser */
  def('isoCompass', 6, function (u, t) {
    var ang = 3.2 * Math.PI * Math.exp(-5 * u) * Math.cos(9 * u), settled = u > 0.55;
    laser(100, 300, 0.9, {}, t);
    circ(450, 300, 190, '#2c3843', 3); for (var i = 0; i < 16; i++) { var a = i / 16 * TAU; seg2(450 + 175 * Math.cos(a), 300 + 175 * Math.sin(a), 450 + 190 * Math.cos(a), 300 + 190 * Math.sin(a), '#55606c', i % 4 ? 2 : 4); }
    at(450, 300, 1, ang, function () { isolator(0, 0, 260, { h: 56, col: settled ? '#0e3a1c' : '#11161c' }); });
    if (settled) { flow([[150, 300], [320, 300]], P.fwd, 5, t, 1, seg(u, 0.55, 0.65)); flow([[580, 300], [780, 300]], P.fwd, 5, t, 1, seg(u, 0.6, 0.7)); flash(700, 300, 60, P.ok, 0.3 * seg(u, 0.6, 0.7)); }
  });

  /* asymmetric mode conversion is reciprocal: the fundamental mode leaves as the first-order mode,
     and the reflection of that mode comes back as the fundamental mode */
  def('modeConvert', 8, function (u, t) {
    var y = 300, xa = 230, xb = 450, xe = 690;
    var c = S.c; poly([[40, y - 16], [xa, y - 16], [xb, y - 50], [xe, y - 50], [xe, y + 50], [xb, y + 50], [xa, y + 16], [40, y + 16]], 'rgba(194,201,242,0.22)', P.wg, 2);
    seg2(xe, y - 90, xe, y + 90, '#e3ecf7', 4);
    laser(-10 + 40, y, 0.5, { alarm: 0.7 * bump(u, 0.88, 1) }, t);
    function prof(x, order, sgn, col, a) {
      var hw = x < xa ? 16 : x < xb ? lerp(16, 50, (x - xa) / (xb - xa)) : 50, pts = [];
      var mix = x < xa ? 0 : x < xb ? (x - xa) / (xb - xa) : 1, o = order === 'fwd' ? mix : mix;
      for (var yy = -hw; yy <= hw; yy += 2) { var q = yy / hw, f0 = Math.cos(Math.PI * q / 2), f1 = Math.sin(Math.PI * q); pts.push([x + sgn * 46 * ((1 - o) * f0 + o * f1), y + yy]); }
      alpha(a, function () { glow(pts, col, 3.5, 14, 0.9); line([[x, y - hw], [x, y + hw]], 'rgba(255,255,255,0.25)', 1.5); });
    }
    if (u < 0.45) prof(lerp(60, xe - 10, lin(u, 0, 0.45)), 'fwd', 1, P.fwd, 1);
    else if (u < 0.5) flash(xe, y, 80, 'rgba(255,90,79,0.9)', 0.8);
    else prof(lerp(xe - 10, 60, lin(u, 0.5, 0.92)), 'back', -1, P.back, 0.9);
  });

  /* the beam leaves an angled waveguide at a larger angle: n sin(theta) = sin(theta_out), n_eff = 3.2 */
  def('snell', 8, function (u, t) {
    var th = (1 + 8 * (0.5 - 0.5 * Math.cos(u * TAU))) * Math.PI / 180, n = 3.2, to = Math.asin(Math.min(1, n * Math.sin(th))), fx = 420, fy = 300;
    rect(40, 80, fx - 40, 440, '#4f5664', null); seg2(fx, 80, fx, 520, '#e3ecf7', 4);
    var a = [fx - 380 * Math.cos(th), fy + 380 * Math.sin(th)];
    wgLine([a, [fx, fy]], 6); flow([a, [fx, fy]], P.fwd, 5, t, 1, 0.9);
    var out = [fx + 360 * Math.cos(to), fy - 360 * Math.sin(to)]; glow([[fx, fy], out], P.fwd, 7, 20, 0.9); flow([[fx, fy], out], '#bff0ff', 3, t, 1, 0.8);
    var rf = [fx - 300 * Math.cos(th), fy - 300 * Math.sin(th)]; pulse(P2(fx, fy, rf[0], rf[1]), (t * 0.8) % 1 * 1.1, P.back, 0.3, 3, 0.7);
    seg2(fx - 200, fy, fx + 300, fy, 'rgba(255,255,255,0.35)', 2, [8, 8]);
    var c = S.c; c.strokeStyle = P.gold; c.lineWidth = 4; c.beginPath(); c.arc(fx, fy, 120, Math.PI - th, Math.PI); c.stroke();
    c.strokeStyle = P.fwd; c.beginPath(); c.arc(fx, fy, 150, -to, 0); c.stroke();
    /* fiber aimed at the refracted beam */
    at(out[0] - 40 * Math.cos(to), out[1] + 40 * Math.sin(to), 1, -to, function () { rect(0, -12, 140, 24, P.jacket, null); rect(-4, -12, 6, 24, '#e3ecf7', null); });
  });

  /* orientation: the arrow points away from the laser. Reversed, the laser light meets the 45 degree polarizer,
     is turned to 90 degrees and is blocked by the 0 degree polarizer: nothing comes out */
  def('isoOrient', 10, function (u, t) {
    var y = 320, flip = seg(u, 0.42, 0.5) - seg(u, 0.92, 1), rev = flip > 0.5, sx = Math.cos(Math.PI * flip);
    laser(80, y, 0.8, {}, t);
    at(400, y, 1, 0, function () {
      S.c.save(); S.c.scale(sx, 1);
      rect(-230, -130, 460, 260, 'rgba(174,181,189,0.12)', P.steel, 3);
      function pz(x, ang) { rect(x - 7, -100, 14, 200, 'rgba(180,200,230,0.3)', '#9fb3c8', 2); at(x, -112, 1, ang, function () { seg2(0, -16, 0, 16, P.ink, 3); }); }
      pz(-170, 0); pz(170, Math.PI / 4 * (sx < 0 ? -1 : 1));
      rect(-110, -80, 220, 160, '#8a6f30', null); for (var i = 0; i < 8; i++) seg2(-100 + i * 28, -80, -100 + i * 28, 80, 'rgba(255,230,160,0.25)', 2);
      arrow(-120, -165, 110, -165, P.ink, 6, 24);
      S.c.restore();
    });
    var f = (t / 1.6) % 1, x = lerp(130, 780, f), ang = 0, a = 1, okDir = !rev && Math.abs(flip) < 0.05, revDir = rev && Math.abs(flip - 1) < 0.05;
    if (okDir) { ang = x < 290 ? 0 : x < 510 ? 45 * (x - 290) / 220 : 45; }
    else if (revDir) { if (x < 230) ang = 0; else if (x < 290) { ang = 45; a = 0.7; } else if (x < 570) ang = 45 + 45 * (x - 290) / 220; if (ang > 90) ang = 90; if (x > 570) a = 0; }
    else a = 0;
    if (a > 0.02) at(x, y, 1, ang * Math.PI / 180, function () { alpha(a, function () { arrow(0, 0, 0, -30, P.fwd, 4, 12); arrow(0, 0, 0, 30, P.fwd, 4, 12); flash(0, 0, 30, P.fwd, 0.7); }); });
    if (revDir && x > 560 && x < 620) flash(570, y, 70, 'rgba(255,90,79,0.9)', 0.8);
    detector(720, y, 1.2, {}); var lv = okDir ? 1 : 0;
    rect(700, 410, 90, 20, '#0c1218', '#3a4654', 2); rect(703, 413, 84 * lv, 14, P.ok, null);
  });

  /* point to the arrow: promptly, privately */
  def('arrowCheck', 6, function (u, t) {
    laser(90, 330, 0.9, {}, t); fiber([[136, 330], [200, 330]], P.jacket, 6); fiber([[600, 330], [770, 330]], P.jacket, 6);
    isolator(400, 330, 400, { h: 110, dir: -1 });
    var r = 70 + 12 * Math.sin(t * 5); circ(400, 330, r, P.back, 5); flash(400, 330, r + 40, 'rgba(255,90,79,0.6)', 0.4);
    /* a small private message bubble with typing dots */
    var pop = seg(u, 0.2, 0.3) * (1 - seg(u, 0.9, 1));
    at(560, 150, pop, 0, function () { rect(-110, -50, 220, 100, '#ffffff', null); poly([[-60, 49], [-20, 49], [-80, 90]], '#ffffff', null); for (var i = 0; i < 3; i++) dot(-40 + i * 40, 0, 12, i === Math.floor(t * 3) % 3 ? '#2b6cd8' : '#a9b6c4'); });
  });

  /* =====================================================================
     Module 6: backscatter in high-Q rings. Coupled-mode model (Kippenberg, Spillane and Vahala 2002):
     t = 1 - (ke/2) [1/(i(D+g) + k/2) + 1/(i(D-g) + k/2)], r = (ke/2) [1/(i(D+g) + k/2) - 1/(i(D-g) + k/2)], k = k0 + ke
     ===================================================================== */
  function cm(D, g, k0, ke) {
    var k = k0 + ke, a1r = k / 2, a1i = D + g, a2r = k / 2, a2i = D - g;
    var d1 = a1r * a1r + a1i * a1i, d2 = a2r * a2r + a2i * a2i;
    var s1r = a1r / d1, s1i = -a1i / d1, s2r = a2r / d2, s2i = -a2i / d2;
    var tr = 1 - ke / 2 * (s1r + s2r), ti = -ke / 2 * (s1i + s2i), rr = ke / 2 * (s1r - s2r), ri = ke / 2 * (s1i - s2i);
    return { T: tr * tr + ti * ti, R: rr * rr + ri * ri };
  }
  function ringBus(cx, cy, R, by, t, g) {
    seg2(40, by, 760, by, P.wg, 6); circ(cx, cy, R, P.wg, 6);
    var a = t * 2.4; glow(arcPath(cx, cy, R, a, a + 1.4, 18), P.fwd, 7, 16, 0.95);
    glow(arcPath(cx, cy, R, -a + 2, -a + 3.4, 18), P.pink, 7, 16, clamp(0.2 + g));
    var sxp = cx + R * Math.cos(-2.2), syp = cy + R * Math.sin(-2.2); dot(sxp, syp, 6, '#ffffff'); flash(sxp, syp, 26, '#ffffff', 0.4 + 0.4 * Math.sin(t * 7));
    flow([[40, by], [760, by]], P.fwd, 4, t, 1, 0.6);
  }
  /* counter-propagating waves split one resonance into two */
  def('ringDoublet', 8, function (u, t) {
    var g = 1.6 * (0.5 - 0.5 * Math.cos(u * TAU));
    ringBus(400, 150, 100, 262, t, g / 1.6);
    var m = screen(110, 320, 580, 220, [-5, 5], [0, 1.05], { xl: 'Detuning' });
    trace(m, function (D) { return cm(D, g, 1, 0.8).T; }, P.gold, 3.5, -5, 5, 400);
  });
  /* one Lorentzian through a doublet versus the coupled-mode fit */
  def('doubletFit', 7, function (u, t) {
    var g = 1.3, k0 = 0.6, ke = 0.5;
    var m = screen(110, 60, 600, 400, [-5, 5], [0.2, 1.05]);
    for (var i = 0; i <= 80; i++) { var D = -5 + i / 8, v = cm(D, g, k0, ke).T + 0.025 * (hash(i * 7.1) - 0.5); dot(m.X(D), m.Y(v), 4.5, '#cfd8e3'); }
    var a1 = seg(u, 0.1, 0.3) * (1 - seg(u, 0.45, 0.55)), a2 = seg(u, 0.5, 0.65) * (1 - seg(u, 0.93, 1));
    var mn = cm(g, g, k0, ke).T;
    alpha(a1, function () { trace(m, function (D) { return 1 - (1 - 0.62) * lor(D, 0, 1.9); }, P.back, 4, -5, 5, 300); txt('1 Lorentzian', 410, 520, 28, P.back, 'center', 700); });
    alpha(a2, function () { trace(m, function (D) { return cm(D, g, k0, ke).T; }, P.ok, 4, -5, 5, 400); txt('coupled-mode doublet', 410, 520, 28, P.ok, 'center', 700); });
  });
  /* the ring heats with power and walks off the laser line; the backscatter that locked the laser fades */
  def('thermalDetune', 8, function (u, t) {
    var pw = seg(u, 0.05, 0.8) * (1 - seg(u, 0.9, 1)), shift = 3.2 * pw;
    flash(400, 150, 140, 'rgba(255,154,82,0.9)', 0.15 + 0.5 * pw);
    var R = cm(-shift, 1.0, 0.6, 0.6).R / cm(0, 1.0, 0.6, 0.6).R, bs = clamp(R + 0.02);
    ringBus(400, 150, 90, 252, t, 0.5);
    laser(90, 252, 0.6, { alarm: pw > 0.6 ? 0.5 : 0 }, t);
    pulse(P2(320, 246, 130, 246), (t * 1.1) % 1 * 1.1, P.pink, 0.3, 3 + 6 * bs, bs);
    var m = screen(110, 320, 580, 220, [-5, 5], [0, 1.05], { xl: 'Detuning' });
    trace(m, function (D) { return cm(D - shift, 1.0, 0.6, 0.6).T; }, P.gold, 3.5, -5, 5, 400);
    seg2(m.X(0), m.y, m.X(0), m.y + m.h, P.fwd, 4); flash(m.X(0), m.y + 10, 30, P.fwd, 0.8);
    rect(720, 320, 40, 220, '#0c1218', '#3a4654', 2); rect(726, 534 - 208 * pw, 28, 208 * pw, P.orange, null);
  });
  /* under- and over-coupled rings give the same transmission dip; transmission alone cannot tell them apart */
  def('couplingAmbiguity', 8, function (u, t) {
    var D0 = 2;
    [0, 1].forEach(function (i) {
      var cx = 210 + i * 380, k0 = i ? 0.5 : 1.5, ke = i ? 1.5 : 0.5, gap = i ? 10 : 34, by = 250;
      seg2(cx - 170, by, cx + 170, by, P.wg, 5); circ(cx, by - 80 - gap, 80, P.wg, 5);
      var a = t * 2; glow(arcPath(cx, by - 80 - gap, 80, a, a + 1.2, 14), P.fwd, 6, 14, 0.9);
      for (var k = 0; k < 6; k++) { var an = k / 6 * TAU + t * 0.5; flash(cx + 80 * Math.cos(an), by - 80 - gap + 80 * Math.sin(an), 18, 'rgba(255,90,79,0.9)', 0.25 * k0); }
      flash(cx, by - 4 - gap / 2, 40, P.gold, 0.25 * ke);
    });
    var m = screen(110, 320, 580, 220, [-5, 5], [0, 1.05], { xl: 'Detuning' });
    trace(m, function (D) { return cm(D, 0, 1.5, 0.5).T; }, P.gold, 6, -5, 5, 300);
    var sh = 0.5 + 0.5 * Math.sin(u * TAU);
    trace(m, function (D) { return cm(D, 0, 0.5, 1.5).T; }, P.fwd, 2.5, -5, -5 + 10 * sh, 300);
    txt('=', 400, 160, 70, P.ink, 'center', 800);
  });
  /* light leaves the input port backward exactly at the doublet */
  def('reflectPort', 8, function (u, t) {
    var g = 1.4, D = lerp(-5, 5, u), r = cm(D, g, 0.5, 0.8);
    seg2(40, 200, 760, 200, P.wg, 6); circ(400, 100, 88, P.wg, 6); flow([[40, 200], [760, 200]], P.fwd, 4, t, 1, 0.7);
    glow(arcPath(400, 100, 88, t * 2.4, t * 2.4 + 1.3, 14), P.fwd, 6, 14, 0.4 + 2 * (1 - r.T));
    if (r.R > 0.1) { pulse(P2(320, 192, 40, 192), (t * 1.5) % 1 * 1.1, P.back, 0.3, 3 + 10 * r.R, clamp(r.R * 2)); flash(60, 192, 50, 'rgba(255,90,79,0.9)', r.R * 2); }
    var mt = screen(110, 260, 580, 130, [-5, 5], [0, 1.05], { nx: 8, ny: 2 }), mr = screen(110, 420, 580, 120, [-5, 5], [0, 0.6], { nx: 8, ny: 2, xl: 'Detuning' });
    trace(mt, function (x) { return cm(x, g, 0.5, 0.8).T; }, P.gold, 3, -5, 5, 300); trace(mr, function (x) { return cm(x, g, 0.5, 0.8).R; }, P.back, 3, -5, 5, 300);
    [mt, mr].forEach(function (m) { seg2(m.X(D), m.y, m.X(D), m.y + m.h, 'rgba(255,255,255,0.6)', 2, [6, 6]); });
    [-g, g].forEach(function (d) { seg2(mt.X(d), mt.y + mt.h, mr.X(d), mr.y, 'rgba(255,90,79,0.35)', 2, [4, 6]); });
  });

  /* =====================================================================
     Module 7: instruments average
     ===================================================================== */
  /* a laser hopping between two adjacent modes (0.15 nm apart) faster than the wavemeter update: the reading is the average */
  function tele(x) { var k = Math.floor(x * 7.3), h = hash(k * 1.7 + 3); return h > 0.42 ? 1 : 0; }
  def('wavemeterAvg', 8, function (u, t) {
    var l1 = 1550.300, l2 = 1550.450, now = t * 1.0;
    var m = screen(110, 60, 600, 230, [now - 4, now], [-0.3, 1.3], { nx: 8, ny: 4, xl: 'Time' });
    trace(m, function (x) { return tele(x); }, P.fwd, 2.5, now - 4, now, 800);
    for (var g = Math.floor(now - 4); g <= now; g++) { var x0 = m.X(Math.max(g, now - 4)), x1 = m.X(Math.min(g + 1, now)); if (x1 > x0) rect(x0 + 2, m.y, x1 - x0 - 4, m.h, g % 2 ? 'rgba(242,201,76,0.06)' : 'rgba(242,201,76,0.12)', null); }
    var gl = Math.floor(now) - 1, duty = 0; for (var i = 0; i < 200; i++) duty += tele(gl + i / 200); duty /= 200;
    rect(200, 360, 400, 160, '#161b21', '#3a4550', 3); rect(220, 390, 360, 100, '#05080a', null);
    txt((l1 + (l2 - l1) * duty).toFixed(3), 400, 442, 50, '#7fe8a2', 'center', 600, true);
    txt('nm', 560, 470, 20, P.ink2, 'right', 600, true);
    dot(230, 378, 6, (now % 1) < 0.15 ? P.gold : '#3a4654');
  });

  /* the on-chip source heats the chip as it sweeps: later resonances arrive red-shifted and the spacing looks larger */
  def('heatedSweep', 8, function (u, t) {
    var sw = lin(u, 0.05, 0.85), stretch = 160 / 120;
    chipSurf(150, 50, 500, 150); rect(170, 90, 80, 70, '#c2a868', null); wgLine([[250, 125], [630, 125]], 3);
    [340, 440, 540].forEach(function (x) { circ(x, 85, 28, P.wg, 3); });
    flash(400, 125, 260, 'rgba(255,120,60,0.9)', 0.1 + 0.4 * sw);
    rect(690, 50, 26, 150, '#0c1218', '#3a4654', 2); rect(694, 196 - 142 * sw, 18, 142 * sw, P.orange, null);
    var m = screen(110, 260, 600, 260, [0, 1], [0, 1.05], { xl: 'Wavelength' });
    var pos = [0.12, 0.33, 0.54, 0.75], meas = pos.map(function (p) { return pos[0] + (p - pos[0]) * stretch; });
    pos.forEach(function (p) { seg2(m.X(p), m.y + m.h, m.X(p), m.y + m.h - 26, '#8a96a3', 3); });
    trace(m, function (x) { var v = 1; meas.forEach(function (q) { v -= 0.85 * lor(x, q, 0.012); }); return v; }, P.gold, 3, 0, sw, 600);
    seg2(m.X(sw), m.y, m.X(sw), m.y + m.h, 'rgba(86,212,255,0.8)', 2.5);
  });

  /* delayed self-heterodyne setup: the flat input connector reflects into the laser until an isolator goes in */
  def('selfHet', 8, function (u, t) {
    var iso = seg(u, 0.4, 0.5) * (1 - seg(u, 0.9, 0.98)), y = 130;
    laser(70, y, 0.6, { alarm: 0.6 * (1 - iso) }, t);
    fiber([[100, y], [300, y]], P.jacket, 4);
    if (iso > 0.02) isolator(170, y - (1 - iso) * 80, 80, { h: 26 });
    ferrule(220, y, 0.45, { hot: (1 - iso) * (0.5 + 0.4 * Math.sin(t * 7)) });
    if (iso < 0.5) pulse(P2(215, y, 104, y), (u * 4) % 1, P.back, 0.4, 3);
    dot(310, y, 10, P.steel); fiber([[310, y], [380, y - 60], [500, y - 60]], P.jacket, 4); fiber([[310, y], [380, y + 60], [460, y + 60]], P.jacket, 4);
    spoolDraw(560, y - 60, 46); rect(460, y + 40, 80, 40, '#2a3a52', '#56d4ff', 2);
    fiber([[606, y - 60], [680, y]], P.jacket, 4); fiber([[540, y + 60], [680, y]], P.jacket, 4); dot(680, y, 10, P.steel); detector(700, y, 0.6, {});
    var m = screen(110, 280, 600, 250, [-1, 1], [0, 1.1], { xl: 'Frequency' });
    var wd = lerp(0.45, 0.05, iso), a = lerp(0.3, 1, iso);
    trace(m, function (x) { var v = a * lor(x, 0, wd); if (wd > 0.15) v *= 1 + 0.2 * (hash(Math.floor(x * 120) + Math.floor(t * 10)) - 0.5); return v + 0.015; }, wd > 0.15 ? P.back : P.teal, 3, -1, 1, 400);
  });
  function spoolDraw(x, y, r) { dot(x, y, r, '#2b2f35'); dot(x, y, r * 0.86, '#d8b947'); for (var i = 0; i < 6; i++) circ(x, y, r * (0.45 + i * 0.07), 'rgba(90,70,10,0.5)', 1); dot(x, y, r * 0.42, '#2b2f35'); }

  /* every run kept: nine sweeps, some with a second peak one mode spacing away. p.mode 'keep' ticks each run,
     'hold' stacks the runs against a held shipment */
  function runCard(x, y, w, h, i, t, hl) {
    rect(x, y, w, h, '#05080b', hl ? P.back : '#3a4654', hl ? 3 : 1.5);
    var two = [1, 3, 4, 6].indexOf(i) >= 0, pts = [];
    for (var k = 0; k <= 60; k++) { var xx = k / 60, v = 0.9 * lor(xx, 0.42, 0.02) + (two ? 0.5 * lor(xx, 0.58, 0.02) : 0); pts.push([x + 6 + xx * (w - 12), y + h - 8 - v * (h - 24)]); }
    line(pts, two ? P.gold : P.teal, 2);
    txt(String(i + 1), x + 12, y + 14, 16, P.ink3, 'left', 700, true);
  }
  def('runStrip', 9, function (u, t, p) {
    var hold = p.mode === 'hold', n = Math.floor(lin(u, 0.05, 0.75) * 9.99);
    if (hold) {
      poly([[480, 240], [760, 240], [760, 520], [480, 520]], '#b9894e', '#6e4f26', 3); rect(480, 360, 280, 40, '#d8c08a', null);
      stampMark(620, 380, 'HOLD', '#c62828', lin(u, 0.15, 0.55), -0.18);
      for (var i = 0; i < 9; i++) { if (i >= n) break; runCard(40 + (i % 3) * 140, 60 + Math.floor(i / 3) * 150, 126, 130, i, t, [1, 3, 4, 6].indexOf(i) >= 0); }
      return;
    }
    for (i = 0; i < 9; i++) {
      var x = 100 + (i % 3) * 205, y = 30 + Math.floor(i / 3) * 185;
      runCard(x, y, 185, 150, i, t, false);
      if (i < n) { rect(x + 150, y + 112, 30, 30, P.ok, null); line([[x + 156, y + 127], [x + 163, y + 135], [x + 175, y + 117]], '#ffffff', 4); }
      if (i === n) flash(x + 92, y + 75, 120, 'rgba(255,255,255,0.4)', 0.4);
    }
  });
  /* second signature: not until every run is attached */
  def('holdSignature', 9, function (u, t) {
    rect(120, 40, 560, 520, P.paper, '#9aa4b0', 1.5);
    for (var i = 0; i < 4; i++) rect(150, 70 + i * 30, 380, 11, '#c3cad3', null);
    var n = Math.floor(lin(u, 0.1, 0.65) * 9.99);
    for (i = 0; i < 9; i++) { var x = 150 + i * 56, y = 210; rect(x, y, 48, 60, i < n ? '#05080b' : '#dfe4ea', i < n ? '#3a4654' : '#b9c2cc', 1.5); if (i < n) { var two = [1, 3, 4, 6].indexOf(i) >= 0; line([[x + 6, y + 50], [x + 18, y + 50], [x + 20, y + 14], [x + 22, y + 50], [x + 28, y + 50]].concat(two ? [[x + 30, y + 30], [x + 32, y + 50], [x + 42, y + 50]] : [[x + 42, y + 50]]), two ? '#b88a10' : '#1a8a72', 2); } }
    seg2(150, 360, 390, 360, '#5b6673', 2); seg2(420, 360, 650, 360, '#5b6673', 2);
    var p1 = []; for (var k = 0; k <= 120; k++) { var s = k / 120; p1.push([160 + s * 200 - 10 * Math.sin(s * 40), 344 - 16 * Math.cos(s * 40) * (0.6 + 0.4 * Math.sin(s * 7))]); } line(p1, '#173a8a', 3);
    var e = seg(u, 0.7, 0.9), p2 = []; for (k = 0; k <= 120 * e; k++) { var s2 = k / 120; p2.push([430 + s2 * 200 - 10 * Math.sin(s2 * 36), 344 - 16 * Math.cos(s2 * 36) * (0.6 + 0.4 * Math.sin(s2 * 5 + 2))]); } line(p2, '#173a8a', 3);
    var pen = e > 0 && e < 1 ? p2[p2.length - 1] : [440, 300 + 6 * Math.sin(t * 3)];
    at(pen[0], pen[1], 1, -0.7, function () { rect(0, -5, 120, 10, '#2b2f35', null); rect(-14, -3, 14, 6, '#c9a24a', null); });
    if (n < 9) { var c = Math.floor(t * 2) % 2; txt('?', 540, 300, 44, c ? P.back : '#c62828', 'center', 900); }
  });

  /* =====================================================================
     Reveal banners (free layout, any aspect)
     ===================================================================== */
  /* cavities nobody designed: an amplifier with facets, a crossing, a splitter with a dark port, a multimode
     interferometer, a grating coupler and an offset splice each send a little light back as the pulse passes */
  def('hiddenReflectors', 7, function (u, t) {
    var W = S.W, H = S.H, L = W - 80, y = H / 2, sc = Math.min(H / 320, L / 880), X = function (f) { return 40 + L * f; };
    chipSurf(X(0.02), y - 95 * sc, X(0.84) - X(0.02), 190 * sc);
    wgLine([[X(0.02), y], [X(0.84), y]], 4 * sc);
    var amp = [X(0.06), X(0.16)]; rect(amp[0], y - 14 * sc, amp[1] - amp[0], 28 * sc, '#2a2236', null); rect(amp[0], y - 5 * sc, amp[1] - amp[0], 10 * sc, P.pink, null); seg2(amp[0], y - 22 * sc, amp[0], y + 22 * sc, '#e3ecf7', 3); seg2(amp[1], y - 22 * sc, amp[1], y + 22 * sc, '#e3ecf7', 3);
    wgLine([[X(0.3), y - 60 * sc], [X(0.3), y + 60 * sc]], 4 * sc);
    wgLine([[X(0.42), y], [X(0.46), y - 40 * sc], [X(0.5), y - 40 * sc]], 3 * sc); wgLine([[X(0.42), y], [X(0.46), y + 40 * sc], [X(0.5), y + 40 * sc]], 3 * sc); flash(X(0.5), y + 40 * sc, 20 * sc, 'rgba(255,90,79,0.9)', 0.5);
    rect(X(0.58), y - 30 * sc, X(0.66) - X(0.58), 60 * sc, 'rgba(194,201,242,0.4)', P.wg, 2);
    gcFan(X(0.76), y, 1.2 * sc);
    fiber([[X(0.86), y - 8 * sc], [X(0.92), y - 8 * sc]], P.jacket, 8 * sc); fiber([[X(0.92), y + 4 * sc], [X(0.99), y + 4 * sc]], P.jacket, 8 * sc);
    var pts = [X(0.06), X(0.16), X(0.3), X(0.42), X(0.58), X(0.66), X(0.76), X(0.92)], s = lin(u, 0, 0.8), px = lerp(X(0.0), X(0.99), s);
    if (u < 0.82) flash(px, y, 30 * sc, P.fwd, 0.9);
    glow([[X(0), y], [px, y]], P.fwd, 3 * sc, 10, 0.4);
    pts.forEach(function (x, i) { if (px > x) { var age = (px - x) / L; flash(x, y, 46 * sc, 'rgba(255,90,79,0.95)', clamp(1 - age * 4)); if (age < 0.3) glow([[x - age * L * 0.8, y + 6 * sc], [x - age * L * 0.8 + 30 * sc, y + 6 * sc]], P.back, 3 * sc, 10, 1 - age * 3); } });
  }, { free: true });

  /* the reflection comes home: whatever path the light took out, the reflection retraces it */
  def('retrace', 6, function (u, t) {
    var W = S.W, H = S.H, y = H / 2, sc = Math.min(H / 300, (W - 80) / 900), x0 = 40 + 60 * sc, x1 = W - 60;
    laser(40 + 50 * sc, y, sc, { alarm: 0.7 * bump(u, 0.85, 1) }, t);
    var lx = x0 + (x1 - x0) * 0.22, cx = x0 + (x1 - x0) * 0.45, fx = x0 + (x1 - x0) * 0.62;
    var c = S.c; c.fillStyle = 'rgba(160,220,255,0.45)'; c.beginPath(); c.ellipse(lx, y, 10 * sc, 60 * sc, 0, 0, TAU); c.fill();
    poly([[cx - 60 * sc, y - 12 * sc], [cx + 60 * sc, y - 30 * sc], [cx + 60 * sc, y + 30 * sc], [cx - 60 * sc, y + 12 * sc]], 'rgba(194,201,242,0.3)', P.wg, 2);
    fiber([[fx, y], [x1 - 20, y]], P.jacket, 6 * sc); mirror(x1, y, 120 * sc);
    var path = [[x0 + 10, y], [lx, y], [cx - 60 * sc, y], [cx + 60 * sc, y], [x1 - 6, y]];
    var pa = mkPath(path.map(function (q, i) { return [q[0], y + (i === 1 ? 0 : 0)]; }));
    if (u < 0.45) pulse(pa, lin(u, 0, 0.45) * 1.1, P.fwd, 0.1, 9 * sc);
    else pulse(mkPath(pa.p.slice().reverse()), lin(u, 0.47, 0.92) * 1.1, P.back, 0.1, 6 * sc);
    flash(x1 - 6, y, 60 * sc, '#ffffff', bump(u, 0.4, 0.52));
  }, { free: true });

  /* resolution hides ripple: the analyzer shows the spectrum convolved with its resolution bandwidth */
  def('osaResolution', 8, function (u, t) {
    var W = S.W, H = S.H, sig = lerp(0.004, 0.06, 0.5 - 0.5 * Math.cos(u * TAU)), per = 0.04;
    var mx = 60, my = 40, mw = W - 120 - (W > 1000 ? 160 : 0), mh = H - 110;
    var m = screen(mx, my, mw, mh, [-0.5, 0.5], [0, 1.1], { nx: 10, ny: 4 });
    var f = function (x) { return 0.25 + 0.7 * lor(x, 0, 0.01) + 0.12 * Math.cos(TAU * x / per); };
    trace(m, f, 'rgba(255,255,255,0.25)', 1.5, -0.5, 0.5, 900, false);
    trace(m, function (x) { var s = 0, w = 0; for (var k = -12; k <= 12; k++) { var d = k / 12 * 2.5 * sig, g = Math.exp(-d * d / (2 * sig * sig)); s += g * f(x + d); w += g; } return s / w; }, P.gold, 3, -0.5, 0.5, 500);
    var bw = sig * 2.355 / 1 * mw, bx = W > 1000 ? mx + mw + 40 : mx + mw / 2 - bw / 2, by = W > 1000 ? my + mh / 2 : my + mh + 34;
    if (W > 1000) { rect(bx, by - 30, 100, 60, '#0c1218', '#3a4654', 2); rect(bx + 50 - Math.min(90, bw) / 2, by - 12, Math.min(90, bw), 24, P.violet, null); }
    else { rect(bx, by - 10, bw, 20, P.violet, null); }
  }, { free: true });
})();
