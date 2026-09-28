"""Download the sounds and music used by the Papertrail example into research/ (not redistributed here).

Mixkit files: Mixkit Sound Effects Free License / Mixkit Stock Music Free License (use in videos,
no attribution, no redistribution of the raw files). Kenney packs: CC0.
"""
import io
import os
import re
import urllib.request
import zipfile

UA = {'User-Agent': 'Mozilla/5.0'}
MIXKIT_SFX = [2607, 1461, 3115, 2577, 2568, 2369, 2870, 2608, 2350, 3192, 2633, 3082, 2344]
MUSIC = [(1167, 'close-up')]
KENNEY = ['casino-audio', 'interface-sounds', 'impact-sounds']


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()


os.makedirs('research/sfx', exist_ok=True)
os.makedirs('research/music', exist_ok=True)
for i in MIXKIT_SFX:
    dst = f'research/sfx/mixkit-{i}.mp3'
    if not os.path.exists(dst):
        open(dst, 'wb').write(get(f'https://assets.mixkit.co/active_storage/sfx/{i}/{i}-preview.mp3'))
for i, name in MUSIC:
    dst = f'research/music/mixkit-{i}-{name}.mp3'
    if not os.path.exists(dst):
        open(dst, 'wb').write(get(f'https://assets.mixkit.co/music/{i}/{i}.mp3'))
for pack in KENNEY:
    folder = f'research/kenney/{pack}'
    if os.path.isdir(folder) and os.listdir(folder):
        continue
    html = get(f'https://kenney.nl/assets/{pack}').decode('utf-8', 'replace')
    link = re.findall(r'https://kenney\.nl/media/pages/assets/[^"\']+\.zip', html)[0]
    z = zipfile.ZipFile(io.BytesIO(get(link)))
    os.makedirs(folder, exist_ok=True)
    for n in z.namelist():
        if n.lower().endswith(('.ogg', '.wav')) or 'license' in n.lower():
            open(os.path.join(folder, os.path.basename(n)), 'wb').write(z.read(n))
print('assets ready in research/')
