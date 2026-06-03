#!/usr/bin/env bash
# Build Chrome Web Store promo tiles. Requires only macOS built-ins.
#   marquee.png : 1400 x 560
#   small.png   :  440 x 280
set -euo pipefail
cd "$(dirname "$0")"

node build.mjs

raster() { # name square-size crop-height
  local name=$1 side=$2 cropH=$3
  rm -f "$name.svg.png" "$name.png"
  qlmanage -t -s "$side" -o . "$name.svg" >/dev/null 2>&1
  # qlmanage emits a square PNG; center-crop to the real tile height.
  sips -c "$cropH" "$side" "$name.svg.png" --out "$name.png" >/dev/null
  rm -f "$name.svg.png"
  echo "$name.png -> $(sips -g pixelWidth -g pixelHeight "$name.png" | awk '/pixel/{print $2}' | paste -sd x -)"
}

raster marquee 1400 560
raster small 440 280
