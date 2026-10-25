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
  console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });
