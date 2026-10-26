# OSM 신호등 위치 → hanbakwi/signals.js (data.js와 같은 미터 좌표계)
# 실행: python tools/signals.py
import json, math, urllib.request, urllib.parse, os

BBOX = '37.1982,127.0253,37.2882,127.1383'
Q = f'[out:json][timeout:60];(node[highway=traffic_signals]({BBOX});node[crossing=traffic_signals]({BBOX}););out;'
req = urllib.request.Request('https://overpass-api.de/api/interpreter', data=urllib.parse.urlencode({'data': Q}).encode(),
                             headers={'User-Agent': 'KHU-orca-running/0.1 (student project)'})
els = json.loads(urllib.request.urlopen(req, timeout=120).read())['elements']

LA0, LO0 = 37.2432, 127.0818
C = math.cos(math.radians(LA0))
pts = [((e['lon'] - LO0) * C * 111320, (e['lat'] - LA0) * 110540) for e in els]
merged = []  # 한 교차로의 신호 노드 여러 개는 25m 안이면 하나로 센다
for p in pts:
    if all(math.hypot(p[0] - q[0], p[1] - q[1]) > 25 for q in merged): merged.append(p)

out = os.path.join(os.path.dirname(__file__), '..', 'hanbakwi', 'signals.js')
with open(out, 'w', encoding='utf-8') as f:
    f.write('// OSM traffic_signals, 교차로 단위로 묶음. tools/signals.py로 생성\n')
    f.write('window.ORCA_SIGNALS=' + json.dumps([round(v) for p in merged for v in p]) + ';\n')
print(len(pts), 'nodes ->', len(merged), 'intersections ->', out)
