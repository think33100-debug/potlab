/* 본문이 **CSS·JS 찌꺼기**인 공고를 모아 집별로 셉니다 (2026-10-22 세중님 2번)
 *
 *   node tools/본문찌꺼기목록.mjs
 *
 * ★ 읽기만 합니다 (DB 읽기 + 쪽은 안 두드립니다).
 *
 * 왜 — 강진의료원 공고의 본문이 2,306자 **CSS 한 줄**(`.bx-wrapper{-moz-box-shadow…`)
 *   이고, 거기 든 글자로 직군이 붙었습니다. 전수로 세니 본문 있는 575건 중 **15건**.
 *   고치는 길은 집마다 **본문선택자**(cfg)를 적어 주는 것인데, 297개 cfg 가운데
 *   본문선택자가 있는 것이 **하나**뿐입니다. 그래서 먼저 어느 집인지 셉니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 찌꺼기본문 } from './직군바로잡기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
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

const 본문 = await 전부('job_body?select=job_id,kind,body');
const 찌 = new Map();
for (const b of 본문) {
  const 글 = String(b.body || '');
  if (찌꺼기본문(글)) 찌.set(b.job_id, { kind: b.kind, 자: 글.length, 앞: 글.trim().slice(0, 60) });
}
console.log('본문 줄 ' + 본문.length + '개 · **찌꺼기 본문** ' + 찌.size + '건\n');
if (!찌.size) process.exit(0);

const ids = [...찌.keys()];
const 공고 = [];
for (let i = 0; i < ids.length; i += 50) {
  const 조각 = ids.slice(i, i + 50).map(encodeURIComponent).join(',');
  공고.push(...await 전부('job_posts?select=id,source,org_name,title,url,job_group,hidden&id=in.(' + 조각 + ')'));
}
const 첨부수 = new Map();
for (const a of await 전부('job_attachments?select=job_id')) {
  첨부수.set(a.job_id, (첨부수.get(a.job_id) || 0) + 1);
}

/* cfg 의 본문선택자 — 집별로 */
const cfg방 = path.join(여기, 'hosp', 'cfgs');
const 집별선택자 = new Map();
if (fs.existsSync(cfg방)) {
  for (const f of fs.readdirSync(cfg방)) {
    if (!f.endsWith('.json')) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(cfg방, f), 'utf8')); } catch { continue; }
    const 집 = String(j.목록 || j.url || j.주소 || '').match(/^https?:\/\/([^/]+)/);
    if (집) 집별선택자.set(집[1].replace(/^www\./, ''), { 파일: f, 선택자: j.본문선택자 || null });
  }
}

const 집셈 = new Map();
console.log('── 하나씩 ──');
for (const j of 공고) {
  const z = 찌.get(j.id) || {};
  const 집 = String(j.url || '').match(/^https?:\/\/([^/]+)/);
  const h = 집 ? 집[1].replace(/^www\./, '') : '(주소 없음)';
  const c = 집별선택자.get(h);
  if (!집셈.has(h)) 집셈.set(h, { 수: 0, cfg: c ? c.파일 : null, 선택자: c ? c.선택자 : null });
  집셈.get(h).수++;
  console.log('  ' + j.id.padEnd(16) + String(j.source).padEnd(5) + (j.hidden ? '숨김' : '보임')
    + ' 첨부 ' + String(첨부수.get(j.id) || 0).padStart(2) + ' · 본문 ' + String(z.자).padStart(5) + '자 '
    + String(j.org_name || '').slice(0, 14).padEnd(16) + String(j.title || '').slice(0, 34));
}
console.log('\n── 집별 (고치는 자리) ──');
for (const [h, v] of [...집셈].sort((a, b) => b[1].수 - a[1].수)) {
  console.log('  ' + String(v.수).padStart(3) + '건  ' + h.padEnd(26)
    + (v.cfg ? 'cfg ' + v.cfg + (v.선택자 ? ' · 본문선택자 있음' : ' · **본문선택자 없음**') : '**cfg 없음**'));
}
console.log('\n첨부도 없고 본문도 찌꺼기인 것 — '
  + 공고.filter((j) => !(첨부수.get(j.id) || 0)).length + '건 (손 확인 거리)');
