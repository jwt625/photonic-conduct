"""Cast portraits for 'Meet the people in this course': Gary, Gary in the cleanroom, Morgan, Dana Okafor, and the crystal.

Same clay character kit (charkit/), studio office set, lights, camera framing and colour pipeline as the host portrait
(shot_host_pat.py, whose helpers this script imports). One character per Blender run (the kit resets the scene).

  gary        the kit's Gary (interconnect film v2 preset: skin, brows, build, belly, cream tee, blue bib overalls with
              the red pen in the bib pocket and brass buckles), without the hard hat: short dark hair, safety glasses
              pushed up on the forehead, confident grin
  gary_suit   Gary in a white cleanroom coverall: hood with face opening and elastic hem, face mask over nose and
              mouth, clear safety glasses, name tag GARY, zip placket
  morgan      Gary's manager (the kit's manager v2 preset: navy suit, white shirt, red tie, parted brown hair with a
              quiff), smug half-lidded smile
  dana        Dana Okafor, labmate (as the earlier drawn avatar: dark brown skin, natural curly hair, round glasses,
              teal sweater, orange lanyard with a badge), warm smile
  crystal     a 100 mm lithium niobate device wafer (shot_wafer.py geometry and materials, gold modulator dies) standing
              on its primary flat in a black wafer stand on a walnut desk, scribed +Z arrow, same set behind

Run (through the Blender slot wrapper):
  bslot.sh -b --factory-startup --python shot_cast.py -- who=gary out=course/media/render/cast_gary.jpg
  options: res (image height, width = 3/4), samples, avatar=<path> (256 px face crop, as shot_host_pat.py),
           view = main | face (close-up check)
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "charkit"))
import numpy as np  # noqa: E402
import bpy  # noqa: E402
from bpy_extras.object_utils import world_to_camera_view  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402
import shot_host_pat as P  # noqa: E402  (Pat's set, lights, lens / pose / avatar helpers)
import chars_geo as G  # noqa: E402
import chars_mat as M  # noqa: E402
import chars_body as B  # noqa: E402
import chars_outfit as O  # noqa: E402
import chars_head as HD  # noqa: E402
import npc_kit_v2 as NK  # noqa: E402

B.torso_table = P._torso_table   # shot_host_pat patches the kit torso for Pat; the cast uses the kit torso

A = C.args(out="/tmp/cast.jpg", who="gary", view="main", samples=256, res=1200, noise=0.01,
           look="AgX - Medium High Contrast", avatar="", exposure=0.0, light=0.55, threads=4, hide="")

# closed-mouth expressions (same parameter set as the kit's expressions; gains applied by HD.E)
HD.EXPR["gary_grin"] = dict(corner=0.0085, gap=0.0028, width=1.08, cheek=0.0045, lid_lo=0.10, brow_in=-0.001, brow_out=0.0045)
HD.EXPR["gary_eyes"] = dict(corner=0.006, gap=0.0028, cheek=0.0035, lid_lo=0.16, brow_in=0.002, brow_out=0.005)
HD.EXPR["morgan_smug"] = dict(brow_in=-0.002, brow_out=0.005, lid_up=0.26, lid_tilt=0.05, corner=0.009, smirk=0.006,
                              width=1.08, gap=0.0022, cheek=0.0035)
HD.EXPR["dana_smile"] = dict(corner=0.0075, gap=0.0028, width=1.05, cheek=0.0045, lid_lo=0.09, brow_in=0.003, brow_out=0.004)
for _k in ("gary_grin", "gary_eyes", "morgan_smug", "dana_smile"):
    if _k not in HD.KEYS:
        HD.KEYS.append(_k)


def finish_props(ch):
    ch.root_props()


# ------------------------------------------------------------------------------------------------ Gary
GARY_SKIN, GARY_HAIR = "#e2a57a", "#3a2412"


def gary_spec(suit=False):
    spec = B.default_spec()
    spec.update(H=1.69, build=1.0, belly=0.45, wide=1.06)
    if suit:
        spec["head"]["ear_s"] = 0.45   # ears stay inside the hood
    return spec


def z_at_x(spec, x, off):
    zs = np.linspace(1.30, 1.47, 400)
    rx, ry, cy = B.torso_at(spec, zs, off)
    k = int(np.argmin(np.abs(rx - abs(x))))
    return float(zs[k])


def build_gary():
    spec = gary_spec()
    ch = B.Character("gary", spec)
    ch.root_props()
    pre = "MAT_gary_"
    O.face_mats(ch, GARY_SKIN, brow_hex=GARY_HAIR, lip_hex="#c9705f")
    ch.mat("overalls", M.clay(pre + "overalls", "#2c5db5", rough=0.72, bump=0.28, sheen=0.2,
                              folds=[(0.50, 0.10, 17.0, 0.5), (0.93, 0.08, 15.0, 0.4), (0.22, 0.07, 24.0, 0.4)]))
    ch.mat("shirt", M.clay(pre + "shirt", "#d9d1bd", rough=0.74, bump=0.28, sheen=0.2,
                           folds=[(1.30, 0.06, 26.0, 0.5), (1.09, 0.10, 18.0, 0.5)]))
    ch.mat("tool_red", M.clay(pre + "pen", "#c32a20", rough=0.55, bump=0.2))
    ch.mat("brass", M.metal(pre + "brass", "#d9b04a", 0.3))
    ch.mat("hair", P.hair_material(pre + "hair", light="#4a3020", dark="#24160b"))
    ch.mat("frame", M.gloss(pre + "safety_frame", "#26303a", rough=0.3, spec=0.5))
    ch.mat("lens", P.lens_material(pre + "lens"))
    spec = ch.spec
    J = ch.J
    surf = O.surf_pt
    ch.add(ch.skin_parts(), "body", ["skin"])
    ch.build_face()

    # t-shirt (kit Gary): torso, short sleeves with hems, neck band
    tp = ch.torso_part(off=0.010, z0=1.00, z1=1.385, cap1=None)
    parts = [tp]
    for side, sn in ((1, "L"), (-1, "R")):
        sx = np.array([side, 1, 1])
        sh, el = J["sh"] * sx, J["el"] * sx
        e2 = sh + (el - sh) * 0.50
        rr = ch.ARM_UA[0] + 0.016
        sl = G.tube(np.array([sh, (sh + e2) / 2, e2]), np.array([rr[0], rr[0] * 0.98, rr[1] * 0.99]),
                    np.array([rr[0], rr[0] * 0.98, rr[1] * 0.99]), u=(0, 1, 0), nseg=24, cap0="round", cap1=None)
        sl.set_w("upper_arm_" + sn, 1.0)
        d = (e2 - sh) / np.linalg.norm(e2 - sh)
        hem = O.ring_tube(e2, d, rr[1] * 0.99, rr[1] * 0.99, 0.0105, u_hint=(0, 1, 0))
        hem.set_w("upper_arm_" + sn, 1.0)
        parts += [sl, hem]
    rx_, ry_, cy_ = B.torso_at(spec, np.array([1.385]), 0.010)
    nb = O.ring_tube((0, cy_[0], 1.385), (0, 0, 1), rx_[0], ry_[0], 0.0125)
    nb.set_w("neck", 1.0)
    parts.append(nb)
    shirt = G.merge(parts)
    shirt.closed = False
    ch.add(shirt, "shirt", ["shirt"])

    # overalls (kit Gary): waist band shell, creases, bib with pocket and pen, straps, buckles, rivets
    band = ch.torso_part(off=0.016, z0=0.80, z1=1.22, cap1=None, taper=(0.80, 1.0, 0.42), dz=0.02, nseg=48)
    band.closed = False
    ch.add(band, "overalls", ["overalls"])
    creases = [O.torso_arc(ch, z, 0.0165, -a, a, r=0.0085, sag=sg, tilt=tl)
               for z, a, tl, sg in ((1.050, 1.05, 0.008, 0.008), (1.082, 0.85, -0.010, 0.010), (1.112, 0.60, 0.006, 0.008))]
    ch.add(G.merge(creases), "creases", ["overalls"])

    def bib_pt(i, j, nz=16, nx=21, z0=1.17, z1=1.355):
        z = z0 + (z1 - z0) * i / (nz - 1)
        u = -1 + 2 * j / (nx - 1)
        xb = 0.118 * (1 - 0.30 * G.smoothstep(1.28, 1.36, z) ** 1.6)
        return surf(spec, u * xb, z, True, 0.0215)
    bib = O.grid_patch(bib_pt, 21, 16)
    ch.torso_weights(bib)
    ch.add(bib, "bib", ["overalls"], solid=0.007, bevel=0.0015)
    pz = 1.262
    py = surf(spec, 0.0, pz, True, 0.0215)[1]
    pocket = G.ellipsoid(np.array([0.0, py - 0.001, pz]), (0.060, 0.0115, 0.046), nseg=20, nrings=12, e=0.42)
    ch.torso_weights(pocket)
    pen = G.capsule(np.array([0.030, py - 0.008, pz + 0.028]), np.array([0.036, py - 0.014, pz + 0.095]), 0.0082, 0.0074, nseg=10)
    ch.torso_weights(pen)
    ch.add(pocket, "pocket", ["overalls"])
    ch.add(pen, "pen", ["tool_red"])
    fr, bt, st_ = [], [], []
    for side in (1, -1):
        cb = surf(spec, side * 0.088, 1.335, True, 0.034)
        fr.append(O.rect_frame(cb, 0.040, 0.032, r=0.0042))
        fr.append(G.capsule(cb + np.array([-0.019, 0.0, 0.0]), cb + np.array([0.019, 0.0, 0.0]), 0.0035, 0.0035, nseg=8))
        bt.append(G.ellipsoid(surf(spec, side * 0.056, 1.298, True, 0.0235), (0.0075, 0.0045, 0.0075), nseg=10, nrings=6))
        zt = z_at_x(spec, side * 0.126, 0.030)
        pts = [surf(spec, side * 0.088, 1.33, True, 0.026), surf(spec, side * 0.108, 1.385, True, 0.030),
               np.array([side * 0.126, 0.0, zt]), surf(spec, side * 0.116, 1.385, False, 0.030),
               surf(spec, side * 0.098, 1.30, False, 0.026), surf(spec, side * 0.090, 1.23, False, 0.024)]
        stp = G.tube(np.array(pts), 0.022, 0.0065, u=(1, 0, 0), nseg=10, cap0="flat", cap1="flat")
        stp.set_w("chest", 1.0)
        st_.append(stp)
    for q in fr + bt:
        ch.torso_weights(q)
    ch.add(G.merge(st_), "straps", ["overalls"])
    ch.add(G.merge(fr), "bib_buckles", ["brass"], bevel=0.001)
    ch.add(G.merge(bt), "buttons", ["brass"])

    # hair: the kit's back-and-sides band (as under the hard hat) plus a short top
    top = NK.hair_shell(ch, 1.655, 1.700, lambda z: 0.010 + 0.006 * G.smoothstep(1.70, 1.75, z))
    sides = O.hair_band(ch, 1.575, 1.70, 0.007, back_only=True, front_cut=0.028)
    NK.head_part(ch, G.merge([top, sides]), "hair", ["hair"], solid=0.004)
    forehead_glasses(ch)
    return ch


def head_front_y(ch, z, x=0.0):
    """Front surface y of the (T-mapped) head grid near height z, column near x (baseline)."""
    V = ch.T(ch.head.V0)
    sel = (np.abs(V[:, 2] - z) < 0.012) & (np.abs(V[:, 0] - x) < 0.02) & (V[:, 1] < ch.head.cy)
    return float(V[sel, 1].min())


def forehead_glasses(ch, lift=0.118, tilt_deg=-34.0):
    """Wrap-style safety glasses pushed up on the forehead: the kit's rectangular frame plus clear lenses, swung up
    about the axis through the temple tips (behind the ears), then pressed onto the forehead."""
    rx, rz = 0.056, 0.030
    gp = NK.glasses(ch, "rect", rx=rx, rz=rz, fwd=0.050, tube_r=0.0060)
    lenses = []
    for c in ch.eye_centres:
        cc = c + np.array([0, -0.050, 0.004])
        lenses.append(P.lens_part(cc + np.array([0, 0.0008, 0]), 2 * rx - 0.004, 2 * rz - 0.004))
    ln = G.merge(lenses)
    ez = float(np.mean([c[2] for c in ch.eye_centres]))
    ey = float(np.mean([c[1] for c in ch.eye_centres])) - 0.050
    zf = ez + lift
    yf = head_front_y(ch, zf) - 0.016
    piv = np.array([0.0, ey, ez])
    R = G.rot_about((1, 0, 0), math.radians(tilt_deg))
    for p in (gp, ln):
        p.v = (p.v - piv) @ R.T + np.array([0.0, yf, zf])
        p.set_w("head", 1.0)
    ch.add(gp, "safety_glasses", ["frame"])
    ch.add(ln, "safety_lenses", ["lens"], solid=0.0016)


# ------------------------------------------------------------------------------------------------ Gary, cleanroom
def hood_part(ch, margin=0.020, top_margin=0.030, z_bot=1.30, n=72):
    """Cleanroom hood: loft of superellipse rings around the T-mapped head grid (front, back and side extents per
    height plus a looseness margin), hanging straight below the widest ring of the lower head and running down
    into the coverall; the face opening is an oval in (angle, height) space."""
    V = ch.T(ch.head.V0)
    cy = ch.head.cy
    zmin, zmax = V[:, 2].min(), V[:, 2].max()
    z_cap = zmax - 0.075                       # below this the rings follow the head; above it, an elliptic dome
    zs = np.linspace(z_bot, z_cap, 84)
    ext = []
    for z in zs:
        zc = max(z, zmin + 0.01)
        sel = np.abs(V[:, 2] - zc) < 0.010
        P_ = V[sel]
        ext.append((np.abs(P_[:, 0]).max() + margin, cy - P_[:, 1].min() + margin, P_[:, 1].max() - cy + margin))
    ext = np.array(ext)
    ker = np.ones(7) / 7.0
    ext = np.stack([np.convolve(np.pad(ext[:, k], 3, mode="edge"), ker, mode="valid") for k in range(3)], axis=1)
    # hang straight below the widest ring of the lower head (no tuck under the jaw)
    iw = int(np.argmax(ext[:, 0] * (zs < (zmin + zmax) / 2)))
    for k in range(iw):
        ext[k] = np.maximum(ext[k], ext[iw])
    # dome from z_cap to the crown plus a looser top margin
    top_z = zmax + top_margin
    e0 = ext[-1]
    tt = np.linspace(0, 1, 14)[1:]
    zs = np.append(zs, z_cap + (top_z - z_cap) * tt)
    ext = np.vstack([ext] + [e0 * math.sqrt(max(1 - t * t, 0.0)) for t in tt])
    p_ = 2.4
    rows = []
    for (z, (rx, rf, rb)) in zip(zs, ext):
        ring = []
        for j in range(n):
            ph = 2 * math.pi * j / n          # 0 = front (-y)
            s, c = math.sin(ph), math.cos(ph)
            x = rx * np.sign(s) * abs(s) ** (2 / p_)
            r_ = rf if c > 0 else rb
            y = cy - r_ * np.sign(c) * abs(c) ** (2 / p_)
            ring.append((x, y, z))
        rows.append(ring)
    Vh = np.array([pt for r in rows[:-1] for pt in r] + [rows[-1][0]])
    nr = len(rows) - 1
    F = []
    for i in range(nr - 1):
        for j in range(n):
            F.append((i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j))
    tip = len(Vh) - 1
    for j in range(n):
        F.append(((nr - 1) * n + j, (nr - 1) * n + (j + 1) % n, tip))
    hp = G.Part(Vh, F, 0, closed=False)
    return hp, zs, ext


def build_gary_suit():
    spec = gary_spec(suit=True)
    ch = B.Character("gary", spec)
    ch.root_props()
    pre = "MAT_garysuit_"
    O.face_mats(ch, GARY_SKIN, brow_hex=GARY_HAIR, lip_hex="#c9705f")
    white = "#eef0f2"
    ch.mat("suit", M.clay(pre + "coverall", white, rough=0.48, bump=0.18, sheen=0.45,
                          folds=[(1.05, 0.08, 20.0, 0.15)]))
    ch.mat("hood", M.clay(pre + "hood", white, rough=0.48, bump=0.16, sheen=0.45))
    ch.mat("mask", M.clay(pre + "mask", "#dbe6f0", rough=0.62, bump=0.12, sheen=0.3, folds=[(1.455, 0.030, 45.0, 0.5)]))
    ch.mat("ink", M.clay(pre + "ink", "#1d3b8a", rough=0.5, bump=0.05))
    ch.mat("zip", M.metal(pre + "zip", "#c4c7cd", 0.28))
    ch.mat("frame", M.gloss(pre + "safety_frame", "#d6e4ef", rough=0.18, spec=0.6))
    ch.mat("lens", P.lens_material(pre + "lens"))
    spec = ch.spec
    J = ch.J
    surf = O.surf_pt
    ch.add(ch.skin_parts(), "body", ["skin"])
    ch.build_face()

    # coverall: closed torso shell, long loose sleeves, zip placket, collar over the hood skirt
    off = 0.022
    tp = ch.torso_part(off=off, z0=0.80, z1=1.405, cap1=None, nseg=60, dz=0.015)
    parts = [tp]
    ar = spec["arm_r"]
    for side, sn in ((1, "L"), (-1, "R")):
        sx = np.array([side, 1, 1])
        sh, el, wr = J["sh"] * sx, J["el"] * sx, J["wr"] * sx
        end = wr - (wr - el) * 0.06
        ua = G.tube(np.array([sh, (sh + el) / 2, el]), ch.ARM_UA[0] * ar + 0.020, ch.ARM_UA[1] * ar + 0.020, u=(0, 1, 0), nseg=28)
        ua.set_w("upper_arm_" + sn, 1.0)
        fa = G.tube(np.array([el, (el + end) / 2, end]), ch.ARM_FA[0] * ar + 0.020, ch.ARM_FA[1] * ar + 0.020, u=(0, 1, 0), nseg=28, cap1=None)
        fa.set_w("forearm_" + sn, 1.0)
        parts += [ua, fa]
    cov = G.merge(parts)
    cov.closed = False
    ch.add(cov, "coverall", ["suit"], solid=0.006)
    # name written on the wearer's left chest in blue marker
    ch.add(name_text(ch, "GARY", 0.110, 1.250, 0.100, off + 0.0075), "name_text", ["ink"])

    # hood (with the elastic hem around the face opening) and face mask
    hood, hz, hext = hood_part(ch, z_bot=1.40)
    ez = float(np.mean([c[2] for c in ch.eye_centres]))
    zo_top, zo_bot = ez + 0.112, ez - 0.180
    zo_c, zo_h = (zo_top + zo_bot) / 2, (zo_top - zo_bot) / 2
    a_open = math.radians(56)
    EO = 3.2   # superellipse exponent of the opening

    def opening(c):
        x, y, z = c[:, 0], c[:, 1], c[:, 2]
        ang = np.arctan2(x, -(y - ch.head.cy))
        q = np.abs(ang / a_open) ** EO + np.abs((z - zo_c) / zo_h) ** EO
        return q < 1.0
    hood.drop_faces(opening)
    hood.f = NK._orient_out(hood.v, hood.f, np.array([0, ch.head.cy, 1.55]))
    hood.only_w(B.lerp_w(hood.v[:, 2], [1.40, 1.47], ["chest", "head"]))
    ch.add(hood, "hood", ["hood"], solid=0.004)
    # hem: oval on the hood surface (ring radii interpolated at each height)
    hem_pts = []
    for t in np.linspace(0, 2 * math.pi, 80, endpoint=False):
        st, ct = math.sin(t), math.cos(t)
        ang = a_open * np.sign(st) * abs(st) ** (2 / EO) * 0.985
        z = zo_c + zo_h * np.sign(ct) * abs(ct) ** (2 / EO) * 0.985
        rx = float(np.interp(z, hz, hext[:, 0]))
        rf = float(np.interp(z, hz, hext[:, 1]))
        s, c = math.sin(ang), math.cos(ang)
        hem_pts.append((rx * np.sign(s) * abs(s) ** (2 / 2.4), ch.head.cy - rf * abs(c) ** (2 / 2.4), z))
    hem = G.tube(np.array(hem_pts), 0.010, 0.010, u=(0, -1, 0), nseg=10, closed_path=True)
    hem.only_w(B.lerp_w(hem.v[:, 2], [1.40, 1.47], ["chest", "head"]))
    ch.add(hem, "hood_hem", ["hood"])
    fc, front = funnel_collar(ch, hz, hext, off)
    ch.add(fc, "collar", ["suit"], solid=0.005)
    # zip placket up the centre front: torso shell below the collar, collar front above it
    pts = [surf(spec, 0.0, z, True, off + 0.009) for z in np.linspace(0.86, front[0][2] - 0.01, 22)]
    pts += [np.array(q) + np.array([0.0, -0.009, 0.0]) for q in front[1:-1]]
    plk = G.tube(np.array(pts), 0.016, 0.0045, u=(1, 0, 0), nseg=10, cap0="round", cap1="round", ncap=2)
    ch.torso_weights(plk)
    ch.add(plk, "placket", ["suit"])
    zp = front[-3]
    pull = G.ellipsoid(np.array(zp) + np.array([0.007, -0.016, -0.012]), (0.006, 0.003, 0.013), nseg=10, nrings=6)
    ch.torso_weights(pull)
    ch.add(pull, "zip_pull", ["zip"])
    mask_shell(ch, "mask", ["mask"])
    for nm in ("nose", "lips"):
        ch.objs[nm].hide_render = True

    # clear over-glasses (light frame), over the eyes inside the opening
    rx, rz = 0.058, 0.036
    gp = NK.glasses(ch, "rect", rx=rx, rz=rz, fwd=0.056, tube_r=0.0058)
    ey = float(np.mean([c[1] for c in ch.eye_centres]))
    xo = float(max(abs(c[0]) for c in ch.eye_centres)) + rx + 0.004
    gp.drop_faces(lambda c: (c[:, 1] > ey - 0.010) | (np.abs(c[:, 0]) > xo))   # no temples: they would poke through the hood
    ch.add(gp, "safety_glasses", ["frame"])
    lenses = []
    for c in ch.eye_centres:
        cc = c + np.array([0, -0.056, 0.004])
        lenses.append(P.lens_part(cc + np.array([0, 0.0008, 0]), 2 * rx - 0.004, 2 * rz - 0.004))
    ch.add(G.merge(lenses), "safety_lenses", ["lens"], solid=0.0016)
    return ch


def funnel_collar(ch, hz, hext, off, z0=1.33, z1=1.455, n=72):
    """Coverall collar zipped up around the tucked-in hood skirt: loft from the torso shell up to just under the chin,
    always 12 mm outside the hood rings, with a rolled top edge."""
    spec = ch.spec
    cy = ch.head.cy
    zs = np.linspace(z0, z1, 16)
    rows = []
    for z in zs:
        rx, ry, cyt = B.torso_at(spec, np.array([z]), off)
        hx = float(np.interp(z, hz, hext[:, 0])) + 0.012
        hf = float(np.interp(z, hz, hext[:, 1])) + 0.012
        hb = float(np.interp(z, hz, hext[:, 2])) + 0.012
        t = float(G.smoothstep(z0, z0 + 0.06, z))
        rxx = (1 - t) * rx[0] + t * hx
        rff = (1 - t) * ry[0] + t * hf
        rbb = (1 - t) * ry[0] + t * hb
        cc = (1 - t) * cyt[0] + t * cy
        ring = []
        for j in range(n):
            ph = 2 * math.pi * j / n
            sn, cs = math.sin(ph), math.cos(ph)
            r_ = rff if cs > 0 else rbb
            ring.append((rxx * np.sign(sn) * abs(sn) ** (2 / 2.4), cc - r_ * np.sign(cs) * abs(cs) ** (2 / 2.4), z))
        rows.append(ring)
    V = np.array([pt for r in rows for pt in r])
    F = [(i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j) for i in range(len(rows) - 1) for j in range(n)]
    p = G.Part(V, F, 0, closed=False)
    top = np.array(rows[-1])
    rim = G.tube(np.vstack([top, top[:1]])[:-1], 0.0075, 0.0075, u=(0, 0, 1), nseg=8, closed_path=True)
    p = G.merge([p, rim])
    p.closed = False
    p.only_w(B.lerp_w(p.v[:, 2], [1.36, 1.44], ["chest", "neck"]))
    return p, [r[0] for r in rows]


def name_text(ch, text, xc, zc, width, off):
    """Raised letters on the torso front at surface offset `off`, centred at (xc, zc) (variant of NK.wordmark)."""
    spec = ch.spec
    V, F = O.text_part(text)
    w = V[:, 0].max() - V[:, 0].min()
    sc = width / w
    V = V.copy()
    V[:, 0] -= (V[:, 0].max() + V[:, 0].min()) / 2
    V[:, 1] -= (V[:, 1].max() + V[:, 1].min()) / 2
    ext = V[:, 2] - V[:, 2].min()
    out = np.zeros_like(V)
    for k in range(len(V)):
        x, z = xc + V[k, 0] * sc, zc + V[k, 1] * sc
        sp = O.surf_pt(spec, float(x), float(z), True, off)
        out[k] = (x, sp[1] - ext[k] * sc * 0.6 + 0.0006, z)
    p = G.Part(out, F, 0, closed=False)
    ch.torso_weights(p)
    return p


def mask_shell(ch, name, mats):
    """Face mask: shell over the lower face (head grid rows up to just under the eyes), offset along the normals with
    a tent over the nose; follows the expression shape keys like the kit's beard shell (NK.face_shell)."""
    head = ch.head
    n = head.n_grid
    N = NK.grid_normals(head)
    di, adj = head.di[:n], np.abs(head.dj[:n])
    sel = (adj <= 13) & (di <= 4 + (adj <= 3)) & (di >= -13)
    faces = [f for f in head.faces if max(f) < n and all(sel[i] for i in f)]
    # the mouth hole is not in head.faces: fill it back from the full grid
    full = [f for f in head.faces_full if max(f) < n and all(sel[i] for i in f)]
    faces = full
    idx = sorted({i for f in faces for i in f})
    remap = {o: k for k, o in enumerate(idx)}
    F = [tuple(remap[i] for i in f) for f in faces]
    idx = np.array(idx)
    V0 = head.V0[idx]
    tip = head.V0[head.vid(17, head.j0)]
    d2 = ((V0[:, 0] - tip[0]) / 0.020) ** 2 + ((V0[:, 2] - tip[2]) / 0.026) ** 2
    off = 0.0075 + 0.016 * np.exp(-d2)
    offv = N[idx] * off[:, None]

    def fn(e):
        return head.deformed(e)[:n][idx] + offv
    V = fn(HD.E("neutral"))
    cen = np.array([0.0, head.cy, head.zc + head.hh * 0.5])
    p = G.Part(V, NK._orient_out(V, F, cen), 0, closed=False)
    wj = head.jaw_weights()[:n][idx]
    p.only_w({"head": 1.0 - wj, "jaw": wj})
    p.v = ch.T(p.v)
    ob = ch.add(p, name, mats, register=False, solid=0.003, subsurf=1)
    HD.add_expression_keys(ob, lambda e: ch.T(fn(e)), ch.root, ch.K, p.v)
    return ob


# ------------------------------------------------------------------------------------------------ Morgan
MGR_NECK, MGR_BTN, MGR_HW = 1.395, 1.00, 0.128


def mgr_hw(z):
    t = np.clip((z - MGR_BTN) / (MGR_NECK - MGR_BTN), 0.0, 1.0)
    return MGR_HW * t ** 0.62 if z > MGR_BTN else 0.0


def build_morgan():
    """The kit's manager v2 (navy suit, white shirt, red tie, parted hair with quiff), upper body only."""
    spec = B.default_spec()
    spec.update(H=1.85, build=1.10, belly=0.30, shoulders=1.08, arm_r=1.06, leg_r=1.05, wide=1.04)
    spec["head"].update(dict(w0=0.082, jaw=0.05, chin=0.085, brow_t=0.0088, brow_h=0.0112, ear_s=0.92))
    ch = B.Character("morgan", spec)
    ch.root_props()
    pre = "MAT_morgan_"
    O.face_mats(ch, "#e89b86", brow_hex="#3d2616", flush_color="#e0301f", lip_hex="#cc6a62")
    ch.mat("jacket", M.clay(pre + "suit", "#2a2f4a", rough=0.75, bump=0.3, sheen=0.25,
                            folds=[(0.50, 0.09, 15.0, 0.30), (0.20, 0.06, 20.0, 0.30)]))
    ch.mat("shirt", M.clay(pre + "shirt", "#eeeae0", rough=0.7, bump=0.28, sheen=0.2))
    ch.mat("tie", M.clay(pre + "tie", "#d4121c", rough=0.5, bump=0.22, sheen=0.3))
    ch.mat("shoe", M.gloss(pre + "buttons", "#161618", rough=0.3, spec=0.6))
    ch.mat("hair", P.hair_material(pre + "hair", light="#6a4228", dark="#3a2412"))
    J = ch.J
    surf = O.surf_pt
    ar = spec["arm_r"]
    ch.add(ch.skin_parts(), "body", ["skin"])
    ch.build_face()

    tp = ch.torso_part(off=0.010, z0=0.96, z1=MGR_NECK, cap1=None)
    parts = [tp]
    for side, sn in ((1, "L"), (-1, "R")):
        sx = np.array([side, 1, 1])
        sh, el, wr = J["sh"] * sx, J["el"] * sx, J["wr"] * sx
        end = wr - (wr - el) * 0.04
        ua = G.tube(np.array([sh, (sh + el) / 2, el]), ch.ARM_UA[0] * ar + 0.010, ch.ARM_UA[1] * ar + 0.010, u=(0, 1, 0), nseg=24)
        ua.set_w("upper_arm_" + sn, 1.0)
        fa = G.tube(np.array([el, (el + end) / 2, end]), ch.ARM_FA[0] * ar + 0.010, ch.ARM_FA[1] * ar + 0.010, u=(0, 1, 0), nseg=24, cap1="flat")
        fa.set_w("forearm_" + sn, 1.0)
        d = (end - el) / np.linalg.norm(end - el)
        cuff = O.ring_tube(end - d * 0.02, d, ch.ARM_FA[0][2] * ar + 0.016, ch.ARM_FA[0][2] * ar + 0.016, 0.011, u_hint=(0, 1, 0))
        cuff.set_w("forearm_" + sn, 1.0)
        parts += [ua, fa, cuff]
    rx_, ry_, cy_ = B.torso_at(spec, np.array([MGR_NECK]), 0.010)
    band = O.ring_tube((0, cy_[0], MGR_NECK), (0, 0, 1), rx_[0] * 0.98, ry_[0] * 0.98, 0.014)
    band.set_w("neck", 1.0)
    parts.append(band)
    for side in (1, -1):
        pts = [surf(spec, side * 0.030, 1.372, True, 0.018), surf(spec, side * 0.060, 1.338, True, 0.021), surf(spec, side * 0.088, 1.296, True, 0.023)]
        cp = G.tube(np.array(pts), [0.020, 0.026, 0.010], [0.0055, 0.0055, 0.0045], u=(0.55, -0.1, 0.6), nseg=8, cap0="round", cap1="round", ncap=2)
        cp.set_w("chest", 1.0)
        parts.append(cp)
    shirt = G.merge(parts)
    shirt.closed = False
    ch.add(shirt, "shirt", ["shirt"])

    jk = O.jacket_shell(ch, 0.026, 0.78, MGR_NECK, mgr_hw, n=60, dz=0.02, flare=lambda z: 0.016 * float(G.smoothstep(0.98, 0.78, z)))
    sleeves = []
    for side, sn in ((1, "L"), (-1, "R")):
        sx = np.array([side, 1, 1])
        sh, el, wr = J["sh"] * sx, J["el"] * sx, J["wr"] * sx
        end = wr - (wr - el) * 0.12
        ua = G.tube(np.array([sh, (sh + el) / 2, el]), ch.ARM_UA[0] * ar + 0.014, ch.ARM_UA[1] * ar + 0.014, u=(0, 1, 0), nseg=26)
        ua.set_w("upper_arm_" + sn, 1.0)
        fa = G.tube(np.array([el, (el + end) / 2, end]), ch.ARM_FA[0] * ar + 0.014, ch.ARM_FA[1] * ar + 0.014, u=(0, 1, 0), nseg=26, cap1=None)
        fa.set_w("forearm_" + sn, 1.0)
        d = (end - el) / np.linalg.norm(end - el)
        hem = O.ring_tube(end, d, ch.ARM_FA[0][2] * ar + 0.014, ch.ARM_FA[0][2] * ar + 0.014, 0.0095, u_hint=(0, 1, 0))
        hem.set_w("forearm_" + sn, 1.0)
        sleeves += [ua, fa, hem]
    zb = 0.78
    rx, ry, cy = B.torso_at(spec, np.array([zb]), 0.026)
    th = np.linspace(0, 2 * math.pi, 56, endpoint=False)
    hem_ring = G.tube(np.array([[(rx[0] + 0.018) * math.cos(t), cy[0] + (ry[0] + 0.018) * math.sin(t), zb] for t in th]), 0.0095, 0.0095, u=(0, 0, 1), nseg=8, closed_path=True)
    ch.torso_weights(hem_ring)
    jacket = G.merge([jk, hem_ring] + sleeves)
    jacket.closed = False
    ch.add(jacket, "jacket", ["jacket"], solid=0.008)
    lap = []
    for side in (1, -1):
        zs = np.linspace(MGR_NECK - 0.004, MGR_BTN + 0.012, 14)
        pts, rr, rt = [], [], []
        for z in zs:
            t = (MGR_NECK - z) / (MGR_NECK - MGR_BTN)
            w = 0.026 + 0.040 * math.sin(math.pi * min(t * 1.08, 1.0)) ** 0.9
            pts.append(surf(spec, side * (float(mgr_hw(z)) + w * 0.50), z, True, 0.026 + 0.010))
            rr.append(w * 0.5)
            rt.append(0.0085)
        lp = G.tube(np.array(pts), np.array(rr), np.array(rt), u=(1, -0.12, 0), nseg=10, cap0="round", cap1="round", ncap=2)
        ch.torso_weights(lp)
        lap.append(lp)
    ch.add(G.merge(lap), "lapels", ["jacket"], bevel=0.0015)
    ang = np.linspace(-2.55, 2.55, 22)
    rxc, ryc, cyc = B.torso_at(spec, np.array([MGR_NECK]), 0.0)
    cpath = np.array([[0.100 * math.sin(a), cyc[0] + 0.012 + 0.092 * math.cos(a), MGR_NECK + 0.012] for a in ang])
    col = G.tube(cpath, 0.030, 0.0105, u=(0, 0, 1), nseg=10, cap0="round", cap1="round", ncap=2)
    col.set_w("chest", 0.5)
    col.add_w("neck", 0.5)
    ch.add(col, "collar", ["jacket"])
    det, btn = [], []
    for z in (1.02, 0.90):
        btn.append(G.ellipsoid(surf(spec, 0.0, z, True, 0.0275), (0.0115, 0.0055, 0.0115), nseg=12, nrings=8))
    for side in (1, -1):
        det.append(G.ellipsoid(surf(spec, side * 0.115, 0.865, True, 0.026), (0.050, 0.0085, 0.0155), nseg=14, nrings=8, e=0.5))
    det.append(G.ellipsoid(surf(spec, 0.165, 1.185, True, 0.026), (0.030, 0.0075, 0.0095), nseg=12, nrings=8, e=0.5))
    for q in det + btn:
        ch.torso_weights(q)
    ch.add(G.merge(det), "jacket_details", ["jacket"])
    ch.add(G.merge(btn), "jacket_buttons", ["shoe"])
    sq = G.ellipsoid(surf(spec, 0.165, 1.205, True, 0.0295), (0.020, 0.0055, 0.014), nseg=10, nrings=6, e=0.6)
    ch.torso_weights(sq)
    ch.add(sq, "pocket_square", ["shirt"])
    zs = np.linspace(1.345, 1.020, 16)
    ty = [surf(spec, 0.0, z, True, 0.019) for z in zs]
    wid = np.interp(zs, [1.020, 1.06, 1.13, 1.22, 1.30, 1.345], [0.014, 0.046, 0.056, 0.044, 0.026, 0.016])
    blade = G.tube(np.array(ty), wid, np.full(len(zs), 0.0085), u=(1, 0, 0), nseg=12, cap0="flat", cap1="flat")
    knot = G.ellipsoid(surf(spec, 0.0, 1.352, True, 0.024), (0.028, 0.018, 0.024), nseg=16, nrings=10)
    for q in (blade, knot):
        ch.torso_weights(q)
    ch.add(G.merge([blade, knot]), "tie", ["tie"])

    hc = O.hair_cap(ch, 1.650, off=0.007, front_z=1.718)
    q = G.tube(np.array([(-0.050, -0.050, 1.713), (-0.008, -0.072, 1.731), (0.038, -0.084, 1.731), (0.072, -0.072, 1.714)]),
               [0.012, 0.020, 0.019, 0.010], [0.012, 0.019, 0.018, 0.010], u=(0, 0, 1), nseg=12, ncap=2)
    q.set_w("head", 1.0)
    tufts = []
    for side in (1, -1):
        tt = G.ellipsoid(np.array([side * 0.066, -0.040, 1.700]), (0.026, 0.034, 0.030), nseg=12, nrings=8)
        tt.set_w("head", 1.0)
        tufts.append(tt)
    q2 = G.ellipsoid(np.array([0.0, 0.052, 1.655]), (0.080, 0.046, 0.070), nseg=16, nrings=10)
    q2.set_w("head", 1.0)
    nape = O.hair_band(ch, 1.560, 1.665, 0.012, back_only=True, front_cut=0.034)
    temple = O.hair_band(ch, 1.610, 1.675, 0.004, back_only=True, front_cut=-0.030)   # fills the cap edge above the ears
    NK.head_part(ch, G.merge([hc, q, q2, nape, temple] + tufts), "hair", ["hair"], solid=0.004)
    return ch


# ------------------------------------------------------------------------------------------------ Dana
def build_dana():
    """Dana Okafor: the kit's curly-hair / round-glasses preset (npc_ayarr v2 head and hair), teal crew-neck sweater
    with long ribbed-cuff sleeves, orange lanyard with a badge."""
    CROWN = 1.358 + 0.233 * 1.68
    spec = B.default_spec()
    spec.update(H=1.68, build=0.95, belly=0.0, wide=0.98, arm_r=0.96, leg_r=0.96)
    spec["head"].update(dict(sup=2.2, eye_r=0.0250, pupil_r=0.0116, jaw=0.06, chin=0.06, brow_t=0.0062, brow_h=0.0080,
                             nose_s=0.95, lip_r=0.0080, ear_s=0.70))
    spec["headS"] = (1.94, 1.44, 1.70)
    spec["chin_post"] = CROWN - 0.233 * spec["headS"][2]
    ch = B.Character("dana", spec)
    ch.root_props()
    pre = "MAT_dana_"
    O.face_mats(ch, "#7a4a30", brow_hex="#1e1510", lip_hex="#6e3a2c", flush_color="#8a3a2a")
    ch.mat("sweater", M.clay(pre + "sweater", "#1f8a83", rough=0.80, bump=0.30, sheen=0.45,
                             folds=[(1.10, 0.10, 18.0, 0.35), (1.28, 0.06, 24.0, 0.3)]))
    ch.mat("rib", M.clay(pre + "rib", "#1a7a74", rough=0.85, bump=0.45, sheen=0.4))
    ch.mat("hair", M.clay(pre + "hair", "#1c1410", rough=0.78, bump=0.45, sheen=0.25))
    ch.mat("frame", M.gloss(pre + "glasses", "#3b2418", rough=0.28, spec=0.5, coat=0.25))
    ch.mat("lens", P.lens_material(pre + "lens"))
    ch.mat("cord", M.clay(pre + "lanyard", "#e8632b", rough=0.6, bump=0.1))
    ch.mat("badge", M.clay(pre + "badge", "#f4f4f0", rough=0.45, bump=0.05))
    ch.mat("stripe", M.clay(pre + "badge_stripe", "#0b2545", rough=0.45, bump=0.05))
    ch.mat("clip", M.metal(pre + "clip", "#c4c7cd", 0.28))
    J = ch.J
    ar = ch.spec["arm_r"]
    ch.add(ch.skin_parts(), "body", ["skin"])
    ch.build_face()

    sw = NK.tee(ch, z0=0.92, sleeve_frac=0.999, hem=True, sleeve_pad=0.014, sleeve_hem=False)
    parts = [sw]
    for side, sn in ((1, "L"), (-1, "R")):
        sx = np.array([side, 1, 1])
        sh, el, wr = J["sh"] * sx, J["el"] * sx, J["wr"] * sx
        end = wr - (wr - el) * 0.10
        fa = G.tube(np.array([el, (el + end) / 2, end]), ch.ARM_FA[0] * ar + 0.016, ch.ARM_FA[1] * ar + 0.016, u=(0, 1, 0), nseg=24, cap1=None)
        fa.set_w("forearm_" + sn, 1.0)
        parts.append(fa)
    ch.add(G.merge(parts), "sweater", ["sweater"])
    ribs = []
    for side, sn in ((1, "L"), (-1, "R")):
        sx = np.array([side, 1, 1])
        el, wr = J["el"] * sx, J["wr"] * sx
        end = wr - (wr - el) * 0.10
        d = (end - el) / np.linalg.norm(end - el)
        cf = O.ring_tube(end - d * 0.012, d, ch.ARM_FA[0][2] * ar + 0.018, ch.ARM_FA[0][2] * ar + 0.018, 0.012, u_hint=(0, 1, 0))
        cf.set_w("forearm_" + sn, 1.0)
        ribs.append(cf)
    rx_, ry_, cy_ = B.torso_at(ch.spec, np.array([1.392]), 0.014)
    nk = O.ring_tube((0, cy_[0], 1.392), (0, 0, 1), rx_[0], ry_[0], 0.016, n=56, ns=10)
    nk.set_w("neck", 1.0)
    ribs.append(nk)
    ch.add(G.merge(ribs), "rib", ["rib"])
    cord, badge, stripe, clip = NK.lanyard(ch, z_badge=1.13, off=0.030, x_out=0.150)
    ch.add(cord, "lanyard", ["cord"])
    ch.add(badge, "badge", ["badge"])
    ch.add(stripe, "badge_stripe", ["stripe"])
    ch.add(clip, "badge_clip", ["clip"])

    base = NK.hair_shell(ch, 1.640, 1.695, lambda z: np.full_like(z, 0.012))
    base.v = ch.T(base.v)
    ch.add(G.merge([base, NK.afro_blobs(ch, r=0.042, off=0.024)]), "hair", ["hair"])
    gp = NK.glasses(ch, "round", rx=0.058, rz=0.052, fwd=0.052, tube_r=0.0068)
    ch.add(gp, "glasses", ["frame"])
    lenses = []
    for c in ch.eye_centres:
        cc = c + np.array([0, -0.052, 0.004])
        lenses.append(round_lens(cc + np.array([0, 0.0008, 0]), 0.058 - 0.003, 0.052 - 0.003))
    ch.add(G.merge(lenses), "lenses", ["lens"], solid=0.0016)
    return ch


def round_lens(center, rx, rz, n=40):
    V = [np.asarray(center, float)] + [np.asarray(center, float) + np.array([rx * math.cos(2 * math.pi * k / n), 0, rz * math.sin(2 * math.pi * k / n)]) for k in range(n)]
    F = [(0, 1 + (k + 1) % n, 1 + k) for k in range(n)]
    p = G.Part(np.array(V), F, 0, closed=False)
    p.set_w("head", 1.0)
    return p


# ------------------------------------------------------------------------------------------------ portrait
EYE_LINE = 0.42   # eye line, fraction of the image height from the top (low enough that a 16:11 centre crop on phones keeps the face and most of the hair)
EXPRESSION = {"gary": "gary_grin", "gary_suit": "gary_eyes", "morgan": "morgan_smug", "dana": "dana_smile"}
BUILD = {"gary": build_gary, "gary_suit": build_gary_suit, "morgan": build_morgan, "dana": build_dana}


def char_top(ch):
    top = 0.0
    for ob in ch.objs.values():
        if ob.type == "MESH" and not ob.hide_render:
            top = max(top, max((ob.matrix_world @ Vector(c)).z for c in ob.bound_box))
    return top


def portrait():
    who = A["who"]
    ch = BUILD[who]()
    K = ch.K
    eye_z = float(np.mean([c[2] for c in ch.eye_centres])) * K
    P.subdivide_all(ch, skip=("lenses", "safety_lenses"))
    C.setup_render(samples=A["samples"], res=(A["res"] * 3 // 4, A["res"]), noise=A["noise"], look=A["look"], exposure=A["exposure"])
    sc = bpy.context.scene
    sc.render.image_settings.quality = 85
    sc.render.threads_mode = "FIXED"
    sc.render.threads = A["threads"]
    C.world_hdri("studio_small_09", strength=0.10, rot_z_deg=120, bg_color=(0.05, 0.045, 0.04))
    P.studio_set()
    P.lights(K)
    bpy.context.view_layer.update()
    z_top = char_top(ch) + 0.030
    if A["view"] == "face":
        sc.render.resolution_x, sc.render.resolution_y = A["res"], A["res"]
        az = math.radians(float(A.get("az", "0")))
        cam = C.camera((1.10 * math.sin(az), -1.10 * math.cos(az), eye_z), Vector((0, 0, eye_z - 0.03)), lens=85.0, sensor=36.0)
        cam.data.dof.use_dof = False
    else:
        # composition of host_pat_present.jpg (shot_host_pat.py: frame 0.60 m wide at the face plane, 85 mm at eye
        # level, eye line about 0.31 of the height from the top), frame scaled by K so the heads match across the
        # series; taller hair widens the frame so the top keeps a margin
        lens = 85.0
        width = 0.60 * K / (1.66 / 1.75)
        hf = max(width * 4.0 / 3.0, (z_top - eye_z) / EYE_LINE)
        width = hf * 3.0 / 4.0
        dist = width * lens / 36.0
        cam_loc = Vector((0.0, -0.12 - dist, eye_z))
        cam = C.camera(cam_loc, cam_loc + Vector((0, 1, 0)), lens=lens, sensor=36.0)
        cam.data.shift_y = EYE_LINE - 0.5
        cam.data.shift_x = -0.03
        C.set_aperture(cam, (0, -0.12 - 0.06, eye_z), pupil_mm=lens * 1e-3 / 3.2)
    P.pose(ch, "present", cam.location)
    P.set_expression(ch, {EXPRESSION[who]: 1.0})
    if who == "gary_suit":
        for nm in ("nose", "lips"):
            ch.objs[nm].hide_render = True
    if "hair" in ch.m:   # matte clay hair (the sheen greys it at grazing angles)
        ch.m["hair"].node_tree.nodes["Principled BSDF"].inputs["Sheen Weight"].default_value = 0.06
    for nm in filter(None, A["hide"].split(",")):   # debug: hide named parts
        ch.objs[nm].hide_render = True
    C.compositor(vignette=0.12)
    sc.frame_set(sc.frame_current)
    bpy.context.view_layer.update()
    for nm, p in (("eyeL", Vector(ch.eye_centres[0]) * K), ("eyeR", Vector(ch.eye_centres[1]) * K)):
        uv = world_to_camera_view(sc, cam, p)
        print("IMG %s x=%.3f y=%.3f" % (nm, uv.x, 1 - uv.y))
    print("INFO who=%s K=%.4f eye_z=%.4f top=%.4f" % (who, K, eye_z, z_top))
    if A["view"] == "main" and A["avatar"]:
        uv = world_to_camera_view(sc, cam, Vector((0, -0.1, eye_z)))
        uv_top = world_to_camera_view(sc, cam, Vector((0, 0.0, z_top - 0.030)))
    C.render(A["out"])
    if A["view"] == "main" and A["avatar"]:
        P.make_avatar(A["out"], A["avatar"], uv.x, 1 - uv_top.y)


# ------------------------------------------------------------------------------------------------ the crystal
def crystal():
    import shot_wafer as SW
    bpy.ops.wm.read_factory_settings(use_empty=True)
    C.setup_render(samples=A["samples"], res=(A["res"] * 3 // 4, A["res"]), noise=A["noise"], look=A["look"], exposure=A["exposure"])
    sc = bpy.context.scene
    sc.render.image_settings.quality = 85
    sc.render.threads_mode = "FIXED"
    sc.render.threads = A["threads"]
    C.world_hdri("studio_small_09", strength=0.10, rot_z_deg=120, bg_color=(0.05, 0.045, 0.04))
    P.studio_set()
    P.lights(1.0)
    # walnut desk top in front of the wall
    z_desk = 0.95
    walnut = C.principled("desk_walnut", color=M.srgb("#5a3d2a"), rough=0.35, color_var=0.25, color_scale=8.0)
    C.box("desk", (1.6, 0.8, 0.04), (0.0, 0.25, z_desk - 0.02), walnut, bevel=0.004)
    # black anodized single-wafer display stand: block with a slot, the wafer stands in it on its primary flat
    black = C.principled("stand_black", color=(0.018, 0.018, 0.02), rough=0.35, metallic=0.6)
    sw_, sd_, sh_ = 0.070, 0.030, 0.016
    for dy in (-1, 1):
        C.box("stand_half", (sw_, (sd_ - 0.0012) / 2, sh_), (0.0, dy * (sd_ / 4 + 0.0003), z_desk + sh_ / 2), black, bevel=0.0015)
    C.box("stand_base", (sw_, sd_, 0.004), (0.0, 0.0, z_desk + 0.002), black, bevel=0.001)
    m = SW.ln_materials()
    w = SW.build_wafer(m, name="ln_wafer", back="lapped")
    au = C.principled("au_wafer", color=(1.0, 0.72, 0.30), metallic=1.0, rough=0.15)
    SW.die_grid(au, w, SW.TW)
    # clear the dies in a patch above the primary flat for the scribed +Z mark (dies' gold +Z arrows point the same way)
    for ob in list(bpy.data.objects):
        if ob.name.startswith("die_au_"):
            i, j = (int(t) for t in ob.name.split("_")[2:4])
            if j in (-6, -5, -4) and abs(i) <= 1:
                bpy.data.objects.remove(ob)
    scribe = C.principled("scribe", color=(0.92, 0.90, 0.86), rough=0.6)
    xa, yb = -2.5, -37.0
    C.extrude_polys("z_arrow", [[(xa - 0.7, yb), (xa + 0.7, yb), (xa + 0.7, yb + 9.5), (xa + 2.2, yb + 9.5), (xa, yb + 13.5),
                                 (xa - 2.2, yb + 9.5), (xa - 0.7, yb + 9.5)]], SW.TW, 0.004, scribe).parent = w
    t = C.text_mesh("z_text", "+Z", 5.0, (0.0, 0.0, 0.0), h=0.004, mat=scribe, align="LEFT")
    t.location = (xa + 2.6, yb + 4.0, SW.TW)
    t.parent = w
    # stand the wafer up: polished face toward the camera (-y), primary flat down in the slot
    s = 0.001
    w.scale = (s, s, s)
    w.rotation_euler = (math.radians(90), 0.0, 0.0)
    flat_d = math.sqrt(SW.RW ** 2 - (SW.PRIMARY / 2) ** 2) * s
    w.location = (0.0, SW.TW * s / 2, z_desk + 0.0045 + flat_d)
    w.visible_shadow = True
    zc = z_desk + 0.0045 + flat_d
    width = 0.150
    lens = 85.0
    dist = width * lens / 36.0
    cam_loc = Vector((0.03, -dist, zc + 0.02))
    cam = C.camera(cam_loc, Vector((0.0, 0.0, zc - 0.006)), lens=lens, sensor=36.0)
    cam.data.sensor_fit = "HORIZONTAL"
    C.set_aperture(cam, (0, 0, zc), pupil_mm=0.005)
    # strip light in the mirror direction of the polished face (glossy highlight band, as in shot_wafer.py)
    strip = C.box("strip", (0.6, 0.05, 0.002), (-0.10, -1.2, zc + 0.30), C.emission_mat("strip_m", (1.0, 0.98, 0.95), 6.0))
    strip.rotation_euler = (math.radians(80), 0, math.radians(8))
    strip.visible_camera = False
    strip.visible_diffuse = False
    strip.visible_shadow = False
    C.compositor(vignette=0.12)
    C.render(A["out"])


if __name__ == "__main__":
    if A["who"] == "crystal":
        crystal()
    else:
        portrait()
