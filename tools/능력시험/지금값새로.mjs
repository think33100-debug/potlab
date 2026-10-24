/* 능력시험 표본의 **「지금값」을 DB 에서 새로** 받습니다 (2026-10-24)
 *
 *   node tools/능력시험/지금값새로.mjs            표본.json (기본)
 *   node tools/능력시험/지금값새로.mjs --표본 표본2.json
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * `표본.json` 의 `지금값` 은 **표본을 뽑은 날(10/20)에 찍은 사진**입니다.
 * 그래서 칸을 고치고 다시 채점해도 **점수가 그대로**입니다 — 2026-10-24 에
 * 지원자격 11건을 덮고도 36% 가 안 움직여서 알았습니다.
 *
 * 이 도구는 **지금값만** 다시 받습니다 (표본 공고·정답지는 안 건드립니다).
 * ★ 읽기만 합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 차례붙이기 } from '../쪽나눠받기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 표본이름 = argv.includes('--표본') ? argv[argv.indexOf('--표본') + 1] : '표본.json';

const cfg = {};
for (const 이름 of ['../../.env', '../../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL; const K = cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 있어야 합니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };

const 자리 = path.join(여기, 표본이름);
const 본 = JSON.parse(fs.readFileSync(자리, 'utf8'));
const 표본 = Array.isArray(본) ? 본 : 본.표본;
console.log('표본 ' + 표본.length + '건 — 지금값을 다시 받습니다');

const 받음 = new Map();
for (let i = 0; i < 표본.length; i += 40) {
  const 조각 = 표본.slice(i, i + 40).map((x) => encodeURIComponent(x.id)).join(',');
  const 길 = 차례붙이기('job_posts?select=id,job_group,work_place,employ_type,headcount,'
    + 'apply_to,apply_to_time,detail,' + encodeURIComponent('뽑은값') + '&id=in.(' + 조각 + ')');
  const r = await fetch(U + '/rest/v1/' + 길 + '&limit=100', { headers: H });
  if (!r.ok) { console.error('✗ ' + r.status + ' ' + (await r.text()).slice(0, 160)); process.exit(1); }
  for (const x of await r.json()) 받음.set(x.id, x);
}
console.log('DB 에서 받은 공고 ' + 받음.size + '건');

/* 지금값 꼴은 표본뽑기.mjs 가 만든 것과 같게 둡니다 — 시험.mjs 가 그 열쇠를 봅니다 */
const 뽑 = (x, k) => {
  const v = (x['뽑은값'] || {})[k];
  return v == null || v === '' ? null : v;
};
const 디 = (x, k) => {
  const v = (x.detail || {})[k];
  return v == null || v === '' ? null : v;
};
let 바뀜 = 0;
for (const 줄 of 표본) {
  const x = 받음.get(줄.id);
  if (!x) continue;
  const 새 = {
    직군: x.job_group || null,
    근무지: x.work_place || null,
    고용형태: x.employ_type || null,
    마감시각: x.apply_to_time || null,
    모집인원: x.headcount != null ? x.headcount : (뽑(x, '모집인원') || 디(x, '모집인원') || null),
    접수마감: x.apply_to || null,
    예상연봉: 뽑(x, '예상연봉') || 디(x, '연봉') || 디(x, '예상연봉') || null,
    지원자격: 뽑(x, '지원자격') || 디(x, '지원자격') || null,
  };
  if (JSON.stringify(줄.지금값 || {}) !== JSON.stringify(새)) 바뀜++;
  줄.지금값 = 새;
}
본.지금값받은때 = new Date().toLocaleString('sv-SE').replace('T', ' ');
fs.writeFileSync(자리, JSON.stringify(본, null, 1) + '\n');
console.log('○ ' + 표본이름 + ' 의 지금값을 새로 적었습니다 — 달라진 공고 ' + 바뀜 + '건');
