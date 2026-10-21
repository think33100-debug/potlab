/* **직군 근거가 뺀 줄에만** 있는 공고를 전수로 셉니다 (2026-10-22 세중님 지시)
 *
 *   node tools/직군근거의심.mjs              회원 화면 + 숨김·보류 전부
 *   node tools/직군근거의심.mjs --회원만
 *   node tools/직군근거의심.mjs --줄 20       견본 줄 수
 *
 * ★ 읽기만 합니다. DB 에 아무것도 쓰지 않습니다.
 *
 * ── 왜 ──────────────────────────────────────────────────────────
 * 셋째 표본에서 **직군 의심 2건**이 나왔습니다 — 우리 직군 말이
 *   · 쪽의 **이전글 제목**에만 (충주의료원 HS258943039 · 임상병리사 공고)
 *   · 제출서류 각주의 **의료기사 법령 정의**에만 (부산대병원 305065)
 * 있었습니다. 오늘 그 줄들을 근거에서 뺐습니다 (공고문읽기 — 이전다음글떼기).
 * 같은 꼴이 DB 에 몇 건 더 있는지 셉니다.
 *
 * 세는 법 — job_group 이 우리 직군인데
 *   ㉮ 본문 **날글**에는 우리 직군 말이 있고
 *   ㉯ **뺀 줄을 떼고 보면** 없는 것  → 근거가 뺀 줄에만 있던 공고입니다
 * 제목에 직군이 있는 것은 따로 셉니다 (제목은 늘 가진 원문이라 흠이 아닙니다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 본문직군, 이전다음글떼기 } from './공고문읽기.mjs';
import { matchJob, notOurs } from './gas-rules.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 회원만 = argv.includes('--회원만');
const 줄수 = Number(값('--줄', 10));

const cfg = {};
for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const 바탕 = cfg.SUPABASE_URL;
const 열쇠 = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY;
if (!바탕 || !열쇠) { console.error('SUPABASE_URL·열쇠가 없습니다'); process.exit(1); }
const 머리 = { apikey: 열쇠, Authorization: 'Bearer ' + 열쇠 };

/** ★ 이 서버는 100줄에서 끊습니다 — 받은 줄 수만큼 넘기고 0줄일 때 멈춥니다 */
async function 전부(길) {
  const 모은것 = [];
  for (let off = 0; ;) {
    const r = await fetch(바탕 + '/rest/v1/' + 길 + (길.includes('?') ? '&' : '?')
      + 'limit=1000&offset=' + off, { headers: 머리 });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 160));
    const 줄 = await r.json();
    모은것.push(...줄);
    if (!줄.length) break;
    off += 줄.length;
    if (off > 200000) throw new Error('너무 많습니다');
  }
  return 모은것;
}

const 우리말 = /(물리|작업|도수)\s*치료/;
const 공고 = await 전부('job_posts?select=id,source,org_name,title,job_group,hidden,hold');
const 보임 = 회원만 ? new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id)) : null;
const 볼것 = 공고.filter((j) => ['물리치료사', '작업치료사', '공통'].includes(j.job_group || ''))
  .filter((j) => !회원만 || 보임.has(j.id));
console.log('우리 직군이 붙은 공고 ' + 볼것.length + '건' + (회원만 ? ' (회원 화면만)' : ' (숨김·보류 포함)'));

/* 본문 글 */
const 글별 = new Map();
const ids = 볼것.map((x) => x.id);
for (let i = 0; i < ids.length; i += 50) {
  const 조각 = ids.slice(i, i + 50).map(encodeURIComponent).join(',');
  for (const b of await 전부('job_body?select=job_id,body&job_id=in.(' + 조각 + ')')) {
    글별.set(b.job_id, (글별.get(b.job_id) || '') + '\n' + String(b.body || ''));
  }
}
console.log('그 가운데 본문 글이 있는 것 ' + 글별.size + '건');

const 의심 = [];
let 글없음 = 0, 멀쩡 = 0, 날글에도없음 = 0;
for (const j of 볼것) {
  const 글 = 글별.get(j.id);
  if (!글) { 글없음++; continue; }
  const 날글에 = 우리말.test(글);
  const 떼고 = 본문직군(글);
  if (!날글에) { 날글에도없음++; continue; }   /* 본문에 아예 없음 — 다른 갈래(직군의심) */
  if (떼고) { 멀쩡++; continue; }
  /* 날글에는 있는데 떼고 보니 없음 = 근거가 뺀 줄에만 있었습니다 */
  const 제목직군 = matchJob(j.title || '') && !notOurs(j.title || '');
  의심.push({ ...j, 제목직군: !!제목직군, 조각: (이전다음글떼기(글) === 글 ? '' : '떼짐') });
}

console.log('');
console.log('  본문 글 없음            ' + 글없음 + '건');
console.log('  본문 날글에 직군 말 없음 ' + 날글에도없음 + '건  (직군의심() 이 보는 갈래)');
console.log('  떼고 봐도 직군 있음      ' + 멀쩡 + '건  (멀쩡합니다)');
console.log('  ★ 근거가 **뺀 줄에만** 있던 것 ' + 의심.length + '건');
const 제목있 = 의심.filter((x) => x.제목직군);
console.log('     그 가운데 제목에 직군이 있는 것 ' + 제목있.length + '건 (제목은 원문이라 흠이 아닙니다)');
console.log('     제목에도 없는 것 ' + (의심.length - 제목있.length) + '건  ← **고칠 거리**');

const 셈 = {};
for (const x of 의심) 셈[x.source] = (셈[x.source] || 0) + 1;
if (의심.length) {
  console.log('     출처별 — ' + Object.entries(셈).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · '));
  console.log('');
  for (const x of 의심.filter((y) => !y.제목직군).slice(0, 줄수)) {
    console.log('  ' + x.id.padEnd(16) + String(x.source).padEnd(5) + String(x.job_group).padEnd(7)
      + (x.hidden ? '숨김 ' : '보임 ') + String(x.org_name || '').slice(0, 14).padEnd(16)
      + String(x.title || '').slice(0, 44));
  }
}
