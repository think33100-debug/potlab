/* **원문을 못 연 까닭**을 회원 DB 전체로 셉니다 (2026-10-22 세중님 3번)
 *
 *   node tools/못연까닭.mjs            회원 화면 공고만 (기본)
 *   node tools/못연까닭.mjs --전부     숨긴 것·보류함까지
 *   node tools/못연까닭.mjs --줄 20    까닭마다 견본 몇 줄 (기본 5)
 *
 * ★ 읽기만 합니다. 그물·DB 쓰기를 안 합니다.
 *
 * ── 왜 ──────────────────────────────────────────────────────────
 * 둘째 표본 30건 가운데 **7건이 원문을 못 열렸습니다** (고용24 자기 POST ·
 * 알리오 JS · JobFlex API 전용 · 워크넷 짧은 글). 표본에서 7/30 이면 전체에서는
 * 몇 건인지 알아야 **어느 길부터 뚫을지** 정할 수 있습니다 (세중님 3번).
 *
 * 세는 갈래 (공고 한 건이 여러 갈래에 들 수 있어 갈래마다 따로 셉니다) —
 *   ⓐ 쪽글도 첨부 글도 없음      = 일곱 칸이 통째로 빕니다
 *   ⓑ 쪽글은 있는데 짧음(<400자) = 목록 글만 담긴 꼴 (워크넷·JF)
 *   ⓒ 첨부 주소가 있는데 못 읽음  = `읽기탈` 까닭별
 *   ⓓ 첨부 주소가 아예 없음       = 받는 길이 없는 꼴 (JS 주소·자기 POST)
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
const 전부볼까 = argv.includes('--전부');
const 줄수 = Number(argv[argv.indexOf('--줄') + 1]) || 5;

/* .env 는 **node 로** 읽습니다 — 셸에 먹이지 않습니다 (지침 8-12) */
const env = { ...process.env };
for (const 이름 of ['.env', '.env.local']) {
  if (!fs.existsSync(이름)) continue;
  for (const l of fs.readFileSync(이름, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const 바탕 = env.SUPABASE_URL;
const 열쇠 = env.SUPABASE_SERVICE_KEY;
if (!바탕 || !열쇠) { console.error('SUPABASE_URL·SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
const 머리 = { apikey: 열쇠, Authorization: 'Bearer ' + 열쇠 };

/** ★ 이 서버는 **100줄에서 끊습니다**(PostgREST max-rows). limit 을 크게 줘도 더 안 옵니다.
 *  그래서 **받은 줄 수만큼** offset 을 넘기고 **0줄일 때** 멈춥니다 —
 *  처음에 「1000줄보다 적으면 끝」으로 짰더니 100줄만 보고 멈췄습니다 (공고 2782건을 100건으로) */
async function 전부(길) {
  const 모은것 = [];
  for (let off = 0; ; ) {
    const u = 바탕 + '/rest/v1/' + 길 + (길.includes('?') ? '&' : '?') + 'limit=1000&offset=' + off;
    const r = await fetch(u, { headers: 머리 });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
    const 줄 = await r.json();
    모은것.push(...줄);
    if (!줄.length) break;
    off += 줄.length;
    if (off > 200000) throw new Error('너무 많습니다 — 고리를 봅니다');
  }
  return 모은것;
}

const 공고 = await 전부('job_posts?select=id,source,org_name,title,hidden,hold');
const 보임 = new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id));
const 볼것 = 전부볼까 ? 공고 : 공고.filter((j) => 보임.has(j.id));
console.log('공고 ' + 공고.length + '건 · ' + (전부볼까 ? '전부 봅니다' : '회원 화면 ' + 볼것.length + '건을 봅니다'));

/* 본문 글 길이 */
const 글길이 = new Map();
for (const b of await 전부('job_body?select=job_id,body')) {
  글길이.set(b.job_id, (글길이.get(b.job_id) || 0) + String(b.body || '').length);
}

/* 첨부 */
let 첨부 = [];
try {
  첨부 = await 전부('job_attachments?select=job_id,url,name,parsed_at,' + encodeURIComponent('읽기탈'));
} catch (e) {
  if (!/42703/.test(String(e.message))) throw e;
  첨부 = await 전부('job_attachments?select=job_id,url,name,parsed_at');
}
const 첨부별 = new Map();
for (const a of 첨부) {
  if (!첨부별.has(a.job_id)) 첨부별.set(a.job_id, []);
  첨부별.get(a.job_id).push(a);
}

const 갈래 = new Map();          /* 이름 → {수, 견본[], 출처별{}} */
const 더하기 = (이름, j) => {
  if (!갈래.has(이름)) 갈래.set(이름, { 수: 0, 견본: [], 출처별: {} });
  const g = 갈래.get(이름);
  g.수++;
  g.출처별[j.source || '?'] = (g.출처별[j.source || '?'] || 0) + 1;
  if (g.견본.length < 줄수) g.견본.push(j);
};

for (const j of 볼것) {
  const 글 = 글길이.get(j.id) || 0;
  const 첨 = 첨부별.get(j.id) || [];
  const 읽힌것 = 첨.filter((a) => a.parsed_at);
  if (!글 && !읽힌것.length) 더하기('ⓐ 쪽글도 첨부 글도 없음', j);
  else if (글 && 글 < 400 && !읽힌것.length) 더하기('ⓑ 쪽글이 400자 미만 (목록 글만)', j);
  if (첨.length && !읽힌것.length) {
    const 탈 = [...new Set(첨.map((a) => String(a['읽기탈'] || '').trim()).filter(Boolean))];
    더하기('ⓒ 첨부가 있는데 못 읽음 — ' + (탈.length ? 탈.slice(0, 2).join('·') : '까닭 안 적힘'), j);
  }
  if (!첨.length && !글) 더하기('ⓓ 첨부 주소가 아예 없음 + 쪽글도 없음', j);
}

const 줄맞춤 = (s, n) => String(s).padEnd(n);
console.log('\n══ 못 연 까닭 ══');
for (const [이름, g] of [...갈래].sort((a, b) => b[1].수 - a[1].수)) {
  const 출처 = Object.entries(g.출처별).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => k + ' ' + v).join(' · ');
  console.log('\n' + 줄맞춤(g.수 + '건', 7) + 이름);
  console.log('        출처 — ' + 출처.slice(0, 150));
  for (const j of g.견본) {
    console.log('        ' + 줄맞춤(j.id, 16) + 줄맞춤(String(j.org_name || '').slice(0, 14), 16)
      + String(j.title || '').slice(0, 44));
  }
}

/* 출처별 「원문을 연 비율」 — 어느 출처가 구멍인지 */
console.log('\n══ 출처별 원문 열림 ══');
const 출처셈 = new Map();
for (const j of 볼것) {
  const s = j.source || '?';
  if (!출처셈.has(s)) 출처셈.set(s, { 전체: 0, 열림: 0 });
  const o = 출처셈.get(s);
  o.전체++;
  const 글 = 글길이.get(j.id) || 0;
  const 읽힌것 = (첨부별.get(j.id) || []).filter((a) => a.parsed_at).length;
  if (글 >= 400 || 읽힌것) o.열림++;
}
console.log('  출처    전체   원문 열림');
for (const [s, o] of [...출처셈].sort((a, b) => b[1].전체 - a[1].전체)) {
  console.log('  ' + 줄맞춤(s, 8) + 줄맞춤(o.전체, 7)
    + o.열림 + ' (' + Math.round((1000 * o.열림) / o.전체) / 10 + '%)');
}
