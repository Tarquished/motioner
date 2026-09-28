# Typography in motion

Read when type carries the film (captions, kinetic type, logo reveals).

## Choosing

- Start from the product's own fonts. If free to choose, compare at least two candidates with the real title, a caption and a UI label, rendered at delivery size and at phone size. Check glyph coverage (umlauts, accents), weights, numerals, and licence (Google Fonts / Fontsource are safe).
- Pair one display face with character (e.g. Bricolage Grotesque, Space Grotesk, Clash Display, Fraunces, Instrument Serif) with a calm UI face (Inter Tight, Manrope, Geist, the product's own). Avoid system fallbacks and "default AI" choices (plain Inter or Arial for everything).
- Record the choice and why the other candidate lost.

## Setting

- Captions: 2 to 6 words, 70 to 110 px on a 1080-wide vertical frame, tight tracking for display sizes (-1 % to -3 %), line height 1.0 to 1.1.
- Keep text inside safe areas (vertical social video: top 250 px and bottom 400 px carry platform UI).
- Contrast: over busy or moving backgrounds, use a die-cut outline, a soft shadow, or defocus the background (depth of field). Never a flat band unless it is the brand style.
- Readable hold: 0.8 s + 0.25 s per word, with the text still.

## Motion

- Lock layout from the first frame: final line breaks and widths are reserved even while letters scale, blur or change weight. Animating the `wght`/`wdth` axes must not reflow the line.
- Entrances: per-word or per-letter rise with a mask or a short blur (4 to 6 frame stagger per word, 1 to 2 per letter), `ease.out`.
- Changing one caption into another: roll (old letters out upward, new letters in), sequential. Let letters travel only when the strings share a run of 3+ letters (`LetterMorph mode="travel"`).
- Wordmark reveals: letters rise from a baseline mask or morph out of a shape; land the last letter on a beat, then hold still.
- Key words can become UI (a word slides into a button or chip) or UI can become words; treat that as a morph with a carrier.
- Numbers roll like an odometer (tabular figures), and land with a small pulse.
