// ChatKHU(BAZE 게이트웨이) 프록시. 키는 Vercel 환경변수 BAZE_API_KEY에만 두고 브라우저에는 절대 내려보내지 않는다.
// 정해진 작업(task)만 받아서 아무 프롬프트나 대신 보내주는 공개 프록시가 되지 않게 한다.
const BASE = process.env.BAZE_BASE_URL || 'https://factchat-cloud.mindlogic.ai/v1/gateway';
const MODEL = process.env.BAZE_MODEL || 'claude-haiku-4-5-20251001';

const TASKS = {
  parse: {
    max: 200,
    system: '너는 러닝 코스 추천 앱의 조건 번역기다. 사용자의 말을 아래 JSON 하나로만 바꿔라. 설명·코드블록 없이 JSON만 출력.\n' +
      '{"start": "gate"|"yeongtong"|"seocheon"|null, "place": 문자열|null, "here": true|false, "km": 숫자|null, "minutes": 숫자|null, "terrain": "flat"|"mild"|"hill"|"trail"|null, "night": true|false}\n' +
      'start: 경희대 정문·학교·캠퍼스=gate, 영통역(출구 번호 없이)=yeongtong, 서천생태공원=seocheon. ' +
      'place: 위 세 곳이 아닌 출발 장소를 사용자가 말하면 지도 검색에 쓸 이름만 짧게(예: "영통역 4번 출구", "서천동 행정복지센터"), 이때 start는 null. ' +
      'here: "여기서", "내 위치", "현재 위치"처럼 지금 있는 곳에서 출발하겠다고 하면 true. ' +
      'novel: "새로운", "다른 코스", "안 뛰어본", "처음 가는"처럼 전에 뛴 길과 다른 코스를 원하면 true. ' +
      'repeat_last: "같은 거리", "같은 시간", "지난번만큼", "어제랑 똑같이"처럼 지난 기록의 거리·시간을 기준으로 하라면 true. 둘 다 JSON에 넣는다(없으면 false). ' +
      'terrain: 오르막 싫음·가볍게·초보·무릎=flat, 적당히=mild, 언덕·빡세게·훈련=hill, 산·숲·흙길=trail. ' +
      'night: 밤·야간·어두운 시간 언급이 있으면 true. 말하지 않은 값은 null.',
    user: p => String(p.text || '').slice(0, 200),
    tokens: 150
  },
  brief: {
    max: 1500,
    system: '너는 러닝 코치다. 주어진 코스 수치만 근거로 출발 전 브리핑을 한국어 문장 3~4개로 써라. ' +
      '수치에 없는 시설·경치·안전 정보는 지어내지 마라. 각 문장은 60자 이내, 끝은 "~예요/~해요/~세요"로 한 번만 맺는다("입니다요", "요요" 금지). ' +
      '경사 기준은 앱과 같게 쓴다: 0–2% 평지, 2–5% 완만, 5–8% 오르막, 8% 이상 급경사. 8% 이상을 쉽다거나 무리 없다고 말하지 마라. ' +
      'time_budget_min이 있으면 예상 시간과 비교해 남거나 넘는 시간을 한 문장에 말해라. ' +
      '설명·코드블록 없이 JSON 문자열 배열 하나로만 출력: ["문장1","문장2",...]',
    user: p => JSON.stringify(p.route || {}),
    tokens: 400
  },
  coach: {
    max: 800,
    system: '너는 달리는 사람 귀에 대고 말하는 러닝 코치다. 주어진 실시간 수치로 음성으로 읽을 한국어 한두 문장(합쳐 45자 이내)을 써라. ' +
      '페이스는 "6분 40초"처럼 읽기 좋게. 다음 1km가 오르막(상승 10m 이상)이면 미리 알려라. 수치에 없는 내용은 지어내지 마라. ' +
      '설명·따옴표 없이 문장만 출력.',
    user: p => JSON.stringify(p.live || {}),
    tokens: 120
  },
  report: {
    max: 3000,
    system: '너는 러닝 코치다. 방금 끝난 달리기 기록(km별 페이스와 그 구간 상승량, 신호·정지 횟수, 본인 느낌)을 분석해 JSON 하나로만 답해라. ' +
      '{"summary": "한두 문장 총평", "points": ["관찰 2~3개, 각 60자 이내, 반드시 수치 근거"], "next": {"dist": 3|5|7|10, "terrain": "flat"|"mild"|"hill"|"trail", "why": "다음 추천 이유 한 문장"}} ' +
      '목표 페이스는 주어지지 않으니 만들어 말하지 마라. 오르막 구간에서 느려진 것은 정상이라고 구분해서 말하라. 느낌이 힘들었으면 다음 추천을 쉽게, 쉬웠으면 어렵게. 기록에 없는 내용은 지어내지 마라. 존댓말(~요).',
    user: p => JSON.stringify(p.run || {}),
    tokens: 500
  },
  refine: {
    max: 4000,
    system: '너는 러닝 코스 추천 앱의 코스 수정 도우미다. 사용자의 요청과 지금 보고 있는 코스, 그리고 고를 수 있는 후보 목록(id별 수치)을 받는다. ' +
      '요청에 가장 맞는 후보 하나를 골라 JSON 하나로만 답해라: {"pick": "후보 id", "reason": "왜 골랐는지 수치를 들어 한 문장, 존댓말"}. ' +
      '후보 목록에 없는 id는 절대 쓰지 마라. 맞는 후보가 없으면 가장 가까운 것을 고르고 reason에 한계를 밝혀라. ' +
      'reason에는 필드 이름(last_km_ascent 등)을 쓰지 말고 "마지막 1km 오르막 20m"처럼 우리말로, 끝은 "~예요/~했어요".',
    user: p => JSON.stringify({request: String(p.request || '').slice(0, 200), now: p.now, options: p.options}),
    tokens: 200
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
    const text = data.choices[0].message.content;
    return res.status(200).json({result: task === 'coach' ? String(text).trim().slice(0, 120) : json(text), model: MODEL});
  } catch (e) {
    return res.status(502).json({error: 'AI 응답을 읽지 못했어요'});
  }
};
