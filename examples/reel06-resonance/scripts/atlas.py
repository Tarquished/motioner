#!/usr/bin/env python3
"""Glyph distance atlas for the shader: real Archivo outlines (expanded, heavy) rendered at 4x, exact Euclidean distance
transform (scipy), stored as half floats. Channel R = signed distance to the glyph (negative inside), channel G = signed
distance to the glyph's counters (the hole of an o, d, e ...; negative inside the hole, +120 where there is none).
Also writes the word layouts (letter centres) used by the picture.
Output: public/atlas.bin (RG16F, cols*CS x rows*CS) and src/atlas.json."""
import json
import math
import os
import sys
from pathlib import Path

import numpy as np
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2"
CS = 448          # cell size in atlas px
SS = 4            # supersampling
CAP = 256.0       # cap height in atlas px
CLAMP = 120.0
CHARS = [chr(c) for c in range(ord("A"), ord("Z") + 1)] + list("motier") + list("n") + ["."]
CHARS = list(dict.fromkeys(CHARS))
COLS = 8
WORDS = ["SOUND", "MOTION", "FRAME", "RING", "PING", "HUM", "BEAT", "WAVE", "FIELD", "EVERY", "TONE", "motioner"]

tmp = ROOT / "out"
tmp.mkdir(exist_ok=True)
ttf = tmp / "archivo_800_125.ttf"
if not ttf.exists():
    f = TTFont(str(SRC))
    inst = instancer.instantiateVariableFont(f, {"wght": 800, "wdth": 125})
    inst.flavor = None
    inst.save(str(ttf))

# font size so that the cap height is CAP atlas px
probe = ImageFont.truetype(str(ttf), 1000)
cap1000 = -probe.getbbox("H", anchor="ls")[1]
FS = CAP / cap1000 * 1000
font = ImageFont.truetype(str(ttf), FS * SS)
print("font size", FS, "cap", CAP)

rows = math.ceil(len(CHARS) / COLS)
atlas = np.zeros((rows * CS, COLS * CS, 2), np.float16)
info = {}


def sdf_of(mask):
    """signed distance of a boolean mask (negative inside), in mask px"""
    d_out = ndi.distance_transform_edt(~mask)
    d_in = ndi.distance_transform_edt(mask)
    return d_out - d_in


for idx, ch in enumerate(CHARS):
    big = CS * SS
    im = Image.new("L", (big, big), 0)
    dr = ImageDraw.Draw(im)
    # baseline origin placed so the glyph centre lands near the cell centre
    adv = font.getlength(ch) / SS
    bb = font.getbbox(ch, anchor="ls")  # relative to the origin, at SS scale
    ox = big / 2 - (bb[0] + bb[2]) / 2
    oy = big / 2 + (-(bb[1] + bb[3]) / 2) * -1  # baseline y such that bbox centre is at big/2
    oy = big / 2 - (bb[1] + bb[3]) / 2
    dr.text((ox, oy), ch, font=font, fill=255, anchor="ls")
    a = np.asarray(im) > 127
    ys, xs = np.nonzero(a)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    # signed distance at big scale, then down-sample to the cell (values / SS)
    sd = sdf_of(a) / SS
    sd_cell = sd.reshape(CS, SS, CS, SS).mean(axis=(1, 3))
    # counters: background components that do not touch the border
    lab, n = ndi.label(~a)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    holes = np.zeros_like(a)
    for k in range(1, n + 1):
        if k not in border:
            holes |= lab == k
    if holes.any():
        cd = sdf_of(holes) / SS
        cd_cell = cd.reshape(CS, SS, CS, SS).mean(axis=(1, 3))
        hy, hx = np.nonzero(holes)
        counter = {"cx": float((hx.min() + hx.max() + 1) / 2 / SS - CS / 2), "cy": float(CS / 2 - (hy.min() + hy.max() + 1) / 2 / SS),
                   "rx": float((hx.max() + 1 - hx.min()) / 2 / SS), "ry": float((hy.max() + 1 - hy.min()) / 2 / SS)}
    else:
        cd_cell = np.full((CS, CS), CLAMP)
        counter = None
    r, c = divmod(idx, COLS)
    atlas[r * CS:(r + 1) * CS, c * CS:(c + 1) * CS, 0] = np.clip(sd_cell, -CLAMP, CLAMP).astype(np.float16)
    atlas[r * CS:(r + 1) * CS, c * CS:(c + 1) * CS, 1] = np.clip(cd_cell, -CLAMP, CLAMP).astype(np.float16)
    # glyph bbox centre relative to the pen origin (x right, y up from the baseline), atlas px
    cx_big, cy_big = (x0 + x1) / 2, (y0 + y1) / 2
    info[ch] = {"idx": idx, "adv": adv, "bx": (cx_big - ox) / SS, "by": (oy - cy_big) / SS, "w": (x1 - x0) / SS, "h": (y1 - y0) / SS, "counter": counter}
    print(ch, idx, round(adv, 1), round(info[ch]["w"], 1), round(info[ch]["h"], 1), "counter" if counter else "")

(ROOT / "public").mkdir(exist_ok=True)
(ROOT / "public" / "atlas.bin").write_bytes(atlas.tobytes())

words = {}
TRACK = 0.02 * CAP  # a little tracking (atlas px)
for w in WORDS:
    pen = 0.0
    items = []
    for i, ch in enumerate(w):
        g = info[ch]
        items.append({"ch": ch, "x": pen + g["bx"], "y": g["by"], "idx": g["idx"]})
        pen += g["adv"] + TRACK
    width = pen - TRACK
    # centre the word on its ink box (first bbox left to last bbox right), baseline at y = 0
    left = items[0]["x"] - info[w[0]]["w"] / 2
    right = items[-1]["x"] + info[w[-1]]["w"] / 2
    mid = (left + right) / 2
    for it in items:
        it["x"] -= mid
    words[w] = {"items": items, "width": right - left, "height": CAP}
    print(w, round(right - left, 1))

meta = {"cs": CS, "cols": COLS, "rows": rows, "cap": CAP, "clamp": CLAMP, "chars": info, "words": words}
(ROOT / "src" / "atlas.json").write_text(json.dumps(meta), encoding="utf-8")
print("atlas", atlas.shape, atlas.nbytes / 1e6, "MB")
