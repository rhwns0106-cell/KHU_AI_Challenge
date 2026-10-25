// ChatKHU(BAZE 게이트웨이) 프록시. 키는 Vercel 환경변수 BAZE_API_KEY에만 두고 브라우저에는 절대 내려보내지 않는다.
// 정해진 작업(task)만 받아서 아무 프롬프트나 대신 보내주는 공개 프록시가 되지 않게 한다.
const BASE = process.env.BAZE_BASE_URL || 'https://factchat-cloud.mindlogic.ai/v1/gateway';
const MODEL = process.env.BAZE_MODEL || 'claude-haiku-4-5-20251001';

const TASKS = {
  parse: {
    max: 200,
    system: '너는 러닝 코스 추천 앱의 조건 번역기다. 사용자의 말을 아래 JSON 하나로만 바꿔라. 설명·코드블록 없이 JSON만 출력.\n' +
      '{"start": "gate"|"yeongtong"|"seocheon"|null, "km": 숫자|null, "minutes": 숫자|null, "terrain": "flat"|"mild"|"hill"|"trail"|null, "night": true|false}\n' +
      'start: 경희대 정문·학교·캠퍼스=gate, 영통역=yeongtong, 서천생태공원·서천=seocheon. ' +
      'terrain: 오르막 싫음·가볍게·초보·무릎=flat, 적당히=mild, 언덕·빡세게·훈련=hill, 산·숲·흙길=trail. ' +
      'night: 밤·야간·어두운 시간 언급이 있으면 true. 말하지 않은 값은 null.',
    user: p => String(p.text || '').slice(0, 200),
    tokens: 150
  },
  brief: {
    max: 1500,
    system: '너는 러닝 코치다. 주어진 코스 수치만 근거로 출발 전 브리핑을 한국어 문장 3~4개로 써라. ' +
      '수치에 없는 시설·경치·안전 정보는 지어내지 마라. 각 문장은 60자 이내, 존댓말(~요). ' +
      '경사 기준은 앱과 같게 쓴다: 0–2% 평지, 2–5% 완만, 5–8% 오르막, 8% 이상 급경사. 8% 이상을 쉽다거나 무리 없다고 말하지 마라. ' +
      'time_budget_min이 있으면 예상 시간과 비교해 남거나 넘는 시간을 한 문장에 말해라. ' +
      '설명·코드블록 없이 JSON 문자열 배열 하나로만 출력: ["문장1","문장2",...]',
    user: p => JSON.stringify(p.route || {}),
    tokens: 400
  }
};

function json(text){
  const m = String(text).match(/[\[{][\s\S]*[\]}]/); // 모델이 코드블록으로 감싸도 본문만 꺼낸다
  return JSON.parse(m ? m[0] : text);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({error: 'POST만 받아요'});
  const {task, payload} = req.body || {};
  const t = TASKS[task];
  if (!t) return res.status(400).json({error: '알 수 없는 작업'});
  if (JSON.stringify(payload || {}).length > t.max * 4) return res.status(413).json({error: '입력이 너무 길어요'});
  if (!process.env.BAZE_API_KEY) return res.status(500).json({error: '서버에 BAZE_API_KEY가 없어요'});
  // shortcut: 요청 횟수 제한 없음. 심사 기간에 남용되면 Vercel KV 등으로 IP별 제한 추가.
  try {
    const r = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: {'Authorization': 'Bearer ' + process.env.BAZE_API_KEY, 'Content-Type': 'application/json'},
      body: JSON.stringify({model: MODEL, max_tokens: t.tokens, messages: [
        {role: 'system', content: t.system}, {role: 'user', content: t.user(payload || {})}]})
    });
    if (!r.ok) return res.status(502).json({error: 'AI 응답 실패 (' + r.status + ')'});
    const data = await r.json();
    return res.status(200).json({result: json(data.choices[0].message.content), model: MODEL});
  } catch (e) {
    return res.status(502).json({error: 'AI 응답을 읽지 못했어요'});
  }
};
