"""Walk the whole learner course in headless Chromium and screenshot every visual event, for a timelapse montage.

Learner mode (no dev flags), served on a non-dev hostname. Narration is fast-forwarded with Playwright's fake clock:
recorded clips and browser speech are disabled so the engine falls back to timed captions, then the clock is advanced
until each gate opens. Every check gets every wrong option first, then the right one (see DevLog-009, D56).

    uv run --no-project --with playwright==1.65.2 python course/tools/montage/capture.py --out <dir> [--course ferroelectric]
        [--max-steps N] [--chromium <path>]

Writes <out>/frames/NNNNN.jpg and <out>/shots.jsonl ({i, file, pos, ci, si, type, tag, hold}).
"""

from __future__ import annotations

import argparse
import datetime as dt
import functools
import http.server
import json
import socket
import sys
import threading
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[3]
HOST = "montage.test"  # not in LMS_CONFIG.devHosts, so the page runs as a learner sees it
DEFAULT_CHROMIUM = Path.home() / "Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell"
LEARNER = "Gary M."
REFLECT_TEXT = "The schedule said tomorrow, so I signed off on the orientation check from memory."

INIT_JS = """
try { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); } catch (e) {}
HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('montage capture', 'NotAllowedError')); };
"""

# Hold (frames at 30 fps) per shot kind; assemble.py rescales to the target length.
HOLD = {"catalog": 30, "start": 30, "enter": 4, "done": 3, "act": 3, "fb": 5, "video": 3, "chat": 2, "slider": 2,
        "modal": 5, "result": 24, "certificate": 60, "disclaimer": 24}


def free_port(lo: int = 47391) -> int:
    for p in range(lo, lo + 200):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                return p
    raise RuntimeError("no free port")


def serve(port: int) -> http.server.ThreadingHTTPServer:
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a: object) -> None:
            pass

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


class Walker:
    def __init__(self, page: Page, out: Path) -> None:
        self.p = page
        self.frames = out / "frames"
        self.frames.mkdir(parents=True, exist_ok=True)
        self.log = (out / "shots.jsonl").open("w")
        self.n = 0
        self.info: dict = {}
        self.ask_n = 0
        self.exam_wrong = 0

    # ---------- primitives ----------
    def adv(self, ms: int) -> None:
        self.p.clock.run_for(ms)

    def jump(self, ms: int) -> None:
        self.p.clock.fast_forward(ms)
        self.p.clock.run_for(20)  # let the chained promises and the next timers settle

    def real(self, ms: int) -> None:
        self.p.wait_for_timeout(ms)

    def ev(self, js: str, arg: object = None):
        return self.p.evaluate(js, arg)

    def keepalive(self) -> None:
        self.ev("""() => { const s = window.__lms && window.__lms.state; if (!s) return;
            s.lastInput = Date.now();
            const mb = document.querySelector('.modal-back .mh.warn');
            if (mb) { const b = document.querySelector('.modal-back .mf .btn'); if (b) b.click(); } }""")

    def until(self, cond: str, step: int = 1500, max_ms: int = 900_000) -> bool:
        t = 0
        while t < max_ms:
            if self.ev(f"() => {{ const s = window.__lms && window.__lms.state; if (s) s.lastInput = Date.now(); return !!({cond}); }}"):
                return True
            if t and t % 30000 < step:
                self.keepalive()
            self.jump(step)
            t += step
        raise RuntimeError(f"timeout waiting for {cond} at step {self.info.get('pos')}")

    def shot(self, tag: str, kind: str | None = None, settle: int = 150) -> None:
        if settle:
            self.real(settle)
        f = self.frames / f"{self.n:05d}.jpg"
        self.p.screenshot(path=str(f), type="jpeg", quality=90)
        rec = {"i": self.n, "file": f.name, "tag": tag, "hold": HOLD[kind or tag],
               **{k: self.info.get(k) for k in ("pos", "ci", "si", "type")}}
        self.log.write(json.dumps(rec) + "\n")
        self.log.flush()
        self.n += 1

    def click(self, sel: str, idx: int = 0) -> None:
        self.ev("([s, i]) => { const e = document.querySelectorAll(s)[i]; if (e) { try { e.scrollIntoView({ block: 'nearest' }); } catch (x) {} e.click(); } }", [sel, idx])

    def reveal(self, sel: str) -> None:
        self.ev("(s) => { const e = document.querySelector(s); if (e) try { e.scrollIntoView({ block: 'nearest' }); } catch (x) {} }", sel)

    def next_ok(self) -> str:
        return "!document.querySelector('.next').disabled"

    # ---------- generic: popup questions, stages, chat taps ----------
    def finish(self) -> None:
        """Advance until Next unlocks, answering the popup question and opening stages on the way."""
        for _ in range(4000):
            st = self.ev("""() => ({
                next: !document.querySelector('.next').disabled,
                ask: !!document.querySelector('.ask-back:not(.out) .ask-opt:not([disabled])'),
                stg: !!document.querySelector('.stg-btn:not(.hidden)'),
                tap: !!document.querySelector('.cs-tap:not(.hidden)') })""")
            if st["ask"]:
                self.answer_ask()
            elif st["stg"]:
                self.click(".stg-btn")
                self.adv(900)
                self.shot("stage", "act", settle=450)
            elif st["tap"]:
                self.click(".cs-tap")
                self.adv(400)
            elif st["next"]:
                return
            else:
                self.keepalive()
                self.jump(1500)
        raise RuntimeError(f"finish() gave up at step {self.info.get('pos')}")

    def answer_ask(self) -> None:
        opts = self.ev("() => (window.__lms.allSteps()[window.__lms.state.pos].st.ask.options || []).map((o) => o.correct === true)")
        self.adv(1500)
        self.shot("ask", "act", settle=350)
        wrong = [i for i, c in enumerate(opts) if not c]
        right = [i for i, c in enumerate(opts) if c]
        pick_wrong = self.ask_n % 2 == 0 and wrong and right
        i = wrong[0] if pick_wrong else (right[0] if right else 0)
        self.ask_n += 1
        self.click(".ask-opt", i)
        self.adv(600)
        self.shot("ask-answer", "fb", settle=300)
        self.until("!document.querySelector('.ask-back')", step=400)

    # ---------- step types ----------
    def h_check(self) -> None:
        opts = self.ev("() => (window.__lms.allSteps()[window.__lms.state.pos].st.options || []).map((o) => !!o.correct)")
        exam = self.info["exam"]
        self.until("document.querySelector('.kc-opts.hint')")
        self.shot("question", "act")
        wrong = [i for i, c in enumerate(opts) if not c]
        if exam:
            wrong = wrong[:1] if self.exam_wrong < 2 else []
            self.exam_wrong += len(wrong)
        for i in wrong:
            self.click(".kc-opts button", i)
            self.adv(500)
            self.reveal(".kc-fb")
            self.shot("wrong", "fb")
            self.until("document.querySelector('.kc-opts.hint')")
        self.click(".kc-opts button", opts.index(True))
        self.adv(500)
        self.reveal(".kc-fb")
        self.shot("right", "fb")

    def h_video(self) -> None:
        kfs = self.ev("() => { const s = window.__lms.allSteps()[window.__lms.state.pos].st; return { D: s.duration || 20, t: (s.keyframes || []).map((k) => k.t).sort((a, b) => a - b) }; }")
        self.click(".bigplay")
        D, ts = kfs["D"], kfs["t"] + [kfs["D"]]
        now = 0.0
        for k in range(len(ts) - 1):
            for frac in (0.3, 0.75):
                target = ts[k] + frac * (ts[k + 1] - ts[k])
                self.jump(int((target - now) * 1000))
                self.adv(40)
                now = target
                self.shot("video", settle=0)
        self.jump(int((D - now) * 1000) + 500)

    def h_chat(self) -> None:
        last = 0
        for _ in range(3000):
            st = self.ev("""() => ({ len: (document.querySelector('.stage-body') || {}).innerText.length,
                tap: !!document.querySelector('.cs-tap:not(.hidden)'),
                ask: !!document.querySelector('.ask-back'),
                next: !document.querySelector('.next').disabled,
                ok: !document.querySelector('.cs-isok.hidden') || !!document.querySelector('.ask-back') })""")
            if st["len"] - last > 25:
                last = st["len"]
                self.shot("message", "chat", settle=120)
            if st["ask"] or st["next"]:
                return
            if st["tap"]:
                self.click(".cs-tap")
            self.adv(300)

    def h_reveal(self) -> None:
        n = self.ev("() => document.querySelectorAll('.reveal-tabs button').length")
        for i in range(n):
            self.until(f"document.querySelectorAll('.reveal-tabs button')[{i}].classList.contains('hint')")
            self.click(".reveal-tabs button", i)
            self.adv(800)
            self.shot("tab", "act", settle=400)

    def h_hotspots(self) -> None:
        n = self.ev("() => document.querySelectorAll('.hs-mk').length")
        for i in range(n):
            self.until(f"document.querySelectorAll('.hs-mk')[{i}].classList.contains('hint')")
            self.click(".hs-mk", i)
            self.adv(800)
            self.shot("spot", "act", settle=400)

    def h_cards(self) -> None:
        cd = self.ev("() => { const s = window.__lms.allSteps()[window.__lms.state.pos].st; return { mode: s.mode, c: (s.cards || []).map((c) => !!c.correct) }; }")
        sel = ".cards-grid > button, .cards-flip > button"
        if cd["mode"] == "choose":
            order = [i for i, c in enumerate(cd["c"]) if not c] + [cd["c"].index(True)]
            for i in order:
                self.until("document.querySelector('.cards-grid.hint, .cards-flip.hint')")
                self.click(sel, i)
                self.adv(700)
                self.reveal(".kc-fb")
                self.shot("card", "fb", settle=650)
        else:
            for i in range(len(cd["c"])):
                self.until(f"document.querySelectorAll('{sel}')[{i}].classList.contains('hint')")
                self.click(sel, i)
                self.adv(700)
                self.shot("card", "act", settle=650)

    def h_spot(self) -> None:
        tg = self.ev("() => window.__lms.allSteps()[window.__lms.state.pos].st.targets")
        miss = None
        for gy in [0.1 * k + 0.05 for k in range(10)]:
            for gx in [0.1 * k + 0.05 for k in range(10)]:
                if not any(t["x"] <= gx <= t["x"] + t["w"] and t["y"] <= gy <= t["y"] + t["h"] for t in tg):
                    miss = (gx, gy)
                    break
            if miss:
                break
        pts = ([miss] if miss else []) + [(t["x"] + t["w"] / 2, t["y"] + t["h"] / 2) for t in tg]
        for x, y in pts:
            self.until("document.querySelector('.spot-fig.hint')")
            self.reveal(".spot-fig")
            r = self.ev("() => { const b = document.querySelector('.spot-fig').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }")
            self.p.mouse.click(r[0] + x * r[2], r[1] + y * r[3])
            self.adv(600)
            self.shot("hit", "fb")

    def h_sort(self) -> None:
        d = self.ev("() => { const s = window.__lms.allSteps()[window.__lms.state.pos].st; return { b: s.buckets.map((x) => x.id), it: s.items.map((x) => x.bucket) }; }")
        for i, right in enumerate(d["it"]):
            wrong = next(b for b in d["b"] if b != right)
            for b, kind in ((wrong, "fb"), (right, "fb")):
                self.until("document.querySelector('.sr-item.hint')")
                self.click(f".sr-item[data-i='{i}']")
                self.click(f".sr-bucket[data-b='{b}']")
                self.adv(500)
                self.reveal(".kc-fb")
                self.shot("sort", kind, settle=350)

    def h_reflect(self) -> None:
        mode = self.ev("() => window.__lms.allSteps()[window.__lms.state.pos].st.mode || 'text'")
        self.adv(2500)
        if mode == "text":
            self.p.click(".rf-text")
            self.p.keyboard.type(REFLECT_TEXT, delay=0)
        else:
            n = self.ev("() => document.querySelectorAll('.rf-opt').length")
            self.click(".rf-opt", n - 1 if mode == "scale" else 0)
        self.shot("response", "act")
        self.click(".rf-submit")
        self.adv(800)
        self.reveal(".rf-reveal")
        self.shot("reveal", "fb", settle=400)

    def h_ack(self) -> None:
        self.until("document.querySelector('.ack-box label.hint')")
        self.ev("(n) => { const i = document.querySelector('.ack-box input[type=text]'); i.value = n; i.dispatchEvent(new Event('input')); }", LEARNER)
        self.click(".ack-box input[type=checkbox]")
        self.adv(300)
        self.shot("signed", "act")

    def slider(self, sel: str, values: list[float], every: int = 3, ms: int = 120) -> None:
        tag = f"mt{self.n}"
        self.ev("([s, t]) => { const e = s === 'SPEED' ? document.querySelectorAll('.widget-root input[type=range]')[1] : document.querySelector(s); e.dataset.mt = t; }", [sel, tag])
        for k, v in enumerate(values):
            self.ev("([s, v]) => { const e = document.querySelector(`[data-mt=${s}]`); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); }", [tag, v])
            self.adv(ms)
            if k % every == every - 1 or k == len(values) - 1:
                self.shot("slider", settle=40)

    def h_widget(self) -> None:
        w = self.info["widget"]
        self.adv(1500)
        self.shot("widget", "act")
        R = ".widget-root input[type=range]"
        if w == "eulerSign":
            self.slider(R, list(range(0, 91, 5)) + list(range(85, -91, -5)), every=3)
        elif w == "xcutIndex":
            self.slider(R, [x * 0.5 for x in range(0, 361)], every=12, ms=50)
            self.slider(R, [x * 0.5 for x in range(360, 179, -1)], every=12, ms=50)
        elif w == "prSweep":
            def sweeps() -> None:
                for label in ("short to long", "long to short"):
                    self.ev("(t) => [...document.querySelectorAll('.widget-root button')].find((b) => b.textContent.indexOf(t) >= 0).click()", label)
                    for _ in range(4):
                        self.adv(400)
                        self.shot("sweep", "slider", settle=40)
                    self.until("[...document.querySelectorAll('.widget-root button')].every((b) => !b.disabled)", step=200)
            sweeps()
            if self.ev("() => !!document.querySelector('.widget-done.hidden')"):
                v0 = self.ev("() => +document.querySelectorAll('.widget-root input[type=range]')[1].value")
                end = -5.0 if v0 > -1 else 3.0
                vals = [v0 + (end - v0) * k / 20 for k in range(21)]
                self.slider("SPEED", vals, every=5)
                sweeps()
        elif w == "pyroCalc":
            self.slider(".widget-root input[type=range].hint", list(range(10, 151, 10)) + list(range(140, 39, -20)), every=3)
            self.slider(".widget-root input[type=range].hint", [x / 10 for x in range(0, 31, 2)], every=3)
        elif w == "biasDrift":
            for _ in range(2):
                self.click(".widget-root button.hint")
                for _ in range(4):
                    self.adv(500)
                    self.shot("run", "slider", settle=40)
        self.reveal(".widget-done")
        self.shot("widget-done", "fb")

    def h_examResult(self) -> None:
        self.adv(1000)
        self.shot("result", "result", settle=400)

    def h_certificate(self) -> None:
        self.adv(1500)
        self.shot("certificate", "certificate", settle=1500)

    # ---------- main walk ----------
    def step_info(self) -> dict:
        return self.ev("""() => { const L = window.__lms, f = L.allSteps()[L.state.pos];
            return { pos: L.state.pos, n: L.allSteps().length, ci: f.ci, si: f.si, type: f.st.type, exam: !!f.st.exam,
                     widget: f.st.widget || null, title: f.st.title || f.st.question || '' }; }""")

    def walk(self, base: str, course: str, max_steps: int | None) -> None:
        p = self.p
        p.goto(f"{base}/course/index.html")
        p.clock.pause_at(dt.datetime(2026, 11, 23, 10, 0, 5))
        self.real(1200)
        self.adv(1000)
        self.shot("catalog", settle=600)
        p.click(f"a[href='player.html?c={course}']")
        p.wait_for_function("() => window.__lms && document.querySelector('.start')")
        self.real(1500)
        self.adv(1500)
        self.info = {"pos": -1, "type": "start"}
        self.shot("start", settle=800)
        p.click(".start .btn.primary")
        done_steps = 0
        while True:
            self.info = self.step_info()
            t0 = time.time()
            typ = self.info["type"]
            self.adv(300)
            self.shot("enter", settle=450 if typ in ("slide", "photo") else 300)
            getattr(self, f"h_{typ}", lambda: None)()
            if typ == "disclaimer":
                self.shot("disclaimer", settle=300)
                break
            self.finish()
            if typ not in ("certificate", "examResult"):
                self.shot("done", settle=150)
            print(f"[{self.info['pos']:3d}/{self.info['n']}] m{self.info['ci']} {typ:10s} {time.time() - t0:5.1f}s shots={self.n}  {self.info['title'][:60]}", flush=True)
            done_steps += 1
            if max_steps and done_steps >= max_steps:
                break
            pos = self.info["pos"]
            self.click(".next")
            self.real(150)
            if self.ev("() => !!document.querySelector('.modal-back .mf .btn')"):
                self.adv(500)
                self.info = {**self.info, "type": "interstitial"}
                self.shot("modal", settle=300)
                self.adv(6500)
                self.click(".modal-back .mf .btn")
            self.until(f"window.__lms.state.pos !== {pos}", step=100, max_ms=20_000)
        self.log.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--course", default="ferroelectric")
    ap.add_argument("--max-steps", type=int, default=None)
    ap.add_argument("--chromium", type=Path, default=DEFAULT_CHROMIUM)
    a = ap.parse_args()
    port = free_port()
    srv = serve(port)
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch(executable_path=str(a.chromium), args=[f"--host-resolver-rules=MAP {HOST} 127.0.0.1"])
            ctx = br.new_context(viewport={"width": 1440, "height": 810}, device_scale_factor=4 / 3)
            ctx.add_init_script(INIT_JS)
            page = ctx.new_page()
            page.clock.install(time=dt.datetime(2026, 11, 23, 10, 0, 0))
            page.on("pageerror", lambda e: print(f"  pageerror: {e}", file=sys.stderr))
            Walker(page, a.out).walk(f"http://{HOST}:{port}", a.course, a.max_steps)
            br.close()
    finally:
        srv.shutdown()


if __name__ == "__main__":
    main()
