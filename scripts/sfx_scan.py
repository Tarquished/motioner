#!/usr/bin/env python3
"""Screen sound-effect candidates before they go near the timeline.

For each file it measures
  lead_in_ms   silence before the sound starts (-40 dB below its peak)
  hit_ms       first moment the envelope reaches half of its peak: the audible attack
  peak_ms      loudest 5 ms window
  attack_ms    10 % -> 90 % rise time around the first attack
  tail_ms      peak -> 30 dB below peak
  length_ms    audible length (lead-in and silent tail removed)
  centroid_hz  spectral centroid (brightness); low_ratio (<150 Hz) and high_ratio (>6 kHz)
  noise_db     level of the quietest audible stretch against the peak (hiss, room, hum)
  shape        transient | swell | riser | sustain | double (two separate hits)

and, when you give it the ROLE and the MOTION it must support, a fit report with warnings:
  --role whoosh --motion-frames 16 --fps 60   (a whoosh should swell into its peak at the fastest frame)
  --role impact | click | pop | tick | riser | sparkle | ui | paper | reward | boom

It also prints where to put the file on a frame timeline for a given event frame:
  --event-frame 240 --fps 60   -> start frame (and trim) so the attack/peak lands on frame 240

--cards DIR writes one PNG per file (envelope + spectrogram with the hit and peak marked) and
one comparison sheet, so candidates can be judged visually as well as by numbers.
Nothing here judges taste. Use it to reject wrong shapes, late attacks and noisy files, then
review the placed sound against the picture.

Examples
  python sfx_scan.py sfx/*.wav --role whoosh --motion-frames 14 --fps 60 --cards review/sfx
  python sfx_scan.py hit.mp3 --role impact --event-frame 372 --fps 60 --json
"""

import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _media import SR, load_audio  # noqa: E402

import numpy as np

# expected shape per role: (shapes that fit, max lead-in ms, max attack ms, length range ms, align)
ROLES = {
    "impact": ({"transient", "double"}, 25, 15, (80, 2500), "hit"),
    "boom": ({"transient", "double", "swell"}, 40, 40, (600, 6000), "hit"),
    "click": ({"transient"}, 10, 6, (15, 250), "hit"),
    "tick": ({"transient"}, 10, 6, (10, 180), "hit"),
    "pop": ({"transient"}, 15, 12, (40, 450), "hit"),
    "ui": ({"transient", "swell"}, 15, 30, (40, 900), "hit"),
    "paper": ({"transient", "swell", "double"}, 30, 60, (80, 1200), "hit"),
    "reward": ({"transient", "swell", "sustain"}, 20, 40, (200, 2500), "hit"),
    "sparkle": ({"transient", "swell", "sustain"}, 20, 60, (150, 2500), "hit"),
    "whoosh": ({"swell"}, 60, 400, (150, 2000), "peak"),
    "swish": ({"swell", "transient"}, 30, 150, (80, 700), "peak"),
    "riser": ({"riser", "swell"}, 80, 5000, (600, 8000), "end"),
    "ambience": ({"sustain"}, 200, 5000, (2000, 600000), "start"),
}


def envelope(x, win_ms=5.0):
    mono = x.mean(1) if x.ndim == 2 else x
    hop = max(1, int(SR * win_ms / 1000))
    n = len(mono) // hop
    if n == 0:
        return np.array([float(np.sqrt(np.mean(mono ** 2)))]), hop
    frames = mono[: n * hop].reshape(n, hop)
    return np.sqrt((frames ** 2).mean(1)), hop


def spectrum_stats(x):
    mono = x.mean(1) if x.ndim == 2 else x
    n = 4096
    if len(mono) < n:
        mono = np.pad(mono, (0, n - len(mono)))
    hops = range(0, len(mono) - n + 1, n // 2)
    win = np.hanning(n)
    mags = np.array([np.abs(np.fft.rfft(mono[i:i + n] * win)) for i in hops])
    energy = (mags ** 2).sum(1)
    if energy.max() <= 0:
        return 0.0, 0.0, 0.0
    loud = mags[energy >= energy.max() * 0.05]
    spec = (loud ** 2).mean(0)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    total = spec.sum() + 1e-18
    centroid = float((freqs * spec).sum() / total)
    return centroid, float(spec[freqs < 150].sum() / total), float(spec[freqs > 6000].sum() / total)


def classify(env, hop, peak_i, hit_i):
    ms = lambda i: i * hop * 1000 / SR  # noqa: E731
    pk = env[peak_i]
    above = np.where(env > pk * 10 ** (-30 / 20))[0]
    start, stop = (above[0], above[-1]) if len(above) else (0, len(env) - 1)
    rise, fall = ms(peak_i - start), ms(stop - peak_i)
    # two separate hits: another maximum >= 70 % of the peak, separated from it by a dip below 35 %
    for seg in (env[peak_i:], env[start:peak_i + 1][::-1]):
        dip = np.where(seg < pk * 0.35)[0]
        if len(dip) and seg[dip[0]:].max() > pk * 0.7:
            return "double"
    if ms(stop - start) > 3000 and np.percentile(env[start:stop + 1], 30) > pk * 0.3:
        return "sustain"
    if rise < 45:
        return "transient"
    if rise > 300 and fall < 0.3 * rise:
        return "riser"
    return "swell"


def measure(path, args):
    x = load_audio(path, args.ffmpeg, max_seconds=args.max_seconds)
    if x.size == 0 or np.max(np.abs(x)) == 0:
        raise RuntimeError("silent or empty")
    env, hop = envelope(x)
    ms = lambda i: round(i * hop * 1000 / SR, 1)  # noqa: E731
    pk = float(env.max())
    peak_i = int(np.argmax(env))
    lead_i = int(np.argmax(env > pk * 10 ** (-40 / 20)))
    hit_i = int(np.argmax(env >= pk * 0.5))
    lo_i = int(np.argmax(env >= pk * 0.1))
    hi_i = lo_i + int(np.argmax(env[lo_i:] >= pk * 0.9))
    tail = np.where(env[peak_i:] > pk * 10 ** (-30 / 20))[0]
    tail_i = peak_i + (int(tail[-1]) if len(tail) else 0)
    audible = np.where(env > pk * 10 ** (-40 / 20))[0]
    end_i = int(audible[-1]) if len(audible) else len(env) - 1
    # noise floor: the quietest 5 % of the whole file (a clean, trimmed file reads near -90 dB)
    noise_db = float(20 * np.log10(max(np.percentile(env, 5), 1e-9) / pk)) if len(env) > 20 else -90.0
    centroid, low, high = spectrum_stats(x[lead_i * hop:(end_i + 1) * hop])
    sample_peak = float(np.max(np.abs(x)))
    info = {
        "file": str(path),
        "duration_ms": round(len(x) * 1000 / SR, 1),
        "lead_in_ms": ms(lead_i),
        "hit_ms": ms(hit_i),
        "peak_ms": ms(peak_i),
        "attack_ms": ms(max(0, hi_i - lo_i)),
        "tail_ms": ms(tail_i - peak_i),
        "length_ms": ms(end_i - lead_i),
        "centroid_hz": round(centroid),
        "low_ratio": round(low, 3),
        "high_ratio": round(high, 3),
        "noise_db": round(noise_db, 1),
        "sample_peak_dbfs": round(20 * math.log10(sample_peak), 2),
        "clipped": int((np.abs(x) >= 0.999).sum()),
        "channels": 2 if x.ndim == 2 and not np.allclose(x[:, 0], x[:, 1], atol=1e-4) else 1,
        "shape": classify(env, hop, peak_i, hit_i),
    }
    info["_env"], info["_hop"], info["_x"] = env, hop, x
    return info


def fit(info, args):
    notes = []
    role = args.role
    shapes, max_lead, max_attack, (lmin, lmax), align = ROLES[role]
    if info["shape"] not in shapes:
        notes.append(f"shape is {info['shape']}, a {role} should be {'/'.join(sorted(shapes))}")
    if info["lead_in_ms"] > max_lead:
        notes.append(f"{info['lead_in_ms']:.0f} ms of lead-in: trim it or place by {align}, never by file start")
    if role not in ("whoosh", "riser", "ambience") and info["attack_ms"] > max_attack:
        notes.append(f"soft attack ({info['attack_ms']:.0f} ms) will feel late on a hard contact")
    if not lmin <= info["length_ms"] <= lmax:
        notes.append(f"audible length {info['length_ms']:.0f} ms is outside {lmin}-{lmax} ms for a {role}")
    if info["noise_db"] > -45 and info["shape"] != "sustain":
        notes.append(f"noise floor {info['noise_db']:.0f} dB under peak: hiss or room tone will be audible")
    if info["clipped"]:
        notes.append(f"{info['clipped']} clipped samples in the source")
    if role in ("click", "tick", "ui") and info["centroid_hz"] < 1200:
        notes.append(f"dark ({info['centroid_hz']} Hz centroid) for a UI click; clean UI sounds are usually brighter")
    if role in ("boom", "impact") and info["low_ratio"] < 0.05 and args.need_weight:
        notes.append("little low end: layer a sub/boom if the hit must feel heavy")
    if args.motion_frames and args.fps:
        motion_ms = args.motion_frames * 1000 / args.fps
        if role in ("whoosh", "swish"):
            rise = info["peak_ms"] - info["lead_in_ms"]
            if info["length_ms"] < 0.6 * motion_ms:
                notes.append(f"shorter ({info['length_ms']:.0f} ms) than the move ({motion_ms:.0f} ms): it will end while the object still flies")
            if info["length_ms"] > 3.0 * motion_ms + 400:
                notes.append(f"much longer ({info['length_ms']:.0f} ms) than the move ({motion_ms:.0f} ms): trim with a fade or pick a shorter one")
            if rise > 1.5 * motion_ms + 150:
                notes.append(f"swells for {rise:.0f} ms before its peak, the move lasts {motion_ms:.0f} ms: the air starts before anything moves")
            speed = info["length_ms"] / max(motion_ms, 1)
            if 0.5 < speed < 2.5 and not 0.8 < speed < 1.6:
                notes.append(f"varispeed around x{min(1.4, max(0.7, speed)):.2f} would match the move length (pitch shifts with it)")
        if role == "riser" and info["peak_ms"] - info["lead_in_ms"] < motion_ms * 0.6:
            notes.append("builds for less time than the planned build-up")
    return notes, align


def placement(info, align, args):
    """Start frame so the chosen point lands on the event frame (can be negative => trim)."""
    point = {"hit": info["hit_ms"], "peak": info["peak_ms"], "end": info["peak_ms"], "start": info["lead_in_ms"]}[align]
    offset_frames = point / 1000 * args.fps
    start = args.event_frame - offset_frames
    whole = math.floor(start)
    return {
        "align": align,
        "align_point_ms": point,
        "start_frame_exact": round(start, 3),
        "start_frame": whole,
        "subframe_delay_ms": round((start - whole) / args.fps * 1000, 1),
        "trim_before_ms": round(max(0.0, -start) / args.fps * 1000, 1),
        "note": "In Remotion: <Sequence from={start_frame}> <Audio src=... /> ; better, mix offline with build_mix.py for sample accuracy.",
    }


def draw_card(info, path, title):
    from PIL import Image, ImageDraw, ImageFont

    x = info["_x"].mean(1) if info["_x"].ndim == 2 else info["_x"]
    env, hop = info["_env"], info["_hop"]
    W, H = 900, 300
    img = Image.new("RGB", (W, H), (20, 20, 24))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    # spectrogram (top)
    n, hopn = 1024, 256
    frames = [x[i:i + n] * np.hanning(n) for i in range(0, max(1, len(x) - n), hopn)] or [np.pad(x, (0, n - len(x)))[:n]]
    S = np.abs(np.fft.rfft(np.array(frames), axis=1)).T
    S = 20 * np.log10(S / (S.max() + 1e-12) + 1e-6)
    S = np.clip((S + 80) / 80, 0, 1)
    # log-frequency rows
    freqs = np.fft.rfftfreq(n, 1 / SR)
    rows = 150
    edges = np.geomspace(40, SR / 2, rows + 1)
    spec = np.zeros((rows, S.shape[1]))
    for r in range(rows):
        sel = (freqs >= edges[r]) & (freqs < edges[r + 1])
        spec[r] = S[sel].max(0) if sel.any() else S[np.searchsorted(freqs, edges[r]) - 1]
    spec = spec[::-1]
    col = (np.stack([spec ** 1.2, spec ** 2.2, 0.35 + 0.65 * spec ** 0.8], -1) * 255).astype(np.uint8)
    img.paste(Image.fromarray(col).resize((W - 20, 150)), (10, 30))
    # envelope (bottom)
    e = env / (env.max() + 1e-12)
    pts = [(10 + (W - 20) * i / max(1, len(e) - 1), H - 12 - 90 * v) for i, v in enumerate(e)]
    d.line(pts, fill=(255, 200, 60), width=2)
    total_ms = len(x) * 1000 / SR
    for key, color in (("hit_ms", (80, 255, 120)), ("peak_ms", (255, 80, 80)), ("lead_in_ms", (120, 160, 255))):
        xx = 10 + (W - 20) * info[key] / max(total_ms, 1)
        d.line([(xx, 30), (xx, H - 10)], fill=color, width=1)
    d.text((10, 6), f"{title}  {info['shape']}  len {info['length_ms']:.0f} ms  lead {info['lead_in_ms']:.0f}  hit {info['hit_ms']:.0f} (green)  "
                    f"peak {info['peak_ms']:.0f} (red)  centroid {info['centroid_hz']} Hz  noise {info['noise_db']} dB", fill=(235, 235, 235), font=font)
    img.save(path)
    return img


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("files", nargs="+", type=Path)
    p.add_argument("--role", choices=sorted(ROLES))
    p.add_argument("--motion-frames", type=float, help="length of the visual move the sound supports")
    p.add_argument("--fps", type=float, default=60)
    p.add_argument("--event-frame", type=float, help="frame of contact / fastest motion / reveal")
    p.add_argument("--align", choices=["hit", "peak", "end", "start"], help="override the role's alignment point")
    p.add_argument("--need-weight", action="store_true", help="warn when an impact lacks low end")
    p.add_argument("--cards", type=Path, help="write PNG sound cards and a comparison sheet here")
    p.add_argument("--max-seconds", type=float, default=30)
    p.add_argument("--ffmpeg")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    results, cards = [], []
    for path in args.files:
        try:
            if not path.is_file():
                raise RuntimeError("file does not exist")
            info = measure(path, args)
        except Exception as exc:  # noqa: BLE001
            results.append({"file": str(path), "error": str(exc)})
            continue
        if args.role:
            notes, align = fit(info, args)
            info["role"] = args.role
            info["fit_warnings"] = notes
            info["verdict"] = "fits" if not notes else ("review" if len(notes) == 1 else "poor fit")
        else:
            align = "hit"
        if args.align:
            align = args.align
        if args.event_frame is not None:
            info["placement"] = placement(info, align, args)
        if args.cards:
            args.cards.mkdir(parents=True, exist_ok=True)
            cards.append(draw_card(info, args.cards / (path.stem + ".png"), path.name))
        for k in ("_env", "_hop", "_x"):
            info.pop(k, None)
        results.append(info)
    if args.cards and cards:
        from PIL import Image

        sheet = Image.new("RGB", (cards[0].width, cards[0].height * len(cards)), (0, 0, 0))
        for i, c in enumerate(cards):
            sheet.paste(c, (0, i * c.height))
        sheet.save(args.cards / "_compare.png")
    if args.json:
        print(json.dumps(results, indent=1))
    else:
        for r in results:
            if "error" in r:
                print(f"ERROR {r['file']}: {r['error']}")
                continue
            head = f"{Path(r['file']).name}: {r['shape']}, {r['length_ms']:.0f} ms, lead {r['lead_in_ms']:.0f}, hit {r['hit_ms']:.0f}, peak {r['peak_ms']:.0f}, " \
                   f"attack {r['attack_ms']:.0f}, tail {r['tail_ms']:.0f} ms, {r['centroid_hz']} Hz, noise {r['noise_db']} dB"
            if "verdict" in r:
                head += f"  -> {r['verdict'].upper()}"
            print(head)
            for n in r.get("fit_warnings", []):
                print(f"    - {n}")
            if "placement" in r:
                pl = r["placement"]
                print(f"    place: start frame {pl['start_frame_exact']} ({pl['align']} at {pl['align_point_ms']} ms)"
                      + (f", trim {pl['trim_before_ms']} ms" if pl["trim_before_ms"] else ""))
    return 1 if any("error" in r for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
