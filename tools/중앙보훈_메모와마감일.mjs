/* 중앙보훈병원 기간제 공고 — 관리자 메모를 붙이고 첨부·원문에서 마감일을 찾습니다
 *   (2026-10-19 세중님 2번)
 *
 *   node tools/중앙보훈_메모와마감일.mjs          무엇을 할지만
 *   node tools/중앙보훈_메모와마감일.mjs --진짜   붙이고 채웁니다
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * CLAUDE.md 10-2 —
 *   「중앙보훈병원 공고가 **두 건** 올라왔고 … 세중님이 보신 그 공고에는
 *    **물리치료사 1명**이 있었습니다. 저는 우리 직군이 있는 쪽을 안 읽고
 *    「우리 직군 없음」 이라 했습니다」
 * 같은 기관의 기간제 공고이고 본문에 「재활」이 한 번 나옵니다. 그래서
 * 숨김보관으로 보내지 않고 **보류함에 두고 세중님이 한 번 보게** 합니다.
 */
import fs from 'node:fs';

const 진짜 = process.argv.includes('--진짜');
const ID = 'HS640656575';

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
if (!U || !K) { console.error('✗ 열쇠가 없습니다 (서버에서)'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };

const 전 = await fetch(U + '/rest/v1/job_posts?id=eq.' + ID
  + '&select=id,org_name,title,url,apply_to,apply_to_time,hold,hidden', { headers: H });
const j = (await 전.json())[0];
if (!j) { console.error('✗ 그 공고가 없습니다'); process.exit(1); }
console.log('공고 — ' + j.org_name + ' | ' + j.title);
console.log('  url ' + j.url);
console.log('  접수마감 ' + (j.apply_to || '(빈칸)') + ' · hold ' + j.hold + ' · hidden ' + j.hidden);

/* ── 저장된 글에서 마감일을 찾습니다 (원문을 다시 두드리기 전에) ── */
const 글들 = await (await fetch(U + '/rest/v1/job_body?select=kind,body&job_id=eq.' + ID,
  { headers: H })).json();
const 글 = 글들.map((b) => String(b.body || '')).join('\n');
console.log('\n저장된 글 ' + 글.length + '자 (' + 글들.map((b) => b.kind).join(',') + ')');

const 날짜꼴 = /20\d\d\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}/g;
const 접수근처 = [];
for (const m of 글.matchAll(/([^\n]{0,70}(?:접수\s*기간|접수\s*마감|제출\s*기간|원서\s*접수|마감)[^\n]{0,90})/g)) {
  접수근처.push(m[1].replace(/\s+/g, ' ').trim());
}
console.log('── 「접수·마감」 이 든 줄 ' + 접수근처.length + '개 ──');
for (const l of 접수근처.slice(0, 8)) console.log('   「' + l.slice(0, 140) + '」');
const 날짜들 = [...new Set((글.match(날짜꼴) || []).map((x) => x.replace(/\s+/g, '')))];
console.log('── 글에 든 날짜 ' + 날짜들.length + '개 — ' + 날짜들.slice(0, 10).join(' · '));

/* ── 우리 직군·재활이 어디 나오나 (세중님이 보실 자리) ── */
const 재활줄 = 글.split('\n').filter((l) => /재활|(물리|작업|도수)\s*치료/.test(l));
console.log('\n── 「재활」·우리 직군이 든 줄 ' + 재활줄.length + '개 ──');
for (const l of 재활줄.slice(0, 6)) console.log('   「' + l.replace(/\s+/g, ' ').trim().slice(0, 140) + '」');

/* 2026-10-19 에 원문을 열어 본 결과를 그대로 적습니다 (짐작 금지 · 지침 3절) */
const 메모 = '【세중님이 한 번 봐 주십시오 · 2026-10-19】 '
  + 'CLAUDE.md 10-2 — 2026-10-02 에 중앙보훈병원 공고 두 건이 같은 날 올라왔고, 세중님이 '
  + '첨부 그림을 읽어 **물리치료사 1명**을 찾으셨습니다(저는 우리 직군이 있는 쪽을 안 읽고 '
  + '「없음」이라 했습니다). 그래서 이 기간제 공고도 숨김보관으로 보내지 않고 보류함에 둡니다. '
  + '／ 원문을 열어 본 것 — 본문 2,296자에 **접수 기간이 없습니다**(「접수처: 채용지원사이트 '
  + 'http://bohun.fairyhr.com」 뿐). 마감일은 첨부 **「채용공고문및직무설명서(기간제_9월).pdf」** '
  + '안에 있을 것입니다. 그런데 그 쪽의 첨부 링크가 `/common/nttFileDownload.do?fileKey=` 로 '
  + '**값이 비어** 있어 우리가 첨부를 못 집었습니다(DB 첨부 0개) — 그래서 읽지 못했습니다. '
  + '／ 쪽에 든 날짜는 2026.08.28 · 2026.09.01 이고 제목이 「(9월)」 입니다. 마감이 지났을 수 '
  + '있지만 **적힌 마감일을 못 찾아 짐작하지 않았습니다.** 「본문에 「재활」이 있다」고 적었던 것도 '
  + '바로잡습니다 — 그것은 쪽 **메뉴**(보훈재활체육센터)에서 온 글자이고 공고 내용이 아닙니다';

console.log('\n── 붙일 메모 ──\n   ' + 메모);

if (!진짜) { console.log('\n[마른] 아무것도 안 바꿉니다 — 붙이려면 --진짜'); process.exit(0); }

/* ★ `admin_decide` 는 **관리자 로그인**이 필요합니다 — service_role 로는
 *   `42501 관리자만 할 수 있습니다` 가 옵니다 (2026-10-19 에 두드려 보고 알았습니다).
 *   그래서 **「손으로 확인할 곳」**(`hand_check_put`)에 넣습니다 —
 *   관리자 화면 `/admin/hand` 에 보이고, 그것이 「세중님이 한 번 보게」의 목적에
 *   맞습니다. 공고 자체는 보류함에 그대로 있습니다. */
if (!cfg.COLLECT_KEY_HS3) { console.error('✗ COLLECT_KEY_HS3 가 없습니다'); process.exit(1); }
const r = await fetch(U + '/rest/v1/rpc/hand_check_put', {
  method: 'POST', headers: H,
  body: JSON.stringify({
    p_secret: cfg.COLLECT_KEY_HS3, p_source: 'HS3',
    p_rows: [{
      이름: '중앙보훈병원(그 공고)',
      결과: '★ 이 공고를 한 번 봐 주십시오 — ' + ID,
      공고줄: 1,
      까닭: 메모,
      어디서: cfg.POTJOB_WHERE || '(모름)',
      메모: '보류함에 그대로 있습니다 · 원문 ' + j.url,
    }],
  }),
});
console.log('\nhand_check_put ' + r.status + ' — ' + (await r.text()).slice(0, 200));
console.log('관리자 화면 /admin/hand 에서 보입니다');
