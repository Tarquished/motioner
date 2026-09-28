#!/usr/bin/env python3
"""Turn a music track into a frame grid for the edit: tempo, beats, downbeats, bars, phrases,
strong accents, quiet breaks and the last big hit, all converted to video frames.

Use it before the shot plan so cuts, morph midpoints and big hits can sit on the music, and so
a music edit can be cut on bar lines. Tempo and downbeat detection is automatic and can be
wrong by a beat (or double/half tempo): check the printed accents against the waveform strip
(--png) and override with --bpm / --downbeat when needed.

Examples
  python beat_grid.py music.mp3 --fps 60
  python beat_grid.py music.mp3 --fps 30 --start 12.0 --duration 20 --png grid.png --json grid.json
  python beat_grid.py music.mp3 --fps 60 --bpm 113 --downbeat 0.531   (force a known grid)

Output (JSON): bpm, beat_s, beats[], downbeats[] (seconds and frames), bars, phrases (every
--phrase-bars bars), accents (strongest onsets), breaks (quiet stretches), final_hit.
Needs numpy; uses librosa when installed for better beat tracking.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _media import load_audio  # noqa: E402

import numpy as np

SR = 22050


def onset_envelope(y, hop):
    """Spectral flux onset strength (numpy only)."""
    n = 2048
    win = np.hanning(n)
    frames = [y[i:i + n] * win for i in range(0, len(y) - n, hop)]
    if not frames:
        return np.zeros(1)
    mag = np.log1p(np.abs(np.fft.rfft(np.array(frames), axis=1)))
    flux = np.maximum(0, np.diff(mag, axis=0)).sum(1)
    flux = np.concatenate([[0], flux])
    flux -= np.convolve(flux, np.ones(16) / 16, mode="same")
    return np.maximum(flux, 0)


def tempo_numpy(env, hop, lo=70, hi=180):
    fr = SR / hop
    ac = np.correlate(env - env.mean(), env - env.mean(), mode="full")[len(env) - 1:]
    best, best_bpm = -1, 120.0
    for bpm in np.arange(lo, hi, 0.1):
        lag = 60 * fr / bpm
        score = sum(np.interp(lag * k, np.arange(len(ac)), ac) for k in (1, 2, 4))
        if score > best:
            best, best_bpm = score, bpm
    return float(best_bpm)


def grid_phase(env, hop, period_s, offset_range=None):
    """Best phase (s) for a beat grid of `period_s` by summing onset strength on the grid."""
    fr = SR / hop
    t = np.arange(len(env)) / fr
    best, best_phase = -1, 0.0
    for phase in np.arange(0, period_s, 0.002):
        idx = np.round((np.arange(phase, t[-1], period_s)) * fr).astype(int)
        idx = idx[idx < len(env)]
        score = env[idx].sum()
        if score > best:
            best, best_phase = score, phase
    return float(best_phase)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("music", type=Path)
    p.add_argument("--fps", type=float, required=True)
    p.add_argument("--start", type=float, default=0.0, help="second of the song where the film begins")
    p.add_argument("--duration", type=float, help="seconds of film to list (default: rest of song)")
    p.add_argument("--bpm", type=float, help="force tempo")
    p.add_argument("--downbeat", type=float, help="force the time (s, in the song) of any bar's first beat")
    p.add_argument("--beats-per-bar", type=int, default=4)
    p.add_argument("--phrase-bars", type=int, default=4)
    p.add_argument("--accents", type=int, default=16, help="how many strongest onsets to list")
    p.add_argument("--json", type=Path)
    p.add_argument("--png", type=Path, help="waveform strip with bars, beats and accents")
    p.add_argument("--ffmpeg")
    args = p.parse_args()

    y = load_audio(args.music, args.ffmpeg, sr=SR, mono=True)
    hop = 256
    fr = SR / hop
    try:
        import librosa  # type: ignore

        env = librosa.onset.onset_strength(y=y.astype(np.float32), sr=SR, hop_length=hop)
        tempo, lb = librosa.beat.beat_track(onset_envelope=env, sr=SR, hop_length=hop)
        lib_beats = librosa.frames_to_time(lb, sr=SR, hop_length=hop)
        bpm = args.bpm or float(np.atleast_1d(tempo)[0])
        chroma = librosa.feature.chroma_stft(y=y.astype(np.float32), sr=SR, hop_length=hop)
        # onset-strength peaks trail the audible attack; measure the lag with backtracking
        pk = librosa.onset.onset_detect(onset_envelope=env, sr=SR, hop_length=hop, units="time")
        bt = librosa.onset.onset_detect(onset_envelope=env, sr=SR, hop_length=hop, units="time", backtrack=True)
        lag = float(np.median(pk - bt)) if len(pk) == len(bt) and len(pk) else 0.0
        engine = "librosa"
    except ImportError:
        env = onset_envelope(y, hop)
        bpm = args.bpm or tempo_numpy(env, hop)
        lib_beats, chroma = None, None
        lag = 0.0
        engine = "numpy"
    beat_s = 60.0 / bpm
    # refine tempo +/- 1 % by grid alignment, then find beat phase and the bar phase
    if not args.bpm:
        best, best_b = -1, beat_s
        for b in np.linspace(beat_s * 0.99, beat_s * 1.01, 81):
            ph = grid_phase(env, hop, b)
            idx = np.round(np.arange(ph, len(env) / fr, b) * fr).astype(int)
            sc = env[idx[idx < len(env)]].mean()
            if sc > best:
                best, best_b = sc, b
        beat_s = best_b
        bpm = 60 / beat_s
    if args.downbeat is not None:
        beat_phase = args.downbeat % beat_s
    elif lib_beats is not None and len(lib_beats) > 8:
        # circular mean of the tracker's beats folded onto the fitted period
        ang = 2 * np.pi * (np.asarray(lib_beats) % beat_s) / beat_s
        beat_phase = float((np.angle(np.exp(1j * ang).mean()) % (2 * np.pi)) / (2 * np.pi) * beat_s)
        beat_phase = (beat_phase - lag) % beat_s
    else:
        beat_phase = (grid_phase(env, hop, beat_s) - lag) % beat_s
    beats = np.arange(beat_phase, len(y) / SR, beat_s)
    # bar phase: which beat of 4 carries the most low-frequency onset energy
    low = y.copy()
    try:
        from scipy.signal import butter, sosfilt  # type: ignore

        low = sosfilt(butter(2, 180, btype="low", fs=SR, output="sos"), y)
    except ImportError:
        pass
    lenv = onset_envelope(low, hop) if engine == "numpy" else env
    if engine != "numpy":
        try:
            import librosa  # type: ignore

            lenv = librosa.onset.onset_strength(y=low.astype(np.float32), sr=SR, hop_length=hop)
        except Exception:  # noqa: BLE001
            lenv = env
    bpb = args.beats_per_bar
    t_env = np.arange(len(env)) / fr

    def top_onsets(count, lo=0.0, hi=None):
        hi = hi if hi is not None else t_env[-1]
        e = np.where((t_env >= lo) & (t_env <= hi), env, 0).astype(float)
        found = []
        for _ in range(count):
            i = int(np.argmax(e))
            if e[i] <= 0:
                break
            found.append(float(t_env[i]) - lag)
            e[max(0, i - int(0.25 * fr)):i + int(0.25 * fr)] = 0
        return sorted(found)

    def quiet_breaks():
        rms_hop = int(0.05 * SR)
        rms = np.sqrt(np.convolve(y ** 2, np.ones(rms_hop) / rms_hop, mode="same")[::rms_hop] + 1e-12)
        quiet = rms < np.median(rms[rms > 0]) * 10 ** (-12 / 20)
        out, i = [], 0
        while i < len(quiet):
            if quiet[i]:
                j = i
                while j + 1 < len(quiet) and quiet[j + 1]:
                    j += 1
                if (j + 1 - i) * 0.05 >= beat_s * 0.9:
                    out.append([round(i * 0.05, 3), round((j + 1) * 0.05, 3)])
                i = j + 1
            else:
                i += 1
        return out

    all_breaks = quiet_breaks()
    if args.downbeat is not None:
        k0 = int(np.argmin(np.abs(beats - args.downbeat))) % bpb
        phase_votes = None
    else:
        # vote: strong accents, the returns after quiet breaks (drops) and harmonic changes all
        # tend to land on bar lines; low-frequency onsets add a weak vote
        votes = np.zeros(bpb)

        def vote(t, w):
            j = (t - beats[0]) / beat_s
            r = round(j)
            if abs(j - r) < 0.2:
                votes[int(r) % bpb] += w

        for t in top_onsets(24):
            vote(t, 1.0)
        for a0, b0 in all_breaks:
            vote(b0, 2.0)
        if chroma is not None:
            nov = np.zeros(len(beats))
            for j, bt_s in enumerate(beats):
                i0, i1, i2 = int(round((bt_s - beat_s) * fr)), int(round(bt_s * fr)), int(round((bt_s + beat_s) * fr))
                if i0 < 0 or i2 > chroma.shape[1]:
                    continue
                pre, post = chroma[:, i0:i1].mean(1), chroma[:, i1:i2].mean(1)
                nov[j] = 1 - float(pre @ post / (np.linalg.norm(pre) * np.linalg.norm(post) + 1e-9))
            for k in range(bpb):
                votes[k] += 3.0 * nov[k::bpb].mean() / (nov.mean() + 1e-9) - 3.0
        for k in range(bpb):
            idx = np.round((beats[k::bpb] + lag) * fr).astype(int)
            idx = idx[idx < len(lenv)]
            votes[k] += lenv[idx].mean() / (lenv.mean() + 1e-9) - 1.0
        k0 = int(np.argmax(votes))
        phase_votes = [round(float(v), 2) for v in votes]
    downbeats = beats[k0::bpb]

    start = args.start
    end = start + args.duration if args.duration else len(y) / SR
    to_frame = lambda s: round((s - start) * args.fps, 2)  # noqa: E731
    in_film = lambda arr: [float(s) for s in arr if start - 1e-6 <= s <= end + 1e-6]  # noqa: E731

    peaks = top_onsets(args.accents, start, end)
    breaks = [br for br in all_breaks if start <= br[0] <= end]
    # final hit: last strong onset (>= 60 % of the song's top onsets) before the end
    thr = np.percentile(env, 99.5) * 0.6
    strong = np.where(env >= thr)[0]
    final_hit = float(t_env[strong[-1]]) - lag if len(strong) else None
    if final_hit is not None and len(downbeats):
        near = downbeats[np.argmin(np.abs(downbeats - final_hit))]
        if abs(near - final_hit) < 0.4 * beat_s * args.beats_per_bar:
            # prefer the downbeat right after the last strong onset if it carries a strong onset itself
            nxt = downbeats[downbeats >= final_hit - 0.05]
            if len(nxt) and env[min(len(env) - 1, int((nxt[0] + lag) * fr))] >= thr * 0.5:
                final_hit = float(nxt[0])

    db = in_film(downbeats)
    bars = [{"bar": k + 1, "s": round(s, 4), "frame": to_frame(s)} for k, s in enumerate(db)]
    phrases = [b for k, b in enumerate(bars) if k % args.phrase_bars == 0]
    out = {
        "file": str(args.music), "engine": engine, "fps": args.fps, "film_starts_at_song_s": start,
        "onset_lag_s": round(lag, 4), "bar_phase_votes": phase_votes, "bpm": round(bpm, 3), "beat_s": round(beat_s, 5), "beat_frames": round(beat_s * args.fps, 3),
        "bar_s": round(beat_s * bpb, 5), "bar_frames": round(beat_s * bpb * args.fps, 3),
        "beats": [{"s": round(s, 4), "frame": to_frame(s)} for s in in_film(beats)],
        "bars": bars, "phrases": phrases,
        "accents": [{"s": round(s, 3), "frame": to_frame(s)} for s in peaks],
        "breaks": [{"s": a, "end_s": b, "frame": to_frame(a), "end_frame": to_frame(b)} for a, b in breaks],
        "final_hit": {"s": round(final_hit, 3), "frame": to_frame(final_hit)} if final_hit is not None else None,
    }
    if args.json:
        args.json.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"{args.music.name}: {out['bpm']} BPM ({engine}), beat {out['beat_frames']} f, bar {out['bar_frames']} f at {args.fps:g} fps"
          + (f"  (bar-phase votes {phase_votes}; if the bars look one beat off, pass --downbeat)" if phase_votes else ""))
    print("bars (frame): " + ", ".join(f"{b['bar']}:{b['frame']:g}" for b in bars[:48]))
    print("phrases (frame): " + ", ".join(f"{b['frame']:g}" for b in phrases))
    print("accents (frame): " + ", ".join(f"{a['frame']:g}" for a in out["accents"]))
    if out["breaks"]:
        print("breaks (frames): " + ", ".join(f"{b['frame']:g}-{b['end_frame']:g}" for b in out["breaks"]))
    if out["final_hit"]:
        print(f"final hit: song {out['final_hit']['s']} s = film frame {out['final_hit']['frame']:g}")
    if args.png:
        from PIL import Image, ImageDraw, ImageFont

        W, H = 1800, 240
        img = Image.new("RGB", (W, H), (20, 20, 24))
        d = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("arial.ttf", 12)
        except OSError:
            font = ImageFont.load_default()
        a, b = int(start * SR), int(min(end, len(y) / SR) * SR)
        seg = np.abs(y[a:b])
        cols = np.array_split(seg, W - 40) if len(seg) > W else [seg]
        for k, c in enumerate(cols):
            v = float(c.max()) if len(c) else 0
            d.line([(20 + k, H / 2 - v * 90), (20 + k, H / 2 + v * 90)], fill=(90, 110, 150))
        X = lambda s: 20 + (W - 40) * (s - start) / max(1e-6, (min(end, len(y) / SR) - start))  # noqa: E731
        for s in in_film(beats):
            d.line([(X(s), H / 2 - 30), (X(s), H / 2 + 30)], fill=(120, 120, 120))
        for bb in bars:
            d.line([(X(bb["s"]), 18), (X(bb["s"]), H - 18)], fill=(255, 200, 60), width=2 if bb in phrases else 1)
            d.text((X(bb["s"]) + 2, 4), f"{bb['bar']}|{bb['frame']:g}", fill=(255, 200, 60), font=font)
        for acc in peaks:
            d.ellipse([X(acc) - 4, H - 16, X(acc) + 4, H - 8], fill=(255, 80, 80))
        img.save(args.png)
    return 0


if __name__ == "__main__":
    sys.exit(main())
