#!/usr/bin/env python3
"""Contact sheet of an encoded video: one thumbnail every N frames (or at listed frames), labelled
with frame and time, for a muted whole-film review at phone size.

  python contact_sheet.py film.mp4 --every 12 --width 180 --out review/film.png
  python contact_sheet.py film.mp4 --frames 118,120,122,124 --width 540 --out review/boundary.png
  python contact_sheet.py film.mp4 --frames 538-543 --crop 1400,300,400,260 --width 400 --out review/zoom.png
      (--crop x,y,w,h in video pixels: frame-by-frame close-up of a small region, e.g. where
       transition_review reported a HANDOFF-JUMP/TELEPORT/JERK "at_px")

Thumbnails are taken from the decoded file (what viewers get), not from source renders.
"""

import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _media import iter_frames, video_info  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", type=Path)
    ap.add_argument("--every", type=int, default=12)
    ap.add_argument("--frames", help="comma-separated frames and ranges (538-543) instead of --every")
    ap.add_argument("--crop", help="x,y,w,h region in video pixels to show instead of the whole frame")
    ap.add_argument("--width", type=int, default=180)
    ap.add_argument("--cols", type=int, default=12)
    ap.add_argument("--out", type=Path, default=Path("contact-sheet.png"))
    args = ap.parse_args()
    from PIL import Image, ImageDraw, ImageFont

    fps, n, w, h = video_info(args.video)
    def parse(text):
        out = set()
        for part in text.split(","):
            part = part.strip()
            if "-" in part:
                a, b = part.split("-")
                out.update(range(int(a), int(b) + 1))
            elif part:
                out.add(int(part))
        return sorted(out)

    wanted = parse(args.frames) if args.frames else list(range(0, max(1, n), args.every))
    crop = [int(v) for v in args.crop.split(",")] if args.crop else None
    keep = set(wanted)
    thumbs = {}
    for i, frame in iter_frames(args.video, width=None if crop else args.width):
        if i in keep:
            if crop:
                x, y, cw, ch = crop
                frame = frame[y:y + ch, x:x + cw]
            img = Image.fromarray(frame)
            if img.width != args.width:
                img = img.resize((args.width, round(img.height * args.width / img.width)), Image.LANCZOS)
            thumbs[i] = img
    frames = [f for f in wanted if f in thumbs]
    if not frames:
        sys.exit("no frames decoded")
    tw, th = thumbs[frames[0]].size
    cols = min(args.cols, len(frames))
    rows = math.ceil(len(frames) / cols)
    pad, lab = 4, 16
    sheet = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + lab + pad) + pad), (20, 20, 24))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 12)
    except OSError:
        font = ImageFont.load_default()
    for k, f in enumerate(frames):
        x, y = pad + (k % cols) * (tw + pad), pad + (k // cols) * (th + lab + pad)
        sheet.paste(thumbs[f], (x, y + lab))
        d.text((x, y + 1), f"f{f} {f / fps:.2f}s", fill=(220, 220, 220), font=font)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.out)
    print(f"{args.out}: {len(frames)} frames, {sheet.size[0]}x{sheet.size[1]}")


if __name__ == "__main__":
    sys.exit(main())
