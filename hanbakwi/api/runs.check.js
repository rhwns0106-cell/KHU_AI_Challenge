// 자가 점검: node api/runs.check.js  — Redis를 가짜 fetch로 대신해 저장·조회·검증을 확인
const assert = require('assert');
process.env.KV_REST_API_URL = 'https://fake'; process.env.KV_REST_API_TOKEN = 't';
const store = {};
globalThis.fetch = async (url, o) => {
  const [cmd, key, a, b] = JSON.parse(o.body), l = store[key] = store[key] || [];
  if (cmd === 'LPUSH') l.unshift(a);
  if (cmd === 'LTRIM') l.splice(b + 1);
  return {ok: true, json: async () => ({result: cmd === 'LRANGE' ? l.slice(a, b + 1) : 1})};
};
const handler = require('./runs.js');
const call = req => new Promise(done => {
  const res = {code: 0, status(c){ this.code = c; return this; }, json(o){ done({code: this.code, body: o}); }};
  handler(req, res);
});
const id = '123e4567-e89b-42d3-a456-426614174000';

(async () => {
  assert.equal((await call({method: 'GET', query: {id: '../etc'}})).code, 400);
  assert.equal((await call({method: 'POST', query: {}, body: {id}})).code, 400);
  for (let i = 0; i < 55; i++) await call({method: 'POST', query: {}, body: {id, run: {km: i}}});
  const post = await call({method: 'POST', query: {}, body: {id, run: {km: 5.1, label: 'A선', cells: [1, 2, 'x', 3.5], evil: '<script>', lat: 37.2}}});
  assert.equal(post.code, 200);
  const got = await call({method: 'GET', query: {id}});
  assert.equal(got.code, 200);
  assert.equal(got.body.runs.length, 30);           // 조회는 최근 30개
  assert.equal(store['runs:' + id].length, 50);     // 저장은 최근 50개
  const first = JSON.parse(store['runs:' + id][0]);   // 방금 넣은 것
  assert.deepEqual(first.cells, [1, 2]);            // 정수 칸만
  assert.ok(!('evil' in first) && !('lat' in first)); // 모르는 칸은 버림
  console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });
