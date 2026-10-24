/* 워크넷 **접수방법(rcptMthd)·기관 홈페이지(homePg)** 전수 셈 (2026-10-23 세중님 2-c·1번)
 *
 *   node tools/워크넷접수방법셈.mjs             셉니다 (읽기만 · 사이트 안 두드림)
 *   node tools/워크넷접수방법셈.mjs --주소열기    「자사채용사이트(URL)」 를 열어 봅니다
 *   node tools/워크넷접수방법셈.mjs --자기점검
 *
 * ── 무엇을 내나 (세중님이 보자고 하신 것) ─────────────────────
 *   ① `접수방법` **값 목록 전수** — 원문 그대로, 건수와 함께
 *   ② **1층/2층을 나눠** 홈페이지·「자사채용사이트(URL)」 비율
 *   ③ 「기타(…)」 에 메일·전화가 **담긴** 건수 (0 이어야 합니다 — 10-23 에 막았습니다)
 *   ④ 「자사채용사이트(URL)」 주소 목록 (--주소열기 면 200·채용 쪽인지까지)
 *
 * ★ 갈래 규칙은 **이 목록을 보고** 정합니다 — 값을 짐작하지 않습니다 (세중님).
 * ★ 아무것도 바꾸지 않습니다.
 */
import fs from 'node:fs';
import { 차례붙이기 } from './쪽나눠받기.mjs';
import { 개인정보찾기 } from './오류잡기_1023.mjs';

/* 「자사채용사이트(주소)」 에서 주소만 뽑습니다 — 괄호 안이 주소입니다 */
export const 자사주소들 = (v) => {
  const 낸것 = [];
  const t = String(v || '');
  const re = /자사채용사이트\s*[(（]\s*([^)）]+)\s*[)）]/g;
  for (const m of t.matchAll(re)) 낸것.push(m[1].trim());
  return 낸것;
};
/* 쉼표로 가른 **조각들** — 괄호 안의 쉼표는 가르지 않습니다 */
export const 조각들 = (v) => {
  const t = String(v || '');
  const 낸것 = [];
  let 이번 = '';
  let 깊이 = 0;
  for (const c of t) {
    if (c === '(' || c === '（') 깊이++;
    else if (c === ')' || c === '）') 깊이 = Math.max(0, 깊이 - 1);
    if (c === ',' && 깊이 === 0) { 낸것.push(이번.trim()); 이번 = ''; continue; }
    이번 += c;
  }
  if (이번.trim()) 낸것.push(이번.trim());
  return 낸것.filter(Boolean);
};

if (process.argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('조각을 쉼표로 가른다', 조각들('방문,우편,기타').join('|') === '방문|우편|기타');
  보('★ 괄호 안의 쉼표로는 안 가른다',
    조각들('자사채용사이트(https://a.b/c?d=1,2),기타').join('|')
      === '자사채용사이트(https://a.b/c?d=1,2)|기타');
  보('자사 주소를 뽑는다',
    자사주소들('자사채용사이트(https://www.redcross.or.kr/a.do),기타')[0]
      === 'https://www.redcross.or.kr/a.do');
  보('자사채용사이트가 없으면 빈 목록', 자사주소들('고용24,이메일').length === 0);
  보('빈 값은 빈 목록', 조각들('').length === 0 && 자사주소들('').length === 0);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL·SERVICE 가 없습니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };

async function 전부(길) {
  const out = [];
  for (let off = 0; ; off += 100) {
    const 길2 = 차례붙이기(길);
    const 이음 = 길2.includes('?') ? '&' : '?';
    const r = await fetch(U + '/rest/v1/' + 길2 + 이음 + 'limit=100&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(길.slice(0, 40) + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const a = await r.json();
    out.push(...a);
    if (a.length < 100) break;
    if (off > 40000) break;
  }
  return out;
}

const 보임 = new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id));
const 다 = await 전부('job_posts?select=id,source,org_name,org_kind,tab,detail,url'
  + '&source=in.(WN,WN2,WN3)');
console.log('워크넷 공고 ' + 다.length + '건 (회원 화면 ' + 다.filter((x) => 보임.has(x.id)).length + '건)');

const 접 = (x) => String((x.detail || {})['접수방법'] || '');
const 홈 = (x) => String((x.detail || {})['기관홈페이지'] || '');
const 담김 = 다.filter((x) => 접(x));
console.log('접수방법 담긴 것 ' + 담김.length + '건 · 기관홈페이지 담긴 것 '
  + 다.filter((x) => 홈(x)).length + '건\n');

/* 1층/2층 — 기관 갈래로 가릅니다. 갈래 값을 짐작하지 않고 **찍어서** 봅니다 */
const 갈래셈 = new Map();
for (const x of 다) 갈래셈.set(x.org_kind || '(빈칸)', (갈래셈.get(x.org_kind || '(빈칸)') || 0) + 1);
console.log('── org_kind 값 (짐작 금지 · 1층/2층을 이것으로 가릅니다) ──');
for (const [k, n] of [...갈래셈].sort((a, b) => b[1] - a[1])) console.log('  ' + k + '  ' + n + '건');

const 일층꼴 = /공공|상급종합|대학|종합/;
const 층 = (x) => (일층꼴.test(String(x.org_kind || '')) ? '1층' : '2층');

console.log('\n══ ① 접수방법 값 목록 **전수** (원문 그대로) ══\n');
const 값셈 = new Map();
for (const x of 담김) 값셈.set(접(x), (값셈.get(접(x)) || 0) + 1);
for (const [v, n] of [...값셈].sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(n).padStart(4) + '건  「' + v + '」');
}
console.log('\n── 조각별 (쉼표로 가른 뒤) ──');
const 조각셈 = new Map();
for (const x of 담김) for (const s of 조각들(접(x))) 조각셈.set(s, (조각셈.get(s) || 0) + 1);
for (const [v, n] of [...조각셈].sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(n).padStart(4) + '건  ' + v.slice(0, 90));
}

console.log('\n══ ② 1층/2층 나눠 ══\n');
for (const t of ['1층', '2층']) {
  const 그층 = 다.filter((x) => 층(x) === t);
  const 담 = 그층.filter((x) => 접(x));
  const 홈있 = 그층.filter((x) => 홈(x));
  const 자사 = 그층.filter((x) => 자사주소들(접(x)).length);
  const 고용24 = 담.filter((x) => /고용24/.test(접(x)));
  const 퍼 = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '-');
  console.log('  ' + t + '  공고 ' + 그층.length + '건 · 접수방법 담김 ' + 담.length + '건'
    + '\n       기관홈페이지 ' + 홈있.length + '건 (' + 퍼(홈있.length, 그층.length) + ')'
    + ' · 자사채용사이트 ' + 자사.length + '건 (' + 퍼(자사.length, 담.length) + ')'
    + ' · 「고용24」 든 것 ' + 고용24.length + '건 (' + 퍼(고용24.length, 담.length) + ')');
}

console.log('\n══ ③ 담긴 접수방법에 메일·전화가 있나 ══\n');
const 샌것 = 담김.map((x) => ({ x, f: 개인정보찾기(접(x)) }))
  .filter((r) => r.f.메일.length || r.f.전화.length);
console.log('  **' + 샌것.length + '건** (회원 화면 '
  + 샌것.filter((r) => 보임.has(r.x.id)).length + '건)');
for (const r of 샌것.slice(0, 20)) {
  console.log('    ● ' + r.x.id + ' ' + String(r.x.org_name).slice(0, 16) + ' 「' + 접(r.x) + '」');
}

console.log('\n══ ④ 「자사채용사이트(URL)」 주소 ══\n');
const 주소셈 = new Map();
for (const x of 담김) {
  for (const a of 자사주소들(접(x))) {
    if (!주소셈.has(a)) 주소셈.set(a, []);
    주소셈.get(a).push(x);
  }
}
console.log('  서로 다른 주소 ' + 주소셈.size + '개\n');
for (const [a, 들] of 주소셈) {
  console.log('  ● ' + a.slice(0, 110) + '\n      ' + 들.length + '건 · '
    + 들.slice(0, 3).map((x) => x.org_name + '(' + 층(x) + ')').join(' · '));
}

if (process.argv.includes('--주소열기')) {
  console.log('\n── 열어 봅니다 (한 집마다 3.5초) ──');
  const 채용말 = /채용|모집|인재|recruit|job|career|insa|employ/i;
  let 앞집 = '';
  for (const [a] of 주소셈) {
    let 집 = '';
    try { 집 = new URL(a).host; } catch { console.log('  ✗ 주소 꼴이 아닙니다 — ' + a); continue; }
    if (집 === 앞집) await new Promise((r) => setTimeout(r, 3500));
    앞집 = 집;
    try {
      const r = await fetch(a, { redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; potjob-check/1.0)' } });
      const t = (await r.text()).slice(0, 200000);
      const 제목 = (t.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim();
      const 채용쪽 = 채용말.test(제목) || 채용말.test(a);
      console.log('  ' + (r.status === 200 ? '○' : '✗') + ' ' + r.status
        + (채용쪽 ? ' · 채용 쪽 같습니다' : ' · **채용 쪽인지 확인 필요**')
        + ' · 「' + 제목.slice(0, 60) + '」\n      ' + a.slice(0, 110));
    } catch (e) {
      console.log('  ✗ 못 열었습니다 (' + String(e.message).slice(0, 60) + ')\n      ' + a.slice(0, 110));
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
}
console.log('\n★ 아무것도 바꾸지 않았습니다.');
