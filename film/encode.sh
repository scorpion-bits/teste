#!/usr/bin/env bash
# Delivery encode: the lossless-ish master render + the synthesised soundtrack → ../scorpionbits-film.mp4
# H.264 High, 1080p30, AAC 192k, two-pass so the file stays under GitHub's 100 MB limit.
#   VB=3000k ./encode.sh      (override the video bitrate)
set -euo pipefail
cd "$(dirname "$0")"
VB=${VB:-2250k}
OUT=${OUT:-../scorpionbits-film.mp4}
[ -f .work/master.mp4 ] || { echo "run: node render.mjs --workers 4" >&2; exit 1; }
[ -f soundtrack.wav ] || node audio.mjs
ffmpeg -y -loglevel error -i .work/master.mp4 -c:v libx264 -preset slow -b:v "$VB" -pass 1 -passlogfile .work/x264 -an -f mp4 /dev/null
ffmpeg -y -loglevel error -i .work/master.mp4 -i soundtrack.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -b:v "$VB" -maxrate 7M -bufsize 10M -pass 2 -passlogfile .work/x264 \
  -pix_fmt yuv420p -profile:v high -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT"
ls -la "$OUT"
