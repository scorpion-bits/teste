"""Scorpion Bits ident: geometry pre-pass.

Reads the official mark (brand/logo-mark.png, unmodified) and derives everything the
animation needs to *build* it:

  * the line art: the centreline of the mark's own dark outline, as a graph of points
  * the isometric lattice the system grows on, and the cubes of it that fall inside the mark
    (the "blockout")
  * a one-to-one assignment of lattice nodes to line-art points (the morph)
  * a wave-distance field: how far each pixel is from the first point, measured *through* the
    mark and along the tail chain (body -> legs -> tail bits -> stinger)

Output: geometry.js (positions, graph, assignment) and data.png (per-pixel wave distance and
region labels). Run once; both are committed.

    pip install pillow numpy scipy scikit-image skan
    python3 geometry.py            # add --debug to write debug images to .work/
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.optimize import linear_sum_assignment
from skimage.graph import MCP_Geometric
from skimage.morphology import skeletonize
from skan import Skeleton

DIR = Path(__file__).parent
DEBUG = '--debug' in sys.argv
WORK = DIR / '.work'
WORK.mkdir(exist_ok=True)

img = np.array(Image.open(DIR / 'brand/logo-mark.png').convert('RGBA')).astype(np.float64)
H, W = img.shape[:2]
alpha = img[..., 3] / 255
rgb = img[..., :3]

# ── key points of the mark (pixel coordinates of logo-mark.png, 437x535)
O = (218.0, 289.0)          # the body cube's front vertex, where its three faces meet: the first point
TAIL = [                     # tail bits from the body outwards, then the stinger
    (112.0, 176.0), (66.0, 116.0), (110.0, 70.0), (178.0, 44.0), (226.0, 96.0),
]
STINGER = (274.0, 148.0)

# ── 1. line art: the mark's own outline colour, minus the darkest shading of the body's right face
OUTLINE_RGB = np.array([15, 37, 56])
outline = (alpha > 0.5) & (np.sqrt(((rgb - OUTLINE_RGB) ** 2).sum(-1)) < 14)
face = Image.new('L', (W, H), 0)
ImageDraw.Draw(face).polygon([(218, 289), (346, 220), (346, 364), (254, 397), (218, 376)], fill=255)
face = ndimage.binary_erosion(np.array(face) > 0, iterations=6)
outline &= ~face
outline = ndimage.binary_closing(outline, iterations=1)
skel = skeletonize(outline)


def prune(sk, min_len=7, rounds=3):
    sk = sk.copy()
    for _ in range(rounds):
        s = Skeleton(sk)
        bt = s.paths_list()
        deg = s.degrees
        removed = False
        for k, path in enumerate(bt):
            ends = [deg[path[0]], deg[path[-1]]]
            if 1 in ends and 3 <= max(ends) and len(path) < min_len:
                for node in path:
                    if deg[node] <= 2:
                        y, x = s.coordinates[node].astype(int)
                        sk[y, x] = False
                        removed = True
        if not removed:
            break
        sk = skeletonize(sk)
    return sk


skel = prune(skel)
S = Skeleton(skel)
paths = [S.coordinates[p][:, ::-1].astype(float) for p in S.paths_list()]  # (x, y)


# resample every branch at ~STEP px, sharing junction points
STEP = 7.0
pts, key_of = [], {}


def pid(p):
    k = (round(p[0]), round(p[1]))
    for dk in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)]:
        kk = (k[0] + dk[0], k[1] + dk[1])
        if kk in key_of:
            return key_of[kk]
    key_of[k] = len(pts)
    pts.append([float(p[0]), float(p[1])])
    return key_of[k]


edgesB = set()
for path in paths:
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(path, axis=0).T))]
    L = d[-1]
    if L < 2:
        continue
    n = max(1, int(round(L / STEP)))
    ids = []
    for k in range(n + 1):
        s = L * k / n
        i = min(np.searchsorted(d, s), len(path) - 1)
        if i == 0:
            p = path[0]
        else:
            f = (s - d[i - 1]) / max(1e-9, d[i] - d[i - 1])
            p = path[i - 1] + (path[i] - path[i - 1]) * f
        ids.append(pid(p))
    for a, b in zip(ids, ids[1:]):
        if a != b:
            edgesB.add((min(a, b), max(a, b)))
skel_pts = np.array(pts)
edgesB = sorted(edgesB)

# ── 2. wave distance: geodesic from O through the mark (g0). The tail chain and the stinger use a
#    second geodesic (g1) in which the stinger and the last bits are cut off from the body, so the wave
#    climbs the tail bit by bit and reaches the stinger last.
walk = alpha > 0.35


def geodesic(mask):
    cost = np.where(mask, 1.0, np.inf)
    g, _ = MCP_Geometric(cost).find_costs([(int(O[1]), int(O[0]))])
    g[~np.isfinite(g)] = 0
    out = np.where(alpha > 0.02, g, 0)
    # antialiased rim pixels outside the walk mask take the nearest walkable value
    missing = (alpha > 0.02) & ~mask
    if missing.any():
        idx = ndimage.distance_transform_edt(~mask, return_distances=False, return_indices=True)
        out[missing] = g[idx[0][missing], idx[1][missing]]
    return out


g0 = geodesic(walk)
barrier = Image.new('L', (W, H), 0)
ImageDraw.Draw(barrier).line([(184, 146), (224, 155), (356, 231)], fill=255, width=5)
g1 = geodesic(walk & ~(np.array(barrier) > 0))

# region labels: 0 none, 1 body + legs, 2..6 tail bits, 7 stinger
region = np.zeros((H, W), np.uint8)
region[alpha > 0.02] = 1
yy, xx = np.mgrid[0:H, 0:W]
centers = TAIL + [STINGER]
dist = np.stack([np.hypot(xx - cx, yy - cy) for cx, cy in centers])
near = dist.argmin(0)
for k in range(5):
    sel = (alpha > 0.02) & (near == k) & (dist[k] < 40) & (g1 > 2)
    region[sel] = 2 + k
hook = Image.new('L', (W, H), 0)
ImageDraw.Draw(hook).polygon([(296, 152), (336, 160), (332, 178), (298, 182)], fill=255)
sting = (alpha > 0.02) & ((dist[5] < 41) | (np.array(hook) > 0))
region[sting] = 7
# g1 everywhere, except the body's own edge right under the cut, which belongs to the body
near_cut = ndimage.distance_transform_edt(~(np.array(barrier) > 0)) < 9
geo_alpha = np.where(near_cut & (region == 1), g0, g1)
GMAX = float(geo_alpha.max())


_inmask = alpha > 0.02
_nearest = ndimage.distance_transform_edt(~_inmask, return_distances=False, return_indices=True)


def geo_at(x, y):
    """wave distance at (x, y); outside the mark, that of the nearest pixel of the mark"""
    x = int(round(min(max(x, 0), W - 1)))
    y = int(round(min(max(y, 0), H - 1)))
    return float(geo_alpha[_nearest[0][y, x], _nearest[1][y, x]])


# ── 3. the lattice: true isometric (30°), the geometry of the studio's cube, rooted at O
U = 15.0
c30, s30 = math.cos(math.pi / 6), 0.5
e1 = np.array([c30, -s30]) * U   # up-right
e2 = np.array([-c30, -s30]) * U  # up-left


def lat(i, j):
    return np.array(O) + i * e1 + j * e2


cov_mask = alpha > 0.5


def hex_cover(cx, cy):
    poly = [(cx + U * math.cos(math.pi / 6 + k * math.pi / 3), cy + U * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]
    # hexagon of a cube centred on a colour-0 node: its six neighbours
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    m = np.array(m) > 0
    n = m.sum()
    return (cov_mask & m).sum() / max(1, n)


R = 40
cubes = {}
for i in range(-R, R + 1):
    for j in range(-R, R + 1):
        if (i + j) % 3:
            continue
        p = lat(i, j)
        if not (-U < p[0] < W + U and -U < p[1] < H + U):
            continue
        cv = hex_cover(*p)
        if cv >= 0.5:
            cubes[(i, j)] = cv

# neighbours (shared rim edge) between cube centres
CN = [(1, -1), (-1, 1), (2, 1), (1, 2), (-1, -2), (-2, -1)]
# keep only cubes connected to the origin cube
seen, order, frontier = {(0, 0): 0}, [], [(0, 0)]
assert (0, 0) in cubes, 'origin cube must be inside the mark'
while frontier:
    nxt = []
    for c in frontier:
        order.append(c)
        for d in CN:
            n = (c[0] + d[0], c[1] + d[1])
            if n in cubes and n not in seen:
                seen[n] = seen[c] + 1
                nxt.append(n)
    frontier = nxt

# hexagon of cube (i, j): its six lattice neighbours, ordered by angle → up-left, top, up-right,
# low-right, down, low-left (screen y points down)
HEX = [(1, 0), (1, 1), (0, 1), (-1, 0), (-1, -1), (0, -1)]


def rim(c):
    vs = [(c[0] + a, c[1] + b) for a, b in HEX]
    ang = [math.atan2(*(lat(*v) - lat(*c))[::-1]) for v in vs]
    return [v for _, v in sorted(zip(ang, vs))]


node_id, nodes = {}, []


def nid(v, depth):
    if v not in node_id:
        node_id[v] = len(nodes)
        p = lat(*v)
        nodes.append({'v': v, 'x': float(p[0]), 'y': float(p[1]), 'depth': depth})
    return node_id[v]


def color(v):
    """sub-lattice of a node: 0 = cube centre (the Y's junction), 1 = Y tips, 2 = the other rim corners"""
    return (v[0] + v[1]) % 3


cube_list = []
for c in order:
    ci = nid(c, seen[c])
    rids = [nid(v, seen[c]) for v in rim(c)]
    cube_list.append({'c': ci, 'rim': rids, 'g': geo_at(*lat(*c))})

# drawn edges: all 1–2 rim edges and 0–1 Y edges, between existing nodes, deduplicated
edgesA = set()
for cb in cube_list:
    ci, rids = cb['c'], cb['rim']
    for k in range(6):
        a, b = rids[k], rids[(k + 1) % 6]
        edgesA.add((min(a, b), max(a, b)))
        if color(nodes[a]['v']) == 1:
            edgesA.add((min(ci, a), max(ci, a)))
edgesA = sorted(edgesA)

# ── 4. assignment: lattice node -> line-art point, minimising squared travel
L = np.array([[n['x'], n['y']] for n in nodes])
nL, nS = len(L), len(skel_pts)
C = ((L[:, None, :] - skel_pts[None, :, :]) ** 2).sum(-1)
ri, ci_ = linear_sum_assignment(C)
target = -np.ones(nL, int)
target[ri] = ci_
src_of = -np.ones(nS, int)
src_of[ci_] = ri
# unmatched lattice nodes merge into their nearest line-art point
for i in np.where(target < 0)[0]:
    target[i] = int(C[i].argmin())
# unmatched line-art points split off the node that took their nearest matched neighbour
extra = []
for s in np.where(src_of < 0)[0]:
    d = ((skel_pts - skel_pts[s]) ** 2).sum(-1)
    d[src_of < 0] = np.inf
    nb = int(d.argmin())
    extra.append({'s': int(s), 'from': int(src_of[nb])})

# final node table: lattice nodes, then split-off extras. Each has a line-art target.
out_nodes = []
for i, n in enumerate(nodes):
    t = skel_pts[target[i]]
    out_nodes.append([round(n['x'], 2), round(n['y'], 2), round(geo_at(n['x'], n['y']), 1),
                      round(float(t[0]), 2), round(float(t[1]), 2), round(geo_at(*t), 1), 1 if src_of[target[i]] == i else 0])
skel_node = {int(target[i]): i for i in range(nL) if src_of[target[i]] == i}
for e in extra:
    src = e['from']
    t = skel_pts[e['s']]
    skel_node[e['s']] = len(out_nodes)
    n = nodes[src]
    out_nodes.append([round(n['x'], 2), round(n['y'], 2), round(geo_at(n['x'], n['y']), 1),
                      round(float(t[0]), 2), round(float(t[1]), 2), round(geo_at(*t), 1), 2])
edgesB_n = [[skel_node[a], skel_node[b]] for a, b in edgesB]

tail_g = [round(geo_at(*p), 1) for p in TAIL] + [round(geo_at(*STINGER), 1)]

# ── data texture: R,G = wave distance (16-bit), B = region, A = mark alpha
g16 = np.clip(geo_alpha / GMAX * 65535, 0, 65535).astype(np.uint32)
tex = np.zeros((H, W, 4), np.uint8)
tex[..., 0] = g16 >> 8
tex[..., 1] = g16 & 255
tex[..., 2] = region
tex[..., 3] = 255
Image.fromarray(tex, 'RGBA').save(DIR / 'data.png', optimize=True)

geo_out = {
    'mark': [W, H], 'O': O, 'U': U, 'gmax': round(GMAX, 2),
    'tail': [list(p) for p in TAIL], 'stinger': list(STINGER), 'tailG': tail_g, 'oG': round(geo_at(*O), 1),
    'nodes': out_nodes,           # [x, y, g(here), tx, ty, g(target), kind: 1 matched, 0 merges into a taken point, 2 splits off]
    'cubes': [[cb['c'], *cb['rim'], round(cb['g'], 1)] for cb in cube_list],   # [centre, rim UL, top, UR, LR, down, LL, g]
    'edgesA': [list(e) for e in edgesA],
    'edgesB': edgesB_n,
    'maxDepth': max(seen.values()),
}
js = '// generated by geometry.py from brand/logo-mark.png — do not edit\n'
js += '(function (g) { const GEO = ' + json.dumps(geo_out, separators=(',', ':')) + ';\n'
js += "if (typeof module !== 'undefined') module.exports = GEO; else g.GEO = GEO; })(this);\n"
(DIR / 'geometry.js').write_text(js)

depth_counts = np.bincount([n['depth'] for n in nodes])
print(f'line art: {nS} points, {len(edgesB)} edges · lattice: {len(cube_list)} cubes, {nL} nodes, {len(edgesA)} edges, '
      f'max depth {geo_out["maxDepth"]} · extras {len(extra)} · gmax {GMAX:.0f} · tail g {tail_g} · O g {geo_out["oG"]}')
print('nodes per depth:', list(depth_counts))

if DEBUG:
    sc = 2
    im = Image.new('RGB', (W * sc, H * sc), (5, 9, 15))
    base = Image.open(DIR / 'brand/logo-mark.png').convert('RGBA').resize((W * sc, H * sc))
    dim = Image.new('RGBA', base.size, (0, 0, 0, 0))
    im.paste(Image.blend(Image.new('RGBA', base.size, (5, 9, 15, 255)), Image.alpha_composite(Image.new('RGBA', base.size, (5, 9, 15, 255)), base), 0.35))
    d = ImageDraw.Draw(im)
    for a, b in edgesB:
        d.line([tuple(skel_pts[a] * sc), tuple(skel_pts[b] * sc)], fill=(255, 255, 255), width=2)
    for p in skel_pts:
        d.ellipse([p[0] * sc - 2, p[1] * sc - 2, p[0] * sc + 2, p[1] * sc + 2], fill=(255, 200, 80))
    im.save(WORK / 'debug_lineart.png')

    im = Image.new('RGB', (W * sc, H * sc), (5, 9, 15))
    im.paste(Image.blend(Image.new('RGBA', base.size, (5, 9, 15, 255)), Image.alpha_composite(Image.new('RGBA', base.size, (5, 9, 15, 255)), base), 0.3))
    d = ImageDraw.Draw(im)
    md = geo_out['maxDepth']
    for a, b in edgesA:
        dp = max(nodes[a]['depth'], nodes[b]['depth']) / md
        col = (int(100 + 155 * (1 - dp)), int(200), 255)
        d.line([(L[a][0] * sc, L[a][1] * sc), (L[b][0] * sc, L[b][1] * sc)], fill=col, width=2)
    d.ellipse([O[0] * sc - 5, O[1] * sc - 5, O[0] * sc + 5, O[1] * sc + 5], fill=(255, 80, 80))
    im.save(WORK / 'debug_lattice.png')

    g = (geo_alpha / GMAX * 255).astype(np.uint8)
    rc = np.array([[0, 0, 0], [60, 60, 60], [255, 80, 80], [255, 160, 60], [255, 230, 60], [80, 255, 120], [60, 160, 255], [200, 100, 255]], np.uint8)
    vis = np.concatenate([np.stack([g, g, g], -1), rc[region]], 1)
    Image.fromarray(vis).save(WORK / 'debug_wave.png')
    # assignment travel
    im = Image.new('RGB', (W * sc, H * sc), (5, 9, 15))
    d = ImageDraw.Draw(im)
    for n in out_nodes:
        d.line([(n[0] * sc, n[1] * sc), (n[3] * sc, n[4] * sc)], fill=(90, 160, 255) if n[6] == 1 else (255, 120, 60), width=1)
    im.save(WORK / 'debug_assign.png')
    print('debug images in', WORK)
