#!/bin/zsh
# usage: run-all.sh <label> [films]   (before|after; `films` stops after the films and stills)
L=$1
cd /Users/sebs/.fs-lanes/travel
export FS_PORT=3137 FS_HEADED=0
O=docs/verification/travel/gates-$L; mkdir -p $O
for e in rod inflate solid; do
  node scripts/verify/travel-wrap/film-loop.mjs docs/verification/travel/film-$L-$e --engine=$e > $O/film-$e.txt 2>&1; echo "film-$e exit $?" >> $O/exits.txt
done
for e in rod inflate solid; do
  node scripts/verify/travel-wrap/film-loop.mjs docs/verification/travel/stills-$L-$e --engine=$e --stills=1 > $O/stills-$e.txt 2>&1; echo "stills-$e exit $?" >> $O/exits.txt
done
[[ $2 == films ]] && { echo "DONE films" >> $O/exits.txt; exit 0; }
g() { n=$1; shift; node scripts/verify/$n.mjs "$@" > $O/$n.txt 2>&1; echo "$n exit $?" >> $O/exits.txt; }
g assert-take-timeline
g assert-export-window
g assert-drawin-timing
g assert-stroke-schedule
g assert-take-persists
g assert-export-plan
node scripts/verify/_probe-pentip-sweep.mjs --label=travel-$L > $O/_probe-pentip-sweep.txt 2>&1; echo "_probe-pentip-sweep exit $?" >> $O/exits.txt
g assert-drawin-pentip --label=travel-$L
node scripts/verify/verify-timing-origin.mjs --label=travel-$L > $O/verify-timing-origin.txt 2>&1; echo "verify-timing-origin exit $?" >> $O/exits.txt
g assert-timing-frames --label=travel-$L
echo DONE >> $O/exits.txt
