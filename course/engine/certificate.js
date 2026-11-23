/* Certificate of completion renderer. Classic script, no build. Contract: course/COURSE_SPEC.md (Certificate).
   window.LMS_CERT.render(variant, data, opts) returns an SVG string, US Letter landscape (11 x 8.5 in, viewBox 1100 x 850).
   data = { name, courseTitle, courseCode, date (ISO), certNo, hours, policy, host: { name, role }, mantra[], line }
   Every frame, guilloche, seal, ribbon, emblem and signature is drawn here from code; fonts are the vendored OFL faces
   in engine/vendor/fonts (loaded on demand by ensureFonts, embedded as data URIs for PNG export). */
(function () {
  'use strict';

  const W = 1100, H = 850;
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const BASE = SRC ? SRC.replace(/[^/]*$/, '') : 'engine/';
  const FONT_SCRIPT_URL = BASE + 'vendor/fonts/cert_fonts_data.js';

  const F = {
    black: "'UnifrakturMaguntia', 'Cinzel Decorative', serif",
    pinyon: "'Pinyon Script', 'Great Vibes', cursive",
    vibes: "'Great Vibes', 'Pinyon Script', cursive",
    deco: "'Cinzel Decorative', 'IM Fell English', serif",
    fell: "'IM Fell English', 'Cinzel Decorative', serif",
  };
  const FAMILIES = ['UnifrakturMaguntia', 'Pinyon Script', 'Great Vibes', 'Cinzel Decorative', 'IM Fell English'];

  /* ---------- small utilities ---------- */
  const r1 = (v) => Math.round(v * 10) / 10;
  const r2 = (v) => Math.round(v * 100) / 100;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TAU = Math.PI * 2;
  const pts = (arr, close) => { let s = ''; for (let i = 0; i < arr.length; i++) s += (i ? 'L' : 'M') + r1(arr[i][0]) + ' ' + r1(arr[i][1]); return s + (close ? 'Z' : ''); };
  const attrs = (o) => Object.keys(o).filter((k) => o[k] != null && o[k] !== false).map((k) => k + '="' + esc(o[k]) + '"').join(' ');
  const hash32 = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
  const B32 = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const code32 = (n, len) => { let s = ''; for (let i = 0; i < len; i++) { s += B32[n % 32]; n = Math.floor(n / 32); } return s; };

  /* ---------- text measurement (canvas, after ensureFonts) ---------- */
  let mctx = null;
  function measure(text, size, family, weight, style, ls) {
    if (!mctx) { try { mctx = document.createElement('canvas').getContext('2d'); } catch (e) { mctx = null; } }
    let w;
    if (mctx) { mctx.font = (style || 'normal') + ' ' + (weight || 400) + ' ' + size + 'px ' + family; w = mctx.measureText(text).width; }
    else w = text.length * size * 0.5;
    return w + (ls || 0) * Math.max(0, text.length - 1);
  }
  /* largest size <= max that fits maxW (never below min) */
  function fitSize(text, max, min, maxW, family, weight, style, lsPerSize) {
    const w = measure(text, max, family, weight, style, (lsPerSize || 0) * max);
    if (w <= maxW) return max;
    return Math.max(min, max * maxW / w);
  }
  /* greedy word wrap; shrinks the size until the text fits in maxLines */
  function wrap(text, max, min, maxW, maxLines, family, weight, style) {
    const words = String(text).split(/\s+/).filter(Boolean);
    for (let size = max; size >= min - 1e-6; size -= 0.5) {
      const lines = []; let cur = '';
      for (const wd of words) {
        const t = cur ? cur + ' ' + wd : wd;
        if (!cur || measure(t, size, family, weight, style) <= maxW) cur = t; else { lines.push(cur); cur = wd; }
      }
      if (cur) lines.push(cur);
      if (lines.length <= maxLines && lines.every((l) => measure(l, size, family, weight, style) <= maxW)) return { size, lines };
      if (size - 0.5 < min) return { size, lines };
    }
    return { size: min, lines: [text] };
  }

  function text(x, y, str, o) {
    o = o || {};
    const a = {
      x: r1(x), y: r1(y), 'font-family': o.font || F.fell, 'font-size': r2(o.size || 16), 'font-weight': o.weight && o.weight !== 400 ? o.weight : null,
      'font-style': o.style && o.style !== 'normal' ? o.style : null, fill: o.fill || '#222', 'text-anchor': o.anchor || 'middle',
      'letter-spacing': o.ls ? r2(o.ls) : null, opacity: o.opacity != null ? o.opacity : null,
      textLength: o.textLength ? r1(o.textLength) : null, lengthAdjust: o.textLength ? (o.adjust || 'spacingAndGlyphs') : null,
      stroke: o.stroke || null, 'stroke-width': o.strokeWidth || null, 'paint-order': o.stroke ? 'stroke' : null,
    };
    return '<text ' + attrs(a) + '>' + esc(str) + '</text>';
  }
  /* centered wrapped block; returns { svg, bottom } */
  function block(cx, y, str, o) {
    const fam = o.font || F.fell;
    const wr = wrap(str, o.size, o.min || o.size * 0.75, o.maxW, o.lines || 2, fam, o.weight, o.style);
    const lh = wr.size * (o.lh || 1.3);
    let s = '';
    wr.lines.forEach((ln, i) => {
      const w = measure(ln, wr.size, fam, o.weight, o.style);
      s += text(cx, y + i * lh, ln, Object.assign({}, o, { size: wr.size, textLength: w > o.maxW ? o.maxW : null }));
    });
    return { svg: s, bottom: y + (wr.lines.length - 1) * lh, size: wr.size, n: wr.lines.length };
  }

  /* ---------- geometry generators ---------- */
  /* point and outward normal at arc length s along a rounded rectangle (x, y, w, h, corner radius rc), clockwise from top-left straight */
  function rrect(x, y, w, h, rc) {
    const segs = [];
    const L1 = w - 2 * rc, L2 = h - 2 * rc, A = Math.PI * rc / 2;
    segs.push({ len: L1, f: (t) => [x + rc + t, y, 0, -1] });
    segs.push({ len: A, f: (t) => { const a = -Math.PI / 2 + t / rc; return [x + w - rc + rc * Math.cos(a), y + rc + rc * Math.sin(a), Math.cos(a), Math.sin(a)]; } });
    segs.push({ len: L2, f: (t) => [x + w, y + rc + t, 1, 0] });
    segs.push({ len: A, f: (t) => { const a = t / rc; return [x + w - rc + rc * Math.cos(a), y + h - rc + rc * Math.sin(a), Math.cos(a), Math.sin(a)]; } });
    segs.push({ len: L1, f: (t) => [x + w - rc - t, y + h, 0, 1] });
    segs.push({ len: A, f: (t) => { const a = Math.PI / 2 + t / rc; return [x + rc + rc * Math.cos(a), y + h - rc + rc * Math.sin(a), Math.cos(a), Math.sin(a)]; } });
    segs.push({ len: L2, f: (t) => [x, y + h - rc - t, -1, 0] });
    segs.push({ len: A, f: (t) => { const a = Math.PI + t / rc; return [x + rc + rc * Math.cos(a), y + rc + rc * Math.sin(a), Math.cos(a), Math.sin(a)]; } });
    const total = segs.reduce((a, b) => a + b.len, 0);
    return {
      total,
      at(s) { s = ((s % total) + total) % total; for (const g of segs) { if (s <= g.len) return g.f(s); s -= g.len; } return segs[0].f(0); },
    };
  }
  /* guilloche band: `n` phase-shifted waves following the rounded rectangle, seamless (integer wavelengths), symmetric phases */
  function frameWaves(x, y, w, h, rc, o) {
    const rr = rrect(x, y, w, h, rc);
    const nW = Math.max(4, Math.round(rr.total / o.lambda));
    const lam = rr.total / nW;
    const step = Math.min(o.step || 2.2, lam / 10);
    const N = Math.ceil(rr.total / step);
    const s0 = (w - 2 * rc) / 2; /* start at top center: left/right mirror symmetric */
    let d = '';
    for (let k = 0; k < o.n; k++) {
      const ph = TAU * k / o.n;
      const p = [];
      for (let i = 0; i <= N; i++) {
        const s = s0 + i * rr.total / N, q = rr.at(s), u = TAU * (i * rr.total / N) / lam;
        let off = o.amp * Math.sin(u + ph);
        if (o.mod) off = o.amp * Math.sin(u + ph) * (1 - o.mod) + o.amp * o.mod * Math.sin(o.modK * u - ph);
        off += o.offset || 0;
        p.push([q[0] + q[2] * off, q[1] + q[3] * off]);
      }
      d += pts(p, true);
    }
    return '<path d="' + d + '" fill="none" ' + attrs({ stroke: o.color, 'stroke-width': o.width || 0.45, opacity: o.opacity }) + '/>';
  }
  function rrectPath(x, y, w, h, rc) {
    if (!rc) return 'M' + r1(x) + ' ' + r1(y) + 'H' + r1(x + w) + 'V' + r1(y + h) + 'H' + r1(x) + 'Z';
    return 'M' + r1(x + rc) + ' ' + r1(y) + 'H' + r1(x + w - rc) + 'A' + rc + ' ' + rc + ' 0 0 1 ' + r1(x + w) + ' ' + r1(y + rc) + 'V' + r1(y + h - rc)
      + 'A' + rc + ' ' + rc + ' 0 0 1 ' + r1(x + w - rc) + ' ' + r1(y + h) + 'H' + r1(x + rc) + 'A' + rc + ' ' + rc + ' 0 0 1 ' + r1(x) + ' ' + r1(y + h - rc)
      + 'V' + r1(y + rc) + 'A' + rc + ' ' + rc + ' 0 0 1 ' + r1(x + rc) + ' ' + r1(y) + 'Z';
  }
  function rect(x, y, w, h, o) { return '<path d="' + rrectPath(x, y, w, h, o.rc || 0) + '" ' + attrs({ fill: o.fill || 'none', stroke: o.stroke, 'stroke-width': o.width, opacity: o.opacity }) + '/>'; }
  /* polar rosette: K closed curves r(t) = rm + ra sin(lobes t + 2 pi k / K) [+ rb sin(m t)] */
  function rosette(cx, cy, o) {
    let d = '';
    const N = o.N || 720;
    for (let k = 0; k < o.K; k++) {
      const ph = TAU * k / o.K + (o.phase || 0);
      const p = [];
      for (let i = 0; i < N; i++) {
        const t = TAU * i / N;
        const r = o.rm + o.ra * Math.sin(o.lobes * t + ph) + (o.rb ? o.rb * Math.sin(o.m * t - ph * (o.twist || 1)) : 0);
        p.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
      }
      d += pts(p, true);
    }
    return '<path d="' + d + '" fill="none" ' + attrs({ stroke: o.color, 'stroke-width': o.width || 0.4, opacity: o.opacity }) + '/>';
  }
  /* hypotrochoid (spirograph) scaled to radius `size`; R/r rational so it closes */
  function spiro(cx, cy, o) {
    const R = o.R, r = o.r, dd = o.d;
    const g = (a, b) => (b ? g(b, a % b) : a);
    const turns = r / g(R, r);
    const N = Math.max(600, Math.round(turns * (o.per || 160)));
    const ext = R - r + dd, sc = o.size / ext;
    const p = [];
    for (let i = 0; i <= N; i++) {
      const t = TAU * turns * i / N + (o.rot || 0);
      p.push([cx + sc * ((R - r) * Math.cos(t) + dd * Math.cos((R - r) / r * t)), cy + sc * ((R - r) * Math.sin(t) - dd * Math.sin((R - r) / r * t))]);
    }
    return '<path d="' + pts(p, true) + '" fill="none" ' + attrs({ stroke: o.color, 'stroke-width': o.width || 0.35, opacity: o.opacity }) + '/>';
  }
  /* straight wave band between two points: n phase-shifted sinusoids, integer wavelengths */
  function waveLine(x0, y0, x1, y1, o) {
    const L = Math.hypot(x1 - x0, y1 - y0), tx = (x1 - x0) / L, ty = (y1 - y0) / L, nx = -ty, ny = tx;
    const lam = L / Math.max(1, Math.round(L / o.lambda));
    const N = Math.ceil(L / Math.min(2.2, lam / 10));
    let d = '';
    for (let k = 0; k < o.n; k++) {
      const ph = TAU * k / o.n, p = [];
      for (let i = 0; i <= N; i++) { const s = i * L / N, off = o.amp * Math.sin(TAU * s / lam + ph); p.push([x0 + tx * s + nx * off, y0 + ty * s + ny * off]); }
      d += pts(p, false);
    }
    return '<path d="' + d + '" fill="none" ' + attrs({ stroke: o.color, 'stroke-width': o.width || 0.4, opacity: o.opacity }) + '/>';
  }

  /* ---------- Five Sigma emblem: bell curve, dashed line at 5 sigma, dot beyond ---------- */
  function emblem(cx, cy, s, o) {
    o = o || {};
    const u0 = -3.3, u1 = 6.5, span = u1 - u0;
    const X = (u) => cx - s / 2 + (u - u0) / span * s;
    const base = cy + s * 0.26, top = cy - s * 0.3, hgt = base - top;
    const Y = (u) => base - hgt * Math.exp(-u * u / 2);
    const curve = [];
    for (let i = 0; i <= 120; i++) { const u = u0 + span * i / 120; curve.push([X(u), Math.min(base, Y(u))]); }
    const sw = o.sw || s * 0.045;
    let g = '';
    if (o.fill) g += '<path d="' + pts(curve.slice(0, 110)) + 'L' + r1(X(u0 + span * 109 / 120)) + ' ' + r1(base) + 'L' + r1(X(u0)) + ' ' + r1(base) + 'Z" ' + attrs({ fill: o.fill, opacity: o.fillOpacity }) + '/>';
    g += '<path d="' + pts(curve) + '" fill="none" ' + attrs({ stroke: o.stroke || '#222', 'stroke-width': r2(sw), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }) + '/>';
    const x5 = X(5);
    g += '<line ' + attrs({ x1: r1(x5), y1: r1(base), x2: r1(x5), y2: r1(top - s * 0.02), stroke: o.accent || o.stroke || '#222', 'stroke-width': r2(sw * 0.8), 'stroke-dasharray': r2(s * 0.035) + ' ' + r2(s * 0.03), 'stroke-linecap': 'butt' }) + '/>';
    g += '<circle ' + attrs({ cx: r1(X(5.62)), cy: r1(base - s * 0.055), r: r2(s * 0.05), fill: o.accent || o.stroke || '#222' }) + '/>';
    return '<g' + (o.opacity != null ? ' opacity="' + o.opacity + '"' : '') + '>' + g + '</g>';
  }
  /* lowercase sigma drawn as a path (the vendored faces carry Latin only) */
  function sigma(cx, cy, s, color, sw) {
    const r = s * 0.34;
    return '<g fill="none" stroke="' + color + '" stroke-width="' + r2(sw || s * 0.11) + '" stroke-linecap="round">'
      + '<circle cx="' + r1(cx) + '" cy="' + r1(cy + s * 0.12) + '" r="' + r2(r) + '"/>'
      + '<path d="M' + r1(cx - s * 0.05) + ' ' + r1(cy + s * 0.12 - r) + 'L' + r1(cx + s * 0.5) + ' ' + r1(cy + s * 0.12 - r) + '"/></g>';
  }

  /* ---------- defs: gold foil, paper, shadows ---------- */
  function goldDefs(id) {
    return '<linearGradient id="' + id + 'gold" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="#7d5c19"/><stop offset="0.16" stop-color="#c9a24a"/><stop offset="0.32" stop-color="#fbe7a1"/><stop offset="0.46" stop-color="#d4ab4f"/>'
      + '<stop offset="0.6" stop-color="#a27b26"/><stop offset="0.74" stop-color="#f3d888"/><stop offset="0.88" stop-color="#b48a33"/><stop offset="1" stop-color="#6f5016"/></linearGradient>'
      + '<linearGradient id="' + id + 'goldL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="240" y2="0" spreadMethod="reflect"><stop offset="0" stop-color="#8a6a1f"/><stop offset="0.3" stop-color="#e2c370"/><stop offset="0.5" stop-color="#fbe7a1"/><stop offset="0.7" stop-color="#c9a24a"/><stop offset="1" stop-color="#8a6a1f"/></linearGradient>'
      + '<radialGradient id="' + id + 'goldR" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#fff4c4"/><stop offset="0.35" stop-color="#e5c26a"/><stop offset="0.75" stop-color="#b3892f"/><stop offset="1" stop-color="#7a5817"/></radialGradient>'
      + '<linearGradient id="' + id + 'goldH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e29a"/><stop offset="0.5" stop-color="#c49a3e"/><stop offset="1" stop-color="#8c6a1f"/></linearGradient>'
      + '<filter id="' + id + 'shadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.2"/><feOffset dx="1.6" dy="2.4"/><feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  }
  function paperDefs(id, tint) {
    return '<filter id="' + id + 'paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="7" result="n"/>'
      + '<feColorMatrix in="n" type="matrix" values="0 0 0 0 ' + tint[0] + ' 0 0 0 0 ' + tint[1] + ' 0 0 0 0 ' + tint[2] + ' 0 0 0 0.16 -0.02"/></filter>';
  }

  /* ---------- seal: serrated gold foil, ring text, guilloche, emblem ---------- */
  function seal(id, cx, cy, R, o) {
    o = o || {};
    const teeth = o.teeth || 64;
    const edge = [];
    for (let i = 0; i < teeth * 2; i++) { const a = TAU * i / (teeth * 2) - Math.PI / 2, rr = i % 2 ? R * 0.93 : R; edge.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
    const dark = o.dark || '#5e4413', light = '#fff3c6';
    const rt = R * 0.755;
    const pid = id + 'sealring' + Math.round(cx) + '_' + Math.round(cy);
    const ring = 'M' + r1(cx - rt) + ' ' + r1(cy) + 'A' + r1(rt) + ' ' + r1(rt) + ' 0 1 1 ' + r1(cx + rt) + ' ' + r1(cy) + 'A' + r1(rt) + ' ' + r1(rt) + ' 0 1 1 ' + r1(cx - rt) + ' ' + r1(cy);
    const label = o.label || 'FIVE SIGMA PHOTONICS, INC. • OFFICE OF PHOTONIC CONDUCT • ';
    const circ = TAU * rt;
    let g = '<g filter="url(#' + id + 'shadow)">';
    g += '<path d="' + pts(edge, true) + '" fill="url(#' + id + 'gold)" stroke="' + dark + '" stroke-width="0.6"/>';
    g += '</g>';
    g += '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="' + r1(R * 0.87) + '" fill="url(#' + id + 'goldR)" stroke="' + dark + '" stroke-width="1"/>';
    g += '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="' + r1(R * 0.85) + '" fill="none" stroke="' + light + '" stroke-width="0.6" opacity="0.8"/>';
    g += rosette(cx, cy, { K: 6, rm: R * 0.865, ra: R * 0.012, lobes: 90, color: dark, width: 0.35, opacity: 0.55, N: 1440 });
    g += '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="' + r1(R * 0.655) + '" fill="none" stroke="' + dark + '" stroke-width="0.9"/>';
    g += '<path id="' + pid + '" d="' + ring + '" fill="none"/>';
    const ts = R * 0.115;
    const tp = (fill, dx, dy, op) => '<text font-family="' + esc(F.deco) + '" font-weight="700" font-size="' + r2(ts) + '" fill="' + fill + '"' + (op ? ' opacity="' + op + '"' : '') + ' transform="translate(' + dx + ' ' + dy + ')"><textPath href="#' + pid + '" startOffset="0" textLength="' + r1(circ * 0.995) + '" lengthAdjust="spacing" dominant-baseline="middle">' + esc(label) + '</textPath></text>';
    g += tp(light, -0.5, -0.5, 0.85) + tp(dark, 0.3, 0.3);
    g += rosette(cx, cy, { K: 12, rm: R * 0.56, ra: R * 0.07, lobes: 18, color: dark, width: 0.4, opacity: 0.7, N: 900 });
    g += '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="' + r1(R * 0.46) + '" fill="url(#' + id + 'goldR)" stroke="' + dark + '" stroke-width="0.9"/>';
    g += emblem(cx - 0.7, cy - 0.7 + R * 0.02, R * 0.66, { stroke: light, accent: light, sw: R * 0.042, opacity: 0.9 });
    g += emblem(cx, cy + R * 0.02, R * 0.66, { stroke: dark, accent: o.accent || '#7a1d12', sw: R * 0.042 });
    return g;
  }
  /* two ribbon tails hanging from (cx, cy), V notched */
  function tails(id, cx, cy, R, o) {
    const len = R * (o.len || 1.55), wd = R * (o.w || 0.42);
    const one = (ang) => {
      const a = ang * Math.PI / 180, dx = Math.sin(a), dy = Math.cos(a), px = Math.cos(a), py = -Math.sin(a);
      const x0 = cx, y0 = cy, x1 = cx + dx * len, y1 = cy + dy * len;
      const p = [[x0 - px * wd / 2, y0 - py * wd / 2], [x1 - px * wd / 2, y1 - py * wd / 2], [x1 - dx * wd * 0.45, y1 - dy * wd * 0.45], [x1 + px * wd / 2, y1 + py * wd / 2], [x0 + px * wd / 2, y0 + py * wd / 2]];
      let s = '<path d="' + pts(p, true) + '" fill="' + o.fill + '" stroke="' + (o.edge || '#000') + '" stroke-width="0.6"/>';
      if (o.stripe) {
        const q = (f) => [[x0 + px * wd * f, y0 + py * wd * f], [x1 + px * wd * f - dx * wd * 0.45 * (1 - 2 * Math.abs(f)), y1 + py * wd * f - dy * wd * 0.45 * (1 - 2 * Math.abs(f))]];
        [-0.3, 0.3].forEach((f) => { const l = q(f); s += '<line x1="' + r1(l[0][0]) + '" y1="' + r1(l[0][1]) + '" x2="' + r1(l[1][0]) + '" y2="' + r1(l[1][1]) + '" stroke="' + o.stripe + '" stroke-width="' + r2(wd * 0.08) + '"/>'; });
      }
      return s;
    };
    return '<g filter="url(#' + id + 'shadow)">' + one(o.angle || 24) + one(-(o.angle || 24)) + '</g>';
  }

  /* ---------- laurel branch pair around (cx, cy) ---------- */
  function laurel(cx, cy, R, o) {
    const leaves = o.n || 11;
    let s = '';
    const side = (sgn) => {
      let g = '';
      const a0 = 100, a1 = 248; /* degrees, measured from +x with y down: 90 = bottom */
      const stem = [];
      for (let i = 0; i <= 40; i++) { const a = (a0 + (a1 - a0) * i / 40) * Math.PI / 180; stem.push([cx + sgn * R * Math.cos(a) * -1, cy + R * Math.sin(a)]); }
      g += '<path d="' + pts(stem) + '" fill="none" stroke="' + o.color + '" stroke-width="' + r2(R * 0.022) + '" stroke-linecap="round"/>';
      for (let i = 0; i < leaves; i++) {
        const f = (i + 0.5) / leaves, a = (a0 + (a1 - a0) * f) * Math.PI / 180;
        const x = cx - sgn * R * Math.cos(a), y = cy + R * Math.sin(a);
        const tang = Math.atan2(Math.cos(a), sgn * Math.sin(a)); /* direction of travel */
        const L = R * (0.3 - 0.13 * f), Wd = L * 0.38;
        [1, -1].forEach((io) => {
          const dir = tang + io * 0.55 * sgn;
          const ex = x + L * Math.cos(dir), ey = y + L * Math.sin(dir);
          const mx = (x + ex) / 2, my = (y + ey) / 2, nx = -Math.sin(dir) * Wd, ny = Math.cos(dir) * Wd;
          g += '<path d="M' + r1(x) + ' ' + r1(y) + 'Q' + r1(mx + nx) + ' ' + r1(my + ny) + ' ' + r1(ex) + ' ' + r1(ey) + 'Q' + r1(mx - nx) + ' ' + r1(my - ny) + ' ' + r1(x) + ' ' + r1(y) + 'Z" fill="' + o.fill + '" stroke="' + o.color + '" stroke-width="' + r2(R * 0.008) + '"/>';
        });
      }
      return g;
    };
    s += side(1) + side(-1);
    return s;
  }

  /* ---------- signatures: centripetal Catmull-Rom spline through hand-placed points, broad-nib width model ---------- */
  /* "Pat Reynolds": baseline y = 70, x-height 50, ascender 10, descender 100 (before slant) */
  const SIG_PAT = [
    { p: [[8, 84], [11, 60], [14, 34], [17, 12], [24, 6], [38, 5], [49, 12], [50, 24], [41, 34], [26, 38], [13, 36]], w: 1 },
    { p: [[66, 53], [58, 49], [49, 54], [45, 63], [48, 71], [56, 70], [63, 60], [67, 51], [65, 61], [66, 69], [72, 71], [78, 66], [83, 52], [87, 26], [88, 18], [86, 30], [84, 52], [85, 66], [90, 71], [97, 68], [102, 62]], w: 0.95 },
    { p: [[70, 38], [86, 35], [106, 33]], w: 0.8, taper: 0.5 },
    { p: [[117, 84], [121, 58], [124, 34], [128, 11], [137, 5], [154, 4], [166, 11], [166, 24], [155, 34], [138, 38], [127, 37], [134, 40], [144, 50], [151, 61], [158, 69], [166, 72], [174, 67],
      [182, 58], [187, 51], [183, 47], [176, 51], [174, 61], [179, 70], [189, 70], [197, 62],
      [200, 53], [199, 62], [202, 70], [209, 69], [214, 60], [216, 52], [214, 66], [211, 82], [205, 98], [196, 104], [190, 99], [196, 89], [212, 79], [226, 70],
      [230, 60], [232, 52], [231, 62], [230, 71], [233, 60], [239, 52], [246, 52], [248, 60], [247, 69], [252, 72], [259, 67],
      [262, 58], [269, 51], [262, 50], [256, 57], [256, 67], [263, 72], [271, 66], [273, 56], [268, 50], [275, 54], [283, 55],
      [292, 40], [299, 18], [300, 7], [293, 9], [289, 30], [287, 54], [289, 68], [295, 72], [302, 67],
      [313, 54], [305, 50], [298, 56], [297, 67], [303, 72], [311, 66], [316, 55], [320, 30], [323, 8], [320, 28], [317, 52], [317, 66], [322, 72], [330, 67],
      [335, 58], [338, 51], [343, 59], [342, 68], [334, 74], [325, 72]], w: 1 },
    { p: [[34, 96], [110, 98], [200, 95], [282, 88], [345, 78], [372, 66]], w: 0.85, taper: 0.7 },
  ];
  /* second officer: a fast, mostly illegible executive scribble */
  const SIG_CPCO = [
    { p: [[6, 74], [14, 40], [22, 10], [27, 34], [32, 62], [40, 30], [50, 8], [55, 30], [58, 66], [64, 54], [76, 50], [84, 58], [80, 68], [70, 66], [88, 56], [104, 52], [112, 60], [118, 52], [128, 48], [134, 58], [146, 56], [160, 46], [172, 24], [176, 10], [172, 30], [170, 62], [180, 70], [198, 62], [222, 56]], w: 1 },
    { p: [[20, 86], [90, 92], [170, 88], [236, 74]], w: 0.8, taper: 0.7 },
  ];
  function catmull(P, perSeg) {
    const out = [];
    const n = P.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      const d = (a, b) => Math.max(1e-4, Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5));
      const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      for (let j = 0; j < perSeg; j++) {
        const t = t1 + (t2 - t1) * j / perSeg;
        const L = (a, b, ta, tb) => (tb - ta < 1e-9 ? a : [a[0] * (tb - t) / (tb - ta) + b[0] * (t - ta) / (tb - ta), a[1] * (tb - t) / (tb - ta) + b[1] * (t - ta) / (tb - ta)]);
        const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
        const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
        out.push(L(B1, B2, t1, t2));
      }
    }
    out.push(P[n - 1]);
    return out;
  }
  function signature(strokes, x, y, scale, o) {
    o = o || {};
    const slant = o.slant != null ? o.slant : 0.28, nib = (o.nib != null ? o.nib : 38) * Math.PI / 180, w0 = (o.width || 2.1);
    let d = '';
    strokes.forEach((st) => {
      const P = st.p.map((q) => [x + scale * (q[0] - (q[1] - 70) * slant), y + scale * (q[1] - 70)]);
      const c = catmull(P, 14);
      const n = c.length;
      let acc = [0];
      for (let i = 1; i < n; i++) acc.push(acc[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
      const tot = acc[n - 1] || 1;
      const L = [], R = [];
      for (let i = 0; i < n; i++) {
        const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const f = acc[i] / tot, tp = st.taper || 0.25;
        const taper = Math.min(1, Math.min(f, 1 - f) / (0.06 + 0.12 * tp)) * (1 - tp * f * 0.6);
        const hw = 0.5 * w0 * scale * (st.w || 1) * (0.32 + 0.68 * Math.abs(Math.sin(ang - nib))) * (0.25 + 0.75 * taper);
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        L.push([c[i][0] + nx * hw, c[i][1] + ny * hw]); R.push([c[i][0] - nx * hw, c[i][1] - ny * hw]);
      }
      d += pts(L.concat(R.reverse()), true);
    });
    return '<path d="' + d + '" fill="' + (o.ink || '#1a2650') + '" fill-rule="nonzero"' + (o.opacity ? ' opacity="' + o.opacity + '"' : '') + '/>';
  }

  /* microtext: phrase repeated to fill a straight line exactly */
  function micro(x0, x1, y, phrase, o) {
    o = o || {};
    const size = o.size || 3.4;
    const unit = phrase.toUpperCase() + ' • ';
    const per = Math.max(1, measure(unit, size, F.deco, 400));
    let s = ''; const n = Math.max(1, Math.ceil((x1 - x0) / per));
    for (let i = 0; i < n; i++) s += unit;
    return text(x0, y, s.trim(), { font: F.deco, size, fill: o.color || '#333', anchor: 'start', textLength: x1 - x0, adjust: 'spacing', opacity: o.opacity, ls: 0.15 });
  }
  /* microtext around a rectangle (text on path) */
  function microRect(id, x, y, w, h, phrase, o) {
    const pid = id + 'mr' + Math.round(x) + '_' + Math.round(y);
    const size = o.size || 3.4;
    const total = 2 * (w + h);
    const unit = phrase.toUpperCase() + ' • ';
    const uw = Math.max(1, measure(unit, size, F.deco, 400) + 0.15 * unit.length);
    let s = ''; const n = Math.max(1, Math.floor(total / uw));
    for (let i = 0; i < n; i++) s += unit;
    return '<path id="' + pid + '" d="M' + r1(x) + ' ' + r1(y) + 'H' + r1(x + w) + 'V' + r1(y + h) + 'H' + r1(x) + 'Z" fill="none"/>'
      + '<text font-family="' + esc(F.deco) + '" font-size="' + size + '" fill="' + (o.color || '#333') + '"' + (o.opacity ? ' opacity="' + o.opacity + '"' : '') + '><textPath href="#' + pid + '" textLength="' + r1(total - 1) + '" lengthAdjust="spacing">' + esc(s.trim()) + '</textPath></text>';
  }

  /* ---------- wording ---------- */
  function words(d) {
    const line = d.line || 'and is hereby certified to conduct themselves at all times in a manner befitting the optical workplace.';
    return {
      line,
      host: d.host || { name: 'Pat Reynolds', role: 'Director, Office of Photonic Conduct' },
      officer: 'Chief Photonic Conduct Officer',
      validThrough: addYear(d.date),
      verify: verifyCode(d),
      mantraText: (d.mantra && d.mantra.length ? d.mantra.join(' ') : 'Photonic conduct is everyone’s responsibility.').replace(/\.\s*/g, ' • ').replace(/\s*•\s*$/, ''),
    };
  }
  function addYear(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    const dt = new Date(+m[1] + 1, +m[2] - 1, +m[3]);
    if (dt.getMonth() !== +m[2] - 1) dt.setDate(0); /* 29 Feb -> 28 Feb */
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }
  function verifyCode(d) { const h1 = hash32((d.certNo || '') + '|' + (d.name || '') + '|' + (d.date || '')), h2 = hash32((d.date || '') + '#' + (d.certNo || '')); return 'OPC-' + code32(h1, 4) + '-' + code32(h2, 4); }

  /* labelled field: small caps label over a value */
  function field(x, y, label, value, o) {
    return text(x, y, label, { font: F.deco, size: o.ls || 7.2, fill: o.label || '#555', anchor: o.anchor || 'middle', ls: 1.1 })
      + text(x, y + (o.gap || 12), value, { font: o.vfont || F.fell, size: o.vs || 11.5, fill: o.value || '#222', anchor: o.anchor || 'middle', textLength: o.maxW && measure(value, o.vs || 11.5, o.vfont || F.fell) > o.maxW ? o.maxW : null });
  }
  /* signature block: signature over a line, printed name and role below */
  function sigBlock(cx, yLine, who, o) {
    const half = o.half || 112;
    let s = '';
    s += o.sig;
    s += o.microLine ? micro(cx - half, cx + half, yLine + 1, o.microLine, { size: 2.6, color: o.lineColor }) : '<line x1="' + r1(cx - half) + '" y1="' + r1(yLine) + '" x2="' + r1(cx + half) + '" y2="' + r1(yLine) + '" stroke="' + o.lineColor + '" stroke-width="0.8"/>';
    if (who.name) s += text(cx, yLine + 17, who.name, { font: F.deco, weight: 700, size: o.nameSize || 13, fill: o.nameColor, ls: 0.6 });
    s += text(cx, yLine + (who.name ? 33 : 17), who.role, { font: F.fell, style: 'italic', size: fitSize(who.role, o.roleSize || 12.5, 9, half * 2.1, F.fell, 400, 'italic'), fill: o.roleColor || o.nameColor });
    return s;
  }
  function patSig(cx, yLine, ink, sc) { const s = sc || 0.56; return signature(SIG_PAT, cx - 188 * s, yLine - 6 - 30 * s, s, { ink, width: 2.3 }); }
  function cpcoSig(cx, yLine, ink, sc) { const s = sc || 0.6; return signature(SIG_CPCO, cx - 118 * s, yLine - 6 - 28 * s, s, { ink, width: 2.1, slant: 0.18, nib: 20 }); }

  /* ---------- corner ornaments (drawn once for the top-left corner, mirrored into the other three) ---------- */
  function corners(svgTL) {
    return '<g>' + svgTL + '</g><g transform="translate(' + W + ' 0) scale(-1 1)">' + svgTL + '</g><g transform="translate(0 ' + H + ') scale(1 -1)">' + svgTL + '</g><g transform="translate(' + W + ' ' + H + ') scale(-1 -1)">' + svgTL + '</g>';
  }

  /* ======================================================================================= */
  /* Variant A: classic diploma. Parchment, triple frame with navy guilloche band, blackletter title, gold seal on navy ribbons */
  function variantA(id, d, w) {
    const ink = '#1d2944', navy = '#1f2d52', gold = 'url(#' + id + 'gold)', paper = '#f5ecd5';
    let s = '';
    s += '<defs>' + goldDefs(id) + paperDefs(id, [0.45, 0.33, 0.15]) + '<radialGradient id="' + id + 'parch" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="' + paper + '"/><stop offset="1" stop-color="#e4d1a4"/></radialGradient>'
      + '<linearGradient id="' + id + 'rib" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#16213f"/><stop offset="0.5" stop-color="#2d4178"/><stop offset="1" stop-color="#16213f"/></linearGradient></defs>';
    s += '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'parch)"/><rect width="' + W + '" height="' + H + '" filter="url(#' + id + 'paper)"/>';
    /* frames */
    s += rect(18, 18, W - 36, H - 36, { stroke: navy, width: 5 });
    s += rect(27, 27, W - 54, H - 54, { stroke: gold, width: 2.2 });
    s += frameWaves(44, 44, W - 88, H - 88, 10, { lambda: 22, amp: 9, n: 8, color: navy, width: 0.42, opacity: 0.85 });
    s += frameWaves(44, 44, W - 88, H - 88, 10, { lambda: 44, amp: 9, n: 4, color: '#9c7a2c', width: 0.5, opacity: 0.8 });
    s += rect(31, 31, W - 62, H - 62, { stroke: navy, width: 0.7 });
    s += rect(57, 57, W - 114, H - 114, { stroke: navy, width: 0.7 });
    s += rect(61, 61, W - 122, H - 122, { stroke: gold, width: 2.2 });
    s += rect(67, 67, W - 134, H - 134, { stroke: navy, width: 0.5 });
    /* corners: rosette medallion on the band plus curled scrolls */
    let c = '<circle cx="44" cy="44" r="21" fill="' + paper + '" stroke="' + navy + '" stroke-width="1.2"/>' + '<circle cx="44" cy="44" r="17.5" fill="none" stroke="#9c7a2c" stroke-width="0.8"/>';
    c += spiro(44, 44, { R: 7, r: 3, d: 2.6, size: 16, color: navy, width: 0.35, per: 120 }) + spiro(44, 44, { R: 9, r: 4, d: 3, size: 11, color: '#9c7a2c', width: 0.35, per: 120, rot: 0.3 });
    c += '<circle cx="44" cy="44" r="2.2" fill="' + navy + '"/>';
    /* flourish arm along the top edge, mirrored about the corner diagonal for the side edge */
    const arm = '<path d="M80 76 C 96 72, 104 88, 120 83 C 130 80, 135 73, 143 76 C 150 79, 149 89, 141 89 C 135 89, 134 82, 139 81" fill="none" stroke="' + navy + '" stroke-width="1.2" stroke-linecap="round"/>'
      + '<path d="M101 81 Q 109 91 101 99 Q 96 90 101 81 Z" fill="#9c7a2c"/><path d="M121 83 Q 126 74 134 73 Q 130 81 121 83 Z" fill="' + navy + '" opacity="0.85"/>';
    c += arm + '<g transform="matrix(0 1 1 0 0 0)">' + arm + '</g>';
    c += '<path d="M79 73 L85 79 L79 85 L73 79 Z" fill="#9c7a2c"/><circle cx="79" cy="79" r="1.4" fill="' + navy + '"/>';
    s += corners(c);
    /* microtext along the inner gold frame */
    s += micro(160, W - 160, 76.5, w.mantraText, { size: 3.3, color: navy });
    s += micro(160, W - 160, H - 72.5, w.mantraText, { size: 3.3, color: navy });
    /* watermark */
    s += emblem(W / 2, 452, 480, { stroke: navy, fill: navy, fillOpacity: 0.5, accent: '#9c7a2c', sw: 16, opacity: 0.045 });
    /* header */
    s += emblem(W / 2, 112, 54, { stroke: navy, fill: navy, fillOpacity: 0.12, accent: '#a8802a', sw: 3 });
    s += text(W / 2, 152, 'Five Sigma Photonics, Inc.', { font: F.deco, weight: 700, size: 19, fill: ink, ls: 3 });
    s += text(W / 2, 173, 'The Office of Photonic Conduct', { font: F.fell, style: 'italic', size: 15.5, fill: '#4a4a4a', ls: 0.5 });
    s += text(W / 2, 248, 'Certificate of Completion', { font: F.black, size: 62, fill: ink });
    s += '<path d="M330 281 H540 M560 281 H770" stroke="url(#' + id + 'goldL)" stroke-width="1.6"/><path d="M544 281 l6 -5 l6 5 l-6 5 z" fill="#9c7a2c"/>';
    s += text(W / 2, 313, 'Be it known to all persons and photons that', { font: F.fell, style: 'italic', size: 20, fill: '#333' });
    /* name */
    const ns = fitSize(d.name, 64, 30, 600, F.pinyon, 400, 'normal');
    s += text(W / 2, 385, d.name, { font: F.pinyon, size: ns, fill: '#14204a', textLength: measure(d.name, ns, F.pinyon) > 640 ? 640 : null });
    s += '<path d="M280 401 H820" stroke="#9c7a2c" stroke-width="1"/><circle cx="276" cy="401" r="2" fill="#9c7a2c"/><circle cx="824" cy="401" r="2" fill="#9c7a2c"/>';
    let b = block(W / 2, 430, 'having demonstrated sustained diligence, unwavering attention to polarization, and conduct befitting the optical workplace, has completed in full the mandatory course of instruction entitled', { font: F.fell, size: 16.5, maxW: 780, lines: 2, fill: '#2b2b2b' });
    s += b.svg;
    b = block(W / 2, b.bottom + 34, d.courseTitle, { font: F.deco, weight: 700, size: 21, min: 15, maxW: 800, lines: 2, fill: ink, lh: 1.22 });
    s += b.svg;
    b = block(W / 2, b.bottom + 30, w.line, { font: F.fell, style: 'italic', size: 16.5, maxW: 760, lines: 2, fill: '#2b2b2b' });
    s += b.svg;
    s += text(W / 2, b.bottom + 25, 'with all the rights, privileges, and return loss appertaining thereto.', { font: F.fell, size: 15.5, fill: '#2b2b2b' });
    s += text(W / 2, b.bottom + 47, 'Course ' + d.courseCode + '  •  ' + d.hours + ' Contact Hours  •  ' + d.policy, { font: F.fell, size: fitSize('Course ' + d.courseCode + '  •  ' + d.hours + ' Contact Hours  •  ' + d.policy, 12.5, 9, 820, F.fell), fill: '#555', ls: 0.3 });
    /* signatures and seal */
    const yl = 692;
    s += sigBlock(250, yl, w.host, { sig: patSig(250, yl, '#1a2a5c'), lineColor: navy, nameColor: ink, roleColor: '#444' });
    s += sigBlock(850, yl, { role: w.officer }, { sig: cpcoSig(850, yl, '#1a2a5c'), lineColor: navy, nameColor: ink, roleColor: '#444' });
    s += tails(id, W / 2, 672, 60, { fill: 'url(#' + id + 'rib)', edge: '#0d1530', stripe: '#c9a24a', angle: 22, len: 1.6 });
    s += seal(id, W / 2, 672, 60);
    /* registry fields */
    const fy = 744, fo = { label: '#5a5a5a', value: ink, vs: 10, ls: 6.6, gap: 12, vfont: F.deco };
    s += field(185, fy, 'CERTIFICATE NO.', d.certNo, fo) + field(345, fy, 'VERIFICATION', w.verify, fo);
    s += field(755, fy, 'DATE OF ISSUE', d.date, fo) + field(915, fy, 'VALID THROUGH', w.validThrough, fo);
    return s;
  }

  /* Variant B: Victorian engraved. Heavy guilloche border, corner medallions, oxblood title banner, swash name */
  function variantB(id, d, w) {
    const sep = '#4b2a16', ox = '#7c1f1c', paper = '#f3e9cf';
    let s = '';
    s += '<defs>' + goldDefs(id) + paperDefs(id, [0.4, 0.27, 0.12])
      + '<radialGradient id="' + id + 'parch" cx="0.5" cy="0.45" r="0.8"><stop offset="0.5" stop-color="' + paper + '"/><stop offset="1" stop-color="#e2cfa2"/></radialGradient>'
      + '<linearGradient id="' + id + 'ban" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a2f28"/><stop offset="0.5" stop-color="#7a1c19"/><stop offset="1" stop-color="#561210"/></linearGradient>'
      + '<linearGradient id="' + id + 'banD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a1714"/><stop offset="1" stop-color="#3e0c0a"/></linearGradient></defs>';
    s += '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'parch)"/><rect width="' + W + '" height="' + H + '" filter="url(#' + id + 'paper)"/>';
    /* heavy guilloche border: two lattices plus a contrasting rope */
    s += rect(16, 16, W - 32, H - 32, { stroke: sep, width: 3 });
    s += rect(21, 21, W - 42, H - 42, { stroke: sep, width: 0.7 });
    s += frameWaves(52, 52, W - 104, H - 104, 18, { lambda: 30, amp: 25, n: 14, color: sep, width: 0.32, opacity: 0.9 });
    s += frameWaves(52, 52, W - 104, H - 104, 18, { lambda: 30, amp: 25, n: 6, color: ox, width: 0.34, opacity: 0.75, mod: 0.5, modK: 3 });
    s += frameWaves(52, 52, W - 104, H - 104, 18, { lambda: 15, amp: 5, n: 4, color: '#a17d2e', width: 0.45, opacity: 0.9 });
    s += rect(83, 83, W - 166, H - 166, { stroke: sep, width: 0.9 });
    s += rect(87, 87, W - 174, H - 174, { stroke: 'url(#' + id + 'gold)', width: 2 });
    s += rect(92, 92, W - 184, H - 184, { stroke: sep, width: 0.5 });
    s += microRect(id, 96, 96, W - 192, H - 192, w.mantraText, { size: 3.1, color: sep });
    /* corner medallions */
    let c = '<circle cx="52" cy="52" r="40" fill="' + paper + '" stroke="' + sep + '" stroke-width="1.4"/><circle cx="52" cy="52" r="36" fill="none" stroke="url(#' + id + 'gold)" stroke-width="1.6"/>';
    c += spiro(52, 52, { R: 11, r: 4, d: 3.4, size: 33, color: sep, width: 0.32, per: 140 });
    c += spiro(52, 52, { R: 13, r: 5, d: 4.4, size: 26, color: ox, width: 0.32, per: 140, rot: 0.2 });
    c += rosette(52, 52, { K: 8, rm: 11, ra: 2.2, lobes: 9, color: sep, width: 0.3, N: 360 });
    c += '<circle cx="52" cy="52" r="3" fill="' + ox + '"/>';
    s += corners(c);
    /* side medallions on the vertical border */
    [[52, H / 2], [W - 52, H / 2]].forEach(([x, y]) => {
      s += '<circle cx="' + x + '" cy="' + y + '" r="27" fill="' + paper + '" stroke="' + sep + '" stroke-width="1.2"/>' + spiro(x, y, { R: 8, r: 3, d: 2.4, size: 22, color: sep, width: 0.3, per: 140 }) + emblem(x, y + 1, 26, { stroke: ox, accent: sep, sw: 1.6 });
    });
    /* watermark */
    s += emblem(W / 2, 470, 460, { stroke: sep, fill: sep, fillOpacity: 0.5, sw: 14, opacity: 0.04 });
    /* banner title */
    const by = 182, bx0 = 250, bx1 = 850, bR = 1500, bh = 52;
    const arc = (yy, rr) => { const cy = yy + rr; const dx = (bx1 - bx0) / 2; const yy0 = cy - Math.sqrt(rr * rr - dx * dx); return { cy, yy0 }; };
    const top = arc(by - bh / 2, bR);
    const bandTop = 'M' + bx0 + ' ' + r1(top.yy0) + 'A' + bR + ' ' + bR + ' 0 0 1 ' + bx1 + ' ' + r1(top.yy0);
    const yb = top.yy0 + bh;
    const bandPath = bandTop + 'L' + bx1 + ' ' + r1(yb) + 'A' + (bR - bh) + ' ' + (bR - bh) + ' 0 0 0 ' + bx0 + ' ' + r1(yb) + 'Z';
    /* folded tails */
    const tail = (x, sgn) => {
      const y0 = top.yy0 + 16, xo = x + sgn * 60;
      const t = [[x, y0], [xo, y0], [xo - sgn * 16, y0 + bh / 2], [xo, y0 + bh], [x, y0 + bh]];
      return '<path d="' + pts(t, true) + '" fill="url(#' + id + 'banD)" stroke="#2b0807" stroke-width="0.8"/><path d="M' + x + ' ' + r1(yb) + 'L' + (x - sgn * 12) + ' ' + r1(y0 + bh) + 'L' + x + ' ' + r1(y0 + bh) + 'Z" fill="#2b0807"/>';
    };
    s += '<g filter="url(#' + id + 'shadow)">' + tail(bx0 + 10, -1) + tail(bx1 - 10, 1) + '<path d="' + bandPath + '" fill="url(#' + id + 'ban)" stroke="#2b0807" stroke-width="0.9"/></g>';
    s += '<path d="M' + bx0 + ' ' + r1(top.yy0 + 4) + 'A' + bR + ' ' + bR + ' 0 0 1 ' + bx1 + ' ' + r1(top.yy0 + 4) + 'M' + bx0 + ' ' + r1(yb - 4) + 'A' + (bR - bh) + ' ' + (bR - bh) + ' 0 0 1 ' + bx1 + ' ' + r1(yb - 4) + '" fill="none" stroke="#d8b25a" stroke-width="0.8"/>';
    const tid = id + 'bantext';
    const ccy = top.yy0 + Math.sqrt(bR * bR - ((bx1 - bx0) / 2) * ((bx1 - bx0) / 2)), rt = bR - bh / 2 - 9, ex = 330, ey = ccy - Math.sqrt(rt * rt - ex * ex);
    s += '<path id="' + tid + '" d="M' + (W / 2 - ex) + ' ' + r1(ey) + 'A' + rt + ' ' + rt + ' 0 0 1 ' + (W / 2 + ex) + ' ' + r1(ey) + '" fill="none"/>';
    const title = 'Certificate of Photonic Conduct';
    s += '<text font-family="' + esc(F.deco) + '" font-weight="700" font-size="26" fill="#f7e7b4" letter-spacing="1.5" text-anchor="middle"><textPath href="#' + tid + '" startOffset="50%">' + esc(title) + '</textPath></text>';
    s += text(W / 2, 128, 'Five Sigma Photonics, Inc.', { font: F.deco, weight: 700, size: 17, fill: sep, ls: 3.5 });
    s += text(W / 2, 146, 'by authority of the Office of Photonic Conduct', { font: F.fell, style: 'italic', size: 14, fill: '#5a4030' });
    s += text(W / 2, 256, 'To all to whom these presents shall come, and to every photon in transit, greeting.', { font: F.fell, style: 'italic', size: 18, fill: '#3a2a1e' });
    s += text(W / 2, 293, 'Know ye that', { font: F.black, size: 30, fill: ox });
    const ns = fitSize(d.name, 64, 30, 560, F.vibes, 400, 'normal');
    s += text(W / 2, 366, d.name, { font: F.vibes, size: ns, fill: '#2a170c', textLength: measure(d.name, ns, F.vibes) > 600 ? 600 : null });
    /* engraved swash rule */
    const sw = (sg) => '<path d="M' + (W / 2) + ' 382 C ' + (W / 2 + sg * 120) + ' 374, ' + (W / 2 + sg * 220) + ' 390, ' + (W / 2 + sg * 300) + ' 380 c ' + (sg * 14) + ' -2, ' + (sg * 18) + ' -12, ' + (sg * 8) + ' -14 c ' + (sg * -8) + ' -1, ' + (sg * -10) + ' 8, ' + (sg * -2) + ' 10" fill="none" stroke="' + sep + '" stroke-width="1.1" stroke-linecap="round"/>';
    s += sw(1) + sw(-1) + '<path d="M' + (W / 2 - 6) + ' 382 l6 -5 l6 5 l-6 5 z" fill="' + ox + '"/>';
    let b = block(W / 2, 410, 'having completed, with diligence and becoming humility, the course of instruction entitled', { font: F.fell, size: 16.5, maxW: 760, lines: 1, fill: '#2e2118' });
    s += b.svg;
    b = block(W / 2, b.bottom + 30, d.courseTitle, { font: F.deco, weight: 700, size: 20, min: 14.5, maxW: 780, lines: 2, fill: ox, lh: 1.22 });
    s += b.svg;
    b = block(W / 2, b.bottom + 28, w.line, { font: F.fell, style: 'italic', size: 16, maxW: 760, lines: 2, fill: '#2e2118' });
    s += b.svg;
    b = block(W / 2, b.bottom + 24, 'is hereby admitted to the company of persons in good photonic standing, with all the rights, privileges, and return loss appertaining thereto.', { font: F.fell, size: 15.5, maxW: 780, lines: 2, fill: '#2e2118' });
    s += b.svg;
    /* signature left, seal centre, registry right */
    s += text(W / 2, b.bottom + 24, 'Course ' + d.courseCode + '  •  ' + d.policy, { font: F.fell, size: fitSize('Course ' + d.courseCode + '  •  ' + d.policy, 12.5, 9, 760, F.fell), fill: '#4a3426', ls: 0.3 });
    const yl = 688;
    s += sigBlock(270, yl, w.host, { sig: patSig(270, yl, '#22150c'), lineColor: sep, nameColor: sep, roleColor: '#4a3426' });
    s += tails(id, W / 2, 662, 54, { fill: 'url(#' + id + 'ban)', edge: '#2b0807', angle: 20, len: 1.45, stripe: '#d8b25a' });
    s += seal(id, W / 2, 662, 54, { accent: ox });
    const rx = 735, rw = 245;
    const row = (y, k, v) => text(rx, y, k, { font: F.fell, style: 'italic', size: 12.5, fill: '#4a3426', anchor: 'start' }) + text(rx + rw, y, v, { font: F.fell, size: 12.5, fill: '#22150c', anchor: 'end', textLength: measure(v, 12.5, F.fell) > 140 ? 140 : null })
      + '<line x1="' + r1(rx + measure(k, 12.5, F.fell, 400, 'italic') + 4) + '" y1="' + (y + 1) + '" x2="' + r1(rx + rw - Math.min(140, measure(v, 12.5, F.fell)) - 4) + '" y2="' + (y + 1) + '" stroke="' + sep + '" stroke-width="0.7" stroke-dasharray="0.8 2.4" stroke-linecap="round"/>';
    s += text(rx + rw / 2, 626, 'Entered in the Register', { font: F.deco, weight: 700, size: 11, fill: sep, ls: 1.2 });
    s += row(646, 'Certificate No.', d.certNo) + row(664, 'Verification', w.verify) + row(682, 'Entered', d.date) + row(700, 'Valid through', w.validThrough) + row(718, 'Credit', d.hours + ' Contact Hours');
    return s;
  }

  /* Variant C: modern corporate award. Navy band frame with fine linework, gold foil lines, rosette with laurel */
  function variantC(id, d, w) {
    const navy = '#0f2747', navy2 = '#1e3b66', gold = 'url(#' + id + 'gold)';
    let s = '';
    s += '<defs>' + goldDefs(id)
      + '<linearGradient id="' + id + 'band" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0c2140"/><stop offset="0.5" stop-color="#14305a"/><stop offset="1" stop-color="#0c2140"/></linearGradient>'
      + '<linearGradient id="' + id + 'rib" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0b1d38"/><stop offset="0.5" stop-color="#21487e"/><stop offset="1" stop-color="#0b1d38"/></linearGradient>'
      + '<clipPath id="' + id + 'bandclip"><path fill-rule="evenodd" d="M0 0H' + W + 'V' + H + 'H0Z M40 40V' + (H - 40) + 'H' + (W - 40) + 'V40Z"/></clipPath></defs>';
    s += '<rect width="' + W + '" height="' + H + '" fill="#fbfaf6"/>';
    /* navy band with fine linework */
    s += '<path fill-rule="evenodd" d="M0 0H' + W + 'V' + H + 'H0Z M40 40V' + (H - 40) + 'H' + (W - 40) + 'V40Z" fill="url(#' + id + 'band)"/>';
    s += '<g clip-path="url(#' + id + 'bandclip)">' + frameWaves(20, 20, W - 40, H - 40, 6, { lambda: 36, amp: 13, n: 10, color: '#3d6299', width: 0.4, opacity: 0.75 }) + '</g>';
    s += rect(40, 40, W - 80, H - 80, { stroke: gold, width: 3 });
    s += rect(50, 50, W - 100, H - 100, { stroke: gold, width: 0.9 });
    /* geometric gold corners */
    let c = '<path d="M50 50 H150 L140 60 H60 V140 L50 150 Z" fill="' + gold + '"/><path d="M66 66 H118 M66 66 V118" stroke="' + navy + '" stroke-width="0.8"/>';
    c += '<path d="M76 76 l10 0 l-10 10 z" fill="' + navy + '"/>';
    s += corners(c);
    /* watermark: faint guilloche rosette and emblem */
    s += spiro(W / 2, 440, { R: 25, r: 9, d: 8, size: 300, color: navy2, width: 0.5, opacity: 0.07, per: 90 });
    s += emblem(W / 2, 440, 300, { stroke: navy, sw: 9, opacity: 0.04 });
    /* header */
    s += emblem(W / 2, 104, 50, { stroke: navy, fill: navy, fillOpacity: 0.1, accent: '#b48a33', sw: 3 });
    s += text(W / 2, 145, 'FIVE SIGMA PHOTONICS', { font: F.deco, weight: 700, size: 16, fill: '#9a7524', ls: 7 });
    s += text(W / 2, 205, 'Certificate of Achievement', { font: F.deco, weight: 700, size: 46, fill: navy, ls: 1 });
    s += '<path d="M380 224 H720" stroke="url(#' + id + 'goldL)" stroke-width="2"/>';
    s += text(W / 2, 247, 'IN PHOTONIC CONDUCT', { font: F.deco, size: 13, fill: '#6a7484', ls: 5 });
    s += text(W / 2, 288, 'This award is proudly presented to', { font: F.fell, style: 'italic', size: 19, fill: '#3e4756' });
    const ns = fitSize(d.name, 74, 30, 620, F.vibes, 400, 'normal');
    s += text(W / 2, 362, d.name, { font: F.vibes, size: ns, fill: navy, textLength: measure(d.name, ns, F.vibes) > 660 ? 660 : null });
    s += '<path d="M290 380 H810" stroke="url(#' + id + 'goldL)" stroke-width="1.4"/>';
    let b = block(W / 2, 412, 'in recognition of the successful completion of the mandatory course of instruction', { font: F.fell, size: 16.5, maxW: 760, lines: 1, fill: '#2f3a4a' });
    s += b.svg;
    b = block(W / 2, b.bottom + 32, d.courseTitle, { font: F.deco, weight: 700, size: 20, min: 14.5, maxW: 800, lines: 2, fill: navy, lh: 1.22 });
    s += b.svg;
    b = block(W / 2, b.bottom + 30, w.line, { font: F.fell, style: 'italic', size: 16, maxW: 760, lines: 2, fill: '#2f3a4a' });
    s += b.svg;
    s += text(W / 2, b.bottom + 25, 'Your commitment to photonic conduct has been noted, logged, and archived.', { font: F.fell, size: 15.5, fill: '#2f3a4a' });
    s += text(W / 2, b.bottom + 48, 'Issued under ' + d.policy, { font: F.fell, style: 'italic', size: fitSize('Issued under ' + d.policy, 12.5, 9, 760, F.fell, 400, 'italic'), fill: '#6a7484' });
    /* signatures and rosette */
    const yl = 688;
    s += sigBlock(250, yl, w.host, { sig: patSig(250, yl, '#0e2350'), lineColor: navy, nameColor: navy, roleColor: '#4a5566' });
    s += sigBlock(850, yl, { role: w.officer }, { sig: cpcoSig(850, yl, '#0e2350'), lineColor: navy, nameColor: navy, roleColor: '#4a5566' });
    const rx = W / 2, ry = 658, R = 64;
    s += tails(id, rx, ry + 10, R, { fill: 'url(#' + id + 'rib)', edge: '#06142a', stripe: '#d4ab4f', angle: 18, len: 1.45, w: 0.5 });
    /* pleated foil rosette */
    const pl = [];
    for (let i = 0; i < 720; i++) { const t = TAU * i / 720, rr = R * (0.94 + 0.06 * Math.abs(Math.sin(18 * t))); pl.push([rx + rr * Math.cos(t), ry + rr * Math.sin(t)]); }
    s += '<g filter="url(#' + id + 'shadow)"><path d="' + pts(pl, true) + '" fill="url(#' + id + 'gold)" stroke="#6f5016" stroke-width="0.6"/></g>';
    let pleats = '';
    for (let i = 0; i < 36; i++) { const t = TAU * (i + 0.5) / 36; pleats += 'M' + r1(rx + R * 0.7 * Math.cos(t)) + ' ' + r1(ry + R * 0.7 * Math.sin(t)) + 'L' + r1(rx + R * 0.94 * Math.cos(t)) + ' ' + r1(ry + R * 0.94 * Math.sin(t)); }
    s += '<path d="' + pleats + '" stroke="#7d5c19" stroke-width="0.6" opacity="0.7"/>';
    s += '<circle cx="' + rx + '" cy="' + ry + '" r="' + r1(R * 0.7) + '" fill="url(#' + id + 'band)" stroke="#d4ab4f" stroke-width="1.6"/>';
    s += '<circle cx="' + rx + '" cy="' + ry + '" r="' + r1(R * 0.64) + '" fill="none" stroke="#d4ab4f" stroke-width="0.5"/>';
    s += laurel(rx, ry + 2, R * 0.5, { color: '#d4ab4f', fill: '#c49a3e', n: 8 });
    s += emblem(rx, ry - 2, R * 0.5, { stroke: '#f6e29a', accent: '#f6e29a', sw: 2.4 });
    /* registry strip */
    const items = [['CERTIFICATE NO.', d.certNo], ['VERIFICATION', w.verify], ['ISSUED', d.date], ['VALID THROUGH', w.validThrough], ['CREDIT', d.hours + ' CONTACT HOURS'], ['COURSE', d.courseCode]];
    const xs = [135, 255, 375, W - 375, W - 255, W - 135];
    items.forEach((it, i) => { s += field(xs[i], 754, it[0], it[1], { label: '#7a8494', value: navy, vs: 10, ls: 6.4, gap: 12, maxW: 112, vfont: F.deco }); });
    s += micro(156, W - 156, H - 55.5, w.mantraText, { size: 3.1, color: '#9a7524' });
    s += micro(156, W - 156, 57.8, w.mantraText, { size: 3.1, color: '#9a7524' });
    return s;
  }

  /* Variant D: banknote / bond. Security tint, interlaced border, denomination counters, oval vignette, red serials, microprint */
  function variantD(id, d, w) {
    const g1 = '#1d4a35', g2 = '#2f6b4c', tint = '#e9f0e2', red = '#a8261d';
    let s = '';
    /* security tint pattern tile */
    const tile = (() => {
      const lw = 36, lh = 9; let p = '';
      for (let k = 0; k < 2; k++) {
        const q = [];
        for (let i = 0; i <= 36; i++) { const x = i; q.push([x, lh / 2 + (lh / 2) * Math.sin(TAU * x / lw + k * Math.PI)]); }
        p += pts(q);
      }
      return '<pattern id="' + id + 'tint" width="' + lw + '" height="' + lh + '" patternUnits="userSpaceOnUse"><path d="' + p + '" fill="none" stroke="#7fa487" stroke-width="0.35"/></pattern>';
    })();
    s += '<defs>' + goldDefs(id) + paperDefs(id, [0.2, 0.3, 0.2]) + tile
      + '<linearGradient id="' + id + 'iris" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e3ecd9"/><stop offset="0.5" stop-color="#f1ecd8"/><stop offset="1" stop-color="#e3ecd9"/></linearGradient>'
      + '<radialGradient id="' + id + 'oval" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f6f4e8"/><stop offset="1" stop-color="#dfe8d4"/></radialGradient>'
      + '<linearGradient id="' + id + 'rib" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#143726"/><stop offset="0.5" stop-color="#2f6b4c"/><stop offset="1" stop-color="#143726"/></linearGradient></defs>';
    s += '<rect width="' + W + '" height="' + H + '" fill="' + tint + '"/><rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'iris)"/>';
    s += '<rect x="96" y="96" width="' + (W - 192) + '" height="' + (H - 192) + '" fill="url(#' + id + 'tint)" opacity="0.55"/>';
    s += '<rect width="' + W + '" height="' + H + '" filter="url(#' + id + 'paper)"/>';
    /* interlaced bond border */
    s += rect(14, 14, W - 28, H - 28, { stroke: g1, width: 2.4 });
    s += '<path fill-rule="evenodd" d="M18 18H' + (W - 18) + 'V' + (H - 18) + 'H18Z M86 86V' + (H - 86) + 'H' + (W - 86) + 'V86Z" fill="#dfe9d6"/>';
    s += frameWaves(52, 52, W - 104, H - 104, 14, { lambda: 26, amp: 28, n: 18, color: g1, width: 0.3, opacity: 0.95 });
    s += frameWaves(52, 52, W - 104, H - 104, 14, { lambda: 52, amp: 28, n: 8, color: g2, width: 0.34, opacity: 0.7, mod: 0.6, modK: 2 });
    s += frameWaves(52, 52, W - 104, H - 104, 14, { lambda: 13, amp: 4, n: 3, color: '#ffffff', width: 1.1, opacity: 0.9 });
    s += rect(19, 19, W - 38, H - 38, { stroke: g1, width: 0.6 });
    s += rect(85, 85, W - 170, H - 170, { stroke: g1, width: 1.6 });
    s += rect(91, 91, W - 182, H - 182, { stroke: g1, width: 0.5 });
    s += microRect(id, 88, 88, W - 176, H - 176, w.mantraText, { size: 2.6, color: g1 });
    /* denomination counters */
    let c = '<circle cx="62" cy="62" r="50" fill="#eef3e8" stroke="' + g1 + '" stroke-width="1.6"/>';
    c += rosette(62, 62, { K: 10, rm: 42, ra: 5, lobes: 24, color: g1, width: 0.3, N: 900 }) + rosette(62, 62, { K: 6, rm: 42, ra: 5, lobes: 12, rb: 1.5, m: 36, color: g2, width: 0.3, N: 900 });
    c += '<circle cx="62" cy="62" r="33" fill="#f4f6ee" stroke="' + g1 + '" stroke-width="0.9"/>';
    c += spiro(62, 62, { R: 10, r: 3, d: 2.2, size: 31, color: '#7fa487', width: 0.3, per: 140 });
    s += corners(c);
    [[62, 62], [W - 62, 62], [62, H - 62], [W - 62, H - 62]].forEach(([x, y]) => {
      s += text(x - 7, y + 13, '5', { font: F.deco, weight: 700, size: 38, fill: g1 }) + sigma(x + 11, y + 1, 18, g1, 3.2);
    });
    /* oval vignette (left) and seal (right) */
    const ov = (cx, cy) => {
      let g = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="92" ry="112" fill="#e6eedd" stroke="' + g1 + '" stroke-width="1.4"/>';
      for (let k = 0; k < 7; k++) { const pts2 = []; for (let i = 0; i <= 720; i++) { const t = TAU * i / 720, rr = 1 + 0.045 * Math.sin(40 * t + TAU * k / 7); pts2.push([cx + 86 * rr * Math.cos(t), cy + 106 * rr * Math.sin(t)]); } g += '<path d="' + pts(pts2, true) + '" fill="none" stroke="' + g1 + '" stroke-width="0.3"/>'; }
      g += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="76" ry="96" fill="url(#' + id + 'oval)" stroke="' + g1 + '" stroke-width="1"/>';
      for (let i = 0; i < 26; i++) g += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + r1(74 - i * 2.7) + '" ry="' + r1(94 - i * 3.4) + '" fill="none" stroke="#9bb89f" stroke-width="0.3"/>';
      g += emblem(cx, cy + 6, 118, { stroke: g1, fill: g2, fillOpacity: 0.2, accent: red, sw: 5 });
      return g;
    };
    s += '<g transform="translate(185 420) scale(0.88) translate(-185 -420)">' + ov(185, 420) + '</g>';
    s += text(185, 540, 'Beyond Five Sigma', { font: F.fell, style: 'italic', size: 13, fill: g1 });
    s += tails(id, W - 185, 410, 58, { fill: 'url(#' + id + 'rib)', edge: '#0c2418', stripe: '#d4ab4f', angle: 20, len: 1.6 });
    s += seal(id, W - 185, 410, 58, { accent: red });
    /* serials */
    const serial = d.certNo;
    s += text(118, 128, serial, { font: F.deco, weight: 700, size: 17, fill: red, anchor: 'start', ls: 1.5 });
    s += text(W - 118, H - 110, serial, { font: F.deco, weight: 700, size: 17, fill: red, anchor: 'end', ls: 1.5 });
    /* title */
    s += text(W / 2, 132, 'FIVE SIGMA PHOTONICS, INC.', { font: F.deco, weight: 700, size: 19, fill: g1, ls: 4 });
    s += text(W / 2, 152, 'Office of Photonic Conduct  •  Incorporated beyond five standard deviations', { font: F.fell, style: 'italic', size: 13, fill: '#3b5a48' });
    s += text(W / 2, 210, 'Certificate of Completion', { font: F.deco, weight: 700, size: 42, fill: g1, ls: 1, stroke: '#f3f6ec', strokeWidth: 3 });
    s += waveLine(330, 228, 770, 228, { lambda: 10, amp: 3, n: 3, color: g2, width: 0.5 });
    s += text(W / 2, 278, 'This certifies that', { font: F.fell, style: 'italic', size: 19, fill: '#24382c' });
    const ns = fitSize(d.name, 58, 26, 470, F.pinyon, 400, 'normal');
    s += text(W / 2, 348, d.name, { font: F.pinyon, size: ns, fill: '#14301f', textLength: measure(d.name, ns, F.pinyon) > 500 ? 500 : null });
    s += '<path d="M320 364 H780" stroke="' + g1 + '" stroke-width="0.9"/>';
    let b = block(W / 2, 394, 'is the registered holder of one (1) fully paid and non-assessable Certificate of Completion in the mandatory course', { font: F.fell, size: 15.5, maxW: 520, lines: 2, fill: '#24382c' });
    s += b.svg;
    b = block(W / 2, b.bottom + 30, d.courseTitle, { font: F.deco, weight: 700, size: 18, min: 13, maxW: 520, lines: 3, fill: g1, lh: 1.22 });
    s += b.svg;
    b = block(W / 2, b.bottom + 28, w.line, { font: F.fell, style: 'italic', size: 15, maxW: 520, lines: 3, fill: '#24382c' });
    s += b.svg;
    s += text(W / 2, b.bottom + 24, 'Transferable only by the registered holder, in person, under illumination.', { font: F.fell, size: 13.5, fill: '#24382c' });
    /* signatures with microprint lines */
    const yl = 676;
    s += sigBlock(250, yl, w.host, { sig: patSig(250, yl, '#14243f'), lineColor: g1, nameColor: g1, roleColor: '#33503f', microLine: w.mantraText });
    s += sigBlock(850, yl, { role: w.officer }, { sig: cpcoSig(850, yl, '#14243f'), lineColor: g1, nameColor: g1, roleColor: '#33503f', microLine: w.mantraText });
    /* center registry cartouche */
    s += rect(430, 626, 240, 96, { stroke: g1, width: 1, fill: '#eef3e8', rc: 8 });
    s += rect(434, 630, 232, 88, { stroke: g1, width: 0.4, rc: 6 });
    const fo = { label: '#4a6a56', value: '#14301f', vs: 10, ls: 6.4, gap: 11.5, maxW: 104, vfont: F.deco };
    s += field(492, 650, 'VERIFICATION', w.verify, fo) + field(608, 650, 'CREDIT', d.hours + ' HOURS', fo);
    s += field(492, 686, 'ISSUED', d.date, fo) + field(608, 686, 'VALID THROUGH', w.validThrough, fo);
    s += text(W / 2, 752, 'Course ' + d.courseCode + '  •  ' + d.policy, { font: F.fell, size: fitSize('Course ' + d.courseCode + '  •  ' + d.policy, 12, 8, 500, F.fell), fill: '#33503f' });
    return s;
  }

  const VARIANTS = {
    A: { label: 'Classic diploma', fn: variantA },
    B: { label: 'Victorian engraved', fn: variantB },
    C: { label: 'Modern corporate award', fn: variantC },
    D: { label: 'Banknote and bond', fn: variantD },
  };

  /* ---------- fonts ---------- */
  let fontPromise = null;
  function loadScript(url) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = () => res(); s.onerror = () => rej(new Error('failed to load ' + url)); document.head.appendChild(s); });
  }
  function b64ToBuf(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  function ensureFonts() {
    if (fontPromise) return fontPromise;
    fontPromise = (window.LMS_CERT_FONTS ? Promise.resolve() : loadScript(FONT_SCRIPT_URL)).then(() => {
      const faces = window.LMS_CERT_FONTS || [];
      if (!window.FontFace || !document.fonts) return;
      return Promise.all(faces.map((f) => {
        const ff = new FontFace(f.family, b64ToBuf(f.data), { style: f.style, weight: String(f.weight), unicodeRange: f.range });
        document.fonts.add(ff);
        return ff.load().catch(() => null);
      })).then(() => document.fonts.ready);
    }).then(() => { mctx = null; }).catch((e) => { console.warn('certificate fonts:', e.message); });
    return fontPromise;
  }
  function fontCss(svgBody) {
    const faces = window.LMS_CERT_FONTS || [];
    return faces.filter((f) => svgBody.indexOf(f.family) >= 0).map((f) => '@font-face{font-family:\'' + f.family + '\';font-style:' + f.style + ';font-weight:' + f.weight + ';src:url(data:font/woff2;base64,' + f.data + ') format(\'woff2\');unicode-range:' + f.range + ';}').join('');
  }

  /* ---------- public API ---------- */
  let uid = 0;
  function normalize(d) {
    d = Object.assign({}, d || {});
    d.name = String(d.name || '').trim() || 'Valued Team Member';
    d.courseTitle = d.courseTitle || 'Photonic Conduct';
    d.courseCode = d.courseCode || 'PC-0000';
    d.date = d.date || isoToday();
    d.certNo = d.certNo || newCertNo(d.courseCode);
    d.hours = d.hours || '1.0';
    d.policy = d.policy || '';
    d.mantra = d.mantra || [];
    return d;
  }
  function render(variant, data, opts) {
    opts = opts || {};
    const v = VARIANTS[variant] || VARIANTS.A;
    const id = 'lc' + (opts.id || ++uid) + '_';
    const d = normalize(data);
    const body = v.fn(id, d, words(d));
    const style = opts.embedFonts ? '<style>' + fontCss(body) + '</style>' : '';
    const size = opts.size === 'px' ? 'width="' + (opts.width || 3300) + '" height="' + (opts.height || 2550) + '"' : 'width="11in" height="8.5in"';
    return '<svg xmlns="http://www.w3.org/2000/svg" ' + size + ' viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc('Certificate of completion for ' + d.name + ', ' + d.courseTitle) + '" text-rendering="geometricPrecision">'
      + style + body + '</svg>';
  }
  function isoToday() { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }
  function newCertNo(code) {
    let r = 0;
    try { const a = new Uint32Array(1); crypto.getRandomValues(a); r = a[0]; } catch (e) { r = Math.floor(Math.random() * 4294967296); }
    return (code || 'PC-0000') + '-' + code32(r, 6);
  }
  /* rasterize an SVG string to a PNG blob at w x h (fonts must be embedded in the string) */
  function toPng(svg, w, h) {
    return new Promise((res, rej) => {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const draw = () => {
          try {
            const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
            const cx = cv.getContext('2d'); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
            cv.toBlob((b) => { URL.revokeObjectURL(url); b ? res(b) : rej(new Error('toBlob failed')); }, 'image/png');
          } catch (e) { URL.revokeObjectURL(url); rej(e); }
        };
        /* fonts inside an SVG image can finish decoding a frame after onload */
        (img.decode ? img.decode().catch(() => null) : Promise.resolve()).then(() => setTimeout(draw, 250));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('SVG image failed to load')); };
      img.src = url;
    });
  }
  function fileName(d) {
    const nm = String(d.name || 'Trainee').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Trainee';
    return 'FiveSigma_' + (d.courseCode || 'COURSE') + '_Certificate_' + nm + '.png';
  }
  /* render, rasterize at 3300 x 2550 (US Letter at 300 dpi) and trigger a download */
  function download(variant, data, opts) {
    opts = opts || {};
    const d = normalize(data);
    return ensureFonts().then(() => toPng(render(variant, d, { embedFonts: true, size: 'px', width: opts.width || 3300, height: opts.height || 2550 }), opts.width || 3300, opts.height || 2550)).then((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = opts.fileName || fileName(d);
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return blob;
    });
  }
  /* certificate data from a course object (course/courses/<id>.js) */
  function fromCourse(course, o) {
    o = o || {};
    const m = /(\d+(?:\.\d+)?)\s*minutes?/i.exec(course.duration || '');
    const hours = m ? (Math.round(+m[1] / 6) / 10).toFixed(1) : '1.0';
    const cert = course.certificate || {};
    return normalize({
      name: o.name, date: o.date, certNo: o.certNo,
      courseTitle: course.title, courseCode: course.code, hours, policy: course.policy || '',
      host: course.host ? { name: course.host.name, role: course.host.role } : null,
      mantra: course.mantraShort || (course.mantra ? [course.mantra] : []), line: cert.line,
    });
  }

  window.LMS_CERT = { render, ensureFonts, toPng, download, fileName, fromCourse, newCertNo, isoToday, variants: Object.keys(VARIANTS).map((k) => ({ id: k, label: VARIANTS[k].label })), families: FAMILIES };
})();
