import sys
from PIL import Image, ImageDraw, ImageFont
files = sys.argv[2:]
out = sys.argv[1]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
cols = min(8, len(ims))
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 6) + 6, rows * (h + 28) + 6), (25, 25, 28))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('arial.ttf', 16)
except OSError:
    font = ImageFont.load_default()
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = 6 + (i % cols) * (w + 6), 6 + (i // cols) * (h + 28)
    sheet.paste(im, (x, y + 22))
    d.text((x, y + 2), __import__('os').path.basename(f), fill=(230, 230, 230), font=font)
sheet.save(out)
print(out, sheet.size)
