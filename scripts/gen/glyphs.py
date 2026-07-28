"""Generates the 5x5 glyph bit tables used by lib/ascii-shader.ts.

Each glyph is a 5x5 pixel bitmap. Bit index = x + 5*y (y=0 is the TOP row),
matching the convention used by the Codrops ASCII shader article (verified:
our '0' encodes to 15255086, the same value that article lists).

The 25-bit value is split into lo (13 bits) / hi (12 bits) because GLSL highp
floats only hold integers exactly up to 2^24 -- a full block glyph is 2^25-1
and would lose precision as a single float.
"""

def bits(rows):
    n = 0
    for y, row in enumerate(rows):
        assert len(row) == 5, row
        for x, ch in enumerate(row):
            if ch == "1":
                n |= 1 << (x + 5 * y)
    return n

G = {}
def g(name, *rows):
    G[name] = bits(rows)

g("space", "00000","00000","00000","00000","00000")
g("dot",   "00000","00000","00000","00000","00100")
g("colon", "00000","00100","00000","00100","00000")
g("dash",  "00000","00000","01110","00000","00000")
g("equal", "00000","01110","00000","01110","00000")
g("plus",  "00000","00100","01110","00100","00000")
g("star",  "00000","10101","01110","10101","00000")
g("hash",  "01010","11111","01010","11111","01010")
g("pct",   "11001","11010","00100","01011","10011")
g("at",    "01110","10011","10101","10010","01110")

g("shade1","10101","00000","10101","00000","10101")
g("shade2","10101","01010","10101","01010","10101")
g("shade3","11111","10101","11111","10101","11111")
g("block", "11111","11111","11111","11111","11111")

g("zero",  "01110","10001","10001","10001","01110")
g("one",   "00100","01100","00100","00100","01110")

g("d1","00000","00000","00100","00000","00000")
g("d2","00000","01000","00000","00010","00000")
g("d3","00100","00000","10001","00000","00100")
g("d4","10001","00000","00100","00000","10001")
g("d5","10101","00000","01010","00000","10101")

g("slash","00001","00010","00100","01000","10000")
g("lt",   "00010","00100","01000","00100","00010")
g("gt",   "01000","00100","00010","00100","01000")
g("lbr",  "01110","01000","01000","01000","01110")
g("lbrc", "00110","00100","01000","00100","00110")

# --- craft-pass additions (indices 26+; existing indices above are FROZEN) ---

# braille-ish: a 2x3 dot cell (cols 1,3 x rows 0,2,4), dots accumulate.
g("b1","00000","00000","01000","00000","00000")
g("b2","01000","00000","01000","00000","00000")
g("b3","01000","00000","01000","00000","01000")
g("b4","01010","00000","01000","00000","01010")
g("b5","01010","00000","01010","00000","01010")
g("b6","01010","01010","01010","01010","01010")

# box-drawing: line weights build from a single stem to a full framed cross.
g("vline",     "00100","00100","00100","00100","00100")
g("cross",     "00100","00100","11111","00100","00100")
g("lattice",   "01010","11111","01010","11111","01010")
g("frame",     "11111","10001","10001","10001","11111")
g("framecross","11111","10101","11111","10101","11111")

# arrows / slashes: directional marks with growing ink.
g("caret",  "00100","01010","10001","00000","00000")
g("bslash", "10000","01000","00100","00010","00001")
g("diagx",  "10001","01010","00100","01010","10001")
g("arrowup","00100","01110","10101","00100","00100")
g("tri",    "00000","00100","01110","11111","00000")

# punctuation: the dense-typography ramp.
g("apos",  "00100","00100","00000","00000","00000")
g("quote", "01010","01010","00000","00000","00000")
g("semi",  "00000","00100","00000","00100","01000")
g("excl",  "00100","00100","00100","00000","00100")
g("quest", "01110","10001","00110","00000","00100")
g("amp",   "01000","10100","01000","10101","01010")
g("dollar","01111","10100","01110","00101","11110")

# numerals (5x5 digit font), ordered by ink coverage in the ramp below.
g("seven","11111","00001","00010","00100","00100")
g("two",  "01110","10001","00110","01000","11111")
g("three","11110","00001","00110","00001","11110")
g("four", "10010","10010","11111","00010","00010")
g("five", "11111","10000","11110","00001","11110")
g("six",  "01110","10000","11110","10001","01110")
g("nine", "01110","10001","01111","00001","01110")
g("eight","01110","10001","01110","10001","01110")

# Ramps: sparse -> dense. Brightness selects the index, so highlights get
# dense glyphs and shadows get sparse ones.
# ORDER MATTERS: the first five ramps assign indices 0..25 and must never be
# reordered — the GLSL table indices are public. New ramps go at the end.
RAMPS = {
    "classic": ["space","dot","colon","dash","equal","plus","star","hash","pct","at"],
    "blocks":  ["space","shade1","shade2","shade3","block"],
    "minimal": ["space","one","zero"],
    "dots":    ["space","d1","d2","d3","d4","d5"],
    "custom":  ["space","dot","slash","gt","lt","lbrc","lbr"],
    "braille": ["space","b1","b2","b3","b4","b5","b6"],
    "boxes":   ["space","vline","cross","lattice","frame","framecross"],
    "arrows":  ["space","caret","slash","bslash","diagx","arrowup","tri"],
    "punct":   ["space","apos","quote","semi","excl","quest","amp","dollar"],
    "numeric": ["space","one","seven","three","four","two","six","nine","five","eight"],
}

order, index = [], {}
for r in RAMPS.values():
    for name in r:
        if name not in index:
            index[name] = len(order)
            order.append(name)

print("// AUTO-GENERATED by scripts/gen/glyphs.py -- do not hand-edit.")
print("// 5x5 glyph bitmaps as (lo 13 bits, hi 12 bits) float pairs.")
print("const GLYPH_GLSL_TABLE = `")
print("vec2 fsGlyphBits(int idx) {")
for name in order:
    n = G[name]
    lo, hi = n % 8192, n // 8192
    print(f"  if (idx == {index[name]}) return vec2({lo}.0, {hi}.0); // {name}")
print("  return vec2(0.0, 0.0);")
print("}")
print("")
print("// charset ramp lookup: (charset, level) -> global glyph index")
print("int fsRampIndex(int charset, int level) {")
for ci, (cname, ramp) in enumerate(RAMPS.items()):
    print(f"  if (charset == {ci}) {{ // {cname}")
    for li, name in enumerate(ramp):
        print(f"    if (level <= {li}) return {index[name]};")
    print(f"    return {index[ramp[-1]]};")
    print("  }")
print("  return 0;")
print("}")
print("`")
print("")
print("// ramp lengths, in charset order")
for ci, (cname, ramp) in enumerate(RAMPS.items()):
    print(f"//   {ci} {cname}: {len(ramp)}")
