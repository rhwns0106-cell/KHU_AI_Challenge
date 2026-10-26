# 브라우저에서 코스를 만들 수 있게 보행 도로망 + 노드 고도를 hanbakwi/graph.js로 내보낸다.
# 좌표는 data.js와 같은 미터 평면(37.2432N, 127.0818E 기준). 실행: python tools/graph.py
# (첫 실행은 고도를 받느라 몇 분 걸리고, 받은 고도는 tools/elev_cache.json에 남겨 다음엔 바로 끝난다)
import json, math, os, time, urllib.request, urllib.parse

S, W, N, E = 37.1982, 127.0253, 37.2882, 127.1383  # 국제캠 반경 약 5km(카카오 검색 반경과 같게)
LA0, LO0 = 37.2432, 127.0818
C = math.cos(math.radians(LA0))
UA = {'User-Agent': 'KHU-orca-running/0.1 (student project)'}
HERE = os.path.dirname(__file__)
xy = lambda la, lo: ((lo - LO0) * C * 111320, (la - LA0) * 110540)

def overpass(q):
    # 서버가 바쁘면 502·504가 난다: 예비 서버를 번갈아 몇 번 다시 시도
    for k in range(6):
        url = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'][k % 2]
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': q}).encode(), headers=UA)
            return json.loads(urllib.request.urlopen(req, timeout=300).read())['elements']
        except Exception as e:
            print('overpass retry', k, url, e, flush=True); time.sleep(10)
    raise SystemExit('Overpass 서버에 연결하지 못했어요')

# 1) OSM 도로·보행로 + 숲·덤불 영역
ways = overpass(f'[out:json][timeout:180];way[highway]({S},{W},{N},{E});out geom;')
forest_els = overpass(f'[out:json][timeout:180];(way[natural~"^(wood|scrub)$"]({S},{W},{N},{E});way[landuse=forest]({S},{W},{N},{E});'
                      f'relation[natural~"^(wood|scrub)$"]({S},{W},{N},{E});relation[landuse=forest]({S},{W},{N},{E}););out geom;')
# 신호등 노드(차량 신호·신호 있는 건널목): 코스가 이 노드를 지나는 간선에 표시한다
sig_nodes = {e['id'] for e in overpass(f'[out:json][timeout:120];(node[highway=traffic_signals]({S},{W},{N},{E});node[crossing=traffic_signals]({S},{W},{N},{E});node["crossing:signals"=yes]({S},{W},{N},{E}););out ids;')}
rings = []
for e in forest_els:
    geoms = [e['geometry']] if e['type'] == 'way' and e.get('geometry') else [m['geometry'] for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
    for g in geoms:
        pts = [xy(p['lat'], p['lon']) for p in g]
        if len(pts) >= 3:
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            rings.append((min(xs), min(ys), max(xs), max(ys), pts))
def in_forest(x, y):
    for x0, y0, x1, y1, pts in rings:
        if not (x0 <= x <= x1 and y0 <= y <= y1): continue
        inside, j = False, len(pts) - 1
        for i in range(len(pts)):
            (xi, yi), (xj, yj) = pts[i], pts[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: inside = not inside
            j = i
        if inside: return True
    return False

BAD = {'motorway', 'motorway_link', 'trunk', 'trunk_link', 'construction', 'elevator', 'busway', 'services', 'proposed', 'raceway'}
MAJOR = {'primary', 'primary_link', 'secondary', 'secondary_link'}
SOFT = {'footway', 'cycleway', 'pedestrian'}  # 포장 보행로로 보는 길(산길로 판정되면 제외)
UNPAVED = {'ground', 'earth', 'dirt', 'gravel', 'fine_gravel', 'grass', 'unpaved', 'sand', 'mud', 'woodchips', 'compacted', 'pebblestone', 'rock'}
PAVED = {'asphalt', 'concrete', 'paving_stones', 'sett', 'paved', 'concrete:plates'}
CAR = {'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'service', 'living_street', 'road'}

idx, nodes, edges, adj = {}, [], {}, {}
def nid(osm, la, lo):
    if osm not in idx: idx[osm] = len(nodes); nodes.append(xy(la, lo))
    return idx[osm]
n_trail = 0
for w in ways:
    t = w.get('tags', {}); h = t.get('highway'); surf = t.get('surface')
    if h in BAD or not w.get('geometry'): continue
    # 통행 금지·사유지는 걸어서 가도 된다고 따로 적힌 경우만 남긴다
    if t.get('access') in ('private', 'no') and t.get('foot') not in ('yes', 'designated', 'permissive'): continue
    g = w['geometry']
    mid = xy(g[len(g) // 2]['lat'], g[len(g) // 2]['lon'])
    # 산길: 오솔길(path·track), 흙·자갈 노면, 또는 숲·덤불 안을 지나는 비포장 보행로
    trail = h in ('path', 'track') or surf in UNPAVED or (h in ('footway', 'steps', 'pedestrian', 'cycleway') and surf not in PAVED and in_forest(*mid))
    n_trail += trail
    # 인도 구분: 16 차도, 32 차도에 인도가 붙어 있음(sidewalk=both/left/right/yes), 64 인도가 따로 그려져 있거나 없음(separate/no → 차도 자체는 피함)
    sw = ' '.join(str(t.get(k, '')) for k in ('sidewalk', 'sidewalk:both', 'sidewalk:left', 'sidewalk:right'))
    car = h in CAR
    flag = (1 if trail else 0) | (2 if h == 'steps' else 0) | (4 if h in MAJOR else 0) | (8 if h in SOFT and not trail else 0)          | (16 if car else 0) | (32 if car and any(v in sw for v in ('both', 'left', 'right', 'yes')) else 0)          | (64 if car and any(v in sw for v in ('separate', 'no', 'none')) and not any(v in sw for v in ('both', 'yes')) else 0)
    flag |= 256 if h in ('residential', 'service', 'unclassified', 'living_street', 'road') else 0  # 골목·단지 도로: 인도가 없는 경우가 많다
    sig_way = t.get('crossing') == 'traffic_signals' or t.get('crossing:signals') == 'yes'  # 신호 있는 건널목 길
    for k in range(len(g) - 1):
        a, b = nid(w['nodes'][k], g[k]['lat'], g[k]['lon']), nid(w['nodes'][k + 1], g[k + 1]['lat'], g[k + 1]['lon'])
        if a == b: continue
        # 128: 신호(이 간선 끝이 신호 노드이거나 신호 건널목 길)
        edges[(min(a, b), max(a, b))] = flag | (128 if sig_way or w['nodes'][k] in sig_nodes or w['nodes'][k + 1] in sig_nodes else 0)
        adj.setdefault(a, set()).add(b); adj.setdefault(b, set()).add(a)
print('ways', len(ways), 'forest rings', len(rings), 'trail ways', n_trail,
      'sidewalk tagged', sum(1 for w in ways if 'sidewalk' in ' '.join(w.get('tags', {}))),
      'footway=sidewalk', sum(1 for w in ways if w.get('tags', {}).get('footway') == 'sidewalk'), 'signal nodes', len(sig_nodes))

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

# 2) 고도: SRTM 30m 원래 해상도. 노드를 30m 칸으로 묶어 칸마다 한 번만 받는다(OpenTopoData, 1초에 1회)
DLA, DLO = 0.00027, 0.00034  # 약 30m
cell = lambda x, y: (round((LA0 + y / 110540) / DLA), round((LO0 + x / (C * 111320)) / DLO))
cache_path = os.path.join(HERE, 'elev_cache.json')
cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
todo = sorted({cell(*nodes[o]) for o in keep} - {tuple(map(int, k.split(','))) for k in cache})
print('elevation cells', len(todo), 'to fetch, cached', len(cache))
for i in range(0, len(todo), 100):
    ch = todo[i:i + 100]
    u = 'https://api.opentopodata.org/v1/srtm30m?locations=' + '|'.join(f'{a*DLA:.6f},{b*DLO:.6f}' for a, b in ch)
    for _ in range(6):
        try:
            res = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read())['results']
            for (a, b), r in zip(ch, res): cache[f'{a},{b}'] = r['elevation']
            break
        except Exception as e: print('retry', i, e, flush=True); time.sleep(5)
    if i % 2000 == 0: json.dump(cache, open(cache_path, 'w')); print('elev', i, '/', len(todo), flush=True)
    time.sleep(1.1)
json.dump(cache, open(cache_path, 'w'))

out = {'nodes': [v for o in keep for v in (round(nodes[o][0]), round(nodes[o][1]))],
       'elev': [round((cache.get('%d,%d' % cell(*nodes[o])) or 0) * 10) for o in keep],  # 0.1m 단위
       'edges': [v for (a, b), f in edges.items() if a in remap and b in remap for v in (remap[a], remap[b], f)]}
path = os.path.join(HERE, '..', 'hanbakwi', 'graph.js')
with open(path, 'w', encoding='utf-8') as f:
    f.write('// 보행 도로망(OSM) + 노드 고도(SRTM 30m, 0.1m 단위) + 산길 표시. tools/graph.py로 생성\nwindow.ORCA_GRAPH=' + json.dumps(out, separators=(',', ':')) + ';\n')
print(len(keep), 'nodes', len(out['edges']) // 3, 'edges', os.path.getsize(path) // 1024, 'KB')
