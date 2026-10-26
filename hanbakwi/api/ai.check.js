// 자가 점검: node api/ai.check.js  (상위 폴더 ../.env 의 BAZE_API_KEY 사용)
const fs = require('fs'), path = require('path'), assert = require('assert');
for (const line of fs.readFileSync(path.join(__dirname, '../../.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const handler = require('./ai.js');
const call = (body, method = 'POST') => new Promise(done => {
  const res = {code: 0, status(c){ this.code = c; return this; }, json(o){ done({code: this.code, body: o}); }};
  handler({method, body}, res);
});

(async () => {
  assert.equal((await call({}, 'GET')).code, 405);
  assert.equal((await call({task: 'hack', payload: {}})).code, 400);
  assert.equal((await call({task: 'parse', payload: {text: 'x'.repeat(5000)}})).code, 413);

  const p = await call({task: 'parse', payload: {text: '밤에 40분 정도 언덕 훈련, 영통역에서'}});
  console.log('parse', p.code, p.body.result);
  assert.equal(p.code, 200);
  assert.equal(p.body.result.start, 'yeongtong');
  assert.equal(p.body.result.terrain, 'hill');

  const b = await call({task: 'brief', payload: {route: {start: '경희대 정문', dist_km: 5.1, minutes: 33, ascent_m: 62, max_grade_pct: 9,
    share_pct: {flat: 50, mild: 41, up: 8, steep: 1}, longest_climb: {at_km: 1.8, length_m: 300, rise_m: 14}, trail_pct: 0, steps: 0}}});
  console.log('brief', b.code, b.body.result);
  assert.equal(b.code, 200);
  assert.ok(Array.isArray(b.body.result) && b.body.result.length >= 2);
  const c = await call({task: 'coach', payload: {live: {km_done: 2, last_km_pace: '6:52', avg_pace: '6:40', next_km_ascent_m: 18, km_left: 3.1}}});
  console.log('coach', c.code, c.body.result);
  assert.equal(c.code, 200); assert.ok(typeof c.body.result === 'string' && c.body.result.length > 5);

  const r = await call({task: 'report', payload: {run: {course: 'A선 5.1km', km: 5.1, active: '35:20', stops: 3, stop_time: '1:40', feel: '힘들었어요',
    splits: [{km: 1, pace: '6:30', ascent_m: 4}, {km: 2, pace: '7:20', ascent_m: 22}, {km: 3, pace: '6:35', ascent_m: 3}]}}});
  console.log('report', r.code, JSON.stringify(r.body.result));
  assert.equal(r.code, 200); assert.ok(r.body.result.summary && [3, 5, 7, 10].includes(r.body.result.next.dist));

  const opts = {'5|flat|0': {km: 5.35, min: 36, ascent: 67, last_km_ascent: 21}, '5|flat|1': {km: 4.85, min: 33, ascent: 64, last_km_ascent: 3}, '3|flat|0': {km: 2.9, min: 20, ascent: 31, last_km_ascent: 5}};
  const f = await call({task: 'refine', payload: {request: '마지막 오르막 빼줘', now: '5|flat|0', options: opts}});
  console.log('refine', f.code, f.body.result);
  assert.equal(f.code, 200); assert.ok(f.body.result.pick in opts);
  console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });
