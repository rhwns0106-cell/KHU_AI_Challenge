# 브라우저에서 순환 코스를 만들 수 있게 보행 도로망 + 노드 고도를 hanbakwi/graph.js로 내보낸다.
# 좌표는 data.js와 같은 미터 평면(37.2432N, 127.0818E 기준). 실행: python tools/graph.py  (약 1분)
import json, math, os, time, urllib.request, urllib.parse

S, W, N, E = 37.2222, 127.0558, 37.2642, 127.1078
LA0, LO0 = 37.2432, 127.0818
C = math.cos(math.radians(LA0))
UA = {'User-Agent': 'KHU-orca-running/0.1 (student project)'}
xy = lambda la, lo: ((lo - LO0) * C * 111320, (la - LA0) * 110540)

# 1) OSM 도로·보행로 (build.py와 같은 규칙)
q = f'[out:json][timeout:120];way[highway]({S},{W},{N},{E});out geom;'
req = urllib.request.Request('https://overpass-api.de/api/interpreter', data=urllib.parse.urlencode({'data': q}).encode(), headers=UA)
ways = json.loads(urllib.request.urlopen(req, timeout=300).read())['elements']
BAD = {'motorway', 'motorway_link', 'trunk', 'trunk_link', 'construction', 'elevator', 'busway', 'services', 'proposed', 'raceway'}
MAJOR = {'primary', 'primary_link', 'secondary', 'secondary_link'}
SOFT = {'footway', 'cycleway', 'pedestrian', 'path', 'track'}
TRAIL = {'path', 'track'}

idx, nodes, edges, adj = {}, [], {}, {}
def nid(osm, la, lo):
    if osm not in idx: idx[osm] = len(nodes); nodes.append(xy(la, lo))
    return idx[osm]
for w in ways:
    t = w.get('tags', {}); h = t.get('highway')
    if h in BAD or not w.get('geometry'): continue
    if t.get('access') in ('private', 'no') and h not in ('footway', 'path'): continue
    flag = (1 if h in TRAIL else 0) | (2 if h == 'steps' else 0) | (4 if h in MAJOR else 0) | (8 if h in SOFT else 0)
    g = w['geometry']
    for k in range(len(g) - 1):
        a, b = nid(w['nodes'][k], g[k]['lat'], g[k]['lon']), nid(w['nodes'][k + 1], g[k + 1]['lat'], g[k + 1]['lon'])
        if a == b: continue
        edges[(min(a, b), max(a, b))] = flag
        adj.setdefault(a, set()).add(b); adj.setdefault(b, set()).add(a)

# 가장 큰 연결 덩어리만 남긴다
seen, best = set(), []
for s0 in adj:
    if s0 in seen: continue
    comp, st = [], [s0]; seen.add(s0)
    while st:
        u = st.pop(); comp.append(u)
        for v in adj[u]:
            if v not in seen: seen.add(v); st.append(v)
    if len(comp) > len(best): best = comp
keep = sorted(best); remap = {o: i for i, o in enumerate(keep)}

# 2) 고도: SRTM 30m를 약 100m 격자로 받아 노드마다 보간 (OpenTopoData, 1초에 1회)
lats = [S + i * 0.0009 for i in range(int((N - S) / 0.0009) + 1)]
lons = [W + j * 0.0011 for j in range(int((E - W) / 0.0011) + 1)]
pts = [(a, b) for a in lats for b in lons]; grid = []
for i in range(0, len(pts), 100):
    u = 'https://api.opentopodata.org/v1/srtm30m?locations=' + '|'.join(f'{a:.5f},{b:.5f}' for a, b in pts[i:i + 100])
    for _ in range(6):
        try: grid += [r['elevation'] for r in json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read())['results']]; break
        except Exception as e: print('retry', i, e); time.sleep(3)
    time.sleep(1.1)
nl = len(lons)
def elev(x, y):
    la, lo = LA0 + y / 110540, LO0 + x / (C * 111320)
    fi = min(max((la - S) / 0.0009, 0), len(lats) - 1.001); fj = min(max((lo - W) / 0.0011, 0), nl - 1.001)
    i, j = int(fi), int(fj); a, b = fi - i, fj - j
    g = lambda r, c: grid[r * nl + c]
    return g(i, j) * (1 - a) * (1 - b) + g(i + 1, j) * a * (1 - b) + g(i, j + 1) * (1 - a) * b + g(i + 1, j + 1) * a * b

out = {'nodes': [v for o in keep for v in (round(nodes[o][0]), round(nodes[o][1]))],
       'elev': [round(elev(*nodes[o]) * 10) for o in keep],  # 0.1m 단위
       'edges': [v for (a, b), f in edges.items() if a in remap and b in remap for v in (remap[a], remap[b], f)]}
path = os.path.join(os.path.dirname(__file__), '..', 'hanbakwi', 'graph.js')
with open(path, 'w', encoding='utf-8') as f:
    f.write('// 보행 도로망(OSM) + 노드 고도(SRTM, 0.1m). tools/graph.py로 생성\nwindow.ORCA_GRAPH=' + json.dumps(out, separators=(',', ':')) + ';\n')
print(len(keep), 'nodes', len(out['edges']) // 3, 'edges', os.path.getsize(path) // 1024, 'KB')
