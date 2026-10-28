// 가게·건물 이름 → 좌표: 카카오 로컬 키워드 검색. REST 키는 Vercel 환경변수 KAKAO_REST_KEY에만 둔다.
// 국제캠(37.2432N, 127.0818E) 반경 5km 안만 찾는다.
module.exports = async (req, res) => {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) return res.status(501).json({error: '카카오 키가 아직 연결되지 않았어요'});
  const q = String((req.query && req.query.q) || '').trim().slice(0, 50);
  if (!q) return res.status(400).json({error: '검색어가 없어요'});
  try {
    const u = 'https://dapi.kakao.com/v2/local/search/keyword.json?x=127.0818&y=37.2432&radius=5000&sort=accuracy&size=5&query=' + encodeURIComponent(q);
    const r = await fetch(u, {headers: {Authorization: 'KakaoAK ' + key}});
    if (!r.ok) return res.status(502).json({error: '카카오 검색 실패 (' + r.status + ')'});
    const docs = (await r.json()).documents || [];
    return res.status(200).json({places: docs.map(d => ({name: d.place_name, address: d.road_address_name || d.address_name, lat: +d.y, lon: +d.x}))});
  } catch (e) {
    return res.status(502).json({error: '카카오 검색에 연결하지 못했어요'});
  }
};
