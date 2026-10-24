#!/bin/bash
set -u
PAIRS="
extrude-outline-reveal F-oZnjkY-ak
extruded-logo-resolve BLFKx8uuBj8
cartoon-network-popup Q3wURy5b_nM
pulltab-popup-crane k25v_50P91c
paper-street-stopmotion ylp_DPjdFOw
origami-crane-fold djeRnWMDjyc
origami-logo-fold 9PfgidScCxc
popup-book 3E8vDN2-0jE
all4-idents sXnf8vyL00Q
pencil-sketch-extrude 3yLlI65B808
stacked-extrude-pin o6Ye2GS7n0o
"
echo "$PAIRS" | while read -r slug id; do
  [ -z "$slug" ] && continue
  yt-dlp --skip-download --write-info-json --write-comments \
    --extractor-args "youtube:max_comments=30,all,30,10;comment_sort=top" \
    -o "$slug.%(ext)s" "https://www.youtube.com/watch?v=$id" >"$slug.log" 2>&1 \
    || echo "COMMENTS-FAILED $slug"
  if [ ! -f "$slug.info.json" ]; then
    yt-dlp --skip-download --write-info-json -o "$slug.%(ext)s" \
      "https://www.youtube.com/watch?v=$id" >>"$slug.log" 2>&1 || echo "INFO-FAILED $slug"
  fi
  echo "done $slug"
done
