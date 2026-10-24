"""
POSITIVE CONTROL for the reveal-order defect measured in
docs/verification/writein-2026-08-28/seq (frames 4, 7, 23).

WHAT IT TESTS.  lib/implicit-surface.ts:1215 keys every surface vertex by
`field.nearestIndex(x,y,z)` — the reveal position of the NEAREST capsule, not
of the capsule that actually put ink there.  This script reproduces that rule
in 2D on a path that approaches itself, and asks one question: does keying by
NEAREST produce ink that appears ahead of the pen and detached from it?

It runs the same reveal twice on the same geometry, changing only the key:
  A  key = nearest sample index        (what the shipped code does)
  B  key = smallest index that COVERS  (ink exists from the moment any pass
                                        laid it — the physically true answer)
If A shows detached islands and B does not, the key is the cause.

2026-08-28 · lane R1 · research only, touches no repo code.
"""
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw

W, H, R = 420, 300, 11.0          # canvas, and the stroke half-width in px

def e_path(n=900):
    """An `e` the way the hero word writes it: bowl first, then a tail that
    passes back under the bowl's own entry.  The self-approach is the point."""
    t = np.linspace(0, 1, n)
    # bowl: 300 deg of a circle, opening to the right
    a = np.linspace(np.deg2rad(20), np.deg2rad(320), int(n * 0.62))
    bx, by = 150 + 62 * np.cos(a), 150 - 62 * np.sin(a)
    # tail: leaves the bowl's end and runs right, passing close under the entry
    s = np.linspace(0, 1, n - len(a))
    tx = bx[-1] + s * 150
    ty = by[-1] + 34 * np.sin(s * 1.5) - 6 * s
    return np.stack([np.r_[bx, tx], np.r_[by, ty]], 1)

P = e_path()
N = len(P)
key_of_sample = np.arange(N) / (N - 1)

yy, xx = np.mgrid[0:H, 0:W]
pts = np.stack([xx.ravel(), yy.ravel()], 1).astype(float)

# distance from every pixel to every sample, in blocks
nearest = np.empty(len(pts), np.int32)
mind    = np.empty(len(pts), float)
first   = np.full(len(pts), np.inf)          # smallest index that COVERS
B = 20000
for i in range(0, len(pts), B):
    d = np.linalg.norm(pts[i:i+B, None, :] - P[None, :, :], axis=2)
    nearest[i:i+B] = d.argmin(1)
    mind[i:i+B]    = d.min(1)
    cov = d <= R
    idx = np.where(cov, np.arange(N)[None, :], N + 1)
    fi = idx.min(1)
    first[i:i+B] = np.where(fi <= N, key_of_sample[np.minimum(fi, N - 1)], np.inf)

ink   = (mind <= R).reshape(H, W)
keyA  = key_of_sample[nearest].reshape(H, W)      # shipped rule
keyB  = first.reshape(H, W)                        # physically true rule

def islands(key, label):
    """Replay the reveal and count new-ink islands detached from all ink so far."""
    prev = np.zeros((H, W), bool)
    det = tot = 0; worst = 0
    log = []
    for f in range(1, 31):
        m = ink & (key <= f / 30.0)
        new = m & ~prev
        if new.sum() >= 40:
            lab, n = ndimage.label(new, np.ones((3, 3)))
            dist = ndimage.distance_transform_edt(~prev) if prev.any() else None
            for j in range(1, n + 1):
                mm = lab == j
                if mm.sum() < 40: continue
                tot += 1
                if dist is None: continue
                g = dist[mm].min()
                if g > 2.5:
                    det += 1; worst = max(worst, g)
                    ys, xs = np.nonzero(mm)
                    log.append(f"    frame {f:2d}: island {mm.sum():5d}px at x[{xs.min()},{xs.max()}], {g:.0f}px clear of all existing ink")
        prev = m
    print(f"  {label}: {det} detached of {tot} new-ink islands; largest gap {worst:.0f}px")
    for l in log[:6]: print(l)
    return prev

print("POSITIVE CONTROL — same path, same reveal, two different keys\n")
finalA = islands(keyA, "A  key = NEAREST sample   (lib/implicit-surface.ts:1215)")
print()
finalB = islands(keyB, "B  key = FIRST sample that covers the pixel        ")

# picture: the frame where A first goes wrong, side by side with B
def shot(key, f):
    m = ink & (key <= f / 30.0)
    rgb = np.full((H, W, 3), 255, np.uint8)
    rgb[ink] = [232, 232, 232]
    rgb[m] = [40, 40, 40]
    return Image.fromarray(rgb)

tiles = [(f"A nearest, t={f}/30", shot(keyA, f)) for f in (9, 12, 15)] + \
        [(f"B covering, t={f}/30", shot(keyB, f)) for f in (9, 12, 15)]
w, h = tiles[0][1].size
sheet = Image.new("RGB", (3 * w, 2 * (h + 18)), (255, 255, 255))
d = ImageDraw.Draw(sheet)
for i, (n, im) in enumerate(tiles):
    r, c = divmod(i, 3)
    sheet.paste(im, (c * w, r * (h + 18) + 18))
    d.text((c * w + 4, r * (h + 18) + 4), n, fill=(200, 0, 0))
    d.rectangle([c*w, r*(h+18)+18, c*w+w-1, r*(h+18)+18+h-1], outline=(200,200,200))
sheet = sheet.resize((sheet.width * 2, sheet.height * 2), Image.LANCZOS)
sheet.save("/Users/sebs/Desktop/Projects/free-stroke/docs/research/write-on-references/_frames/nearest-index-control.png")
print("\nwrote _frames/nearest-index-control.png")
