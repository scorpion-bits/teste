#!/usr/bin/env bash
# Delivery: lossless master render + synthesised soundtrack → H.264 High / AAC, BT.709, faststart.
#   ./encode.sh            → ../scorpionbits-ident.mp4        (1080p60)
#   FPS=30 ./encode.sh     → ../scorpionbits-ident-30fps.mp4  (1080p30, from its own 30 fps render)
set -euo pipefail
cd "$(dirname "$0")"
FPS=${FPS:-60}
OUT=${OUT:-../scorpionbits-ident$([ "$FPS" = 60 ] || echo "-${FPS}fps").mp4}
[ -f ".work/master-$FPS.mp4" ] || node render.mjs --fps "$FPS"
[ -f soundtrack.wav ] || node audio.mjs
ffmpeg -y -loglevel error -i ".work/master-$FPS.mp4" -i soundtrack.wav -map 0:v -map 1:a \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 14 -tune film -profile:v high -g "$FPS" \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 320k -ar 48000 -t 10 -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
