// 달린 기록 저장소(Upstash Redis REST, Vercel Storage에서 연결하면 환경변수가 자동으로 생긴다).
// 기기마다 무작위 id로 구분한다. GPS 궤적 원본은 받지 않고 코스 칸(50m 격자)과 요약만 저장한다.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd){
  const r = await fetch(URL_, {method: 'POST', headers: {Authorization: 'Bearer ' + TOKEN}, body: JSON.stringify(cmd)});
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).result;
}

// 들어온 기록에서 알려진 칸만, 정해진 형태로만 남긴다
function clean(run){
  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0), str = (v, n) => String(v == null ? '' : v).slice(0, n);
  const cells = Array.isArray(run.cells) ? run.cells.filter(Number.isInteger).slice(0, 600) : [];
  return {at: str(run.at, 40), label: str(run.label, 60), km: num(run.km), ms: num(run.ms), rest: num(run.rest), stops: num(run.stops),
          sim: !!run.sim, start: str(run.start, 20), startName: str(run.startName, 30), sx: num(run.sx), sy: num(run.sy),
          dist: num(run.dist), terr: str(run.terr, 10), cells};
}

module.exports = async (req, res) => {
  if (!URL_ || !TOKEN) return res.status(501).json({error: '서버 저장소가 아직 연결되지 않았어요'});
  const id = String((req.query && req.query.id) || (req.body && req.body.id) || '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({error: '잘못된 기기 id'});
  const key = 'runs:' + id;
  try {
    if (req.method === 'GET') {
      const list = await redis(['LRANGE', key, 0, 29]);
      return res.status(200).json({runs: (list || []).map(s => JSON.parse(s))});
    }
    if (req.method === 'POST') {
      if (!req.body || typeof req.body.run !== 'object') return res.status(400).json({error: '기록이 없어요'});
      await redis(['LPUSH', key, JSON.stringify(clean(req.body.run))]);
      await redis(['LTRIM', key, 0, 49]); // 기기당 최근 50개만
      return res.status(200).json({ok: true});
    }
    return res.status(405).json({error: 'GET, POST만 받아요'});
  } catch (e) {
    return res.status(502).json({error: '저장소에 연결하지 못했어요'});
  }
};
