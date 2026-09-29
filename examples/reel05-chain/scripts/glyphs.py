# Extract the outlines of "motioner" from Archivo (wght 800, wdth 125) as path commands, in font units (upm 1000).
import json, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.recordingPen import DecomposingRecordingPen

src = 'node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2'
f = TTFont(src)
print('axes', [(a.axisTag, a.minValue, a.defaultValue, a.maxValue) for a in f['fvar'].axes])
inst = instantiateVariableFont(f, {'wght': 800, 'wdth': 125}, inplace=False)
gs = inst.getGlyphSet()
cmap = inst.getBestCmap()
hmtx = inst['hmtx']
out = {'upm': inst['head'].unitsPerEm, 'glyphs': {}}
os2 = inst['OS/2']
out['xHeight'] = getattr(os2, 'sxHeight', 0)
out['capHeight'] = getattr(os2, 'sCapHeight', 0)
for ch in 'motiner.':
    name = cmap[ord(ch)]
    pen = DecomposingRecordingPen(gs)
    gs[name].draw(pen)
    cmds = []
    for op, args in pen.value:
        cmds.append([op] + [list(a) for a in args])
    out['glyphs'][ch] = {'adv': hmtx[name][0], 'cmds': cmds}
    print(ch, name, hmtx[name][0], len(cmds))
json.dump(out, open('src/glyphs.json', 'w'))
print('xHeight', out['xHeight'], 'cap', out['capHeight'])
