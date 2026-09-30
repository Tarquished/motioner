#!/usr/bin/env bash
# web encodes of the delivered master: 1440p for the repository (CRF 26) and a 720p two-pass file under 9.3 MB for GitHub's inline player
set -e
FF=node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe
IN=${1:-out/film.mp4}
OUT=${2:-out/web}
mkdir -p "$OUT"
$FF -y -v error -i "$IN" -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 160k -movflags +faststart "$OUT/repo1440.mp4"
kb=$(python -c "print(int(9.2e6*8/30/1000-96))")
$FF -y -v error -i "$IN" -vf scale=1280:720:flags=lanczos -c:v libx264 -preset slow -b:v ${kb}k -maxrate $((kb*13/10))k -bufsize $((kb*2))k -pix_fmt yuv420p -profile:v high -an -pass 1 -passlogfile "$OUT/p" -f mp4 /dev/null
$FF -y -v error -i "$IN" -vf scale=1280:720:flags=lanczos -c:v libx264 -preset slow -b:v ${kb}k -maxrate $((kb*13/10))k -bufsize $((kb*2))k -pix_fmt yuv420p -profile:v high -c:a aac -b:a 96k -movflags +faststart -pass 2 -passlogfile "$OUT/p" "$OUT/inline720.mp4"
ls -l "$OUT"/*.mp4 | awk '{printf "%.1f MB %s\n", $5/1048576, $9}'
