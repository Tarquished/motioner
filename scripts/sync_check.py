#!/usr/bin/env python3
"""Check, in the delivered file, that every sound effect lands where the picture needs it.

For each cue it takes the sound file (with the cue's varispeed), finds it in the final audio by
cross-correlation inside a search window around the planned time, and reports where the cue's
alignment point (attack, peak, ...) actually sounds, relative to its event frame:

  offset_ms > 0  the sound is late (heard after the contact/fastest frame)
  offset_ms < 0  the sound is early

It also reports the correlation strength; a weak match means the cue is masked by the music or
other cues, missing, or replaced. This works on MP4/MOV/WAV and so catches mux offsets, AAC
priming delay, Remotion <Sequence> rounding, a wrong trim, or a cue placed by file start.

Input cues: the <mix>.cues.json written by build_mix.py, or any JSON list of
  {"frame": 240, "file": "sfx/hit.wav", "align": "hit"|"peak"|"end"|"start", "rate": 1.0, "label": "..."}
(align defaults to hit). Frames are video frames at --fps (or the fps stored in cues.json).

Usage
  python sync_check.py out/final.mp4 public/audio/mix.cues.json [--root DIR] [--tolerance-ms 20]
Exit code 1 when any cue is off by more than the tolerance or cannot be found.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _media import load_audio  # noqa: E402

import numpy as np

SR = 48000


def _smooth(x, n):
    """Centred moving average in O(len(x))."""
    n = max(1, int(n))
    c = np.concatenate([[0.0], np.cumsum(x)])
    half = n // 2
    idx = np.arange(len(x))
    lo = np.clip(idx - half, 0, len(x))
    hi = np.clip(idx - half + n, 0, len(x))
    return (c[hi] - c[lo]) / np.maximum(1, hi - lo)


def bandpass(x, lo=250):
    """Band-limit before correlating so the music's bass does not dominate the match. Low sounds
    (thumps, subs) are matched with a lower cut-off, chosen per cue."""
    try:
        from scipy.signal import butter, sosfiltfilt

        return sosfiltfilt(butter(4, [lo, 9000], btype="bandpass", fs=SR, output="sos"), x)
    except ImportError:
        return x - _smooth(x, SR // lo)


def env_points(x):
    hop = SR // 200
    e = np.sqrt(np.maximum(0, _smooth(x ** 2, hop)))
    sm = _smooth(e, int(0.015 * SR))
    return int(np.argmax(e >= 0.5 * e.max())), int(np.argmax(sm))


def trim_lead(x, db=-45):
    hop = SR // 200
    e = np.sqrt(np.maximum(0, _smooth(x ** 2, hop)))
    on = int(np.argmax(e > e.max() * 10 ** (db / 20)))
    return x[max(0, on - int(0.004 * SR)):], max(0, on - int(0.004 * SR))


def xcorr_find(hay, needle):
    """Normalised cross-correlation via FFT; returns (best index, score 0..1)."""
    n = len(hay) + len(needle)
    size = 1 << (n - 1).bit_length()
    H = np.fft.rfft(hay, size)
    N = np.fft.rfft(needle[::-1], size)
    corr = np.fft.irfft(H * N, size)[len(needle) - 1:len(hay)]
    c = np.concatenate([[0.0], np.cumsum(hay ** 2)])
    energy = c[len(needle):] - c[:-len(needle)]  # sliding energy of the haystack, O(n)
    norm = np.sqrt(np.maximum(energy, 1e-12) * (needle ** 2).sum())
    score = corr[: len(norm)] / norm
    i = int(np.argmax(score))
    return i, float(score[i])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("media", type=Path, help="final video or audio")
    ap.add_argument("cues", type=Path)
    ap.add_argument("--root", type=Path, help="folder that cue file paths are relative to")
    ap.add_argument("--fps", type=float)
    ap.add_argument("--search-ms", type=float, default=250)
    ap.add_argument("--tolerance-ms", type=float, help="default: half a frame, at least 12 ms")
    ap.add_argument("--min-score", type=float, default=0.25)
    ap.add_argument("--ffmpeg")
    ap.add_argument("--json", type=Path, help="write the results here")
    args = ap.parse_args()

    data = json.loads(args.cues.read_text(encoding="utf-8"))
    cues = data["cues"] if isinstance(data, dict) else data
    fps = args.fps or (data.get("fps") if isinstance(data, dict) else None)
    if not fps:
        ap.error("--fps is required for a plain cue list")
    root = args.root or args.cues.resolve().parent
    tol = args.tolerance_ms or max(12.0, 500.0 / fps)
    full = load_audio(args.media, args.ffmpeg)
    raw_mono = full.mean(1) if full.ndim == 2 else full
    mono_by_cut = {250: bandpass(raw_mono, 250)}
    cache, results, bad = {}, [], 0
    # repeated copies of one sound (typing, ticks) must not be matched to their neighbours:
    # search at most 45 % of the gap to the nearest other cue that uses the same file
    same_gap = []
    for i, c in enumerate(cues):
        # same family = same file, or another take of it (synth_score names takes <type>_<hash>)
        fam = lambda q: Path(q["file"]).stem.rsplit("_", 1)[0]  # noqa: E731
        gaps = [abs(o["frame"] - c["frame"]) / fps for j, o in enumerate(cues)
                if j != i and (o["file"] == c["file"] or fam(o) == fam(c)) and o["frame"] != c["frame"]]
        same_gap.append(min(gaps) if gaps else None)
    for ci, c in enumerate(cues):
        if c.get("sync", True) is False:
            results.append({"frame": c["frame"], "label": c.get("label", ""), "status": "SKIP"})
            continue
        f = c["file"]
        path = Path(f) if Path(f).is_absolute() else root / f
        if not path.is_file() and isinstance(data, dict):
            path = Path(f)
        key = (str(path), c.get("rate", 1.0))
        if key not in cache:
            x = load_audio(path, args.ffmpeg)
            x = x.mean(1) if x.ndim == 2 else x
            x, _ = trim_lead(x)
            rate = float(c.get("rate", 1.0))
            if abs(rate - 1) > 1e-6:
                t = np.arange(int(len(x) / rate)) * rate
                x = np.interp(t, np.arange(len(x)), x)
            cache[key] = x
        x = cache[key]
        hit, peak = env_points(x)
        align = c.get("align", "hit")
        point = {"hit": hit, "peak": peak, "end": peak, "start": 0, "peakcut": peak}[align]
        event = c["frame"] / fps
        # correlate a slice around the alignment point (the part that must sit on the frame)
        a = max(0, point - int(0.06 * SR))
        b = min(len(x), point + int(0.25 * SR))
        seg = x[a:b]
        hi_part = bandpass(seg, 250)
        cut = 250 if (hi_part ** 2).sum() > 0.3 * (seg ** 2).sum() else 40
        if cut not in mono_by_cut:
            mono_by_cut[cut] = bandpass(raw_mono, cut)
        mono = mono_by_cut[cut]
        needle = hi_part if cut == 250 else bandpass(seg, cut)
        if align == "peakcut":
            expected_needle_start = event * SR - (point - a)
        else:
            expected_needle_start = event * SR - (point - a)
        search_s = args.search_ms / 1000
        if same_gap[ci]:
            search_s = min(search_s, 0.45 * same_gap[ci])
        lo = int(max(0, expected_needle_start - search_s * SR))
        hi = int(min(len(mono), expected_needle_start + search_s * SR + len(needle)))
        if hi - lo <= len(needle) or np.abs(needle).max() == 0:
            results.append({"frame": c["frame"], "label": c.get("label", ""), "status": "OUTSIDE"})
            bad += 1
            continue
        i, score = xcorr_find(mono[lo:hi], needle)
        found_point = (lo + i + (point - a)) / SR
        off = (found_point - event) * 1000
        status = "ok"
        if score < args.min_score:
            status = "MASKED?"
        elif abs(off) > tol:
            status = "LATE" if off > 0 else "EARLY"
        if status != "ok":
            bad += 1
        results.append({"frame": c["frame"], "label": c.get("label", c.get("sound", "")), "file": str(f), "align": align,
                        "offset_ms": round(off, 1), "offset_frames": round(off / 1000 * fps, 2), "score": round(score, 3),
                        "status": status})
    for r in results:
        if "offset_ms" in r:
            print(f"{r['status']:8s} f{r['frame']:<6g} {r['offset_ms']:+7.1f} ms ({r['offset_frames']:+.2f} f)  match {r['score']:.2f}  "
                  f"[{r['align']}] {r['label']}")
        else:
            print(f"{r['status']:8s} f{r['frame']:<6g} {r['label']}")
    offs = [r["offset_ms"] for r in results if r.get("status") == "ok"]
    if offs:
        print(f"{len(offs)}/{len(results)} cues in sync (tolerance {tol:.0f} ms); median offset {np.median(offs):+.1f} ms, "
              f"worst {max(offs, key=abs):+.1f} ms")
        if abs(np.median(offs)) > tol / 2:
            print("NOTE: a constant offset across cues points at the mux/encode (AAC priming, audio start) rather than the cue sheet")
    if args.json:
        args.json.write_text(json.dumps(results, indent=1), encoding="utf-8")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
