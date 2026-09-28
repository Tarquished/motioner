"""Build audio/cues.json from src/timeline.json (the one clock shared with the picture).

Whoosh peaks use the fastest frames MEASURED in the rendered draft by transition_review.py
(motion events: 278-287@283, 447-472@454, 558-581@563, 695-701@695, 730-737@732).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / 'src' / 'timeline.json').read_text(encoding='utf-8'))
K = 'research/kenney/'
M = 'research/sfx/mixkit-'

sounds = {
    'note_a': {'file': K + 'casino-audio/card-slide-3.ogg', 'role': 'paper', 'max_ms': 260, 'fade_out_ms': 120},
    'note_b': {'file': K + 'casino-audio/card-place-1.ogg', 'role': 'paper'},
    'note_c': {'file': K + 'casino-audio/card-slide-1.ogg', 'role': 'paper'},
    'air': {'file': M + '2607.mp3', 'role': 'whoosh'},
    'swish': {'file': M + '1461.mp3', 'role': 'whoosh'},
    'swish_small': {'file': M + '3115.mp3', 'role': 'swish'},
    'land': {'file': K + 'impact-sounds/impactSoft_heavy_000.ogg', 'role': 'impact_small'},
    'tick_a': {'file': K + 'interface-sounds/select_003.ogg', 'role': 'tick'},
    'tick_b': {'file': K + 'interface-sounds/select_004.ogg', 'role': 'tick'},
    'tap': {'file': M + '2577.mp3', 'role': 'click'},
    'tap_soft': {'file': M + '2568.mp3', 'role': 'click'},
    'check': {'file': K + 'interface-sounds/drop_001.ogg', 'role': 'pop'},
    'pencil': {'file': M + '2369.mp3', 'role': 'paper', 'gain_db': -6, 'max_ms': 420},
    'chip': {'file': K + 'interface-sounds/pluck_001.ogg', 'role': 'pop'},
    'done': {'file': M + '2870.mp3', 'role': 'success'},
    'flood_punch': {'file': M + '2608.mp3', 'role': 'whoosh'},
    'flood_air': {'file': M + '2350.mp3', 'role': 'whoosh', 'max_ms': 1300},
    'bubble': {'file': M + '3192.mp3', 'role': 'pop'},
    'morph_sweep': {'file': M + '2633.mp3', 'role': 'whoosh', 'max_ms': 1500},
    'logo_hit': {'file': M + '3082.mp3', 'role': 'reward'},
    'bell': {'file': M + '2344.mp3', 'role': 'reward'},
}

cues = []


def cue(frame, sound, label, **kw):
    cues.append({'frame': frame, 'sound': sound, 'label': label, **kw})


# notes land one by one (contact = land frame), three recordings rotated with small pitch changes
for i, f in enumerate(TL['notes']['land']):
    cue(f, 'note_' + 'abc'[i % 3], f'note {i + 1} lands', rate=[1.0, 1.06, 0.95, 1.1, 1.02, 0.92, 1.08][i], gain_db=-1 - (i % 2), pan=[-0.3, 0.3, -0.35, 0.35, 0.05, -0.25, 0.25][i])
# shuffle nudges
for k, f in enumerate(TL['notes']['shuffle']):
    cue(f + 6, 'swish_small', 'notes get pushed around', align='peak', rate=0.9 + 0.1 * k, gain_db=-7, pan=-0.2 + 0.4 * k)
    cue(f + 13, 'note_c', 'notes shuffle', rate=1.15 + 0.1 * k, gain_db=-3)
    cue(f + 19, 'note_a', 'notes shuffle', rate=1.2, gain_db=-5, pan=0.3)
# anticipation breath before the merge
cue(262, 'swish_small', 'notes pull back (anticipation)', align='peak', rate=0.8, gain_db=-8)
# the merge: whoosh peak on the fastest frame, soft body on the landing
cue(283, 'air', 'notes fly into one card', align='peak', rate=1.1, gain_db=-3)
cue(TL['merge']['end'], 'land', 'card lands', gain_db=-8)
cue(TL['merge']['end'] + 1, 'note_a', 'card lands (paper layer)', rate=0.9, gain_db=-4)
cue(303, 'swish_small', 'caption rolls to "All in one place."', align='peak', gain_db=-9, rate=1.1)
for k, f in enumerate(TL['card']['rowsIn']):
    cue(f + 4, 'tick_a', f'row {k + 1} appears', rate=1.0 + 0.08 * k, gain_db=-4)
# checks on the card
for k, f in enumerate(TL['card']['taps']):
    cue(f, 'tap', f'tap checkbox {k + 1}', gain_db=-2)
    cue(f + 2, 'check', f'checkbox {k + 1} fills', rate=1.0 + 0.1 * k)
    cue(f + 5, 'pencil', f'strike-through {k + 1}', gain_db=-3, rate=1.1)
cue(TL['card']['cardTap'], 'tap_soft', 'tap the card')
# expand
cue(454, 'swish', 'card expands to full screen', align='peak', rate=0.85, gain_db=-3)
cue(TL['expand']['end'], 'tick_b', 'detail settles', gain_db=-6, rate=0.9)
for k, f in enumerate(TL['detail']['chips']):
    cue(f + 3, 'chip', f'chip {k + 1} pops', rate=1.0 + 0.12 * k, gain_db=-3)
cue(TL['detail']['ring'] + 4, 'tick_a', 'ring appears', rate=0.85, gain_db=-4)
cue(TL['detail']['tap3'], 'tap', 'tap the last checkbox', gain_db=-2)
cue(TL['detail']['tap3'] + 2, 'check', 'last checkbox fills', rate=1.2)
cue(TL['detail']['tap3'] + 5, 'pencil', 'last strike-through', gain_db=-3, rate=1.15)
cue(TL['detail']['tap3'] + 14, 'done', 'ring completes 3/3', gain_db=-9)
cue(TL['detail']['shareTap'], 'tap', 'press Share', rate=0.9)
# flood
cue(558, 'flood_punch', 'flood leaves the button', align='peak', gain_db=-2)
cue(566, 'flood_air', 'flood fills the frame', align='peak', gain_db=-3)
for k, f in enumerate(TL['shared']['avatars']):
    cue(f + 3, 'bubble', f'avatar {k + 1} pops', rate=[1.0, 1.12, 1.25][k], pan=[-0.3, 0, 0.3][k])
cue(TL['shared']['caption'] + 6, 'swish_small', 'caption slides in', align='peak', gain_db=-10)
cue(TL['shared']['label'] + 2, 'tick_b', 'label appears', gain_db=-7, rate=1.1)
# logo
cue(695, 'swish', 'avatars converge', align='peak', rate=0.95, gain_db=-3)
cue(732, 'morph_sweep', 'circle becomes the plane', align='peak', gain_db=-3)
cue(TL['logo']['shape'][1], 'logo_hit', 'logo lands', gain_db=-5)
cue(TL['logo']['tagline'] + 4, 'tick_a', 'tagline appears', gain_db=-6, rate=0.9)
cue(TL['logo']['stamp'], 'bell', 'stamp on the song stop', gain_db=-4)
cue(TL['logo']['stamp'], 'land', 'stamp body', gain_db=-12)

sheet = {
    'fps': TL['fps'], 'duration_frames': TL['durationInFrames'], 'sample_rate': 48000,
    'master': {'lufs': -14, 'true_peak_db': -1.5},
    'music': {'file': 'research/music/mixkit-1167-close-up.mp3', 'bed_lufs': -27, 'edits': TL['music']['edit'],
              'xfade_ms': 40, 'fade_in_ms': 30, 'fade_out_ms': 300, 'end_frame': TL['durationInFrames']},
    'duck': {'attack_ms': 40, 'hold_ms': 160, 'release_ms': 450},
    'sounds': sounds, 'cues': sorted(cues, key=lambda c: c['frame']),
}
(ROOT / 'audio').mkdir(exist_ok=True)
(ROOT / 'audio' / 'cues.json').write_text(json.dumps(sheet, indent=1), encoding='utf-8')
print(f'{len(cues)} cues, {len({c["sound"] for c in cues})} sounds')
