---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Surface: orca 코스 추천 화면 (index.html)

Mode: Operate. 휴대폰 우선, 데스크톱은 지도 확장.
Audience/job: 공강에 출발 직전인 국제캠 러너가 입력 한 번으로 순환 코스 하나를 고른다. 심사위원은 시연으로 같은 흐름을 본다.
Constraints: 경로·경사는 data.js 계산값 그대로, AI 브리핑은 규칙 예시임을 밝힌다. 후기·평점은 없으므로 만들지 않는다.

## Direction contract

THESIS: 코스를 지도 위 낙서가 아니라 노선도의 순환선으로 읽힌다. 러닝 앱의 흰 지도+주황 강조 기본형을 거부한다.
OWN-WORLD: 자정 남색 법랑 바탕(#0B1230), 도자기 흰 글자, 경사 4색은 노선 잉크(초록·호박·주황·진홍), 코발트는 조작·선택 전용. 역 표시는 흰 테 원, 출발점은 환승역 큰 원. 좁은 트랜짓 산세리프 숫자.
STORY: 말로 조건을 넣으면 이해한 조건이 역 이름표처럼 붙고, A·B·C선 중 하나를 골라 몇 km 지점에 오르막이 있는지와 공강 시간 안에 들어오는지 알고 출발한다.
FIRST VIEWPORT: 모바일 390 기준 상단 브랜드 줄, 입력창+코발트 찾기 버튼, 조건 칩. 그 아래 지도(화면 절반)에서 선택 코스가 노선색으로 빛나고, 바로 아래 노선 띠(정문→1km역…→정문, 구간 경사색, 끝에 시간 예산). 데스크톱은 왼쪽 420px 운행 패널, 오른쪽 전체 지도.
FORM: challenger wayfinding-cartography-signage-midnight-transit-diagram (사용자 선택), assigned was grounded #4. seed: seed:4d70f7b47d601902. Signature interaction: 노선 띠의 역(km)을 누르면 지도가 그 지점으로 이동하고 표시된다; 거리·지형을 바꾸면 띠·지도·고도가 함께 다시 그려진다.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
