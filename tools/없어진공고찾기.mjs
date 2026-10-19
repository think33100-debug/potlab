/* 회원 화면에서 **원문이 없어진 공고**를 찾습니다 (2026-10-18 세중님 1·2번)
 *
 *   node tools/없어진공고찾기.mjs --바퀴 1        1바퀴 (결과를 파일로 남깁니다)
 *   node tools/없어진공고찾기.mjs --바퀴 2        2바퀴 (1바퀴와 견줍니다)
 *   node tools/없어진공고찾기.mjs --견주기        두 바퀴 결과를 견주어 **내릴 목록**을 냅니다
 *   node tools/없어진공고찾기.mjs --바퀴 1 --정찰보고   결과를 alive_mark 에 보고합니다
 *                                                (창구가 seen_on·gone_streak 을 적고
 *                                                 gone_streak>=2 에서 스스로 내립니다)
 *   node tools/없어진공고찾기.mjs --자기점검
 *
 * ── 세중님 조건 ──────────────────────────────────────
 *   · **시간을 두고 두 번(최소 1시간 간격)** 「없어짐」 판정된 것만 내립니다
 *   · 응답 원문 앞부분과 판정 글귀를 로그에 남깁니다
 *   · **사이트 오류(5xx·타임아웃·빈 응답)는 없어짐으로 세지 않습니다**
 *
 * ── 어떻게 가리나 (출처마다 다릅니다) ──────────────────
 *   워크넷(WN·WN2) 306건   **상세 API** 한 번으로 됩니다 — 쪽을 열지 않습니다.
 *                          없어진 공고는 120자로 오고 `messageCd 006` ·
 *                          `정보가 존재하지 않습니다` 가 들어 있습니다.
 *                          (2026-10-18 에 살아 있는 공고 2,727자·항목 61개와
 *                           견주어 확인했습니다 — tools/워크넷_없어짐조사.mjs)
 *                          ★ 목록을 569쪽 넘겨 「사라짐」을 **추론**하지 않습니다.
 *                            사이트가 공고별로 직접 말해 줍니다
 *   그밖(ND2·HS·HS3·AL·CE2·GJ2)  쪽을 열어 `없어짐말` 로 봅니다.
 *                          같은 사이트 3.5초 이상 (지침)
 *
 * 없어짐말은 `hosp/hs_목록상태.mjs` **한 자리**에서 가져옵니다 (지침 6절).
 * 열쇠는 가립니다 (지침 8-11).
 *
 * ── 칸도 함께 받습니다 (2026-10-19 세중님 1번) ──────────
 * 세중님 지시 — 「이미 찬 것은 정찰(하루 1번)과 겹치게 — **같은 호출에서
 * 칸도 받기**」. 살아 있다고 판정한 공고의 **그 응답**에서 칸을 뽑아
 * `칸되메우기` 로 보냅니다. **추가 호출은 0** 입니다.
 *
 * ★ 왜 추가 호출을 안 늘리나 — 이 API 는 `x-ratelimit-*` 헤더를 **안 줍니다**
 *   (2026-10-19 에 상세·목록 둘 다 헤더를 전부 찍어 확인했습니다). 하루 한도를
 *   모르는 채로 호출을 늘리지 않습니다 (지침 3·4절).
 * ★ `--정찰보고` 일 때만 보냅니다 — 하루 한 번 도는 그 길입니다.
 *   `--칸안받기` 를 적으면 안 보냅니다 (판정만 보고 싶을 때).
 */
import fs from 'node:fs';
import { 없어짐말, 알림상태 } from './hosp/hs_목록상태.mjs';
import { 워크넷상세칸 } from './워크넷상세칸.mjs';
import { 고용형태판정 } from './공고문읽기.mjs';

const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 바퀴 = 값('--바퀴', '');
const 견주기 = argv.includes('--견주기');
const 안받기 = argv.includes('--칸안받기');
const 제목도 = argv.includes('--제목도');   /* 제목 되메우기는 승인 뒤에 (2026-10-19 3번) */
const 결과폴더 = '/home/ubuntu/log';
const 결과파일 = (n) => 결과폴더 + '/없어짐_' + n + '바퀴.json';

/* 워크넷 상세 응답이 「없어짐」 이라고 말하나 */
export function 워크넷없어짐(xml) {
  const s = String(xml || '');
  if (/<messageCd>\s*006\s*<\/messageCd>/.test(s)) return 'messageCd 006';
  const m = s.match(/<message>([^<]*)<\/message>/);
  if (m && 없어짐말.test(m[1])) return 'message 「' + m[1].trim() + '」';
  return null;
}

if (argv.includes('--자기점검')) {
  const 어겼나 = [];
  const 봐 = (n, c) => { if (!c) 어겼나.push(n); };
  const 없 = '<?xml version="1.0" encoding="UTF-8"?><wantedDtl><message>정보가 존재하지 않습니다.</message><messageCd>006</messageCd></wantedDtl>';
  const 산 = '<?xml version="1.0"?><wantedDtl><wantedAuthNo>KF1</wantedAuthNo><corpInfo><corpNm>주식회사</corpNm></corpInfo></wantedDtl>';
  봐('워크넷 없어짐 — 원문 그대로', 워크넷없어짐(없) === 'messageCd 006');
  봐('워크넷 살아 있음 — null', 워크넷없어짐(산) === null);
  봐('빈 값은 null', 워크넷없어짐('') === null && 워크넷없어짐(null) === null);
  봐('messageCd 가 006 이 아니면 안 걸림',
    워크넷없어짐('<wantedDtl><message>조회 성공</message><messageCd>000</messageCd></wantedDtl>') === null);
  /* 없어짐말이 한 자리에서 오나 */
  봐('없어짐말을 한 자리에서 가져온다', 없어짐말 instanceof RegExp);
  봐('없어짐말 — 치매센터 꼴', 없어짐말.test('게시물이 존재하지 않습니다'));
  if (어겼나.length) { console.error('✗ 자기 점검 실패 — ' + 어겼나.join(' · ')); process.exit(1); }
  console.log('○ 자기 점검 통과 — 워크넷 없어짐 판정 6가지 (사이트를 두드리지 않았습니다)');
  process.exit(0);
}

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
const WK = cfg.WORK_KEY;
const H = { apikey: K, Authorization: 'Bearer ' + K };
const 가리고 = (s) => String(s).replace(/authKey=[^&\s]+/g, 'authKey=‹열쇠›');
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 두 바퀴 견주기 ── */
if (견주기) {
  const a = JSON.parse(fs.readFileSync(결과파일(1), 'utf8'));
  const b = JSON.parse(fs.readFileSync(결과파일(2), 'utf8'));
  const 사이 = (new Date(b.잰때) - new Date(a.잰때)) / 60000;
  console.log('1바퀴 ' + a.잰때 + ' · 2바퀴 ' + b.잰때 + ' · 사이 ' + Math.round(사이) + '분');
  if (사이 < 60) console.log('★ 한 시간이 안 됐습니다 — 세중님 조건(최소 1시간)에 못 맞습니다');
  const A = new Map(a.없어짐.map((x) => [x.id, x]));
  const 둘다 = b.없어짐.filter((x) => A.has(x.id));
  const 한번만 = b.없어짐.filter((x) => !A.has(x.id));
  const 사라진것 = a.없어짐.filter((x) => !b.없어짐.some((y) => y.id === x.id));
  console.log('\n1바퀴 없어짐 ' + a.없어짐.length + '건 · 2바퀴 ' + b.없어짐.length + '건');
  console.log('★ **두 번 다 없어짐 ' + 둘다.length + '건** ← 내릴 것');
  console.log('   2바퀴에만 ' + 한번만.length + '건 (한 번만 — 안 내립니다)');
  console.log('   1바퀴에만 ' + 사라진것.length + '건 (2바퀴에 살아 있었습니다 — 안 내립니다)');
  const 출처별 = {};
  for (const x of 둘다) (출처별[x.source] ??= []).push(x);
  console.log('\n── 내릴 목록 (출처별) ──');
  for (const [s, xs] of Object.entries(출처별).sort((p, q) => q[1].length - p[1].length)) {
    console.log('  ' + s + ' ' + xs.length + '건');
    for (const x of xs) console.log('     ' + x.id + ' ' + String(x.org_name).slice(0, 16) + ' | '
      + String(x.title).slice(0, 26) + '\n        ' + x.왜 + ' · 앞부분 「' + String(x.앞부분).slice(0, 60) + '」');
  }
  console.log('\n── 오류였던 것 (없어짐으로 세지 않습니다) ──');
  console.log('  1바퀴 ' + a.오류.length + '건 · 2바퀴 ' + b.오류.length + '건');
  const 오류별 = {};
  for (const x of b.오류) 오류별[x.왜] = (오류별[x.왜] || 0) + 1;
  for (const [w, n] of Object.entries(오류별).sort((p, q) => q[1] - p[1])) console.log('     ' + String(n).padStart(3) + '건  ' + w);
  fs.writeFileSync(결과폴더 + '/없어짐_내릴목록.json', JSON.stringify({ 잰때: new Date().toISOString(), 내릴것: 둘다 }, null, 1));
  console.log('\n내릴 목록을 ' + 결과폴더 + '/없어짐_내릴목록.json 에 적었습니다 (아직 안 내렸습니다)');
  process.exit(0);
}

if (!['1', '2'].includes(바퀴)) { console.error('✗ --바퀴 1 또는 --바퀴 2 또는 --견주기'); process.exit(1); }
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
if (!WK) { console.error('✗ WORK_KEY 가 없습니다'); process.exit(1); }

async function 다(q) {
  const 모 = [];
  let off = 0;
  for (;;) {
    const r = await fetch(U + '/rest/v1/' + q + '&limit=1000&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
    const a = await r.json();
    모.push(...a);
    if (!a.length) return 모;
    off += a.length;
    if (off > 100000) throw new Error('너무 많습니다');
  }
}
const 보이는 = (await 다('job_posts_pub?select=id&order=id.asc')).map((x) => x.id);
const 공 = [];
for (let i = 0; i < 보이는.length; i += 60) {
  const 조각 = 보이는.slice(i, i + 60).map(encodeURIComponent).join(',');
  공.push(...await 다('job_posts?select=id,source,org_name,title,url&id=in.(' + 조각 + ')&url=not.is.null'));
}
const 워크넷 = 공.filter((x) => ['WN', 'WN2'].includes(x.source));
const 그밖 = 공.filter((x) => !['WN', 'WN2'].includes(x.source));
console.log(바퀴 + '바퀴 · 회원 화면 ' + 공.length + '건 — 워크넷 ' + 워크넷.length + '건(상세 API) · 그밖 ' + 그밖.length + '건(쪽 열기)');
console.log(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' KST\n');

const 없어짐 = [];
const 오류 = [];
const 살아있음 = [];

/* ── 워크넷: 상세 API ── */
const WURL = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do';

/* ── 같은 응답에서 칸도 받습니다 (2026-10-19 세중님 1번) ──────────
 * 뽑는 자리는 `워크넷상세칸.mjs` **한 자리**이고(지침 6절), 고용형태 판정은
 * `공고문읽기.mjs` 의 `고용형태판정()` **한 자리**입니다 — 화면 값 셋
 * (정규직/계약직/무기계약직)으로만 나옵니다 (2026-10-19 세중님 1번).
 * **빈 값은 안 보냅니다** (null 가드 — 창구도 다시 봅니다). */
const 칸줄 = [];
const 칸셈 = { 제목: 0, 고용형태: 0, 접수마감: 0, 모집인원: 0, 근무지: 0, 지원자격: 0, 예상연봉: 0 };
function 칸모음(x, xml) {
  if (안받기) return;
  const c = 워크넷상세칸(xml);
  const 줄 = { id: x.id };
  const 근거 = {};
  /* 제목 — 창구가 **잘린 것만** 바꿉니다(제목바꿀만한가).
     ★ `--제목도` 를 적어야 보냅니다. 제목 되메우기는 세중님이 「마른 실행 →
       견본 10 → 승인 → 실행」 으로 묶은 자리라(2026-10-19 3번), 승인 전까지
       정시 실행이 제목을 바꾸지 않게 꼭지를 따로 둡니다 */
  if (c.제목 && 제목도) { 줄.title = c.제목; 칸셈.제목++; }
  if (c.접수마감) { 줄.apply_to = c.접수마감; 줄.마감일출처 = '워크넷 상세 API'; 칸셈.접수마감++; }
  if (c.모집인원) { 줄.headcount = c.모집인원; 칸셈.모집인원++; }
  if (c.근무지) { 줄.work_place = c.근무지; 칸셈.근무지++; }
  /* 고용형태 — 글(empTpNm)과 본문(jobCont)을 함께 넣습니다. 코드보다 글이 먼저입니다 */
  const 고용 = 고용형태판정(c.제목 || x.title || '', [c.고용형태글, c.본문].filter(Boolean).join('\n'));
  if (고용) { 줄.employ_type = 고용; 칸셈.고용형태++; }
  const 뽑은값 = {};
  if (c.지원자격) { 뽑은값.지원자격 = c.지원자격; 칸셈.지원자격++; }
  if (c.예상연봉) { 뽑은값.예상연봉 = c.예상연봉; 칸셈.예상연봉++; }
  /* ★ `근거` 를 통째로 보내지 않습니다 — 창구의 `뽑은값` 합치기는 **한 겹**이라
     기존 `근거` 를 덮습니다(「근거 덮임」 — 아직 안 고친 자리). 다른 열쇠에 둡니다 */
  Object.assign(근거, c.근거);
  if (Object.keys(근거).length) 뽑은값.워크넷상세근거 = 근거;
  if (Object.keys(뽑은값).length) 줄.뽑은값 = 뽑은값;
  if (Object.keys(줄).length > 1) 칸줄.push(줄);
}
for (const [i, x] of 워크넷.entries()) {
  const no = (String(x.url).match(/wantedAuthNo=([A-Z0-9]+)/) || [])[1];
  if (!no) { 오류.push({ ...x, 왜: '주소에서 공고번호를 못 집음' }); continue; }
  const u = WURL + '?authKey=' + encodeURIComponent(WK) + '&returnType=XML&callTp=D'
    + '&wantedAuthNo=' + encodeURIComponent(no) + '&infoSvc=VALIDATION';
  let r;
  try {
    const res = await fetch(u, { headers: { accept: 'application/xml' }, signal: AbortSignal.timeout(20000) });
    if (res.status >= 500) { 오류.push({ ...x, 왜: 'HTTP ' + res.status + ' (사이트 장애)' }); await 자고(250); continue; }
    const t = await res.text();
    if (!t.length) { 오류.push({ ...x, 왜: '빈 응답' }); await 자고(250); continue; }
    r = t;
  } catch (e) { 오류.push({ ...x, 왜: '못 받음 · ' + String(e && e.message || e).slice(0, 34) }); await 자고(250); continue; }
  const 왜 = 워크넷없어짐(r);
  if (왜) 없어짐.push({ ...x, 왜: '상세 API — ' + 왜, 앞부분: 가리고(r).replace(/\s+/g, ' ').slice(0, 200) });
  else { 살아있음.push(x.id); 칸모음(x, r); }
  process.stderr.write('\r  워크넷 ' + (i + 1) + '/' + 워크넷.length + '   ');
  await 자고(250);
}
process.stderr.write('\n');

/* ── 그밖: 쪽 열기 (같은 사이트 3.5초) ── */
const 끝때 = new Map();
for (const [i, x] of 그밖.entries()) {
  let host;
  try { host = new URL(x.url).host; } catch { 오류.push({ ...x, 왜: '주소 꼴이 아님' }); continue; }
  const 지난 = Date.now() - (끝때.get(host) || 0);
  if (지난 < 3500) await 자고(3500 - 지난);
  끝때.set(host, Date.now());
  let html;
  try {
    const res = await fetch(x.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; potjob/1.0)', 'Accept-Language': 'ko' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    if (res.status >= 500) { 오류.push({ ...x, 왜: 'HTTP ' + res.status + ' (사이트 장애)' }); continue; }
    if (res.status === 403 || res.status === 429) { 오류.push({ ...x, 왜: 'HTTP ' + res.status + ' (막힘)' }); continue; }
    if (res.status === 404 || res.status === 410) {
      없어짐.push({ ...x, 왜: 'HTTP ' + res.status, 앞부분: '(본문 없음)' });
      continue;
    }
    if (!res.ok) { 오류.push({ ...x, 왜: 'HTTP ' + res.status }); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) { 오류.push({ ...x, 왜: '빈 응답' }); continue; }
    const ct = res.headers.get('content-type') || '';
    const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
      || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
  } catch (e) { 오류.push({ ...x, 왜: '못 받음 · ' + String(e && e.message || e).slice(0, 34) }); continue; }
  const m = html.match(없어짐말);
  if (m) {
    없어짐.push({ ...x, 왜: '쪽 — 없어짐말 「' + m[0] + '」', 앞부분: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) });
  } else if (알림상태(html).결과 === 'closed') {
    없어짐.push({ ...x, 왜: '쪽 — ' + 알림상태(html).왜, 앞부분: String(알림상태(html).줄글).slice(0, 200) });
  } else 살아있음.push(x.id);
  process.stderr.write('\r  그밖 ' + (i + 1) + '/' + 그밖.length + '   ');
}
process.stderr.write('\n');

/* ── 정찰 창구에 보고 (2026-10-18 세중님 7번) ──────────────────
 * `--정찰보고` 를 적으면 `alive_mark` 에 `{id, 결과}` 를 보냅니다.
 * **그 창구가 `seen_on`·`gone_streak` 를 적고, `gone_streak >= 2` 에서 스스로
 * 내립니다** — 세중님의 「두 번 판정된 것만」 규칙과 **같은 문턱**입니다.
 * 그래서 손으로 내리지 않아도 되고, 「정찰이 한 번도 안 본 회원 화면 공고」
 * 323 → 0 도 이쪽으로 풀립니다.
 *
 * ★ 오류였던 것은 **안 보냅니다** — `unknown` 으로도 안 보냅니다.
 *   사이트 장애를 「없어짐 셈」에 넣지 않는 것이 세중님 조건입니다.
 * ★ 까닭은 안 보냅니다 — gone 갈래가 `원문없어짐까닭말()` 을 씁니다 (한 자리). */
if (argv.includes('--정찰보고')) {
  if (!cfg.ALIVE_KEY) { console.error('✗ ALIVE_KEY 가 없습니다 — 창구가 이 열쇠로 권한을 봅니다'); process.exit(1); }
  const 줄 = [
    ...없어짐.map((x) => ({ id: x.id, 결과: 'gone' })),
    ...살아있음.map((id) => ({ id, 결과: 'alive' })),
  ];
  console.log('\n정찰 창구(alive_mark)에 보냅니다 — gone ' + 없어짐.length
    + ' · alive ' + 살아있음.length + ' · 오류 ' + 오류.length + '건은 **안 보냅니다**');
  let 받음 = null;
  for (let i = 0; i < 줄.length; i += 200) {
    const r = await fetch(U + '/rest/v1/rpc/alive_mark', {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: cfg.ALIVE_KEY, p_rows: 줄.slice(i, i + 200) }),
    });
    const t = await r.text();
    if (!r.ok) { console.error('✗ alive_mark ' + r.status + ' · ' + t.slice(0, 200)); process.exit(1); }
    try { 받음 = JSON.parse(t); } catch { /* 모양이 다르면 그대로 */ }
  }
  if (받음) console.log('창구가 답한 것 — ' + JSON.stringify(받음));

  /* ── 같은 응답에서 받은 칸을 창구로 (2026-10-19 세중님 1번) ──────
   * 추가 호출 0 입니다 — 위 판정에 쓴 그 응답에서 뽑았습니다.
   * `칸되메우기` 가 「비었을 때만」(고용형태·제목은 조건부로) 채웁니다 */
  if (칸줄.length) {
    console.log('\n칸 창구(칸되메우기)에 보냅니다 — ' + 칸줄.length + '건 (추가 호출 0)');
    console.log('  뽑힌 칸 — ' + Object.entries(칸셈).map(([k, v]) => k + ' ' + v).join(' · '));
    for (let i = 0; i < 칸줄.length; i += 50) {
      const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
        method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_rows: 칸줄.slice(i, i + 50) }),
      });
      const t = await r.text();
      if (!r.ok) { console.error('✗ 칸되메우기 ' + r.status + ' · ' + t.slice(0, 200)); break; }
      if (i === 0) console.log('  창구가 답한 것 — ' + t.slice(0, 300));
    }
  }
}

const 낼것 = { 바퀴: Number(바퀴), 잰때: new Date().toISOString(), 본것: 공.length, 없어짐, 오류, 살아있음수: 살아있음.length };
fs.mkdirSync(결과폴더, { recursive: true });
fs.writeFileSync(결과파일(바퀴), JSON.stringify(낼것, null, 1));
console.log('── ' + 바퀴 + '바퀴 셈 ──');
console.log('  살아 있음 ' + 살아있음.length + '건 · **없어짐 ' + 없어짐.length + '건** · 오류 ' + 오류.length + '건 (없어짐으로 안 셉니다)');
const 출처별 = {};
for (const x of 없어짐) (출처별[x.source] ??= []).push(x);
for (const [s, xs] of Object.entries(출처별).sort((p, q) => q[1].length - p[1].length)) {
  console.log('\n  ' + s + ' ' + xs.length + '건');
  for (const x of xs.slice(0, 12)) {
    console.log('     ' + x.id + ' ' + String(x.org_name).slice(0, 16) + ' | ' + String(x.title).slice(0, 26));
    console.log('        ' + x.왜);
    console.log('        앞부분 「' + String(x.앞부분).slice(0, 80) + '」');
  }
}
if (오류.length) {
  const 오류별 = {};
  for (const x of 오류) 오류별[x.왜] = (오류별[x.왜] || 0) + 1;
  console.log('\n  ── 오류 (없어짐으로 안 셉니다) ──');
  for (const [w, n] of Object.entries(오류별).sort((p, q) => q[1] - p[1])) console.log('     ' + String(n).padStart(3) + '건  ' + w);
}
console.log('\n' + 결과파일(바퀴) + ' 에 적었습니다 · 아무것도 바꾸지 않았습니다');
