#!/usr/bin/env python3
"""Verify basic delivery properties of a rendered video using FFprobe."""

import argparse
import json
import math
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _media import find_tool  # noqa: E402


def positive_int(value):
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("must be positive")
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("--width", type=positive_int, required=True)
    parser.add_argument("--height", type=positive_int, required=True)
    parser.add_argument("--fps", type=Fraction, required=True, help="e.g. 60 or 30000/1001")
    parser.add_argument("--frames", type=positive_int, required=True)
    parser.add_argument("--codec", default="h264", help="FFprobe codec name; default h264")
    parser.add_argument("--pixel-format", help="e.g. yuv420p")
    parser.add_argument("--require-audio", action="store_true")
    parser.add_argument("--max-av-drift", type=float, default=0.25, help="seconds; default 0.25")
    parser.add_argument("--ffprobe", help="path to FFprobe (default: PATH, MOTIONER_FFPROBE or Remotion's bundled copy)")
    args = parser.parse_args()

    if args.fps <= 0 or not math.isfinite(args.max_av_drift) or args.max_av_drift < 0:
        parser.error("fps must be positive and max-av-drift must be a finite nonnegative number")
    if not args.video.is_file():
        parser.error(f"video file does not exist: {args.video}")
    binary = find_tool("ffprobe", args.ffprobe)
    if not binary:
        parser.error("FFprobe not found: install it, set MOTIONER_FFPROBE, pass --ffprobe, or run inside a Remotion project")

    command = [
        binary, "-v", "error", "-count_frames", "-show_streams", "-show_format",
        "-of", "json", str(args.video),
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        info = json.loads(result.stdout)
    except (subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print(f"FFprobe failed: {exc}", file=sys.stderr)
        return 2

    streams = info.get("streams", [])
    videos = [stream for stream in streams if stream.get("codec_type") == "video"]
    audios = [stream for stream in streams if stream.get("codec_type") == "audio"]
    errors = []
    if len(videos) != 1:
        errors.append(f"expected one video stream, found {len(videos)}")
    if args.require_audio and not audios:
        errors.append("audio stream required but absent")

    report = {"file": str(args.video), "expected_frames": args.frames}
    if videos:
        video = videos[0]
        frames_text = video.get("nb_read_frames") or video.get("nb_frames")
        try:
            frames = int(frames_text)
        except (ValueError, TypeError):
            frames = None
        try:
            fps = Fraction(video.get("avg_frame_rate", "0/1"))
        except (ValueError, ZeroDivisionError):
            fps = Fraction(0)
        report.update(
            width=video.get("width"),
            height=video.get("height"),
            fps=str(fps),
            frames=frames,
            video_codec=video.get("codec_name"),
            pixel_format=video.get("pix_fmt"),
            video_duration=video.get("duration"),
            audio_streams=len(audios),
        )
        for key, expected in (("width", args.width), ("height", args.height)):
            if video.get(key) != expected:
                errors.append(f"{key}: expected {expected}, got {video.get(key)}")
        if fps != args.fps:
            errors.append(f"fps: expected {args.fps}, got {fps}")
        if frames != args.frames:
            errors.append(f"frames: expected {args.frames}, got {frames}")
        if video.get("codec_name") != args.codec:
            errors.append(f"codec: expected {args.codec}, got {video.get('codec_name')}")
        if args.pixel_format and video.get("pix_fmt") != args.pixel_format:
            errors.append(f"pixel format: expected {args.pixel_format}, got {video.get('pix_fmt')}")

        expected_seconds = float(Fraction(args.frames, 1) / args.fps)
        try:
            actual_seconds = float(video["duration"])
            if abs(actual_seconds - expected_seconds) > 1 / float(args.fps):
                errors.append(f"duration: expected {expected_seconds:.3f}s, got {actual_seconds:.3f}s")
        except (KeyError, ValueError, TypeError):
            errors.append("video stream duration unavailable")
        if audios:
            report["audio_codecs"] = [audio.get("codec_name") for audio in audios]
            try:
                audio_seconds = float(audios[0]["duration"])
                report["audio_duration"] = audio_seconds
                if abs(audio_seconds - expected_seconds) > args.max_av_drift:
                    errors.append(
                        f"audio duration drift: video target {expected_seconds:.3f}s, "
                        f"audio {audio_seconds:.3f}s"
                    )
            except (KeyError, ValueError, TypeError):
                errors.append("audio stream duration unavailable")

    report["status"] = "PASS" if not errors else "FAIL"
    report["errors"] = errors
    print(json.dumps(report, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
