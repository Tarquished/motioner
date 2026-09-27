#!/usr/bin/env python3
"""Estimate the energy attack and peak of SFX files for frame-level cue placement."""

import argparse
import array
import io
import json
import math
import shutil
import subprocess
import sys
import wave
from pathlib import Path


def bounded_float(low, high):
    def convert(value):
        try:
            result = float(value)
        except ValueError as exc:
            raise argparse.ArgumentTypeError(str(exc)) from exc
        if not math.isfinite(result) or not low <= result <= high:
            raise argparse.ArgumentTypeError(f"must be between {low} and {high}")
        return result
    return convert


def inspect_file(path, ffmpeg, sample_rate, window_ms, threshold, max_seconds):
    command = [
        ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(path),
        "-t", str(max_seconds), "-vn", "-ac", "1", "-ar", str(sample_rate),
        "-c:a", "pcm_s16le", "-f", "wav", "pipe:1",
    ]
    result = subprocess.run(command, capture_output=True)
    if result.returncode:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(detail or f"FFmpeg exited {result.returncode}")
    with wave.open(io.BytesIO(result.stdout), "rb") as decoded:
        if decoded.getnchannels() != 1 or decoded.getsampwidth() != 2:
            raise RuntimeError("unexpected WAV format from FFmpeg")
        samples = array.array("h")
        samples.frombytes(decoded.readframes(decoded.getnframes()))
    if sys.byteorder != "little":
        samples.byteswap()
    if not samples:
        raise RuntimeError("no decoded audio samples")

    window_samples = max(1, round(sample_rate * window_ms / 1000))
    envelopes = []
    for start in range(0, len(samples), window_samples):
        part = samples[start:start + window_samples]
        envelopes.append(math.sqrt(sum(value * value for value in part) / len(part)))
    peak = max(envelopes)
    if peak == 0:
        raise RuntimeError("decoded audio is silent")
    attack_index = next(index for index, value in enumerate(envelopes) if value >= peak * threshold)
    peak_index = envelopes.index(peak)
    return {
        "file": str(path),
        "decoded_duration_ms": round(len(samples) * 1000 / sample_rate, 1),
        "estimated_attack_ms": round(attack_index * window_ms, 1),
        "energy_peak_ms": round(peak_index * window_ms, 1),
        "attack_threshold_of_peak": threshold,
        "window_ms": window_ms,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--ffmpeg", default="ffmpeg", help="path to FFmpeg executable")
    parser.add_argument("--window-ms", type=bounded_float(1, 100), default=5.0)
    parser.add_argument("--threshold", type=bounded_float(0.01, 1), default=0.5)
    parser.add_argument("--max-seconds", type=bounded_float(0.1, 600), default=30.0)
    args = parser.parse_args()

    binary = shutil.which(args.ffmpeg)
    if not binary:
        parser.error(f"FFmpeg not found: {args.ffmpeg}")
    outputs = []
    failed = False
    for path in args.files:
        try:
            if not path.is_file():
                raise RuntimeError("file does not exist")
            outputs.append(inspect_file(path, binary, 48000, args.window_ms, args.threshold, args.max_seconds))
        except (RuntimeError, ValueError) as exc:
            failed = True
            outputs.append({"file": str(path), "error": str(exc)})
    print(json.dumps(outputs, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
