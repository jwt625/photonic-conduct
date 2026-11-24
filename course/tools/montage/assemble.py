"""Assemble capture.py screenshots into a fixed-fps timelapse of about --seconds, H.264 yuv420p + silent AAC + faststart.

    uv run --no-project python course/tools/montage/assemble.py --cap <capture dir> --out <file.mp4> [--seconds 60] [--fps 30]

Each shot keeps its relative hold from shots.jsonl; holds are scaled so the total hits the target length, with a floor of
--min-frames per shot. The frame sequence is a directory of symlinks, encoded with the image2 demuxer at exactly --fps.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path


def frames_for(holds: list[int], target: int, floor: int) -> list[int]:
    lo, hi = 0.0, 50.0
    for _ in range(60):
        s = (lo + hi) / 2
        tot = sum(max(floor, round(h * s)) for h in holds)
        lo, hi = (s, hi) if tot < target else (lo, s)
    out = [max(floor, round(h * lo)) for h in holds]
    # absorb the rounding remainder on the longest holds (end card first)
    diff = target - sum(out)
    order = sorted(range(len(out)), key=lambda i: -holds[i])
    k = 0
    while diff != 0 and k < 10_000:
        i = order[k % len(order)]
        if diff > 0:
            out[i] += 1
            diff -= 1
        elif out[i] > floor:
            out[i] -= 1
            diff += 1
        k += 1
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cap", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--seconds", type=float, default=60.0)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--min-frames", type=int, default=1)
    ap.add_argument("--crf", type=int, default=20)
    ap.add_argument("--fixed", default="catalog=30,start=24,result=24,certificate=75,disclaimer=24",
                    help="tag=frames holds kept out of the rescale (bookends)")
    a = ap.parse_args()

    shots = [json.loads(x) for x in (a.cap / "shots.jsonl").read_text().splitlines() if x.strip()]
    target = round(a.seconds * a.fps)
    fixed = {k: int(v) for k, v in (x.split("=") for x in a.fixed.split(",") if x)}
    free = [i for i, s in enumerate(shots) if s["tag"] not in fixed]
    n = [fixed.get(s["tag"], 0) for s in shots]
    scaled = frames_for([shots[i]["hold"] for i in free], target - sum(n), a.min_frames)
    for i, c in zip(free, scaled):
        n[i] = c
    print(f"{len(shots)} shots -> {sum(n)} frames ({sum(n) / a.fps:.2f} s at {a.fps} fps)")

    seq = Path(tempfile.mkdtemp(prefix="montage_seq_"))
    try:
        k = 0
        for s, c in zip(shots, n):
            src = (a.cap / "frames" / s["file"]).resolve()
            for _ in range(c):
                (seq / f"{k:06d}.jpg").symlink_to(src)
                k += 1
        a.out.parent.mkdir(parents=True, exist_ok=True)
        cmd = ["ffmpeg", "-v", "error", "-y", "-framerate", str(a.fps), "-i", str(seq / "%06d.jpg"),
               "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
               "-map", "0:v", "-map", "1:a", "-shortest",
               "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p",
               "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", str(a.crf), "-pix_fmt", "yuv420p",
               "-r", str(a.fps), "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
               "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(a.out)]
        subprocess.run(cmd, check=True)
    finally:
        shutil.rmtree(seq)
    print(a.out)


if __name__ == "__main__":
    main()
