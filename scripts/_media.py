"""Shared helpers for the Motioner scripts: locate FFmpeg/FFprobe, decode audio and video.

Nothing here writes to the project. Every script imports this module from its own folder.
"""

import io
import os
import shutil
import subprocess
import sys
import wave
from pathlib import Path

SR = 48000


def _candidates(name):
    exe = name + (".exe" if os.name == "nt" else "")
    env = os.environ.get("MOTIONER_" + name.upper())
    if env:
        yield env
    found = shutil.which(name)
    if found:
        yield found
    try:  # pip install imageio-ffmpeg ships a static ffmpeg (no ffprobe)
        if name == "ffmpeg":
            import imageio_ffmpeg  # type: ignore
            yield imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    # Remotion bundles ffmpeg and ffprobe in its compositor package
    here = Path.cwd().resolve()
    for folder in [here, *here.parents]:
        nm = folder / "node_modules" / "@remotion"
        if nm.is_dir():
            for comp in sorted(nm.glob("compositor-*")):
                cand = comp / exe
                if cand.is_file():
                    yield str(cand)


def find_tool(name, explicit=None):
    """Return a path to ffmpeg/ffprobe or None. Search order: explicit path, MOTIONER_FFMPEG /
    MOTIONER_FFPROBE, PATH, imageio-ffmpeg, node_modules/@remotion/compositor-* in cwd or a parent."""
    if explicit:
        p = shutil.which(explicit) or (explicit if Path(explicit).is_file() else None)
        return p
    for cand in _candidates(name):
        if cand and Path(cand).is_file():
            return cand
    return None


def require_tool(name, explicit=None):
    path = find_tool(name, explicit)
    if not path:
        sys.exit(
            f"{name} not found. Install it, set MOTIONER_{name.upper()}, pass --{name} PATH, "
            "or run from a Remotion project (node_modules/@remotion/compositor-* ships one)."
        )
    return path


def load_audio(path, ffmpeg=None, sr=SR, mono=False, max_seconds=None):
    """Decode any audio or video file to float64 numpy array (n, 2) or (n,) at `sr`."""
    import numpy as np

    ff = require_tool("ffmpeg", ffmpeg)
    cmd = [ff, "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(path)]
    if max_seconds:
        cmd += ["-t", str(max_seconds)]
    cmd += ["-vn", "-ac", "1" if mono else "2", "-ar", str(sr), "-c:a", "pcm_s16le", "-f", "wav", "pipe:1"]
    res = subprocess.run(cmd, capture_output=True)
    if res.returncode:
        raise RuntimeError(res.stderr.decode("utf-8", "replace").strip() or "ffmpeg failed")
    raw = res.stdout
    # ffmpeg writes a streaming WAV header with unknown sizes into a pipe; patch it so `wave` can read it
    if len(raw) > 44 and raw[:4] == b"RIFF":
        data_at = raw.find(b"data")
        if data_at > 0:
            raw = bytearray(raw)
            n = len(raw) - (data_at + 8)
            raw[4:8] = (len(raw) - 8).to_bytes(4, "little")
            raw[data_at + 4:data_at + 8] = n.to_bytes(4, "little")
            raw = bytes(raw)
    with wave.open(io.BytesIO(raw), "rb") as w:
        ch = w.getnchannels()
        data = w.readframes(w.getnframes())
    x = np.frombuffer(data, dtype="<i2").astype(np.float64) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch)
    return x


def video_info(path):
    """(fps, frame_count, width, height) using OpenCV when available, else ffprobe."""
    try:
        import cv2  # type: ignore

        cap = cv2.VideoCapture(str(path))
        if cap.isOpened():
            fps = cap.get(cv2.CAP_PROP_FPS)
            n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()
            if fps > 0:
                return fps, n, w, h
    except ImportError:
        pass
    import json
    from fractions import Fraction

    probe = require_tool("ffprobe")
    out = subprocess.run(
        [probe, "-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries",
         "stream=avg_frame_rate,nb_read_frames,width,height", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    s = json.loads(out)["streams"][0]
    return float(Fraction(s["avg_frame_rate"])), int(s["nb_read_frames"]), int(s["width"]), int(s["height"])


def iter_frames(path, width=None, ffmpeg=None):
    """Yield (index, RGB uint8 array) for every frame, optionally resized to `width` px wide."""
    import numpy as np

    try:
        import cv2  # type: ignore

        cap = cv2.VideoCapture(str(path))
        if cap.isOpened():
            i = 0
            while True:
                ok, bgr = cap.read()
                if not ok:
                    break
                if width and bgr.shape[1] != width:
                    h = round(bgr.shape[0] * width / bgr.shape[1])
                    bgr = cv2.resize(bgr, (width, h), interpolation=cv2.INTER_AREA)
                yield i, bgr[:, :, ::-1].copy()
                i += 1
            cap.release()
            return
    except ImportError:
        pass
    from PIL import Image

    ff = require_tool("ffmpeg", ffmpeg)
    vf = ["-vf", f"scale={width}:-2:flags=area"] if width else []
    proc = subprocess.Popen(
        [ff, "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(path), *vf,
         "-f", "image2pipe", "-c:v", "png", "pipe:1"],
        stdout=subprocess.PIPE,
    )
    buf = b""
    i = 0
    sig = b"\x89PNG\r\n\x1a\n"
    iend = b"IEND\xaeB`\x82"
    while True:
        chunk = proc.stdout.read(1 << 20)
        if chunk:
            buf += chunk
        while True:
            end = buf.find(iend)
            if end < 0:
                break
            end += len(iend)
            img = Image.open(io.BytesIO(buf[:end])).convert("RGB")
            buf = buf[end:]
            start = buf.find(sig)
            buf = buf[start:] if start >= 0 else b""
            yield i, np.asarray(img)
            i += 1
        if not chunk:
            break
    proc.wait()


def frames_to_seconds(frame, fps):
    return frame / fps


def parse_list(text, cast=float):
    return [cast(v) for v in str(text).replace(";", ",").split(",") if str(v).strip()]
