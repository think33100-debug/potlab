/* 워크넷 수집기 (WN2) — 고용24 채용정보 API (2026-09-30).
 *
 *   node tools/collect-worknet.mjs --dry        담지 않고 견주기만
 *   node tools/collect-worknet.mjs --dry --한줄  사흘 대조용 한 줄만
 *   node tools/collect-worknet.mjs              정말로 담습니다 (source = WN2)
 *
 * ── 어디서 받나 ──────────────────────────────────────────────
 *   https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do
 *   authKey · callTp L=목록 D=상세 · returnType=XML
 *   startPage 최대 1000 · display 최대 100
 *   occupation  306500 물리및작업치료사 · 306501 물리치료사 · 306502 작업치료사
 *
 * **공공데이터포털 열쇠가 아닙니다.** 고용24 전용 authKey 입니다 (UUID 36자).
 *
 * ── 워크넷은 과거를 안 줍니다 ────────────────────────────────
 * 지금 접수 중인 것만 옵니다. **매일 받아 쌓는 것이 우리가 가진 유일한 이력**입니다.
 * 그래서 마감된 줄도 지우지 않습니다 (DB 의 hide_stale_posts 가 감춥니다).
 *
 * ── 2026-09-30 에 응답 원문으로 확인한 것 ────────────────────
 *   목록 항목  wantedAuthNo company busino indTpNm title salTpNm sal minSal maxSal
 *             region holidayTpNm minEdubg maxEdubg career regDt closeDt infoSvc
 *             wantedInfoUrl wantedMobileInfoUrl smodifyDtm zipCd strtnmCd
 *             basicAddr detailAddr empTpCd jobsCd
 *   상세      callTp=D + wantedAuthNo + **infoSvc** (없으면 「정보제공처가 바르지 않습니다」)
 *             empTpNm · receiptCloseDt · jobCont · collectPsncnt …
 *
 * ── 상세(callTp=D)도 부릅니다 (2026-10-11) ───────────────────
 *   2026-10-10 에 보이는 공고 373건 중 303건이 워크넷인데 **모집인원 0%**
 *   였습니다. 까닭은 공고문이 아니라 **이 수집기가 목록만 쓴 것**입니다.
 *   위 머리말에 상세 항목을 적어 두고도 한 번도 안 불렀습니다.
 *     collectPsncnt → headcount      certificate → detail.지원자격
 *     salTpNm       → detail.연봉 (목록의 salTpNm 은 「월급」 뿐입니다)
 *   247건을 되메워 모집인원 3% → 75% 가 됐습니다 (docs/공고통일점검_1010.md).
 *   **한 번 받은 번호는 다시 안 받습니다** — 로그 폴더의 워크넷_상세받음.json 에
 *   번호 → smodifyDtm 을 적어 두고, 새 번호이거나 원 출처가 고친 것만 받습니다.
 *   한 번에 받는 수는 --상세최대=N (기본 40) 으로 묶습니다. 하루 호출이
 *   96번(목록+덧갈래)인데 상세를 다 부르면 네 배가 넘습니다.
 *
 * ── 고쳐 넣은 것 (예전에 찾아둔 버그) ────────────────────────
 *   ① closeDt 가 「채용시까지  26-11-07」 로 섞여 옴 (235건 중 156건 · 66%)
 *      → tools/날짜.mjs 의 공용 함수로 풉니다. 치매센터·나라일터와 같은 함수
 *   ② 우리 직종이 아닌 공고가 섞여 옴 (235건 중 13건)
 *      → jobsCd 로 한 번 더 거릅니다
 *   ③ 고용형태가 코드(10·20)로 옴. empTpNm 은 목록에 **안 옵니다**
 *      → 상세 API 로 코드마다 이름을 직접 확인해 표를 만들었습니다 (짐작 아님)
 *   ④ 제목의 HTML 기호가 두 번·세 번 겹쳐 옴 (&amp;amp; · &amp;gt;)
 *      → 바뀌지 않을 때까지 되풀이해 풉니다
 *   ⑤ 「전남광주 목포시」 → 「전남 목포시」
 *      → 「화성시 만세구·효행구」 「인천 서해구」 는 진짜 행정구역이라 안 건드립니다
 *   ⑥ 명세에 없는 사업자번호(busino)가 옴 → 저장해 둡니다 (심평원 자료와 이을 용도)
 *
 * ── 워크넷 승인 때 약속한 것 ─────────────────────────────────
 *   · 출처를 「고용24」 로 밝힙니다
 *   · 원문·지원은 고용24 원본 링크(wantedInfoUrl)로 보냅니다
 *   · 내용을 임의로 고치거나 재가공해 팔지 않습니다
 */
import fs from 'node:fs';
/* ★ 2026-10-26 세중님 3번 — DB 조회는 **공용 받아보기()** 로 합니다.
   지나가는 401(PGRST303 "JWT issued at future")·408·429·5xx·연결 탈을 1·2초 뒤 다시
   두드립니다 (404·403 은 바로 올립니다). 자는 tools/쪽나눠받기.mjs 한 자리입니다. */
import { 받아보기 } from './쪽나눠받기.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sortJob } from './sort-rule.mjs';
import { 판정남기기, 지문 } from './순찰기억.mjs';
import { matchJob, notOurs, titleOtherOnly, 구운날 } from './gas-rules.mjs';
import { 고용형태코드 } from './공고문읽기.mjs';
import { 워크넷상세칸 } from './워크넷상세칸.mjs';
import { 세기, 남기기 as 고용24남기기, 막힘인가, 막힘적기, 막혔나 } from './고용24한도.mjs';
import { 날짜풀기, 채용시까지인가 } from './날짜.mjs';
import { 기관종별, 시설구분 } from './wn-kind.mjs';
/* ㉮ 덧갈래로 온 줄을 제목으로 가립니다 (2026-10-03 세중님 승인).
   새 앱 판정(gas-rules · 뽑을단어)을 그대로 쓰고 세 겹만 얹은 것입니다 */
import { 덧갈래가리기, 괄호풀기 } from './덧갈래판정.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
/* 한 번에 받을 상세 수 — 하루 호출 수를 묶는 고삐입니다 */
const 상세최대 = Number((process.argv.find((a) => a.startsWith('--상세최대=')) || '').split('=')[1] || 40);
/* --dry 는 상세를 안 받습니다 (09:55 대조용 마른 실행이 호출을 안 쓰게).
   따로 폴더에서 시험할 때만 --상세시험 으로 켭니다 */
const 상세시험 = process.argv.includes('--상세시험');
/* 잘린 제목을 상세의 온전한 제목으로 바꿉니다 — 세중님 승인 뒤에 켭니다 (2026-10-19 3번) */
const 제목도 = process.argv.includes('--제목도');
const SOURCE = 'WN2';
const URL_ = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do';
/* 물리및작업치료사 · 물리치료사 · 작업치료사 */
const 직종 = ['306500', '306501', '306502'];
const 직종이름 = { 306500: '물리및작업치료사', 306501: '물리치료사', 306502: '작업치료사' };

/* ③ 고용형태 코드 → 말.
   **상세 API 의 empTpNm 을 직접 읽어 만든 표입니다** (2026-09-30).
   2026-10-05 에 네 코드를 **다시 응답 원문으로 확인했습니다**
   (tools/워크넷_고용형태_코드확인.mjs) —
     10  기간의 정함이 없는 근로계약
     11  기간의 정함이 없는 근로계약(시간(선택)제)
     20  기간의 정함이 있는 근로계약
     21  기간의 정함이 있는 근로계약(시간(선택)제)

   ★ 「시간제」를 **「시간선택제」로 고쳤습니다** (2026-10-05).
     API 가 쓰는 말이 「시간(선택)제」이고, 옛 앱도 「시간선택제」라
     같은 뜻인데 글자가 둘로 갈려 있었습니다.

   ⚠ 4(파견)·Y(대체인력)은 **아직 응답으로 못 봤습니다.** 2026-09-30·10-05
     두 번 다 목록에 안 나왔습니다. gas/wage.js 의 HIRE_CODE 를 따른 값이라
     확인되면 고쳐야 합니다. */
/* 코드 → 셋(정규직·계약직·무기계약직) 은 공고문읽기.mjs 의 고용형태코드()
   **한 자리**입니다 (2026-10-19 세중님 1번). 전에는 이 파일이 자기 표를
   들고 「기간제」·「정규직(시간선택제)」·「파견」 같은 말을 그대로 넣었습니다 —
   회원이 보는 말이 열 가지가 넘었습니다 (지침 6절).
   ★ 쉼표로 여럿이 오면 `고용형태코드()` 가 **섞임으로 보고 비웁니다** —
     전에는 「정규직, 기간제」 처럼 이어 붙였습니다 */
const 고용형태 = (v) => (고용형태코드(v) || {}).값 || '';

const argv = process.argv.slice(2);
const 값 = (이름, 기본) => { const i = argv.indexOf(이름); return i > -1 && argv[i + 1] != null ? Number(argv[i + 1]) : 기본; };
const dry = argv.includes('--dry');
const 한줄 = argv.includes('--한줄');
const 최대쪽 = 값('--쪽', 10);
/* 덧갈래 (면허 3 · 낱말 4) — `--덧` 을 줄 때만 돕니다. 하루 3회만 걸 생각입니다.
   갈래마다 첫 쪽만 보고, 꽉 찼으면 한 쪽 더까지 (--덧쪽 으로 바꿀 수 있습니다) */
const 덧켬 = argv.includes('--덧');
const 덧최대쪽 = 값('--덧쪽', 2);

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', '.env'),
    path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^'|'$/g, '');
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  out.COLLECT_KEY_WN2 = out.COLLECT_KEY_WN2 || out.COLLECT_KEY_HS3;
  /* 집에서 돌릴 때는 gas 에서 꺼내 씁니다 (서버에는 WORK_KEY 로 보냅니다) */
  if (!out.WORK_KEY && fs.existsSync(path.join(여기, '..', 'gas', 'wage.js'))) {
    const g = fs.readFileSync(path.join(여기, '..', 'gas', 'wage.js'), 'utf8');
    out.WORK_KEY = (g.match(/const WORK_API = \{[\s\S]*?KEY:\s*'([^']+)'/) || [])[1] || '';
  }
  return out;
}
const cfg = env();
const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));

/* ④ HTML 기호가 두 번·세 번 겹쳐 옵니다. **바뀌지 않을 때까지** 풉니다 */
function 겹친것풀기(s0) {
  let s = String(s0 == null ? '' : s0);
  for (let i = 0; i < 5; i++) {
    const 앞 = s;
    s = s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
      .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
      .replace(/&amp;/g, '&');
    if (s === 앞) break;
  }
  return s.replace(/\s+/g, ' ').trim();
}

/* ⑤ 지역 — gas 의 regionNorm_ 과 같은 규칙입니다.
   「전남광주 광산구」 처럼 광주 자치구가 붙은 것은 광주로, 나머지는 전남으로.
   **화성시 만세구·효행구, 인천 서해구는 진짜 행정구역이라 안 건드립니다.** */
const 시도줄임 = { 충청북: '충북', 충청남: '충남', 전라북: '전북', 전라남: '전남', 경상북: '경북', 경상남: '경남' };
function 지역손질(v) {
  return String(v || '').split(',').map((s0) => s0.trim().replace(/\s+/g, ' ')
    .replace(/^전남광주(통합특별시)?\s*(동구|서구|남구|북구|광산구)(?![가-힣])/, '광주 $2')
    .replace(/^전남광주(통합특별시)?\s*/, '전남 ')
    .replace(/^(경기|강원|충청북|충청남|전라북|전라남|경상북|경상남|제주|전북)(특별자치도|도)?\s*/,
      (_, a) => (시도줄임[a] || a) + ' ')
    .replace(/^(서울|부산|대구|인천|광주|대전|울산)(특별시|광역시)\s*/, '$1 ')
    .replace(/^세종특별자치시\s*/, '세종 ')
    .trim()).filter(Boolean).join(', ');
}

/* 기관종별은 **gas/wage.js 의 wnKind_ 규칙을 떼어** 씁니다 (tools/wn-kind.mjs).
   옛 수집기가 이미 그 말로 1,000건 가까이 담아 놨습니다 —
   요양원·주야간보호 107 · 요양병원 47 · 공공·복지기관 43 …
   여기서 새로 만들면 두 벌이 되어 한쪽만 고치게 됩니다. */

function 아이템들(t) {
  return [...String(t).matchAll(/<wanted>([\s\S]*?)<\/wanted>/g)].map((x) => {
    const o = { 원문: {} };
    for (const f of x[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) {
      o.원문[f[1]] = f[2];              /* 푼 뒤만 들고 있으면 「고치기 전」 을 못 셉니다 */
      o[f[1]] = 겹친것풀기(f[2]);
    }
    return o;
  });
}

async function 받기(주소, 다시 = 3) {
  for (let t = 0; t <= 다시; t++) {
    try {
      const r = await fetch(주소, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      const 글 = await r.text();
      if (r.ok) return { code: r.status, 글 };
      if (t === 다시) return { code: r.status, 글 };
    } catch (e) {
      if (t === 다시) return { code: 0, 글: '', 왜: String(e.message).slice(0, 90) };
    }
    await 쉼(1500 * (t + 1));
  }
  return { code: 0, 글: '' };
}
const 주소만들기 = (o) => URL_ + '?' + Object.entries({ authKey: cfg.WORK_KEY, returnType: 'XML', ...o })
  .map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
/* 로그에 열쇠가 찍히지 않게 */
const 가리기 = (t) => (cfg.WORK_KEY ? String(t).split(cfg.WORK_KEY).join('‹열쇠›') : String(t));

/* ── 상세 한 건 ─────────────────────────────────────────────
   infoSvc 가 없으면 「정보제공처가 바르지 않습니다」가 옵니다. 목록 줄에
   이미 들어 있으니 목록을 다시 부르지 않습니다 */
const 한칸 = (t, 이름) => {
  const 글 = String(t);
  const 여 = 글.indexOf('<' + 이름 + '>');
  if (여 < 0) return '';
  const 까 = 글.indexOf('</' + 이름 + '>', 여);
  if (까 < 0) return '';
  return 겹친것풀기(글.slice(여 + 이름.length + 2, 까)).trim();
};

/* 접수방법·기관홈페이지 손질은 **tools/워크넷칸손질.mjs 한 자리**입니다 (2026-10-24).
   치우는 도구(기관홈페이지_주소아닌것치우기.mjs)도 같은 자를 씁니다 — 이 파일은
   들여오면 바로 수집을 시작하므로 거기서 들여올 수 없습니다 (지침 6절) */
export { 접수방법손질, 홈페이지손질 } from './워크넷칸손질.mjs';
import { 접수방법손질, 홈페이지손질 } from './워크넷칸손질.mjs';
/* ── 자기점검 — node tools/collect-worknet.mjs --자기점검 ───────────
 * 워크넷 상세 두 칸 자기점검 (2026-10-23 세중님 2번).
 * API 도 DB 도 안 두드립니다 — `한칸()` 이 응답 글에서 칸을 제대로 집나만 봅니다.
 * 견본은 **실제 응답에서 본 꼴**입니다 (rcptMthd 「이메일」 · homePg 는 빈 칸). */
if (process.argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 견본 = [
    '<wantedDtl>',
    '  <wantedAuthNo>K180012610190008</wantedAuthNo>',
    '  <rcptMthd>이메일</rcptMthd>',
    '  <homePg>http://www.example-hosp.or.kr</homePg>',
    '  <collectPsncnt>1</collectPsncnt>',
    '  <certificate>물리치료사</certificate>',
    '</wantedDtl>',
  ].join('\n');
  const 빈홈 = 견본.replace('<homePg>http://www.example-hosp.or.kr</homePg>', '<homePg></homePg>');
  const 없는것 = 견본.replace(/<homePg>.*<\/homePg>/, '');

  보('접수방법을 원문 그대로 집는다', 한칸(견본, 'rcptMthd') === '이메일');
  보('홈페이지 주소를 집는다', 한칸(견본, 'homePg') === 'http://www.example-hosp.or.kr');
  보('빈 칸이면 빈 글자', 한칸(빈홈, 'homePg') === '');
  보('칸이 아예 없으면 빈 글자', 한칸(없는것, 'homePg') === '');
  보('다른 칸은 그대로', 한칸(견본, 'collectPsncnt') === '1' && 한칸(견본, 'certificate') === '물리치료사');
  /* ★ 빈 값이면 detail 에 **열쇠를 안 넣는** 꼴인지 — collect_put 이 합치므로
     빈 글자를 넣으면 전에 찬 값을 덮습니다 (세중님 — null 로 덮지 않기) */
  const 담기 = (상) => ({ ...(상.접수방법 ? { 접수방법: String(상.접수방법) } : {}),
                        ...(상.홈페이지 ? { 기관홈페이지: String(상.홈페이지) } : {}) });
  보('값이 있으면 두 열쇠가 들어간다',
    Object.keys(담기({ 접수방법: '이메일', 홈페이지: 'http://a.b' })).length === 2);
  보('★ 빈 값이면 열쇠가 **아예 없다** (덮지 않습니다)',
    Object.keys(담기({ 접수방법: '', 홈페이지: '' })).length === 0);
  보('한쪽만 있으면 한 열쇠만', Object.keys(담기({ 접수방법: '방문', 홈페이지: '' })).length === 1);

  /* ★ 접수방법손질 — 실제로 온 값으로 (2026-10-23) */
  보('기타 괄호 속 메일을 떼어낸다',
    접수방법손질('방문,우편,기타(이메일 : entl9156@naver.com)') === '방문,우편,기타');
  보('기타 괄호 속 전화를 떼어낸다',
    접수방법손질('고용24,기타(▣전화(010-1234-5678), 이메일 등)') === '고용24,기타');
  보('★ 자사채용사이트 주소는 **남긴다**',
    접수방법손질('자사채용사이트(https://www.redcross.or.kr/a/b.do),기타(온라인 접수)')
      === '자사채용사이트(https://www.redcross.or.kr/a/b.do),기타');
  보('괄호가 없으면 그대로', 접수방법손질('방문,팩스,고용24,이메일') === '방문,팩스,고용24,이메일');
  보('기타 뒤에 다른 말이 오면 그것은 남긴다',
    접수방법손질('기타(전화 010-1-2),이메일') === '기타,이메일');
  보('빈 값은 빈 값', 접수방법손질('') === '');
  /* ★ 홈페이지손질 — 기관이 홈페이지 칸에 **메일**을 적은 일이 있었습니다 (2026-10-24) */
  보('★ 메일 주소는 담지 않는다', 홈페이지손질('silverhp@naver.com') === '');
  보('주소는 그대로', 홈페이지손질('http://www.a-hosp.or.kr') === 'http://www.a-hosp.or.kr');
  보('www 로 시작해도 담는다', 홈페이지손질('www.mabokgi.com') === 'www.mabokgi.com');
  보('길이 붙어도 담는다', 홈페이지손질('a.or.kr/recruit?x=1') === 'a.or.kr/recruit?x=1');
  보('전화번호는 안 담는다', 홈페이지손질('054-123-4567') === '');
  보('「없음」 같은 말은 안 담는다', 홈페이지손질('없음') === '');
  보('날짜 꼴도 안 담는다 (글자 TLD 가 없습니다)', 홈페이지손질('2026.10.28') === '');
  보('빈 값은 빈 값', 홈페이지손질('') === '');

  보('★ 손질한 값에 메일·전화가 **없다**',
    !/@|[0-9]{2,4}-[0-9]{3,4}-[0-9]{4}/.test(
      접수방법손질('고용24,이메일,기타(이메일( a.b@c.d ) 접수 * 전화 010-1234-5678)')));

  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}


async function 상세한건(번호, svc) {
  const r = await 받기(주소만들기({ callTp: 'D', wantedAuthNo: 번호, infoSvc: svc }));
  호출수++; 세기('상세');            /* 하루 호출 수 — 목록·상세 따로 (2026-10-19) */
  if (r.code !== 200 || !/<wantedDtl[\s>]/.test(r.글)) {
    return { 탈: 'HTTP ' + r.code + ' ' + 가리기(r.글).replace(/\s+/g, ' ').slice(0, 120) };
  }
  /* 뽑는 자리는 `워크넷상세칸.mjs` **한 자리**입니다 (지침 6절).
     ★ 제목은 **추가 호출 0** 으로 얻습니다 — 이 응답을 이미 받고 있었고
       `wantedTitle` 만 안 읽고 있었습니다 (2026-10-19) */
  const 칸 = 워크넷상세칸(r.글);
  return {
    인원: 한칸(r.글, 'collectPsncnt'),
    자격: 한칸(r.글, 'certificate'),
    급여: 한칸(r.글, 'salTpNm').replace(/,\s*$/, '').slice(0, 120),
    제목: 칸.제목 || '',
    /* ★ 2026-10-23 세중님 2번 — **접수방법·기관 홈페이지.** 추가 호출 0 입니다
       (이 응답을 이미 받고 있었고 두 칸만 안 읽고 있었습니다 · 지침 4절).
       `rcptMthd` 는 **글**입니다(이 공고는 「이메일」). 값 목록을 보고 갈래를
       정하기 전까지 **손질하지 않고 원문 그대로** 담습니다 (세중님 — 값 짐작 금지).
       `homePg` 는 기관 홈페이지입니다 — **채용 페이지가 아닙니다.** */
    /* ★ 2026-10-23 — 「기타(…)」 속 메일·전화를 **담지 않습니다** (접수방법손질) */
    접수방법: 접수방법손질(한칸(r.글, 'rcptMthd')).slice(0, 160),
    /* ★ 2026-10-24 — **주소 꼴이 아니면 담지 않습니다** (홈페이지손질).
       기관이 홈페이지 칸에 **메일 주소**를 적어 넣습니다 — 경상북도립김천노인전문
       요양병원이 `silverhp@naver.com` 이었고, 그것이 `detail.기관홈페이지` 로
       **회원 화면까지** 갔습니다 (허용 목록을 올린 뒤에도 남은 1건이 이것입니다) */
    홈페이지: 홈페이지손질(한칸(r.글, 'homePg')).slice(0, 300),
  };
}

/* 한 번 받은 번호를 기억합니다 — 번호 → smodifyDtm */
const 상세기억터 = () => 로그터 + '/워크넷_상세받음.json';
function 상세기억읽기() {
  try { return JSON.parse(fs.readFileSync(상세기억터(), 'utf8')); } catch { return {}; }
}
function 상세기억쓰기(표) {
  try {
    fs.mkdirSync(로그터, { recursive: true });
    fs.writeFileSync(상세기억터(), JSON.stringify(표, null, 1));
  } catch (e) { console.error('상세 기억 못 남김 · ' + String(e.message).slice(0, 120)); }
}

/* ── 본체 ─────────────────────────────────────────────────── */
const t0 = Date.now();
if (한줄) console.log = () => {};

/* 오늘 이미 막힌 출처면 **두드리지 않습니다** (2026-10-19 세중님 2번).
   호출을 더 써서 한도를 더 밀어내지 않고, 멈춘 것을 메일로 알립니다 */
for (const 이름 of ['WN2', 'WN2-목록']) {
  const 막 = 막혔나(이름);
  if (막) {
    console.error('★ 고용24(' + 이름 + ')가 오늘 막혔습니다 — ' + 막.수 + '번 · ' + 막.까닭);
    console.error('  이 바퀴는 **아무것도 하지 않습니다**. 아침 메일에 뜹니다');
    process.exit(0);
  }
}

console.log('워크넷 새 수집기 (' + SOURCE + ') · '
  + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + (dry ? ' · **--dry**' : ''));
console.log('  규칙 구운 날  ' + 구운날);
console.log('  열쇠          고용24 authKey ' + (cfg.WORK_KEY ? '있음 (' + cfg.WORK_KEY.length + '자)' : '**없음**')
  + ' · Supabase ' + (cfg.SUPABASE_ANON_KEY ? '있음' : '**없음**')
  + ' · collect_put ' + (cfg.COLLECT_KEY_WN2 ? '있음' : '**없음**'));
console.log('  직종          ' + 직종.map((c) => c + ' ' + 직종이름[c]).join(' · '));
if (!cfg.WORK_KEY) { console.error('WORK_KEY 가 없습니다'); process.exit(1); }
if (!dry && !cfg.COLLECT_KEY_WN2) { console.error('COLLECT_KEY_WN2 가 없습니다'); process.exit(1); }

const 셈 = {
  읽은줄: 0, 남의직종: 0, 남의자리: 0, 마감지남: 0,
  회원: 0, 보류: 0, 쓰레기: 0, 못받은쪽: 0,
  날짜섞임: 0, 기호겹침: 0, 지역고침: 0, 사업자번호: 0,
  코드틀림: 0,
};
const 보기 = { 날짜: [], 기호: [], 지역: [], 남의직종: [], 코드틀림: [] };

/* ── 이상한 응답을 스스로 잡습니다 (2026-10-02) ──────────────────
   고용24 는 **하루 호출 한도를 어디에도 밝히지 않습니다.** 문서 두 곳,
   data.go.kr, 응답 헤더 13개, 응답 본문을 다 봤는데 없었습니다.
   그래서 주기를 하루 3회 → 16회로 올리면서 「이상하면 바로 멈추는」 장치를 둡니다.

   정상 응답은 반드시 <wantedRoot> 로 시작합니다. 200 인데 그게 아니면
   (한도 초과·열쇠 거절·점검 화면 등) **원문을 남기고 exit 1 로 멈춥니다.**
   그러면 ~/워크넷크론.sh 가 주기를 하루 3회로 되돌립니다. */
const 로그터 = (process.env.HOME || process.env.USERPROFILE || '.') + '/log';
function 이상한응답남기기(쪽, r) {
  try {
    fs.mkdirSync(로그터, { recursive: true });
    const 글 = '[' + new Date().toISOString() + '] ' + 쪽 + '쪽 · HTTP ' + r.code
      + ' · ' + (r.왜 || '') + '\n' + 가리기(r.글).slice(0, 1200) + '\n\n';
    fs.appendFileSync(로그터 + '/워크넷_이상.log', 글);
  } catch (e) { console.error('이상 기록 실패 · ' + String(e.message).slice(0, 120)); }
}
/* 하루 호출 수 — 나중에 한도를 문의할 때 근거로 씁니다 */
let 호출수 = 0;
function 호출수남기기() {
  try {
    fs.mkdirSync(로그터, { recursive: true });
    const 파일 = 로그터 + '/워크넷_호출수.json';
    let 표 = {};
    try { 표 = JSON.parse(fs.readFileSync(파일, 'utf8')); } catch { /* 처음이면 빈 표 */ }
    const 날 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    표[날] = (표[날] || 0) + 호출수;
    /* 60일치만 들고 있습니다 */
    const 날들 = Object.keys(표).sort();
    while (날들.length > 60) delete 표[날들.shift()];
    fs.writeFileSync(파일, JSON.stringify(표, null, 1));
    const 갈래 = 고용24남기기();   /* 목록·상세 따로 — 아침 메일이 읽습니다 */
    console.log('  호출 ' + 호출수 + '번 · 오늘 누적 ' + 표[날] + '번'
      + ' (목록 ' + 갈래.목록 + ' · 상세 ' + 갈래.상세 + ')'
      + ' · **한도는 신청 화면에 안 적혀 있습니다**');
    호출수 = 0;   /* 적은 만큼 비웁니다 — 상세까지 세려고 두 번 부릅니다 */
  } catch (e) { console.error('호출 수 기록 실패 · ' + String(e.message).slice(0, 120)); }
}

/* ── 덧갈래 — 면허 3 · 낱말 4 (2026-10-03 · 세중님 승인) ──────────
 *
 *  왜 붙이나 — 2026-10-03 짝 대조에서 **옛것만 읽은 접수 중 83건**이 나왔습니다.
 *  옛 WN(gas/wage.js 2577줄 WN_QUERIES)은 여덟 갈래로 찾는데 여기는 직종코드
 *  한 갈래뿐이었습니다. 「요양원인데 제목에 물리치료사가 있는」 공고가
 *  낱말 검색으로만 잡힙니다.
 *
 *  호출을 줄이는 방식 (세중님이 못 박으신 것)
 *    · 직종코드 갈래는 **그대로** — 하루 16회 · 최대 10쪽
 *    · 덧갈래는 `--덧` 을 줄 때만 돕니다 — 하루 3회 · **갈래마다 첫 쪽만**
 *      → 한 바퀴 7회. 첫 쪽이 꽉 차고 맨 아래가 처음 보는 번호면 그때만 한 쪽 더
 *    · 순찰 기억으로 이미 판정한 번호는 상세를 안 엽니다
 *    · 이상한 응답을 받으면 **그 갈래만** 접고 넘어갑니다 (직종 갈래와 달리
 *      전체를 멈추지 않습니다 — 덧갈래는 거드는 것이라 하나 빠져도 본 목록은 옵니다)
 *
 *  옛 WN 과 같은 값입니다. 짐작해 만들지 않았습니다 — gas 에서 그대로 옮겼습니다. */
const 덧갈래 = [
  ['면허6006184', { certLic: '6006184' }],
  ['면허6006189', { certLic: '6006189' }],
  ['면허6099839', { certLic: '6099839' }],
  ['낱말작업치료', { keyword: '작업치료' }],
  ['낱말작업치료사', { keyword: '작업치료사' }],
  ['낱말물리치료', { keyword: '물리치료' }],
  ['낱말물리치료사', { keyword: '물리치료사' }],
];

console.log('\n① 목록 —');
const 모은것 = [];
let 전체 = null;
let 이상 = false;
for (let 쪽 = 1; 쪽 <= 최대쪽; 쪽++) {
  const r = await 받기(주소만들기({ callTp: 'L', startPage: 쪽, display: 100, occupation: 직종.join('|') }));
  호출수++; 세기('목록');
  /* ★ 2026-10-19 세중님 2번 — 막힘을 **고용24한도 한 자리**에서 가립니다 */
  const 막힘L = 막힘인가(r.code, r.글);
  if (막힘L && !/<wantedRoot[s>]/.test(String(r.글 || ''))) {
    const 상태 = 막힘적기('WN2-목록', 막힘L, r.글);
    if (상태.멈춤) {
      console.error('  ★ 고용24 목록이 막혔습니다 — ' + 상태.수 + '번 · ' + 막힘L);
      console.error('    오늘은 여기서 접습니다. 응답 원문은 log/고용24_막힘.log 에 있습니다');
      이상 = true; break;
    }
  }
  if (r.code !== 200 || !r.글) {
    셈.못받은쪽++;
    이상 = true;
    이상한응답남기기(쪽, r);
    console.error('  ★ ' + 쪽 + '쪽 HTTP ' + r.code + ' · ' + (r.왜 || '')
      + ' · 응답 앞 500자 — ' + 가리기(r.글).replace(/\s+/g, ' ').slice(0, 500));
    break;
  }
  /* 200 인데 wantedRoot 가 아니면 한도 초과·열쇠 거절·점검 화면입니다 */
  if (!/<wantedRoot[\s>]/.test(r.글)) {
    셈.못받은쪽++;
    이상 = true;
    이상한응답남기기(쪽, r);
    console.error('  ★ ' + 쪽 + '쪽 HTTP 200 인데 wantedRoot 가 아닙니다'
      + ' · ' + r.글.length + '자 · 앞 500자 — ' + 가리기(r.글).replace(/\s+/g, ' ').slice(0, 500));
    break;
  }
  if (전체 === null) {
    전체 = Number((r.글.match(/<total>(\d+)<\/total>/) || [])[1] || 0);
    console.log('  접수 중인 공고 ' + 전체 + '건');
  }
  const 줄 = 아이템들(r.글);
  if (!줄.length) break;
  셈.읽은줄 += 줄.length;
  모은것.push(...줄);
  console.log('  ' + 쪽 + '쪽 ' + 줄.length + '건');
  if (모은것.length >= 전체) break;
  await 쉼(400);
}
console.log('  읽은 줄 ' + 셈.읽은줄 + (셈.못받은쪽 ? ' · 못 받은 쪽 ' + 셈.못받은쪽 : ''));

/* ── ①-2 덧갈래 (--덧 일 때만) ────────────────────────────────── */
if (덧켬 && !이상) {
  console.log('\n①-2 덧갈래 — 면허 3 · 낱말 4 (갈래마다 첫 쪽만)');
  const 이미 = new Set(모은것.map((x) => String(x.wantedAuthNo || '')));
  for (const [이름, 인자] of 덧갈래) {
    let 더한것 = 0;
    for (let 쪽 = 1; 쪽 <= 덧최대쪽; 쪽++) {
      const r = await 받기(주소만들기({ callTp: 'L', startPage: 쪽, display: 100, ...인자 }));
      호출수++; 세기('목록');
      /* 이상한 응답이면 **그 갈래만** 접습니다. 본 목록은 이미 받았습니다 */
      if (r.code !== 200 || !r.글 || !/<wantedRoot[\s>]/.test(r.글)) {
        셈.못받은쪽++;
        이상한응답남기기(이름 + ' ' + 쪽 + '쪽', r);
        console.error('  ★ ' + 이름 + ' ' + 쪽 + '쪽 — HTTP ' + r.code
          + (r.글 && !/<wantedRoot[\s>]/.test(r.글) ? ' (200 인데 wantedRoot 가 아닙니다)' : '')
          + ' · 이 갈래만 접습니다 · 앞 300자 — '
          + 가리기(String(r.글 || '')).replace(/\s+/g, ' ').slice(0, 300));
        break;
      }
      const 줄 = 아이템들(r.글);
      if (!줄.length) break;
      let 새것 = 0;
      for (const x of 줄) {
        const no = String(x.wantedAuthNo || '');
        if (!no) continue;
        if (이미.has(no)) {
          /* 본 갈래가 **먼저** 집어간 줄입니다. 그래도 덧갈래에도 걸렸다는
             표시는 남겨야 합니다 — 안 그러면 겹치는 줄이 ㉮ 판정을 영영
             못 받습니다 (2026-10-04 에 「물리(작업)치료사 모집」이 그래서
             버려지고 있는 것을 보고 고쳤습니다) */
          const 먼저 = 모은것.find((y) => String(y.wantedAuthNo || '') === no);
          if (먼저 && !먼저.__덧) 먼저.__덧 = 이름;
          continue;
        }
        /* ㉮ 표시 — 덧갈래로 온 줄입니다. 직종코드가 우리 것이 아닐 수밖에
           없으므로(면허·낱말로 찾았으니) 아래 ②에서 코드 검사를 건너뛰고
           **제목으로** 가립니다 (2026-10-03 세중님 승인) */
        x.__덧 = 이름;
        이미.add(no); 모은것.push(x); 새것++;
      }
      더한것 += 새것;
      셈.읽은줄 += 줄.length;
      /* 첫 쪽이 꽉 차고(100건) 그 쪽에서 처음 보는 것이 있었으면 한 쪽 더.
         아니면 거기서 멈춥니다 — 호출을 아끼는 자리입니다 */
      if (줄.length < 100 || 새것 === 0) break;
      await 쉼(400);
    }
    console.log('  ' + 이름.padEnd(14) + '새로 더한 것 ' + 더한것 + '건');
  }
  console.log('  덧갈래 뒤 모은 것 ' + 모은것.length + '건');
}

호출수남기기();
/* 이상한 응답을 한 번이라도 받으면 **담지 않고 멈춥니다.**
   반쪽만 읽은 목록으로 담으면 멀쩡한 공고가 사라진 것처럼 보입니다.
   exit 1 을 보고 ~/워크넷크론.sh 가 주기를 하루 3회로 되돌립니다 */
if (이상) {
  console.error('\n★ 이상한 응답을 받아 멈춥니다 — 담지 않았습니다');
  console.error('   원문은 ' + 로그터 + '/워크넷_이상.log 에 남겼습니다');
  process.exit(1);
}

/* ── ② 거르고 다듬기 ──────────────────────────────────────── */
const 오늘 = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const 볼것 = [];
for (const r of 모은것) {
  /* ② 우리 직종이 아닌 것은 여기서 거릅니다.
     **다만 제목에 우리 직군이 또렷하면 버리지 않고 보류함으로 보냅니다** (2026-10-02).
     사업주가 직종코드를 엉뚱하게 넣는 일이 있습니다. 실측으로 확인했습니다 —
       대명노인전문요양원 「물리치료사/작업치료사 채용」   jobsCd 307903
       삼성요양원 「… 작업,물리치료사 …」               jobsCd 550100 (요양보호사)
     우리가 받는 코드는 306500·306501·306502 뿐이라, 코드만 믿으면 이런 공고를
     **조용히 버립니다.** 「못 가린 공고는 버리지 말고 보류함으로」가 우리 원칙입니다.
     제목에 우리 직군이 없는 것(운동처방사·특수교사·요양보호사 강사 등)은
     지금처럼 버립니다 — 그래야 보류함이 안 넘칩니다. */
  /* ㉮ 덧갈래로 온 줄 — 직종코드 검사를 건너뜁니다 (2026-10-03 세중님 승인).
     면허·낱말로 찾아온 것이라 코드가 우리 것일 리가 없습니다. 코드로 거르면
     **덧갈래를 붙인 뜻이 통째로 없어집니다.**
     대신 tools/덧갈래판정.mjs 가 제목으로 가립니다 — 새 앱의 판정
     (gas-rules · 뽑을단어)을 그대로 쓰고 그 위에 세 겹만 얹은 것입니다.
       · 시설 설명인가   「물리치료실 완비 요양보호사 모집」을 안 올립니다
       · 괄호 꼴         「물리(작업)치료사」를 우리 직군으로 읽습니다
       · 잘린 제목       「… 공공어린이재활의료센터(목포중앙병원) ...」을 안 버립니다 */
  /* ★ 직종코드가 **이미 우리 것**이면 ㉮ 판정을 쓰지 않습니다.
     고용24가 우리 직종이라고 적어 준 공고는 그걸로 확인된 것입니다.
     제목만 보고 다시 가리면 「○○요양원 직원 채용」처럼 제목이 뭉뚱그려진
     멀쩡한 공고가 보류함으로 떨어집니다.
     2026-10-04 에 이걸 빠뜨려 회원 목록이 243 → 230 으로 줄었습니다. */
  if (r.__덧 && !직종.includes(String(r.jobsCd || ''))) {
    const 가림 = 덧갈래가리기({ 제목: String(r.title || ''), 기관: String(r.company || '') });
    if (가림.갈래 === '버림') {
      셈.남의직종++;
      if (보기.남의직종.length < 5) 보기.남의직종.push('[덧] ' + String(r.title || '').slice(0, 40));
      continue;
    }
    r.__덧판정 = 가림;          // 아래 ③에서 회원목록/보류함을 가릅니다
  } else if (!직종.includes(String(r.jobsCd || ''))) {
    const 제목만 = String(r.title || '');
    /* 괄호 꼴을 펼쳐서 봅니다 — 「물리(작업)치료사」를 matchJob 이 못 읽습니다.
       2026-10-04 에 「* 물리(작업)치료사 모집」(jobsCd 307903)이 조용히
       버려지고 있는 것을 보고 넣었습니다. 펼친 말을 뒤에 붙이면
       matchJob 이 둘 다 보고 「공통」까지 알아서 가립니다 */
    const 펼친말 = 괄호풀기(제목만);
    const 볼제목 = 펼친말.length ? 제목만 + ' ' + 펼친말.join(' ') : 제목만;
    const 우리것 = matchJob(볼제목) && !notOurs(제목만);
    if (!우리것) {
      셈.남의직종++;
      if (보기.남의직종.length < 5) 보기.남의직종.push(String(r.jobsCd) + ' · ' + 제목만.slice(0, 40));
      continue;
    }
    셈.코드틀림++;
    if (보기.코드틀림.length < 8) {
      보기.코드틀림.push('jobsCd ' + String(r.jobsCd) + ' · ' + String(r.company || '').slice(0, 18)
        + ' · ' + 제목만.slice(0, 40));
    }
    r.__코드틀림 = String(r.jobsCd || '');
  }
  const 제목 = String(r.title || '').trim();
  if (!제목) continue;
  /* ④ 원문(푸는 앞)을 봐야 합니다 */
  const 제목원문 = String((r.원문 || {}).title || '');
  if (/&amp;|&lt;|&gt;|&#/.test(제목원문)) {
    셈.기호겹침++;
    if (보기.기호.length < 3) 보기.기호.push('「' + 제목원문.slice(0, 48) + '」  →  「' + 제목.slice(0, 48) + '」');
  }

  /* ① 마감일 — 「채용시까지  26-11-07」 이 66% */
  const 섞임 = 채용시까지인가(r.closeDt);
  if (섞임) 셈.날짜섞임++;
  const 마감 = 날짜풀기(r.closeDt);
  if (섞임 && 보기.날짜.length < 3) 보기.날짜.push(String(r.closeDt) + '  →  ' + String(마감));
  if (마감 && 마감 < 오늘) { 셈.마감지남++; continue; }

  /* ⑤ 지역 */
  const 지역0 = String(r.region || '');
  const 지역 = 지역손질(지역0);
  if (지역 !== 지역0) { 셈.지역고침++; if (보기.지역.length < 3) 보기.지역.push('「' + 지역0 + '」 → 「' + 지역 + '」'); }

  if (r.busino) 셈.사업자번호++;

  /* 직군 — jobsCd 가 이미 우리 직종이라 확정입니다.
     306500(물리및작업치료사)은 둘 다이므로 「공통」 */
  const 직군코드 = String(r.jobsCd) === '306501' ? '물리치료사'
    : String(r.jobsCd) === '306502' ? '작업치료사' : '공통';
  const 제목직군 = matchJob(제목);
  if (notOurs(제목) || titleOtherOnly(제목)) { 셈.남의자리++; continue; }

  볼것.push({
    r, 제목, 지역, 마감, 섞임,
    직군: 제목직군 || 직군코드,
    근거: 제목직군 ? '제목' : '고용24 직종코드 ' + r.jobsCd,
  });
}
console.log('\n② 거르기 — 우리 직종이 아닌 것 ' + 셈.남의직종 + '건 · 남의 자리 ' + 셈.남의자리
  + '건 · 마감 지난 것 ' + 셈.마감지남 + '건 뺐습니다');
console.log('  고친 것 — 마감일 섞임 ' + 셈.날짜섞임 + '건 · 제목 기호 겹침 ' + 셈.기호겹침
  + '건 · 지역 ' + 셈.지역고침 + '건 · 사업자번호 ' + 셈.사업자번호 + '건 저장');
if (보기.남의직종.length) console.log('  남의 직종 보기 — ' + 보기.남의직종.join(' / '));
/* ★ 이 보고는 **거르기 고리 뒤**에 있어야 합니다 — 목록 받기 요약에 붙였더니
   셈이 아직 0 일 때 찍혀 아무것도 안 나왔습니다 (2026-10-02 에 그렇게 틀렸습니다) */
if (셈.코드틀림) {
  console.log('\n  ★ 직종코드는 남의 것인데 제목에 우리 직군이 있는 공고 '
    + 셈.코드틀림 + '건 — 회원 목록으로 (근거에 코드를 남깁니다)');
  for (const x of 보기.코드틀림) console.log('     ' + x);
}
if (보기.기호.length) 보기.기호.forEach((x) => console.log('  제목 기호 — ' + x));
if (보기.날짜.length) 보기.날짜.forEach((x) => console.log('  마감일 — ' + x));
if (보기.지역.length) 보기.지역.forEach((x) => console.log('  지역 — ' + x));

/* ── ②-2 상세 (callTp=D) ──────────────────────────────────── */
const 상세값 = new Map();        /* 번호 → { 인원, 자격, 급여 } */
const 상세탈 = [];
if (!dry || 상세시험) {
  const 기억 = 상세기억읽기();
  /* ① 먼저 기억에 있는 값을 그대로 싣습니다.
     collect_put 이 headcount·detail 을 excluded 로 덮기 때문에, 이번에 상세를
     안 받은 공고도 값을 실어 보내야 **어제 받은 인원이 null 로 지워지지
     않습니다.** 40건씩 묶어 받는 것과 한 쌍입니다 */
  for (const v of 볼것) {
    const 번호 = String(v.r.wantedAuthNo || '');
    const 옛 = 기억[번호];
    /* ★ 2026-10-19 — 제목이 **잘렸는데 기억에 온전한 제목이 없으면** 기억을
       안 믿고 상세를 다시 받습니다. 그래야 잘린 제목이 스스로 고쳐집니다.
       (14:27 에 이것이 없어서, 되메운 제목 95건이 잘린 목록 제목으로
        되돌아갔습니다. 창구에도 가드를 걸었지만 **채우는 쪽도** 고쳐야
        제목이 온전해집니다 — 가드는 지키고 이쪽은 채웁니다) */
    const 제목잘림 = /(\.\.\.|…)\s*$/.test(String(v.제목 || ''));
    if (옛 && 옛.m === String(v.r.smodifyDtm || '-') && !(제목잘림 && !옛.t)) {
      상세값.set(번호, { 인원: 옛.n || '', 자격: 옛.c || '', 급여: 옛.s || '', 제목: 옛.t || '',
        접수방법: 옛.a || '', 홈페이지: 옛.h || '' });
    }
  }
  /* ② 새 번호이거나 원 출처가 고친 것(smodifyDtm 이 달라진 것)만 받습니다 */
  const 할것 = 볼것.filter((v) => {
    const 번호 = String(v.r.wantedAuthNo || '');
    if (!번호 || !v.r.infoSvc) return false;
    return !상세값.has(번호);
  });
  const 받을것 = 할것.slice(0, 상세최대);
  console.log('\n②-2 상세 — 받을 것 ' + 할것.length + '건 중 ' + 받을것.length + '건'
    + (할것.length > 받을것.length ? ' (--상세최대=' + 상세최대 + ' · 남은 것은 다음 번에)' : ''));
  for (const v of 받을것) {
    const 번호 = String(v.r.wantedAuthNo);
    const r = await 상세한건(번호, String(v.r.infoSvc));
    if (r.탈) {
      상세탈.push(번호 + ' · ' + r.탈);
      /* 연달아 실패하면 한도일 수 있습니다 — 그 자리에서 멈추고 목록은 그대로 담습니다 */
      if (상세탈.length >= 5) { console.error('   ★ 연달아 다섯 번 실패 — 상세만 접습니다'); break; }
    } else {
      상세값.set(번호, r);
      기억[번호] = { m: String(v.r.smodifyDtm || '-'), n: r.인원, c: r.자격, s: r.급여, t: r.제목,
        /* ★ 2026-10-23 — 기억에도 담습니다. 안 담으면 **기억으로 넘긴 바퀴**에서
           두 칸이 빈 채로 가고, collect_put 이 빈 값을 안 덮긴 하지만 새로 찬
           칸도 안 생깁니다 (지침 9절 — 이미 쌓인 자료는 안 고쳐집니다) */
        a: r.접수방법, h: r.홈페이지 };
    }
    await 쉼(300);
  }
  /* 지금 목록에 없는 번호는 기억에서 지웁니다 — 워크넷은 마감되면 목록에서 뺍니다 */
  const 살아있는 = new Set(볼것.map((v) => String(v.r.wantedAuthNo || '')));
  for (const k of Object.keys(기억)) if (!살아있는.has(k)) delete 기억[k];
  if (!dry) 상세기억쓰기(기억);
  const 셈3 = { 인원: 0, 자격: 0, 급여: 0, 제목: 0 };
  for (const v of 상세값.values()) for (const k of Object.keys(셈3)) if (v[k]) 셈3[k]++;
  console.log('   실어 보낼 것 ' + 상세값.size + '건 (기억분 포함) · 못 받음 ' + 상세탈.length + '건'
    + ' — 모집인원 ' + 셈3.인원 + ' · 지원자격 ' + 셈3.자격 + ' · 급여 ' + 셈3.급여
    + ' · 온전한 제목 ' + 셈3.제목);
  for (const t of 상세탈.slice(0, 3)) console.error('   ✗ ' + t);
  호출수남기기();        /* 상세로 쓴 호출도 오늘 누적에 넣습니다 */
}

/* ── ③ 갈래 ───────────────────────────────────────────────── */
const 회원 = [], 보류 = [], 쓰레기 = [];
for (const v of 볼것) {
  const r = v.r;
  const 종별 = 기관종별(r.indTpNm, r.company);
  /* 나중에 만들 「전체 / 병원 / 요양」 화면용. **아직 화면에 안 씁니다** */
  const 구분 = 시설구분(종별.종별, r.company);
  /* 상세에서 받은 것 — 없으면 전과 똑같이 돕니다 */
  const 상 = 상세값.get(String(r.wantedAuthNo || '')) || {};
  const 줄 = {
    id: 'WN' + String(r.wantedAuthNo || ''),      /* 옛 수집기와 같은 규칙 — 겹치면 안 덮습니다 */
    external_id: String(r.wantedAuthNo || ''),
    org_name: String(r.company || '').trim(),
    /* 제목 — 목록 API 가 30자로 자릅니다. 상세의 `wantedTitle` 이 온전합니다.
       ★ **잘린 것만** 바꿉니다. 그리고 `--제목도` 를 적어야 바꿉니다 —
         `collect_put` 은 같은 출처면 title 을 덮으므로, 승인 전에 켜면
         기존 72건이 이 길로 슬그머니 바뀝니다 (세중님 3번은 「마른 실행 →
         견본 10 → 승인 → 실행」 입니다). 승인 뒤에 이 꼭지를 지웁니다 */
    title: (제목도 && /(\.\.\.|…)\s*$/.test(String(v.제목 || '')) && 상.제목)
      ? 상.제목 : v.제목,
    employ_type: 고용형태(r.empTpCd),
    work_place: 지역손질(r.basicAddr || ''),
    sido: (v.지역.split(' ')[0] || ''),
    sgg: (v.지역.split(' ').slice(1).join(' ') || ''),
    edu: [r.minEdubg, r.maxEdubg].filter(Boolean).join('~'),
    /* 모집 인원 — 상세의 collectPsncnt. 공고 하나에 직종 하나(jobsNm)라
       **우리 직군 몫**입니다 (통합 공고가 아닙니다 · 작업지침 15절) */
    ...(/^[0-9]+$/.test(String(상.인원 || '')) ? { headcount: Number(상.인원) } : {}),
    apply_to: v.마감,
    deadline_src: v.마감 ? 'API:워크넷' : null,
    posted_at: 날짜풀기(r.regDt),
    url: String(r.wantedInfoUrl || ''),           /* 약속 — 원문·지원은 고용24 원본으로 */
    job_group: v.직군,
    org_kind: 종별.종별,
    detail: {
      출처: '고용24',                              /* 약속 — 출처를 밝힙니다 */
      근거: v.근거,
      직종코드: String(r.jobsCd || ''),
      직종이름: 직종이름[r.jobsCd] || '',
      사업자번호: String(r.busino || ''),          /* ⑥ 심평원 자료와 이을 용도 */
      업종: String(r.indTpNm || ''),
      급여: [r.salTpNm, r.sal].filter(Boolean).join(' '),
      /* 화면이 읽는 이름은 「지원자격」·「연봉」 입니다 (web/app/jobs/[id]/page.tsx).
         목록의 salTpNm 은 「월급」 한 낱말뿐이고, 상세의 salTpNm 은
         「월급2,413,950원 이상 ~ 2,413,950원 이하」 로 옵니다 */
      ...(상.자격 ? { 지원자격: String(상.자격).slice(0, 300) } : {}),
      ...(상.급여 && /[0-9]/.test(상.급여) ? { 연봉: 상.급여 } : {}),
      /* ★ 2026-10-23 세중님 2번 — 접수방법·기관 홈페이지.
         **빈 값이면 열쇠를 아예 안 넣습니다** — collect_put 이 detail 을 합치므로
         (`j.detail || excluded.detail`) 빈 글자를 넣으면 **전에 찬 값을 덮습니다**
         (세중님 — null 로 덮지 않기).
         ★ 세중님 글에는 「뽑은값에」라고 적혀 있었는데 **detail 에 담았습니다** —
           까닭 하나입니다: collect_put 의 `뽑은때` 가
             case when excluded."뽑은값" = '{}' then j."뽑은때" else now() end
           이라, 수집기가 뽑은값을 보내기 시작하면 **공고마다 「공고문 읽은 때」가
           바퀴마다 지금으로** 바뀝니다. 그 값이 거짓이 됩니다.
           detail 도 같은 jsonb 이고 **합쳐지며**(표·칸 추가 없음) 이 수집기의
           다른 API 칸들(직종코드·업종·급여·경력)이 이미 그 자리에 있습니다.
           뽑은값으로 옮기라 하시면 한 줄입니다 */
      ...(상.접수방법 ? { 접수방법: String(상.접수방법) } : {}),
      ...(상.홈페이지 ? { 기관홈페이지: String(상.홈페이지) } : {}),
      경력: String(r.career || ''),
      휴일: String(r.holidayTpNm || ''),
      시설구분: 구분,                              /* 병원 · 요양·주간보호 · 모름 */
      기관종별근거: 종별.왜,                        /* 업종 신고 · 이름 추정 */
      ...(v.섞임 ? { 마감메모: '채용시까지 (마감 전이라도 사람이 정해지면 닫힙니다)' } : {}),
      모바일: String(r.wantedMobileInfoUrl || ''),
    },
    evidence: {},
  };
  /* ★ 2026-10-19 세중님 4번 — **거르기는 온전한 제목으로** 합니다.
     목록 API 가 30자로 자르니 「… 서류전형 **합격자 발표**」 처럼 뒤에 있는
     결과 발표 글귀를 못 보고 회원 화면에 올릴 수 있습니다. ③ 갈래는 ②-2 상세
     **뒤**라 `상.제목` 이 이미 손에 있습니다 — 추가 호출 0.
     제목 칸을 바꾸는 것(--제목도)과는 **다른 일**입니다. 거르기는 늘 온전한
     제목으로 하고, 칸에 적는 제목만 승인 뒤에 바꿉니다 */
  const 거를제목 = (상.제목 && /(\.\.\.|…)\s*$/.test(v.제목)) ? 상.제목 : v.제목;
  if (거를제목 !== v.제목) 셈.온전한제목으로거름 = (셈.온전한제목으로거름 || 0) + 1;
  const 갈래 = sortJob(거를제목, v.직군, null);
  /* 직종코드가 틀린 공고 — **회원 목록으로 올립니다** (2026-10-02 세중님 결정).
     처음엔 보류함으로 보냈는데, 그러면 토요일 주인 넘기기 때 **지금 회원 화면에
     보이는 공고가 사라집니다.** 옛 WN 이 제목을 보고 이미 제대로 올려 둔 것을
     새 수집기가 치우는 꼴입니다.
     직군을 **못 가린** 게 아니라 **남이 코드를 잘못 넣은** 것입니다.
     그래서 제목으로 가린 직군 그대로 올리고, 근거에 코드만 적어 둡니다 —
     나중에 「코드가 틀린 공고가 얼마나 되나」를 셀 수 있게. */
  /* ㉮ 덧갈래로 온 줄은 덧갈래판정이 내린 대로 갑니다 */
  if (v.r && v.r.__덧판정) {
    const 가림 = v.r.__덧판정;
    if (가림.갈래 === '보이기') {
      v.__판정 = '회원목록';
      줄.hold = false;
      줄.evidence = { 덧갈래: v.r.__덧 + ' — ' + 가림.왜 };
      회원.push(줄); continue;
    }
    v.__판정 = '보류함';
    줄.hold = true;
    줄.evidence = { 보류사유: '[덧갈래 ' + v.r.__덧 + '] ' + 가림.왜 };
    보류.push(줄); continue;
  }
  if (v.r && v.r.__코드틀림) {
    v.__판정 = '회원목록';
    줄.hold = false;
    줄.evidence = { 직종코드다름: 'jobsCd ' + v.r.__코드틀림
      + ' — 우리 코드(306500·306501·306502)가 아닙니다. 제목으로 직군을 가렸습니다' };
    회원.push(줄); continue;
  }
  if (갈래.갈래 === '회원목록') { v.__판정 = '회원목록'; 회원.push(줄); continue; }
  if (갈래.갈래 === '쓰레기통') {
    /* 직종코드가 우리 것인데 갈래가 쓰레기통이면 사람이 봐야 합니다. 버리지 않습니다 */
    줄.hold = true;
    줄.evidence = { 보류사유: '고용24 직종코드는 우리 것인데 제목 규칙이 걸렀습니다 — ' + (갈래.왜 || '') };
    v.__판정 = '보류함';
    보류.push(줄); continue;
  }
  v.__판정 = '보류함';
  줄.hold = true; 보류.push(줄);
}
셈.회원 = 회원.length; 셈.보류 = 보류.length; 셈.쓰레기 = 쓰레기.length;
/* 내린 판정을 기억에 남깁니다 — 10/3 짝 대조용 (2026-10-02).
   워크넷 응답에는 **smodifyDtm(수정일시)** 가 있습니다 (예 202610011621).
   원 출처가 「언제 고쳤나」를 알려주면 그게 지문보다 정확합니다 —
   알리오·나라일터에는 그 칸이 없어서 목록 줄 지문을 쓰고 있습니다 */
if (!dry) {
  await 판정남기기(cfg, { 열쇠: cfg.COLLECT_KEY_WN2 || cfg.COLLECT_KEY_HS3 || '', source: SOURCE,
    줄들: 볼것.filter((v) => v.__판정 && v.r && v.r.wantedAuthNo)
      .map((v) => ({ 번호: String(v.r.wantedAuthNo), 판정: v.__판정,
        지문: 지문({ m: String(v.r.smodifyDtm || ''), t: v.제목 }) })) });
}
console.log('\n③ 갈래 — 회원 목록 ' + 셈.회원 + ' · 보류함 ' + 셈.보류 + ' · 쓰레기통 ' + 셈.쓰레기);
const 구분셈 = {};
회원.forEach((x) => { const g = x.detail.시설구분; 구분셈[g] = (구분셈[g] || 0) + 1; });
console.log('   시설 구분 (아직 화면에 안 씁니다) — '
  + Object.entries(구분셈).map(([k, v]) => k + ' ' + v).join(' · '));
const 종별셈 = {};
회원.forEach((x) => { 종별셈[x.org_kind] = (종별셈[x.org_kind] || 0) + 1; });
console.log('   기관종별 — ' + Object.entries(종별셈).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => k + ' ' + v).join(' · '));
if (회원.length) {
  console.log('\n  ★ 회원 목록에 올라갈 것 (앞 8건) —');
  회원.slice(0, 8).forEach((r) => console.log('     ' + String(r.job_group).padEnd(8)
    + String(r.employ_type || '').padEnd(10) + String(r.apply_to || '날짜없음').padEnd(12)
    + String(r.org_name).slice(0, 18).padEnd(20) + String(r.title).slice(0, 38)));
}

/* ── ④ 담기 ───────────────────────────────────────────────── */
async function rpc(fn, body) {
  const k = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY;   /* 창구는 service_role 로 (2026-10-11) */
  const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(fn + ' HTTP ' + r.status + ' · ' + t.slice(0, 250));
  try { return JSON.parse(t); } catch { return t; }
}

if (dry) {
  console.log('\n--dry 라 담지 않았습니다. ' + Math.round((Date.now() - t0) / 1000) + '초');
} else {
  let 담음 = 0;
  const 넣을것 = [...회원, ...보류];
  for (let i = 0; i < 넣을것.length; i += 100) {
    const r = await rpc('collect_put', { p_secret: cfg.COLLECT_KEY_WN2, p_source: SOURCE, p_rows: 넣을것.slice(i, i + 100) });
    담음 += r['담음'] || 0;
  }
  console.log('\n씀          ' + 담음 + '건');
  console.log(Math.round((Date.now() - t0) / 1000) + '초');
  try {
    await rpc('collect_beat', {
      p_secret: cfg.COLLECT_KEY_WN2, p_source: SOURCE,
      p_beat: { took_ms: Date.now() - t0, ok: true, 본곳: 1, 담음: 셈.회원 + 셈.보류,
        보류: 셈.보류, 버림: 셈.쓰레기, 못받음: 셈.못받은쪽,
        메모: { 읽은줄: 셈.읽은줄, 남의직종: 셈.남의직종, 마감지남: 셈.마감지남,
          날짜섞임: 셈.날짜섞임, 기호겹침: 셈.기호겹침, 지역고침: 셈.지역고침 } },
    });
  } catch (e) { console.error('박동 못 남김 · ' + String(e.message).slice(0, 120)); }

  /* ── 덧갈래 박동 (2026-10-04 세중님 지시) ──────────────────────
     덧갈래 크론(`워크넷덧크론.sh`)은 탈나면 **제 crontab 줄만 스스로 끕니다.**
     그러면 조용히 멈추고 아무도 모릅니다.

     그래서 `--덧` 으로 돌 때마다 **따로 박동을 남깁니다**(경로 WNX).
     크론이 스스로 꺼지면 박동이 끊기고, `beat_health()` 가 평소 간격의
     2배를 넘긴 것을 보고 관리자 화면(/admin/beat)에 **빨간 줄**을 띄웁니다.
     새 화면을 만들 필요가 없습니다 — 이미 있는 장치를 쓰는 것입니다. */
  if (덧켬) {
    try {
      await rpc('collect_beat', {
        p_secret: cfg.COLLECT_KEY_WN2, p_source: 'WNX',
        p_beat: { took_ms: Date.now() - t0, ok: true, 본곳: 덧갈래.length,
          담음: 셈.회원 + 셈.보류, 보류: 셈.보류,
          메모: { 덧갈래수: 덧갈래.length, 읽은줄: 셈.읽은줄 } },
      });
    } catch (e) { console.error('덧갈래 박동 못 남김 · ' + String(e.message).slice(0, 120)); }
  }
}

if (한줄) {
  console.error('── ' + SOURCE + ' · 읽은 줄 ' + 셈.읽은줄 + ' · 담은 줄 ' + (셈.회원 + 셈.보류)
    + ' · 회원 ' + 셈.회원 + ' · 보류 ' + 셈.보류 + ' · 쓰레기통 ' + 셈.쓰레기
    + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');
}
