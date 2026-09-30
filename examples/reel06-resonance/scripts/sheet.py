# Compose still frames into contact sheets: python scripts/sheet.py dir out.png cols label...
import sys, glob, os
from PIL import Image, ImageDraw
d, out, cols = sys.argv[1], sys.argv[2], int(sys.argv[3])
files = sorted(glob.glob(os.path.join(d, 'f*.png')))
ims = [Image.open(f) for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (w * cols, h * rows), (20, 20, 20))
dr = ImageDraw.Draw(s)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * w, (i // cols) * h
    s.paste(im, (x, y))
    dr.text((x + 6, y + 4), os.path.basename(f)[1:5], fill=(255, 255, 0))
s.save(out)
print(s.size, len(ims))
