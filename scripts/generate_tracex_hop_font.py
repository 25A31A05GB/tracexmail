"""
TraceX Hop - an original display typeface for TraceXMail.

Concept: a message travelling a route. Every letter is a single-weight line
(the path); free stroke ends get a round "hop node" (a bead slightly larger
than the stroke). Junctions and joins stay clean, so the nodes read as the
start and end of a trace.

Letterforms are defined as skeleton strokes (lines and elliptical arcs),
expanded to outlines here. Lowercase letters are true small capitals.
"""
import math
import os
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import flagOverlapSimple

UPM = 1000
T = 64           # stroke weight
H = T / 2
R = 54           # hop node radius
SB = 78          # side bearing (from skeleton edge)
SC = 0.80        # small-cap scale for lowercase


def L(x0, y0, x1, y1): return ('L', (x0, y0, x1, y1))
def A(cx, cy, rx, ry, a0, a1): return ('A', (cx, cy, rx, ry, a0, a1))
def D(x, y, r=58): return ('D', (x, y, r))


# ---------------------------------------------------------------- glyph data
G = {}
G['A'] = ([L(0,0,250,700), L(250,700,500,0), L(89,250,411,250)], 500)
G['B'] = ([L(0,0,0,700), L(0,700,190,700), A(190,525,175,175,90,-90),
           L(0,350,210,350), A(210,175,175,175,90,-90), L(210,0,0,0)], 385)
G['C'] = ([A(250,350,250,350,35,325)], 500)
G['D'] = ([L(0,0,0,700), L(0,700,170,700), A(170,350,270,350,90,-90), L(170,0,0,0)], 440)
G['E'] = ([L(0,0,0,700), L(0,700,380,700), L(0,350,320,350), L(0,0,380,0)], 380)
G['F'] = ([L(0,0,0,700), L(0,700,380,700), L(0,350,310,350)], 380)
G['G'] = ([A(250,350,250,350,40,360), L(500,350,280,350)], 500)
G['H'] = ([L(0,0,0,700), L(440,0,440,700), L(0,350,440,350)], 440)
G['I'] = ([L(0,700,220,700), L(110,700,110,0), L(0,0,220,0)], 220)
G['J'] = ([L(100,700,260,700), L(260,700,260,130), A(130,130,130,130,0,-180)], 260)
G['K'] = ([L(0,0,0,700), L(0,230,420,700), L(190,443,420,0)], 420)
G['L'] = ([L(0,700,0,0), L(0,0,360,0)], 360)
G['M'] = ([L(0,0,0,700), L(0,700,280,260), L(280,260,560,700), L(560,700,560,0)], 560)
G['N'] = ([L(0,0,0,700), L(0,700,460,0), L(460,0,460,700)], 460)
G['O'] = ([A(260,350,260,350,0,360)], 520)
G['P'] = ([L(0,0,0,700), L(0,700,190,700), A(190,525,175,175,90,-90), L(190,350,0,350)], 365)
G['Q'] = ([A(260,350,260,350,0,360), L(390,47,540,-70)], 520)
G['R'] = ([L(0,0,0,700), L(0,700,190,700), A(190,525,175,175,90,-90),
           L(190,350,0,350), L(150,350,400,0)], 400)
G['S'] = ([A(200,525,175,175,20,270), A(200,175,175,175,90,-160)], 400)
G['T'] = ([L(0,700,440,700), L(220,700,220,0)], 440)
G['U'] = ([L(0,700,0,220), A(220,220,220,220,180,360), L(440,220,440,700)], 440)
G['V'] = ([L(0,700,240,0), L(240,0,480,700)], 480)
G['W'] = ([L(0,700,160,0), L(160,0,360,500), L(360,500,560,0), L(560,0,720,700)], 720)
G['X'] = ([L(0,0,460,700), L(0,700,460,0)], 460)
G['Y'] = ([L(0,700,230,360), L(460,700,230,360), L(230,360,230,0)], 460)
G['Z'] = ([L(0,700,420,700), L(420,700,0,0), L(0,0,420,0)], 420)

G['0'] = ([A(220,350,220,350,0,360), L(105,150,335,550)], 440)
G['1'] = ([L(30,540,200,700), L(200,700,200,0), L(40,0,360,0)], 360)
G['2'] = ([A(210,490,210,210,165,-35), L(382,370,0,0), L(0,0,420,0)], 420)
G['3'] = ([A(200,525,175,175,150,-90), A(200,175,175,175,90,-150)], 400)
G['4'] = ([L(330,0,330,700), L(330,700,0,230), L(0,230,460,230)], 460)
G['5'] = ([L(380,700,70,700), L(70,700,70,415), A(195,235,195,235,130,-140)], 400)
G['6'] = ([A(220,230,220,230,0,360), L(360,700,2,262)], 440)
G['7'] = ([L(0,700,420,700), L(420,700,130,0)], 420)
G['8'] = ([A(210,525,185,175,0,360), A(210,175,210,175,0,360)], 420)
G['9'] = ([A(220,470,220,230,0,360), L(80,0,438,438)], 440)

P = {}
P['.'] = ([D(30,0)], 60)
P[','] = ([D(30,0), L(30,0,0,-150)], 60)
P[':'] = ([D(30,0), D(30,420)], 60)
P[';'] = ([D(30,420), D(30,0), L(30,0,0,-150)], 60)
P['!'] = ([L(10,700,10,230), D(10,0)], 20)
P['?'] = ([A(200,520,180,180,160,-90), L(200,340,200,230), D(200,0)], 380)
P['-'] = ([L(0,300,260,300)], 260)
P['_'] = ([L(0,-90,460,-90)], 460)
P['+'] = ([L(150,180,150,520), L(0,350,300,350)], 300)
P['='] = ([L(0,260,300,260), L(0,440,300,440)], 300)
P['/'] = ([L(0,0,300,700)], 300)
P['\\'] = ([L(0,700,300,0)], 300)
P['('] = ([A(260,300,260,520,120,240)], 260)
P[')'] = ([A(0,300,260,520,60,-60)], 260)
P['#'] = ([L(120,0,180,700), L(300,0,360,700), L(20,240,440,240), L(20,470,440,470)], 440)
P['%'] = ([A(100,580,100,100,0,360), A(400,120,100,100,0,360), L(470,700,30,0)], 500)
P['@'] = ([A(260,300,300,300,25,335), A(260,300,105,105,0,360), L(365,400,365,210)], 520)
P["'"] = ([L(10,700,10,500)], 20)
P['"'] = ([L(10,700,10,500), L(130,700,130,500)], 140)
P['\u2192'] = ([L(0,350,440,350), L(440,350,300,490), L(440,350,300,210)], 440)
P['|'] = ([L(10,760,10,-160)], 20)
P['['] = ([L(130,740,0,740), L(0,740,0,-140), L(0,-140,130,-140)], 130)
P[']'] = ([L(0,740,130,740), L(130,740,130,-140), L(130,-140,0,-140)], 130)
P['<'] = ([L(300,520,0,350), L(0,350,300,180)], 300)
P['>'] = ([L(0,520,300,350), L(300,350,0,180)], 300)
P['*'] = ([L(150,500,150,200), L(20,425,280,275), L(20,275,280,425)], 300)
P['\u2013'] = ([L(0,300,360,300)], 360)
P['\u2014'] = ([L(0,300,640,300)], 640)
P['\u2026'] = ([D(30,0), D(190,0), D(350,0)], 380)


# ----------------------------------------------------------------- geometry
def sample(stroke, k):
    kind, p = stroke
    if kind == 'L':
        x0, y0, x1, y1 = p
        return [(x0 * k, y0 * k), (x1 * k, y1 * k)], False
    cx, cy, rx, ry, a0, a1 = p
    n = max(10, int(abs(a1 - a0) / 3))
    pts = []
    for i in range(n + 1):
        t = math.radians(a0 + (a1 - a0) * i / n)
        pts.append(((cx + rx * math.cos(t)) * k, (cy + ry * math.sin(t)) * k))
    closed = abs(abs(a1 - a0) - 360) < 0.01
    return pts, closed


def area(poly):
    s = 0.0
    for i in range(len(poly)):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % len(poly)]
        s += x0 * y1 - x1 * y0
    return s / 2


def clockwise(poly):
    return poly if area(poly) < 0 else poly[::-1]


def counter(poly):
    return poly if area(poly) > 0 else poly[::-1]


def circle(x, y, r, n=44):
    return clockwise([(x + r * math.cos(2 * math.pi * i / n),
                       y + r * math.sin(2 * math.pi * i / n)) for i in range(n)])


def offsets(pts, closed):
    P_ = pts[:-1] if closed else pts
    m = len(P_)
    left, right = [], []
    for i in range(m):
        if closed:
            a, b = P_[(i - 1) % m], P_[(i + 1) % m]
        else:
            a = P_[i - 1] if i > 0 else P_[i]
            b = P_[i + 1] if i < m - 1 else P_[i]
        tx, ty = b[0] - a[0], b[1] - a[1]
        d = math.hypot(tx, ty) or 1
        nx, ny = -ty / d, tx / d
        left.append((P_[i][0] + nx * H, P_[i][1] + ny * H))
        right.append((P_[i][0] - nx * H, P_[i][1] - ny * H))
    return left, right


def seg_dist(p, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0 if L2 == 0 else max(0, min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L2))
    return math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))


def poly_dist(p, pts):
    return min(seg_dist(p, pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def build(strokes, k=1.0, xoff=SB):
    polys = []
    geo = []       # (index, pts, closed)
    for i, s in enumerate(strokes):
        if s[0] == 'D':
            x, y, r = s[1]
            polys.append(circle(x * k, y * k, r))
            continue
        pts, closed = sample(s, k)
        geo.append((i, pts, closed))
        left, right = offsets(pts, closed)
        if closed:
            a, b = left, right
            outer, inner = (a, b) if abs(area(a)) > abs(area(b)) else (b, a)
            polys.append(clockwise(outer))
            polys.append(counter(inner))
        else:
            polys.append(clockwise(left + right[::-1]))
            polys.append(circle(pts[0][0], pts[0][1], H))
            polys.append(circle(pts[-1][0], pts[-1][1], H))
    # hop nodes at free terminals only
    for i, pts, closed in geo:
        if closed:
            continue
        for e in (pts[0], pts[-1]):
            shared = False
            for j, pts2, closed2 in geo:
                if j == i:
                    continue
                if not closed2 and (math.hypot(e[0]-pts2[0][0], e[1]-pts2[0][1]) < 3 or
                                    math.hypot(e[0]-pts2[-1][0], e[1]-pts2[-1][1]) < 3):
                    shared = True
                    break
                if poly_dist(e, pts2) < 3:
                    shared = True
                    break
            if not shared:
                polys.append(circle(e[0], e[1], R))
    return [[(x + xoff, y) for x, y in poly] for poly in polys]


def to_glyph(polys):
    pen = TTGlyphPen(None)
    for poly in polys:
        pts, last = [], None
        for x, y in poly:
            q = (round(x), round(y))
            if q != last:
                pts.append(q)
                last = q
        if len(pts) < 3:
            continue
        pen.moveTo(pts[0])
        for q in pts[1:]:
            pen.lineTo(q)
        pen.closePath()
    g = pen.glyph()
    if len(g.coordinates):
        g.flags[0] |= flagOverlapSimple
    return g


def min_x(polys):
    xs = [round(x) for poly in polys for x, _ in poly]
    return min(xs) if xs else 0


def notdef():
    outer = [(60, 0), (60, 700), (440, 700), (440, 0)]
    inner = [(120, 60), (380, 60), (380, 640), (120, 640)]
    return [clockwise(outer), counter(inner)]


# -------------------------------------------------------------------- assemble
glyphs, metrics, cmap, order = {}, {}, {}, ['.notdef', 'space']

nd = notdef()
glyphs['.notdef'] = to_glyph(nd)
metrics['.notdef'] = (500, min_x(nd))
glyphs['space'] = TTGlyphPen(None).glyph()
metrics['space'] = (260, 0)
cmap[32] = 'space'
cmap[0xA0] = 'space'


def add(name, code, strokes, w, k):
    polys = build(strokes, k)
    glyphs[name] = to_glyph(polys)
    metrics[name] = (round(w * k + 2 * SB), min_x(polys))
    order.append(name)
    cmap[code] = name


for ch, (st, w) in G.items():
    if ch.isalpha():
        add(ch, ord(ch), st, w, 1.0)
        add(ch.lower() + '.sc', ord(ch.lower()), st, w, SC)
    else:
        add('digit' + ch, ord(ch), st, w, 1.0)
for ch, (st, w) in P.items():
    nm = 'uni%04X' % ord(ch)
    add(nm, ord(ch), st, w, 1.0)

# typographic quote aliases (same glyphs as the straight quotes)
cmap[0x2018] = cmap[0x2019] = cmap[ord("'")]
cmap[0x201C] = cmap[0x201D] = cmap[ord('"')]

fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=800, descent=-200)
fb.setupNameTable({
    'familyName': 'TraceX Hop',
    'styleName': 'Regular',
    'uniqueFontIdentifier': 'TraceXMail:TraceX Hop Regular:1.000',
    'fullName': 'TraceX Hop Regular',
    'psName': 'TraceXHop-Regular',
    'version': 'Version 1.000',
    'copyright': 'Copyright (c) 2026 TraceXMail. All rights reserved.',
})
fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, sTypoLineGap=0,
            usWinAscent=950, usWinDescent=300, sxHeight=560, sCapHeight=700,
            achVendID='TXML', fsType=0)
fb.setupPost()

os.makedirs('public/fonts', exist_ok=True)
out_ttf = 'public/fonts/TraceXHop-Regular.ttf'
out_woff = 'public/fonts/TraceXHop-Regular.woff'
out_woff2 = 'public/fonts/TraceXHop-Regular.woff2'

fb.save(out_ttf)

f = TTFont(out_ttf)
f.flavor = 'woff'
f.save(out_woff)

try:
    f2 = TTFont(out_ttf)
    f2.flavor = 'woff2'
    f2.save(out_woff2)
except Exception as e:
    print(f"woff2 generation note: {e}")

print('Generated TraceX Hop font files successfully:')
print(' -', out_ttf, f"({os.path.getsize(out_ttf)} bytes)")
print(' -', out_woff, f"({os.path.getsize(out_woff)} bytes)")
if os.path.exists(out_woff2):
    print(' -', out_woff2, f"({os.path.getsize(out_woff2)} bytes)")
print('glyphs:', len(order), 'cmap entries:', len(cmap))
