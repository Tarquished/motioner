# Motioner

A portable Agent Skill for directing, building, revising, and checking finished motion graphics. It works with Codex and Claude Code because the core instructions use the shared `SKILL.md` format. Remotion is the preferred production framework when it fits the brief; the skill does not include a Remotion project or media assets.

## Install

Copy the **entire** `motioner` folder, including `references/` and `scripts/`:

| Agent | Personal skill folder | Repository skill folder |
| --- | --- | --- |
| Codex | `~/.codex/skills/motioner/` | `.agents/skills/motioner/` |
| Claude Code | `~/.claude/skills/motioner/` | `.claude/skills/motioner/` |

Start a fresh session in the project after installing. Invoke it explicitly with `$motioner` in Codex or `/motioner` in Claude Code. Both agents can also select it automatically from its description when a video task matches. Remove or disable an older installed `directed-motion-graphics` copy so the two descriptions do not compete.

The video verifier requires Python 3 and FFprobe. The SFX timing analyzer requires Python 3 and FFmpeg. Both accept a custom binary path. Creating a film requires the production tools chosen for that film, such as Node.js and Remotion. This skill does not install them.

## Test that it works

1. **Discovery:** In a fresh Codex session and a fresh Claude Code session, invoke the skill explicitly. Ask each agent which file it loaded. It should identify this `SKILL.md` and use its linked review reference only when reviewing.
2. **Behavior:** Use the first prompt in [`evals/evals.json`](evals/evals.json). Run it in a disposable empty workspace. Ask for a real six-second MP4, not only a plan or source code. Check the morph, font specimens, cue map, rendered frames, full watch/listen review, and file properties. Repeat with the second prompt for product interaction and the third for a longer branded tutorial.
3. **Automatic selection:** In new sessions, repeat one prompt without naming the skill. Confirm that the agent opens `SKILL.md`. A static poster request is a useful negative case: this skill should not be loaded merely because the poster has a visual style.
4. **Artifact:** Watch each finished video at normal speed and destination size, first muted and then with sound. Fill in [`evals/review-scorecard.md`](evals/review-scorecard.md) for each run, including before/contact/after frames and an individual verdict for every morph or seamless handoff. Inspect its start, midpoint, and end colors as well as shape and speed. Revise weak transitions and score the new render. Compare the same prompt in both agents; if helpful, run once without the skill as a baseline. The skill works when it changes observable behavior and the finished films satisfy the brief, not merely when the agent says it loaded the skill.
5. **Internet assets:** Confirm that the agent compared suitable SFX and visual candidates, used fitting licensed files in the video, logged source and license details, measured SFX attack or peak, and replaced weak assets after reviewing the final render. More purposeful sonic coverage is desirable; a raw cue count is not the quality measure.

For a fixed 6-second, 1080 × 1920, 30 fps H.264 MP4 with audio:

```text
python scripts/verify_video.py path/to/final.mp4 --width 1080 --height 1920 --fps 30 --frames 180 --codec h264 --pixel-format yuv420p --require-audio
```

The script reports a nonzero exit code when a checked property fails. It cannot judge visual quality, factual accuracy, licensing, or whether the soundtrack actually sounds good. Human playback remains part of the test.

To estimate timing offsets for downloaded SFX:

```text
python scripts/analyze_sfx.py path/to/impact.wav path/to/whoosh.mp3
```

The analyzer reports an energy-based attack estimate and peak position in milliseconds. Use those numbers to place candidates on the picture timeline, then listen and inspect the encoded video; the measurements alone cannot judge timing by feel.

## Share on GitHub

The repository includes an MIT license. It contains no copied client footage, music, screenshots, private paths, or chat transcripts. Users can clone it and copy this folder to either agent's skill location above. The skill is portable; its instructions cannot guarantee identical model behavior, so maintain sample prompts and review actual video output after future revisions.
