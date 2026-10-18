/* 워크넷 공고가 **없어졌나를 API 로** 알 수 있나 — 명세부터 봅니다
 *   (2026-10-18 세중님 2번 · 읽기만 · DB 를 안 건드립니다)
 *
 *   node tools/워크넷_없어짐조사.mjs
 *
 * ── 왜 ───────────────────────────────────────────────
 * 회원 화면 342건 중 **306건이 워크넷**이고, 정찰은 그것을 **한 번도 안 봅니다**.
 * 2026-10-18 점검에서 워크넷 상세 쪽이 「구인정보를 확인할 수 없습니다」(1,020바이트
 * 빈 껍데기)를 주는 것을 찾았습니다 — **없어진 공고입니다.**
 *
 * 세중님 — 「워크넷은 쪽 306번 열지 말고 **고용24 API 먼저**: 명세 다시 보기 —
 * 상태·마감 칸이 있는지, 목록 API 를 끝까지 넘겨서 「목록에서 사라짐」 2바퀴
 * 연속이면 없어짐 후보 → 그 공고만 쪽 열어 확인」
 *
 * ── 그래서 세 가지를 묻습니다 ─────────────────────────
 *   ① 상세(callTp=D)에 **상태·채용여부** 칸이 있나 — 항목 이름을 **전부** 찍습니다
 *   ② 없어진 공고를 상세로 부르면 **무엇이 오나** (오류인가 빈 값인가)
 *   ③ 목록(callTp=L)을 **끝까지** 넘길 수 있나 — 전체 건수와 쪽 수
 *
 * 열쇠는 가립니다 (지침 8-11). 리터럴 정규식만 씁니다.
 */
import fs from 'node:fs';

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const KEY = cfg.WORK_KEY;
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('✗ WORK_KEY 가 없습니다'); process.exit(1); }
const URL_ = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do';
const 주소 = (o) => URL_ + '?' + Object.entries({ authKey: KEY, returnType: 'XML', ...o })
  .map(([k, v]) => k + '=' + encodeURIComponent(String(v))).join('&');
const 가리고 = (s) => String(s).replace(/authKey=[^&\s]+/g, 'authKey=‹열쇠›').split(KEY).join('‹열쇠›');

async function 받기(u) {
  try {
    const r = await fetch(u, { headers: { accept: 'application/xml' }, signal: AbortSignal.timeout(25000) });
    return { code: r.status, 글: await r.text() };
  } catch (e) { return { 왜: String(e && e.message || e).slice(0, 60) }; }
}
const 태그들 = (xml) => [...new Set([...String(xml).matchAll(/<([a-zA-Z_][\w]*)>/g)].map((m) => m[1]))];
const 한칸 = (xml, 태그) => {
  const m = String(xml).match(new RegExp('<' + 태그 + '>([^<]*)</' + 태그 + '>'));
  return m ? m[1].trim() : '';
};
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 살아 있다고 보는 공고와, 없어진 것으로 확인된 공고를 DB 에서 하나씩 ── */
const H = { apikey: K, Authorization: 'Bearer ' + K };
async function 하나(q) {
  const r = await fetch(U + '/rest/v1/' + q, { headers: H });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 160));
  return (await r.json())[0];
}
/* 2026-10-18 점검에서 「없어짐」 으로 나온 것 하나 (달명스마트너싱홈) */
const 없어진번호 = 'K130112609040032';
const 살아있는것 = await 하나('job_posts?select=id,title,url&source=in.(WN,WN2)&id=neq.WNK130112609040032&limit=1&order=collected_at.desc');
const 살아있는번호 = (String(살아있는것 && 살아있는것.url).match(/wantedAuthNo=([A-Z0-9]+)/) || [])[1];

console.log('════ ① 상세(callTp=D) 항목 이름 전부 ════');
for (const [이름, 번호] of [['살아 있다고 보는 공고', 살아있는번호], ['없어진 것으로 확인된 공고', 없어진번호]]) {
  if (!번호) { console.log('  ' + 이름 + ': 번호를 못 집었습니다'); continue; }
  const r = await 받기(주소({ callTp: 'D', wantedAuthNo: 번호, infoSvc: 'VALIDATION' }));
  console.log('\n  ── ' + 이름 + ' (' + 번호 + ') ──');
  if (r.왜) { console.log('     ✗ ' + r.왜); continue; }
  console.log('     HTTP ' + r.code + ' · ' + r.글.length + '자');
  const t = 태그들(r.글);
  console.log('     항목 ' + t.length + '개');
  /* 상태·마감처럼 들리는 항목만 값과 함께 */
  const 관심 = t.filter((x) => /stat|close|end|yn|flag|gubun|cd$|date|dt$/i.test(x));
  console.log('     상태·마감처럼 보이는 항목 ' + 관심.length + '개:');
  for (const x of 관심) console.log('        ' + x.padEnd(26) + ' = ' + 한칸(r.글, x).slice(0, 40));
  console.log('     ── 원문 앞 600자 ──');
  console.log('     ' + 가리고(r.글).replace(/>\s+</g, '>\n     <').slice(0, 600));
  await 자고(1500);
}

console.log('\n════ ③ 목록(callTp=L) 을 끝까지 넘길 수 있나 ════');
const L1 = await 받기(주소({ callTp: 'L', startPage: 1, display: 100 }));
if (L1.왜) console.log('  ✗ ' + L1.왜);
else {
  const 전체 = Number(한칸(L1.글, 'total') || 한칸(L1.글, 'totalCount') || 0);
  const 줄 = (L1.글.match(/<wanted>/g) || []).length;
  console.log('  HTTP ' + L1.code + ' · 전체 ' + (전체 || '(못 읽음)') + '건 · 1쪽 줄 ' + 줄 + '개');
  console.log('  목록 항목: ' + 태그들(L1.글).slice(0, 30).join(' · '));
  if (전체) {
    const 쪽수 = Math.ceil(전체 / 100);
    console.log('  → display 100 이면 ' + 쪽수 + '쪽. startPage 최대 1000 이라 '
      + (쪽수 <= 1000 ? '**끝까지 넘길 수 있습니다**' : '★ 1000쪽을 넘습니다 — 좁혀 받아야 합니다'));
    console.log('  → 쪽마다 ~1초면 한 바퀴 ' + Math.round(쪽수 * 1.2) + '초쯤입니다'
      + ' (쪽 306번 여는 것보다 훨씬 쌉니다)');
  }
}
console.log('\n※ 아무것도 바꾸지 않았습니다');
