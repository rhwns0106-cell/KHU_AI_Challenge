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
  console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });
