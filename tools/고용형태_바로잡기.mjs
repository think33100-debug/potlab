/* 고용형태를 **공고 본문에서 읽어** 바로잡습니다 (2026-10-19 세중님 지시)
 *
 *   node tools/고용형태_바로잡기.mjs           무엇이 바뀔지만 (기본)
 *   node tools/고용형태_바로잡기.mjs --진짜    바꿉니다
 *   node tools/고용형태_바로잡기.mjs --전부    회원 화면 밖까지 (기본은 회원 화면만)
 *
 * 세중님 지시 — 「**공무원은 고용형태가 아닙니다.** 공무원에도 계약직이 있습니다.
 * 고용형태는 공고 본문(·첨부)에서 읽어 정한다.」
 *
 * 판정은 `공고문읽기.mjs` 의 `고용형태판정()` **한 자리**입니다. 수집기도
 * 같은 함수를 씁니다 (지침 6절).
 *
 * ★ 지키는 것
 *   · `edited_fields` 에 employ_type 이 있으면 **건너뜁니다** (사람이 고친 값)
 *   · `admin_locked` 면 건너뜁니다
 *   · 판정이 **비면 안 건드립니다** — 짐작으로 지우지 않습니다
 *   · 창구(`칸되메우기`)로만 보내 `updated_at` 을 안 바꿉니다
 *     ⚠ 그 창구가 employ_type 을 받는지 먼저 봅니다 — 안 받으면 멈춥니다
 */
import fs from 'node:fs';
import { 고용형태판정, 고용형태코드, 우리직군줄 } from './공고문읽기.mjs';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 전부볼까 = argv.includes('--전부');

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
if (!U || !K) { console.error('✗ 열쇠가 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };

async function 전부(길) {
  const out = [];
  for (let off = 0; ; off += 100) {
    const r = await fetch(U + '/rest/v1/' + 길 + (길.includes('?') ? '&' : '?')
      + 'limit=100&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(길.slice(0, 40) + ' ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const 한쪽 = await r.json();
    out.push(...한쪽);
    if (한쪽.length < 100) break;
    if (off > 20000) break;
  }
  return out;
}

/* 회원 화면 공고만 (기본) — 틀린 값이 **회원에게 보이는** 자리가 먼저입니다 */
const 공고 = await 전부('job_posts?select=id,source,org_name,title,employ_type,'
  + 'edited_fields,admin_locked,hidden,hold&order=db_insert_at.desc');
const 보임 = new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id));
const 볼것 = 전부볼까 ? 공고 : 공고.filter((x) => 보임.has(x.id));
console.log('공고 ' + 공고.length + '건 중 ' + (전부볼까 ? '전부' : '회원 화면 ' + 볼것.length + '건')
  + ' 을 봅니다');

/* 본문·첨부 글을 모읍니다 — 「본문(·첨부)에서 읽어 정한다」 */
const ids = 볼것.map((x) => x.id);
const 본문 = [];
for (let i = 0; i < ids.length; i += 50) {
  const 조각 = ids.slice(i, i + 50).map(encodeURIComponent).join(',');
  본문.push(...await 전부('job_body?select=job_id,body&job_id=in.(' + 조각 + ')'));
}
const 글별 = new Map();
for (const b of 본문) 글별.set(b.job_id, (글별.get(b.job_id) || '') + '\n' + String(b.body || ''));
console.log('본문·첨부 글이 있는 공고 ' + 글별.size + '건');

const 바뀔것 = []; const 건너뜀 = { '사람이 고친 칸': 0, '관리자가 손댐': 0, '판정이 비어 그대로': 0, '지금과 같음': 0 };
for (const j of 볼것) {
  if (j.admin_locked) { 건너뜀['관리자가 손댐']++; continue; }
  if ((j.edited_fields || []).includes('employ_type')) { 건너뜀['사람이 고친 칸']++; continue; }
  const 지금 = String(j.employ_type || '');
  /* ① 본문(·첨부)에서 읽습니다 — 통합공고면 **우리 직군 줄만** 떼어 넘깁니다
        (세중님 2번 · 「모집인원은 우리 직군 인원만」과 같은 원칙) */
  const 글 = 글별.get(j.id) || '';
  const 줄 = 우리직군줄(글);
  let r = 고용형태판정(j.title, 줄 || 글);
  /* ② 본문으로 못 가렸으면 **지금 값을 셋으로 옮깁니다** (세중님 1번 —
        「DB 기존 값도 같은 규칙으로 정리」). 기간제·비정규직·숫자코드 등 */
  if (!r.값) {
    const c = 고용형태코드(지금);
    if (c && c.값) r = { 값: c.값, 왜: '지금 값을 셋으로 옮김 — ' + c.왜 };
    else if (c && !c.값) r = { 값: '', 왜: c.왜 };
  }
  if (!r.값) { 건너뜀['판정이 비어 그대로']++; continue; }
  if (r.값 === 지금) { 건너뜀['지금과 같음']++; continue; }
  바뀔것.push({ ...j, 전: 지금, 후: r.값, 왜: r.왜 });
}

console.log('\n바뀔 것 ' + 바뀔것.length + '건');
console.log('  건너뛴 것 — ' + Object.entries(건너뜀).map(([k, v]) => k + ' ' + v).join(' · '));
const 꼴별 = {};
for (const x of 바뀔것) {
  const k = (x.전 || '(빈칸)') + ' → ' + x.후;
  꼴별[k] = (꼴별[k] || 0) + 1;
}
console.log('\n  어떻게 바뀌나 —');
for (const [k, v] of Object.entries(꼴별).sort((a, b) => b[1] - a[1])) console.log('     ' + v + '건  ' + k);

console.log('\n  견본 (앞 12건) —');
for (const x of 바뀔것.slice(0, 12)) {
  console.log('    ' + x.id + ' [' + x.source + '] ' + String(x.org_name).slice(0, 18));
  console.log('        ' + String(x.title).slice(0, 56));
  console.log('        「' + (x.전 || '(빈칸)') + '」 → 「' + x.후 + '」   ' + x.왜);
}
if (바뀔것.length > 12) console.log('    … 그밖 ' + (바뀔것.length - 12) + '건');

if (!바뀔것.length) { console.log('\n바꿀 것이 없습니다'); process.exit(0); }
if (!진짜) { console.log('\n[마른] 아무것도 안 바꿉니다 — 바꾸려면 --진짜'); process.exit(0); }

/* 창구가 employ_type 을 받는지 먼저 봅니다 — 안 받으면 **멈춥니다**.
   표를 직접 쓰지 않습니다 (지침 6절) */
const 시험 = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
  method: 'POST', headers: H,
  body: JSON.stringify({ p_rows: [{ id: 바뀔것[0].id, employ_type: 바뀔것[0].후 }] }),
});
const 시험글 = await 시험.text();
if (!시험.ok) { console.error('✗ 칸되메우기 ' + 시험.status + ' · ' + 시험글.slice(0, 250)); process.exit(1); }
console.log('\n창구 답 — ' + 시험글.slice(0, 220));
if (!/employ_type/.test(시험글)) {
  console.error('★ 창구가 employ_type 을 다룬다는 답이 없습니다 — 멈춥니다.');
  console.error('  `칸되메우기` 가 그 칸을 받게 고친 뒤에 다시 돌리십시오 (표를 직접 쓰지 않습니다).');
  process.exit(1);
}
let 바꿈 = 1;
for (let i = 1; i < 바뀔것.length; i += 50) {
  const 토막 = 바뀔것.slice(i, i + 50).map((x) => ({ id: x.id, employ_type: x.후 }));
  const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
    method: 'POST', headers: H, body: JSON.stringify({ p_rows: 토막 }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('✗ ' + r.status + ' · ' + t.slice(0, 200)); process.exit(1); }
  바꿈 += 토막.length;
  console.log('  ' + 바꿈 + '/' + 바뀔것.length);
}
console.log('\n바꿨습니다 — ' + 바꿈 + '건');
