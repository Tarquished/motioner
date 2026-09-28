#!/usr/bin/env python3
"""Frame-level transition review for an encoded video.

For every transition window it measures, frame by frame:
  motion    mean absolute luma change from the previous frame (a proxy for on-screen speed)
  luma      mean brightness
  contrast  luma standard deviation (drops when two images are blended into mush)
  sharp     variance of the Laplacian (drops with blur, soft upscales, and blends)
  color     mean CIELAB colour of the frame

and flags the defects that make a morph or seamless handoff look broken:
  POP       one frame changes far more than its neighbours: a snap, a layer swap that does not
            match, an off-by-one Sequence, or a hard cut where a continuous move was planned
  STUTTER   a frame repeats (or nearly) while the frames around it move: choppy, "patah-patah"
  HITCH     motion drops sharply for 1-2 frames and resumes: a velocity discontinuity between keys
  FLASH     brightness spikes or dips for a few frames and returns: an accidental white/black flash
  BLANK     a nearly uniform frame inside the transition: nothing on screen
  COLORJUMP the average colour jumps in one frame: an unmotivated hue switch
  MUDDY     contrast and sharpness sag in the middle of the window below both ends: typical of a
            crossfade, double exposure or ghost text
  SOFT      the settled frames after the transition are less sharp than the frames before: an
            upscaled raster or leftover blur

Outputs (in --out): one contact sheet per transition (PNG) with every sampled frame labelled and
flagged frames outlined in red, a curve strip under it, a whole-film motion curve, and report.json.
The numbers find suspects; you still have to look at the sheets and the video.

Examples
  python transition_review.py film.mp4 --at 118,240,361 --out review/
  python transition_review.py film.mp4 --plan transitions.json --out review/
      transitions.json: [{"name": "card->detail", "start": 110, "end": 128, "kind": "morph"}, ...]
      kind is one of morph, seamless, cut, whip, zoom, flash (flash/cut allow one intentional spike)
  python transition_review.py film.mp4 --auto --out review/     (detect likely boundaries)
"""

import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _media import iter_frames, video_info  # noqa: E402

try:
    import numpy as np
except ImportError:  # pragma: no cover
    sys.exit("numpy is required: pip install numpy pillow opencv-python")


def srgb_to_lab(rgb_mean):
    c = np.asarray(rgb_mean, dtype=np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = m @ c / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def laplacian_map(gray):
    try:
        import cv2  # type: ignore

        return cv2.Laplacian(np.ascontiguousarray(gray, dtype=np.float32), cv2.CV_32F)
    except ImportError:
        g = gray.astype(np.float64)
        out = np.zeros_like(g)
        out[1:-1, 1:-1] = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
        return out


def laplacian_var(gray):
    try:
        import cv2  # type: ignore

        return float(cv2.Laplacian(np.ascontiguousarray(gray, dtype=np.float32), cv2.CV_32F).var())
    except ImportError:
        g = gray.astype(np.float64)
        lap = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
        return float(lap.var())


def resize(img, width):
    if img.shape[1] == width:
        return img
    try:
        import cv2  # type: ignore

        h = round(img.shape[0] * width / img.shape[1])
        return cv2.resize(img, (width, h), interpolation=cv2.INTER_AREA)
    except ImportError:
        from PIL import Image

        h = round(img.shape[0] * width / img.shape[1])
        return np.asarray(Image.fromarray(img).resize((width, h), Image.LANCZOS))


def parse_frames(text, fps):
    out = []
    for part in str(text).replace(";", ",").split(","):
        part = part.strip()
        if not part:
            continue
        out.append(round(float(part[:-1]) * fps) if part.endswith("s") else int(float(part)))
    return out


GRID = 6


def tile_stats(gray, prev_gray):
    """Per-tile sharpness (Laplacian variance) and motion on a GRID x GRID grid."""
    h, w = gray.shape
    lap = laplacian_map(gray)
    sh, mo = np.zeros((GRID, GRID)), np.zeros((GRID, GRID))
    for r in range(GRID):
        for c in range(GRID):
            ys, ye = r * h // GRID, (r + 1) * h // GRID
            xs, xe = c * w // GRID, (c + 1) * w // GRID
            sh[r, c] = lap[ys:ye, xs:xe].var()
            if prev_gray is not None:
                mo[r, c] = np.abs(gray[ys:ye, xs:xe] - prev_gray[ys:ye, xs:xe]).mean()
    return sh, mo


def analyse(video, analysis_width, sharp_width, keep, thumb_width):
    fps, n_hint, w, h = video_info(video)
    motion, luma, contrast, sharp, lab = [], [], [], [], []
    tsharp, tmotion = [], []
    thumbs = {}
    prev = None
    prev_mid = None
    count = 0
    for i, frame in iter_frames(video):
        small = resize(frame, analysis_width).astype(np.float32)
        gray = small @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
        motion.append(0.0 if prev is None else float(np.abs(gray - prev).mean()))
        prev = gray
        luma.append(float(gray.mean()))
        contrast.append(float(gray.std()))
        mid = resize(frame, sharp_width)
        mid_gray = (mid.astype(np.float32) @ np.array([0.299, 0.587, 0.114], dtype=np.float32)).astype(np.float32)
        sharp.append(laplacian_var(mid_gray))
        ts, tm = tile_stats(mid_gray, prev_mid)
        prev_mid = mid_gray
        tsharp.append(ts)
        tmotion.append(tm)
        lab.append(srgb_to_lab(small.reshape(-1, 3).mean(0)))
        if i in keep:
            thumbs[i] = resize(frame, thumb_width)
        count += 1
    return {
        "fps": fps, "frames": count, "width": w, "height": h,
        "motion": np.array(motion), "luma": np.array(luma), "contrast": np.array(contrast),
        "sharp": np.array(sharp), "lab": np.array(lab), "thumbs": thumbs,
        "tsharp": np.array(tsharp), "tmotion": np.array(tmotion),
    }


def local_median(x, i, radius=4, exclude=1):
    lo, hi = max(0, i - radius), min(len(x), i + radius + 1)
    vals = [x[j] for j in range(lo, hi) if abs(j - i) > exclude - 1 and j != i]
    return float(np.median(vals)) if vals else 0.0


def detect(data, start, end, kind, args):
    m, L, C, S, lab = data["motion"], data["luma"], data["contrast"], data["sharp"], data["lab"]
    n = len(m)
    flags = []
    spikes_allowed = 1 if kind in ("cut", "flash", "whip") else 0
    lo, hi = max(1, start), min(n - 1, end)
    for i in range(lo, hi + 1):
        base = local_median(m, i)
        if m[i] > args.pop_abs and m[i] > args.pop_ratio * max(base, 0.35):
            flags.append({"frame": i, "type": "POP", "value": round(m[i], 2), "neighbours": round(base, 2)})
        if 0 < i < n - 1 and m[i] < args.freeze_eps and m[i - 1] > args.moving and m[i + 1] > args.moving:
            flags.append({"frame": i, "type": "STUTTER", "value": round(m[i], 3),
                          "neighbours": round((m[i - 1] + m[i + 1]) / 2, 2)})
        if 2 <= i < n - 2:
            around = min(m[i - 2], m[i - 1] if m[i - 1] > m[i] else m[i - 2], m[i + 1], m[i + 2])
            if m[i] > args.freeze_eps and around > args.moving * 2 and m[i] < 0.35 * around:
                flags.append({"frame": i, "type": "HITCH", "value": round(m[i], 2), "neighbours": round(around, 2)})
        lm = float(np.median(L[max(0, i - 6):i - 2].tolist() + L[i + 3:i + 7].tolist() or [L[i]]))
        if abs(L[i] - lm) > args.flash and abs(L[min(n - 1, i + 4)] - lm) < args.flash / 2:
            flags.append({"frame": i, "type": "FLASH", "value": round(L[i] - lm, 1)})
        if C[i] < args.blank:
            flags.append({"frame": i, "type": "BLANK", "value": round(C[i], 2)})
        de = float(np.linalg.norm(lab[i] - lab[i - 1]))
        if de > args.color_jump:
            flags.append({"frame": i, "type": "COLORJUMP", "value": round(de, 1)})
    # POP at the declared cut frame is intended
    if spikes_allowed:
        pops = sorted([f for f in flags if f["type"] in ("POP", "COLORJUMP", "FLASH")], key=lambda f: -f["value"])
        allowed = {f["frame"] for f in pops[:spikes_allowed]}
        flags = [f for f in flags if not (f["type"] in ("POP", "COLORJUMP", "FLASH") and f["frame"] in allowed)]
    # MUDDY: contrast and sharpness sag inside the window below both ends
    pad = args.settle
    a, b = max(0, start - pad), min(n - 1, end + pad)
    if b - a > 6 and kind not in ("cut",):
        inner = range(start + 1, end)
        if len(inner):
            c_ends = min(np.median(C[a:start + 1]), np.median(C[end:b + 1]))
            s_ends = min(np.median(S[a:start + 1]), np.median(S[end:b + 1]))
            ci = int(min(inner, key=lambda j: C[j] / max(c_ends, 1e-6) + S[j] / max(s_ends, 1e-6)))
            if C[ci] < args.muddy * c_ends and S[ci] < args.muddy * s_ends and m[ci] < 6 * max(1e-6, np.median(m[a:b + 1])):
                flags.append({"frame": ci, "type": "MUDDY", "value": round(float(C[ci] / max(c_ends, 1e-6)), 2),
                              "sharp_ratio": round(float(S[ci] / max(s_ends, 1e-6)), 2)})
    # GHOST: a region loses detail in the middle of the window while barely moving. Motion blur
    # comes with movement; a sag without movement is a crossfade, double exposure or ghost text.
    TS, TM = data["tsharp"], data["tmotion"]
    if kind not in ("cut",) and end - start >= 2:
        ref_a = np.median(TS[max(0, start - pad):start + 1], axis=0)
        ref_b = np.median(TS[end:min(n, end + pad + 1)], axis=0)
        ref = np.minimum(ref_a, ref_b)
        detailed = ref > max(20.0, float(np.percentile(ref, 40)))
        worst = None

        def sag(j):
            return detailed & (TM[j] < args.ghost_motion) & (TS[j] / np.maximum(ref, 1e-6) < args.ghost)

        for j in range(start + 1, end):
            ratio = TS[j] / np.maximum(ref, 1e-6)
            # must persist on a neighbouring frame too: a one-frame dip is usually an occlusion edge
            bad = sag(j) & (sag(j - 1) | sag(min(end, j + 1)))
            if bad.sum() >= 1:
                score = float((args.ghost - ratio[bad]).sum())
                if worst is None or score > worst[1]:
                    cells = [f"r{r}c{c}" for r, c in zip(*np.where(bad))]
                    worst = (j, score, cells, float(ratio[bad].min()))
        if worst:
            flags.append({"frame": worst[0], "type": "GHOST", "value": round(worst[3], 2), "tiles": worst[2][:8]})
    # SOFT: settled frames after vs before
    before = S[max(0, start - pad):start]
    after = S[min(n - 1, end + 2):min(n, end + 2 + pad)]
    after_m = m[min(n - 1, end + 2):min(n, end + 2 + pad)]
    c_before = np.median(C[max(0, start - pad):start]) if start > 0 else 0
    c_after = np.median(C[min(n - 1, end + 2):min(n, end + 2 + pad)])
    comparable = c_after >= 0.7 * c_before  # a plainer new scene is not a softness problem
    if len(before) and len(after) and np.median(after_m) < args.moving and comparable:
        ratio = float(np.median(after) / max(np.median(before), 1e-6))
        if ratio < args.soft:
            flags.append({"frame": end, "type": "SOFT", "value": round(ratio, 2)})
    # smoothness of the speed curve across the window: jerk relative to motion
    seg = m[max(1, start - 2):min(n, end + 3)]
    rough = float(np.abs(np.diff(seg, 2)).sum() / max(seg.sum(), 1e-6)) if len(seg) > 3 else 0.0
    peak = int(max(1, start - 2) + int(np.argmax(seg))) if len(seg) else start
    uniq = {}
    for f in flags:
        uniq.setdefault((f["frame"], f["type"]), f)
    return sorted(uniq.values(), key=lambda f: f["frame"]), round(rough, 2), peak


def auto_boundaries(data, args):
    m = data["motion"]
    found = []
    for i in range(1, len(m)):
        if m[i] > args.pop_abs * 1.5 and m[i] > 4 * max(local_median(m, i, 6), 0.35):
            if not found or i - found[-1] > 8:
                found.append(i)
    return found


def draw_sheet(data, t, path, cols):
    from PIL import Image, ImageDraw, ImageFont

    thumbs = data["thumbs"]
    frames = [f for f in t["sampled"] if f in thumbs]
    if not frames:
        return
    tw, th = thumbs[frames[0]].shape[1], thumbs[frames[0]].shape[0]
    rows = math.ceil(len(frames) / cols)
    label_h, curve_h, pad = 22, 150, 6
    W = cols * (tw + pad) + pad
    H = rows * (th + label_h + pad) + pad + curve_h + 40
    sheet = Image.new("RGB", (W, H), (22, 22, 26))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 14)
        big = ImageFont.truetype("arial.ttf", 17)
    except OSError:
        font = big = ImageFont.load_default()
    flagged = {}
    for f in t["flags"]:
        flagged.setdefault(f["frame"], []).append(f["type"])
    fps = data["fps"]
    for k, fr in enumerate(frames):
        x = pad + (k % cols) * (tw + pad)
        y = pad + (k // cols) * (th + label_h + pad)
        sheet.paste(Image.fromarray(thumbs[fr]), (x, y + label_h))
        near = [ty for ff, tys in flagged.items() for ty in tys if abs(ff - fr) <= max(0, t["step"] // 2)]
        color = (255, 70, 70) if near else (120, 200, 255) if t["start"] <= fr <= t["end"] else (170, 170, 170)
        if near:
            d.rectangle([x - 3, y + label_h - 3, x + tw + 2, y + label_h + th + 2], outline=(255, 60, 60), width=3)
        d.text((x, y + 3), f"f{fr}  {fr / fps:.2f}s  m{data['motion'][fr]:.1f}" + (f"  {'/'.join(sorted(set(near)))}" if near else ""),
               fill=color, font=font)
    # curves
    top = H - curve_h - 30
    a, b = t["sampled"][0], t["sampled"][-1]
    xs = list(range(a, b + 1))
    d.text((pad, top - 4), f"{t['name']}  [{t['kind']}]  frames {t['start']}-{t['end']}  roughness {t['roughness']}  verdict {t['auto_verdict']}",
           fill=(255, 255, 255), font=big)
    series = [("motion", data["motion"], (255, 200, 60)), ("contrast", data["contrast"], (120, 200, 255)),
              ("sharp", data["sharp"], (160, 255, 160)), ("luma", data["luma"], (230, 230, 230))]
    x0, x1 = pad + 60, W - pad
    y0, y1 = top + 24, H - 12
    for name, arr, col in series:
        seg = arr[a:b + 1]
        lo, hi = float(seg.min()), float(seg.max())
        span = hi - lo if hi > lo else 1.0
        pts = [(x0 + (x1 - x0) * (j / max(1, len(xs) - 1)), y1 - (y1 - y0) * ((seg[j] - lo) / span)) for j in range(len(xs))]
        d.line(pts, fill=col, width=2)
    for fr in (t["start"], t["end"]):
        xx = x0 + (x1 - x0) * ((fr - a) / max(1, b - a))
        d.line([(xx, y0), (xx, y1)], fill=(120, 200, 255), width=1)
    for fr in flagged:
        if a <= fr <= b:
            xx = x0 + (x1 - x0) * ((fr - a) / max(1, b - a))
            d.line([(xx, y0), (xx, y1)], fill=(255, 60, 60), width=2)
    for k, (name, _, col) in enumerate(series):
        d.text((pad, y0 + k * 18), name, fill=col, font=font)
    sheet.save(path)


def draw_overview(data, transitions, path):
    from PIL import Image, ImageDraw, ImageFont

    m = data["motion"]
    W, H = 1600, 260
    img = Image.new("RGB", (W, H), (22, 22, 26))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    n = len(m)
    hi = float(np.percentile(m, 99.5)) or 1.0
    for t in transitions:
        xa, xb = 40 + (W - 60) * t["start"] / n, 40 + (W - 60) * t["end"] / n
        d.rectangle([xa, 20, max(xa + 2, xb), H - 30], fill=(40, 60, 90))
    pts = [(40 + (W - 60) * i / n, H - 30 - (H - 60) * min(1.0, m[i] / hi)) for i in range(n)]
    d.line(pts, fill=(255, 200, 60), width=1)
    for t in transitions:
        for f in t["flags"]:
            x = 40 + (W - 60) * f["frame"] / n
            d.line([(x, 20), (x, H - 30)], fill=(255, 60, 60), width=1)
    fps = data["fps"]
    for s in range(0, int(n / fps) + 1, max(1, int(n / fps / 20))):
        x = 40 + (W - 60) * s * fps / n
        d.text((x - 6, H - 22), f"{s}s", fill=(200, 200, 200), font=font)
    d.text((40, 3), "motion per frame (yellow), transition windows (blue), flags (red)", fill=(230, 230, 230), font=font)
    img.save(path)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("video", type=Path)
    p.add_argument("--at", help="comma-separated boundary frames (or seconds with s suffix, e.g. 2.5s)")
    p.add_argument("--plan", type=Path, help="JSON list of {name,start,end,kind}")
    p.add_argument("--auto", action="store_true", help="also detect likely hard boundaries from the video")
    p.add_argument("--window", type=int, default=10, help="frames either side of an --at boundary (default 10)")
    p.add_argument("--settle", type=int, default=8, help="frames before/after a window used as reference (default 8)")
    p.add_argument("--out", type=Path, default=Path("transition-review"))
    p.add_argument("--analysis-width", type=int, default=320)
    p.add_argument("--sharp-width", type=int, default=720)
    p.add_argument("--thumb-width", type=int, default=240)
    p.add_argument("--max-thumbs", type=int, default=24, help="thumbnails per sheet (default 24)")
    p.add_argument("--cols", type=int, default=8)
    p.add_argument("--pop-abs", type=float, default=5.0)
    p.add_argument("--pop-ratio", type=float, default=3.2)
    p.add_argument("--moving", type=float, default=0.8)
    p.add_argument("--freeze-eps", type=float, default=0.12)
    p.add_argument("--flash", type=float, default=22.0)
    p.add_argument("--blank", type=float, default=2.5)
    p.add_argument("--color-jump", type=float, default=14.0)
    p.add_argument("--muddy", type=float, default=0.72)
    p.add_argument("--soft", type=float, default=0.7)
    p.add_argument("--event", type=float, default=1.5, help="motion level that starts a motion event (default 1.5)")
    p.add_argument("--ghost", type=float, default=0.55, help="tile sharpness ratio that counts as a blend (default 0.55)")
    p.add_argument("--ghost-motion", type=float, default=2.0, help="tile motion below which a sag is not motion blur")
    args = p.parse_args()

    if not args.video.is_file():
        p.error(f"no such video: {args.video}")
    fps, n_hint, _, _ = video_info(args.video)
    plan = []
    if args.plan:
        for k, t in enumerate(json.loads(args.plan.read_text(encoding="utf-8"))):
            s = int(round(t["start"] * fps)) if isinstance(t["start"], float) and t.get("unit") == "s" else int(t["start"])
            e = int(round(t["end"] * fps)) if isinstance(t["end"], float) and t.get("unit") == "s" else int(t["end"])
            plan.append({"name": t.get("name", f"t{k + 1}"), "start": s, "end": e, "kind": t.get("kind", "morph")})
    if args.at:
        for k, f in enumerate(parse_frames(args.at, fps)):
            plan.append({"name": f"boundary@{f}", "start": f - args.window // 2, "end": f + args.window // 2, "kind": "morph"})
    if not plan and not args.auto:
        p.error("give --at, --plan or --auto")

    def sampled_frames(t, n):
        a, b = max(0, t["start"] - args.settle), min(n - 1, t["end"] + args.settle)
        step = max(1, math.ceil((b - a + 1) / args.max_thumbs))
        fr = list(range(a, b + 1, step))
        for must in (t["start"], t["end"]):
            if a <= must <= b and must not in fr:
                fr.append(must)
        return sorted(fr), step

    n_est = n_hint or 100000
    keep = set()
    for t in plan:
        fr, _ = sampled_frames(t, n_est)
        keep.update(fr)
    print(f"decoding {args.video} ...", file=sys.stderr)
    data = analyse(args.video, args.analysis_width, args.sharp_width, keep, args.thumb_width)
    n = data["frames"]
    if args.auto:
        known = [t["start"] for t in plan]
        for f in auto_boundaries(data, args):
            if all(abs(f - k) > 12 for k in known):
                plan.append({"name": f"auto@{f}", "start": f - 5, "end": f + 5, "kind": "cut"})
        missing = set()
        for t in plan:
            fr, _ = sampled_frames(t, n)
            missing.update(f for f in fr if f not in data["thumbs"])
        if missing:
            for i, frame in iter_frames(args.video):
                if i in missing:
                    data["thumbs"][i] = resize(frame, args.thumb_width)
    args.out.mkdir(parents=True, exist_ok=True)
    report = {"video": str(args.video), "fps": data["fps"], "frames": n, "transitions": []}
    for k, t in enumerate(sorted(plan, key=lambda t: t["start"])):
        t["start"], t["end"] = max(0, t["start"]), min(n - 1, t["end"])
        flags, rough, peak = detect(data, t["start"], t["end"], t["kind"], args)
        t["flags"], t["roughness"], t["peak_motion_frame"] = flags, rough, peak
        severe = [f for f in flags if f["type"] in ("POP", "STUTTER", "BLANK", "FLASH", "COLORJUMP", "HITCH")]
        t["auto_verdict"] = "suspect" if severe else ("check" if flags or rough > 2.5 else "clean")
        t["sampled"], t["step"] = sampled_frames(t, n)
        sheet = args.out / f"{k + 1:02d}_{''.join(c if c.isalnum() or c in '-_' else '_' for c in t['name'])}.png"
        draw_sheet(data, t, sheet, args.cols)
        t["sheet"] = str(sheet)
        m = data["motion"]
        report["transitions"].append({
            "name": t["name"], "kind": t["kind"], "start": t["start"], "end": t["end"],
            "peak_motion_frame": peak, "roughness": rough, "auto_verdict": t["auto_verdict"],
            "motion": [round(float(v), 2) for v in m[max(0, t["start"] - 3):min(n, t["end"] + 4)]],
            "flags": flags, "sheet": t["sheet"],
        })
    draw_overview(data, report["transitions"], args.out / "overview.png")
    # film-wide stutter scan (duplicate frames while moving), outside the windows too
    m = data["motion"]
    film_stutter = [i for i in range(1, n - 1) if m[i] < args.freeze_eps and m[i - 1] > args.moving and m[i + 1] > args.moving]
    report["film_stutter_frames"] = film_stutter
    events, i = [], 1
    while i < n:
        if m[i] > args.event:
            j = i
            while j + 1 < n and m[j + 1] > args.event * 0.6:
                j += 1
            if j - i >= 2:
                pk = i + int(np.argmax(m[i:j + 1]))
                events.append({"start": i, "end": j, "peak": pk, "peak_motion": round(float(m[pk]), 2)})
            i = j + 1
        else:
            i += 1
    report["motion_events"] = events
    (args.out / "report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    for t in report["transitions"]:
        kinds = ", ".join(f"{f['type']}@{f['frame']}" for f in t["flags"]) or "no flags"
        print(f"{t['auto_verdict']:8s} {t['name']:28s} f{t['start']}-{t['end']}  peak f{t['peak_motion_frame']}  rough {t['roughness']:.2f}  {kinds}")
    if film_stutter:
        print(f"film-wide STUTTER frames: {film_stutter[:30]}{' ...' if len(film_stutter) > 30 else ''}")
    print(f"motion events (start-end, peak = fastest frame, where a whoosh peak belongs): "
          + ", ".join(f"{e['start']}-{e['end']}@{e['peak']}" for e in report["motion_events"][:40]))
    print(f"sheets and report: {args.out}")
    return 1 if any(t["auto_verdict"] == "suspect" for t in report["transitions"]) else 0


if __name__ == "__main__":
    sys.exit(main())
