/* **회원이 신뢰를 느끼는 셋** — 아침마다 한 자리에서 셉니다 (2026-10-22 세중님 · 오픈 11/10)
 *
 *   node tools/신뢰셋.mjs              세 숫자와 목록
 *   node tools/신뢰셋.mjs --조용히     세 줄만 (보고에 붙일 꼴)
 *
 * 목표는 **셋 다 0** 입니다 (docs/오픈일정_1110.md).
 *
 *   ① 마감 지난 공고가 회원 화면에 보임
 *   ② 회원 화면에 틀린 값                      주 1회 표본 40건 원문 대조 (손으로 잽니다)
 *   ③ 우리 직군이 아닌 공고·직군 빈칸이 보임
 *
 * ★ **세는 곳은 DB 함수 `네숫자()` 의 '신뢰셋' 하나입니다** (지침 6절 · 2026-10-22).
 *   처음에는 이 파일이 따로 셌는데, 아침 메일과 숫자가 갈라질 자리가 됩니다.
 *   여기서는 받아 찍고, **파고들 목록**만 따로 불러옵니다.
 * ★ ② 를 새로 쟀으면 `--틀림넣기` 로 site_settings['신뢰셋_틀림'] 을 고칩니다.
 * ★ 읽기만 합니다 (--틀림넣기 만 그 한 줄을 고칩니다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 조용히 = process.argv.includes('--조용히');
const 틀림넣기 = process.argv.includes('--틀림넣기');

const cfg = {};
for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const 바탕 = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
const 열쇠 = cfg.SUPABASE_SERVICE_KEY;
if (!바탕 || !열쇠) { console.error('SUPABASE_URL·열쇠가 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const 머리 = { apikey: 열쇠, Authorization: 'Bearer ' + 열쇠 };

async function 창구(이름, 몸 = {}) {
  const r = await fetch(바탕 + '/rest/v1/rpc/' + encodeURIComponent(이름), {
    method: 'POST', headers: { ...머리, 'Content-Type': 'application/json' },
    body: JSON.stringify(몸),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(이름 + ' → ' + r.status + ' ' + t.slice(0, 120));
  return JSON.parse(t);
}
/** ★ 100줄에서 끊깁니다 — 받은 줄 수만큼 넘기고 0줄일 때 멈춥니다 */
async function 다받기(길) {
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

/* ② 를 새로 쟀을 때 — log/신뢰셋_틀림.json 을 site_settings 로 올립니다 */
if (틀림넣기) {
  let 잰것 = null;
  for (const t of [path.join(여기, '..', 'log', '신뢰셋_틀림.json'),
    path.join(process.env.HOME || '', 'log', '신뢰셋_틀림.json')]) {
    try { 잰것 = JSON.parse(fs.readFileSync(t, 'utf8')); break; } catch { /* 다음 자리 */ }
  }
  if (!잰것) { console.error('log/신뢰셋_틀림.json 이 없습니다'); process.exit(1); }
  const r = await fetch(바탕 + '/rest/v1/site_settings?on_conflict=key', {
    method: 'POST',
    headers: { ...머리, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key: '신뢰셋_틀림', value: 잰것 }]),
  });
  if (!r.ok) { console.error('✗ 못 넣었습니다 — ' + (await r.text()).slice(0, 200)); process.exit(1); }
  console.log('○ ② 를 넣었습니다 — 틀림 ' + 잰것.틀림 + '건 · 잰날 ' + 잰것.잰날);
}

const 네 = await 창구('네숫자');
const t = 네['신뢰셋'];
if (!t) { console.error('네숫자() 에 신뢰셋 칸이 없습니다 — 마이그레이션이 올라갔나 보십시오'); process.exit(1); }

const 표 = (v) => (v === null || v === undefined ? '아직 못 잼' : v + '건');
console.log('① 마감 지난 공고가 보임        ' + 표(t['①마감지난공고가보임']));
console.log('② 회원 화면에 틀린 값          ' + 표(t['②회원화면에틀린값'])
  + (t['②잰날'] ? '   (' + t['②잰날'] + ' · 표본 ' + t['②표본'] + ')' : '   (주 1회 · 새 표본 40건 원문 대조)'));
console.log('③ 우리 직군이 아닌 공고·빈칸   ' + 표(t['③우리직군아님_직군빈칸'])
  + '   (직군 빈칸 ' + t['③직군빈칸'] + ' · 자격증 목록꼴 ' + t['③자격증목록꼴']
  + ' · 직군의심 ' + t['③직군의심'] + (t['③겹친것'] ? ' · 겹침 ' + t['③겹친것'] : '') + ')');
if (조용히) process.exit(0);

console.log('\n회원 화면 ' + (네['회원화면'] ?? '?') + '건 · 잰 때 ' + (네['잰때'] || ''));

/* ── 파고들 목록 (셈은 위에서 끝났습니다 · 아래는 보기용) ───────────────── */
if ((t['③직군빈칸'] ?? 0) > 0) {
  const 보임 = await 다받기('job_posts_pub?select=id,job_group,title&order=id');
  const 빈칸 = 보임.filter((v) => !String(v.job_group || '').trim()).map((v) => v.id);
  const 공고 = await 다받기('job_posts?select=id,source,org_name&id=in.(' + 빈칸.join(',') + ')');
  const 이름 = new Map(공고.map((x) => [x.id, x]));
  console.log('\n── 직군 빈칸 ──');
  for (const id of 빈칸.slice(0, 12)) {
    const j = 이름.get(id) || {};
    console.log('  ' + id.padEnd(13) + String(j.source || '').padEnd(5)
      + String(j.org_name || '').slice(0, 14).padEnd(16)
      + String((보임.find((v) => v.id === id) || {}).title || '').slice(0, 44));
  }
}
if ((t['③직군의심'] ?? 0) > 0) {
  const 의심 = await 창구('직군의심');
  console.log('\n── 직군의심() 이 본 것 ──');
  for (const x of (의심['의심목록'] || []).slice(0, 12)) console.log('  ' + JSON.stringify(x).slice(0, 150));
}
