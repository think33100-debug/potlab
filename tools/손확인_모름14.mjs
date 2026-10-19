/* 「모름 14곳」을 **손으로 확인할 곳**에 넣습니다 (2026-10-19 밤 조사 결과)
 *
 *   node tools/손확인_모름14.mjs --마른     무엇을 넣을지만 (기본)
 *   node tools/손확인_모름14.mjs --진짜     넣습니다
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * ① 사각지대 60곳의 꼴을 가렸을 때 14곳이 「모름」이었습니다. 밤에 그 14곳을
 * `tools/채용판_들어가보기.mjs` 로 **열어** 봤고, **한 곳도 못 붙입니다.**
 * 까닭이 넷입니다 —
 *   robots 전면 금지 3 · 쪽에 채용 링크 없음 8 · 채용관이 봇 막이 1 ·
 *   자바스크립트 쪽(SPA) 1 · 채용 링크는 있지만 공고 목록이 아님 1
 * 「빠지지 않는 것이 자동화보다 중요하다」(CLAUDE.md 맨 앞)이므로 **지우지 않고**
 * 손확인 목록으로 넘깁니다.
 *
 * ★ 넣는 길은 창구 `hand_check_put` 하나입니다.
 * ★ 되돌리는 법 — 손확인 목록에서 그 이름의 줄을 지우면 됩니다 (회원 화면과
 *   무관한 내부 목록입니다).
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL; const AK = cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_SERVICE_KEY;
const SEC = cfg.COLLECT_KEY_HS3;
if (!U || !AK || !SEC) { console.error('✗ 열쇠가 없습니다 (SUPABASE_URL · 열쇠 · COLLECT_KEY_HS3)'); process.exit(1); }

const 머리 = '【2026-10-19 밤】 ① 사각지대 「모름 14곳」을 한 곳씩 열어 봤습니다 '
  + '(tools/채용판_들어가보기.mjs — 링크를 따라 들어가 공고 목록인지까지 봤습니다). ';

const 줄 = [
  ['강북삼성병원', '채용관이 봇 막이 — 사람이 봐야 합니다',
    '뿌리 → /index.jsp → main.kbsmc.co.kr 로 두 번 옮겨 갑니다. 거기 「채용정보」가 '
    + 'https://kbsmcrecruit.ninehire.site/ (나인하이어 채용관)인데 **HTTP 429 + 「Vercel Security '
    + 'Checkpoint」** 입니다 — 봇 막이입니다. **뚫지 않습니다.** 상급종합 3곳 중 하나라 값이 큽니다.'],
  ['강남을지대학교병원', '쪽에 채용 링크 없음 — 그룹 쪽에 있을 수 있습니다',
    'gangnam.eulji.or.kr 이 m.eulji.or.kr 로 옮겨 가고, 두 쪽을 합쳐도 채용말 링크가 0개입니다. '
    + '링크 글이 「을지재단 · 을지대학교 · 을지인력개발원 · 범석학술장학재단」 뿐입니다 — '
    + '채용이 **그룹(을지재단) 쪽**에 모일 수 있는데, 주소를 짐작하지 않습니다.'],
  ['부천세종병원', '쪽에 채용 링크 없음',
    'www.sejongh.co.kr 링크 글이 「선천성심장병 · 세종심혈관네트워크 · 심장박물관」 셋뿐입니다.'],
  ['서울산보람병원', '쪽에 채용 링크 없음 — 여러 병원 묶음 쪽입니다',
    'www.imc-boram.co.kr 가 「보람병원 · 서울산보람병원 · 보람요양병원 · 바로가기」 넷만 있는 '
    + '고르는 쪽입니다. 병원별 쪽으로 들어가야 하는데 주소를 짐작하지 않습니다.'],
  ['서울성심병원', '쪽에 채용 링크 없음',
    'www.sshosp.co.kr 메뉴 24가지를 전부 봤는데 채용·인재·구인이 없습니다 '
    + '(병원소개·진료과·진료안내·커뮤니티…). 「커뮤니티」 안에 있을 수 있지만 들어가 보는 것은 '
    + '한 걸음 더이고, 주소를 만들지 않습니다.'],
  ['세종여주병원', '쪽이 옮겨 가는데 그 쪽을 못 받습니다',
    'xn--om3bn4fhxed0am6dpua.com 이 `location.href=\'web/\'` 로 옮겨 가는데 그 쪽에서 '
    + 'fetch 가 실패합니다(응답 없음). 쪽 자체가 살아 있는지 사람이 봐 주셔야 합니다.'],
  ['씨엠병원', '「채용안내」가 공고 목록이 아닙니다 — 안내 쪽입니다',
    'cmhospital.co.kr/cmhospital/sub_05_11.php 를 열어 원문을 봤습니다. 채용 **절차** 안내 쪽이고 '
    + '「모집」이 1번, 글번호가 든 링크가 1개(옛 공지)뿐입니다. 「직원게시판」은 직원 전용입니다.'],
  ['우리들병원', '쪽에 채용 링크 없음',
    'www.wooridul.co.kr 링크 285개를 훑었는데 「채용」 글자가 0번입니다. 메뉴는 의료진·진료·'
    + '연구센터 쪽이고, 「게시판」이 있지만 채용판인지는 사람이 봐야 합니다.'],
  ['의료법인 박애의료재단 박애병원', 'robots 전면 금지 — 긁지 않습니다',
    'robots.txt 가 User-agent: * 에 Disallow: / 입니다.'],
  ['의료법인갑을의료재단 갑을장유병원', 'robots 전면 금지 — 긁지 않습니다',
    'robots.txt 가 User-agent: * 에 Disallow: / 입니다.'],
  ['의료법인삼백의료재단상주성모병원', 'robots 전면 금지 — 긁지 않습니다',
    'robots.txt 가 User-agent: * 에 Disallow: / 입니다.'],
  ['의료법인영성의료재단 고흥종합병원', '쪽에 채용 링크 없음',
    'kgh.kr 에 한글 링크 글이 「위치 안내」 하나뿐입니다 — 쪽이 거의 그림·스크립트입니다.'],
  ['재단법인일신기독교선교회 일신기독병원', '쪽에 채용 링크 없음',
    'www.ilsin.or.kr 에 한글 링크 글이 0가지입니다(그림 메뉴). 글자로 된 링크가 없어 '
    + '채용판이 있는지 글자로는 알 수 없습니다.'],
  ['하남성심병원', '자바스크립트로 그리는 쪽(SPA) — 긁을 수 없습니다',
    'www.sungshim.co.kr 가 614바이트에 `<div id="root">` 하나입니다(Vite). HTML 에 링크가 '
    + '하나도 없어 긁기로는 닿지 않습니다. 채용판을 쓰는지 사람이 봐 주셔야 합니다.'],
].map(([이름, 결과, 까닭]) => ({
  이름, 결과, 공고줄: 0, 까닭: 머리 + 까닭,
  어디서: '서버 (tools/채용판_들어가보기.mjs · 자기점검 26가지)',
}));

console.log('넣을 것 ' + 줄.length + '곳 —');
for (const v of 줄) console.log('  ' + v.이름.slice(0, 26).padEnd(28) + v.결과);

if (!진짜) { console.log('\n[마른] 아무것도 안 넣습니다 — 넣으려면 --진짜'); process.exit(0); }

const r = await fetch(U + '/rest/v1/rpc/hand_check_put', {
  method: 'POST',
  headers: { apikey: AK, Authorization: 'Bearer ' + AK, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_secret: SEC, p_source: 'HS3', p_rows: 줄 }),
});
console.log('\nhand_check_put ' + r.status + ' · ' + (await r.text()).slice(0, 200));
const c = await fetch(U + '/rest/v1/hand_check?select=' + encodeURIComponent('이름'),
  { headers: { apikey: AK, Authorization: 'Bearer ' + AK, Prefer: 'count=exact' } });
console.log('손으로 확인할 곳 — ' + (c.headers.get('content-range') || '?') + '줄');
