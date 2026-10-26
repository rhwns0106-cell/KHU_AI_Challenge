// 자가 점검: node loop.check.js  — 영통역 근처 임의 지점에서 5km 순환 코스가 실제로 돌아오는지
const assert = require('assert');
globalThis.window = globalThis;
require('./graph.js'); require('./loop.js');
const {prep, near, makeLoops} = globalThis.OrcaLoop;

(async () => {
  const t0 = Date.now(), P = prep(globalThis.ORCA_GRAPH);
  const [s, d] = near(P, -800, 900); // 정문에서 북서쪽 1.2km 정도, 프리셋 출발지가 아닌 곳
  assert.ok(d < 100, '근처에 도로가 있어야 함');
  const out = await makeLoops(P, s, 5000);
  console.log('생성 시간', Date.now() - t0, 'ms');
  for (const t in out) {
    console.log(t, out[t].map(r => [r.dist, r.apk, r.share.join('/')]));
    for (const r of out[t]) {
      assert.ok(Math.abs(r.dist - 5000) / 5000 < 0.12, '거리 ±12%');
      const n = r.pts.length;
      assert.ok(Math.hypot(r.pts[0] - r.pts[n-2], r.pts[1] - r.pts[n-1]) < 1, '출발점으로 돌아와야 함');
      assert.equal(r.el.length, n / 2);
    }
  }
  assert.ok(out.flat.length >= 1);
  // 평지·완만 추천에는 산길이 5% 넘게 섞이면 안 된다
  for (const t of ['flat', 'mild']) for (const r of out[t]) assert.ok(r.trail <= 0.05, t + ' 코스에 산길 ' + r.trail);
  // 산길을 고르면 산길 위주 후보를 따로 만든다
  const tr = await makeLoops(P, s, 5000, null, 'trail');
  console.log('산길 요청: 산길 비율', tr.trail.map(r => r.trail));

  // 코스 이탈 → 다시 붙기: 1km 지점(40번째 점)에서 옆으로 80m 벗어난 곳
  const r = out.flat[0], n = r.pts.length / 2, k = 40;
  const dx = r.pts[2*(k+1)] - r.pts[2*k], dy = r.pts[2*(k+1)+1] - r.pts[2*k+1], len = Math.hypot(dx, dy) || 1;
  const ox = r.pts[2*k] - dy/len*80, oy = r.pts[2*k+1] + dx/len*80;
  const nr = globalThis.OrcaLoop.rejoin(P, r, k, ox, oy);
  assert.ok(nr, '다시 붙는 길을 찾아야 함');
  const m = nr.pts.length / 2;
  assert.ok(Math.hypot(nr.pts[0] - ox, nr.pts[1] - oy) < 100, '새 길은 지금 위치 근처에서 시작');
  assert.deepEqual([nr.pts[2*m-2], nr.pts[2*m-1]], [r.pts[2*n-2], r.pts[2*n-1]], '끝은 원래 출발점');
  assert.equal(nr.el.length, m);
  for (let i = 1; i < m; i++) assert.ok(Math.hypot(nr.pts[2*i] - nr.pts[2*i-2], nr.pts[2*i+1] - nr.pts[2*i-1]) < 120, '끊긴 곳 없이 이어짐');
  // 출발지 → 목적지: 정문 근처에서 영통역 근처까지, 짧게(1km)와 길게(5km) 요청
  const [a] = near(P, -470, 400), [b] = near(P, -740, 1110);
  for (const D of [1000, 5000]){
    const o = await globalThis.OrcaLoop.makeRoutes(P, a, b, D);
    console.log('목적지', D, o.flat.map(r => r.dist));
    assert.ok(o.flat.length >= 1, '목적지 코스가 있어야 함');
    for (const t of ['flat', 'mild', 'hill']) for (const r of o[t]){
      const m = r.pts.length / 2;
      assert.deepEqual([r.pts[0], r.pts[1]], [P.G.nodes[2*a], P.G.nodes[2*a+1]], '출발지에서 시작');
      assert.deepEqual([r.pts[2*m-2], r.pts[2*m-1]], [P.G.nodes[2*b], P.G.nodes[2*b+1]], '목적지에서 끝');
    }
    if (D === 5000) assert.ok(o.flat.some(r => Math.abs(r.dist - 5000) / 5000 < 0.15), '5km 요청이면 5km 근처 경유 코스가 있어야 함');
  }
  console.log('다시 붙기: 남은 거리', ((n-1-k)*25/1000).toFixed(2), 'km →', (nr.dist/1000).toFixed(2), 'km');
  console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });
