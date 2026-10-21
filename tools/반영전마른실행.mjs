/* **반영 전 전수 마른 실행** — 규칙을 바꾼 뒤, 회원 DB **전체 공고**에 지금 코드를
 * 걸어 보고 **값이 바뀌는 공고 수**를 칸별로 셉니다 (2026-10-22 세중님 4번 · 새 안전장치)
 *
 *   node tools/반영전마른실행.mjs              전부 (기본)
 *   node tools/반영전마른실행.mjs --회원만
 *   node tools/반영전마른실행.mjs --줄 40       직군 바뀌는 목록 줄 수 (기본 전부)
 *   node tools/반영전마른실행.mjs --문턱 60     이 수를 넘는 칸이 있으면 ★ 로 세웁니다
 *
 * ★ 읽기만 합니다. DB 에 아무것도 쓰지 않습니다. 그물도 안 두드립니다(담긴 본문만 씁니다).
 *
 * ── 왜 생겼나 (2026-10-22 세중님) ──────────────────────────────
 * 어젯밤 제가 넣은 울타리(법령 정의·이전글 제목·결과 발표 제목)가 **한 줄짜리
 * 공고문 전체를 떨어뜨렸습니다.** 50건 표본에서는 **안 잡혔습니다** — 표본의
 * 원문은 줄바꿈이 있었기 때문입니다. 전수로 걸어 보면 「직군이 사라지는 공고 9건」
 * 처럼 **수가 먼저** 보입니다. 그래서 반영 전에 이것을 돌립니다.
 *
 * 세는 것 — 칸마다
 *   빈칸→값   지금 비었는데 새 규칙이 값을 냅니다 (채움)
 *   값→다른값  지금 값이 있는데 새 규칙이 **다른 값**을 냅니다 (덮기 — 가장 위험)
 *   값→빈칸   지금 값이 있는데 새 규칙이 **못 냅니다** (잃음 — 어젯밤 흠이 이 꼴)
 * 그리고 **직군이 바뀌는 공고는 전부 목록**으로 찍습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 칸뽑기, 고용형태고르기, 본문직군 } from './공고문읽기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 회원만 = argv.includes('--회원만');
const 줄수 = Number(값('--줄', 0)) || 0;      /* 0 = 전부 */
const 문턱 = Number(값('--문턱', 60));

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

const 공고 = await 전부('job_posts?select=id,source,org_name,title,job_group,headcount,apply_to,'
  + 'apply_to_time,work_place,employ_type,detail,' + encodeURIComponent('뽑은값')
  + ',edited_fields,admin_locked,hidden,hold');
const 보임 = 회원만 ? new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id)) : null;
const 볼것 = 회원만 ? 공고.filter((j) => 보임.has(j.id)) : 공고;

/* 본문 글 (담긴 것만 — 그물을 안 두드립니다) */
const 글별 = new Map();
const ids = 볼것.map((x) => x.id);
for (let i = 0; i < ids.length; i += 50) {
  const 조각 = ids.slice(i, i + 50).map(encodeURIComponent).join(',');
  for (const b of await 전부('job_body?select=job_id,body&job_id=in.(' + 조각 + ')')) {
    글별.set(b.job_id, (글별.get(b.job_id) || '') + '\n' + String(b.body || ''));
  }
}
console.log('공고 ' + 볼것.length + '건' + (회원만 ? ' (회원 화면만)' : ' (숨김·보류 포함)')
  + ' · 본문 글이 있는 것 ' + 글별.size + '건');
console.log('★ 읽기만 합니다 — DB 에 아무것도 쓰지 않습니다\n');

const 칸이름 = ['모집인원', '접수마감', '마감시각', '근무지', '지원자격', '예상연봉', '고용형태', '직군'];
const 셈 = {};
for (const k of 칸이름) 셈[k] = { '빈칸→값': 0, '값→다른값': 0, '값→빈칸': 0, 같음: 0, 둘다없음: 0 };
const 직군바뀜 = [];
const 견본 = {};

const 있나 = (v) => v != null && v !== '';
const 글자 = (v) => (v == null ? '' : String(v).trim());

for (const j of 볼것) {
  const 글 = 글별.get(j.id);
  if (!글) continue;
  const p = j['뽑은값'] || {};
  const d = j.detail || {};
  let 뽑;
  try { 뽑 = 칸뽑기(글, ''); } catch (e) { continue; }
  const 새 = {
    모집인원: 뽑.모집인원 && Object.keys(뽑.모집인원).length
      ? Object.values(뽑.모집인원)[0] : (뽑.모집인원글 ? Object.values(뽑.모집인원글)[0] : null),
    접수마감: 뽑.접수마감, 마감시각: 뽑.접수시각, 근무지: 뽑.근무지,
    지원자격: 뽑.지원자격, 예상연봉: 뽑.예상연봉,
    고용형태: (() => { try { return 고용형태고르기(j.title || '', 글).값 || null; } catch { return null; } })(),
    직군: (() => { try { return 본문직군(글) || null; } catch { return null; } })(),
  };
  const 지금 = {
    모집인원: j.headcount != null ? j.headcount : (p.모집인원 ?? null),
    접수마감: j.apply_to, 마감시각: j.apply_to_time, 근무지: j.work_place,
    지원자격: p.지원자격 ?? d.지원자격 ?? null,
    예상연봉: p.예상연봉 ?? d.예상연봉 ?? d.연봉 ?? null,
    고용형태: j.employ_type, 직군: j.job_group,
  };
  for (const k of 칸이름) {
    const a = 글자(지금[k]); const b = 글자(새[k]);
    if (!있나(a) && !있나(b)) { 셈[k].둘다없음++; continue; }
    if (a === b) { 셈[k].같음++; continue; }
    const 갈래 = !있나(a) ? '빈칸→값' : (!있나(b) ? '값→빈칸' : '값→다른값');
    셈[k][갈래]++;
    견본[k] = 견본[k] || [];
    if (견본[k].length < 3) 견본[k].push(j.id + ' ' + 갈래 + ' 「' + a.slice(0, 26) + '」 → 「' + b.slice(0, 26) + '」');
    if (k === '직군') {
      직군바뀜.push({ id: j.id, source: j.source, 기관: j.org_name, 제목: j.title,
        숨김: j.hidden, 갈래, 지금: a, 새: b });
    }
  }
}

console.log('── 값이 바뀌는 공고 수 (칸별) ──');
console.log('  칸        빈칸→값   값→다른값   값→빈칸     같음  둘다없음');
let 센 = false;
for (const k of 칸이름) {
  const c = 셈[k];
  const 바뀜 = c['빈칸→값'] + c['값→다른값'] + c['값→빈칸'];
  const 세움 = 바뀜 > 문턱 ? '  ★' : '';
  if (바뀜 > 문턱) 센 = true;
  console.log('  ' + k.padEnd(8) + String(c['빈칸→값']).padStart(7) + String(c['값→다른값']).padStart(10)
    + String(c['값→빈칸']).padStart(9) + String(c.같음).padStart(9) + String(c.둘다없음).padStart(9) + 세움);
}
for (const k of 칸이름) {
  if (!견본[k]) continue;
  console.log('\n  [' + k + '] 견본');
  for (const l of 견본[k]) console.log('    ' + l);
}

console.log('\n── 직군이 바뀌는 공고 ' + 직군바뀜.length + '건 (전부) ──');
for (const x of (줄수 ? 직군바뀜.slice(0, 줄수) : 직군바뀜)) {
  console.log('  ' + x.id.padEnd(16) + String(x.source).padEnd(5) + (x.숨김 ? '숨김' : '보임')
    + ' ' + x.갈래.padEnd(8) + ('「' + x.지금 + '」 → 「' + x.새 + '」').padEnd(22)
    + String(x.기관 || '').slice(0, 14).padEnd(16) + String(x.제목 || '').slice(0, 36));
}

console.log('\n' + (센
  ? '★ 문턱(' + 문턱 + '건)을 넘는 칸이 있습니다 — **반영을 멈추고 보고합니다** (세중님 4번)'
  : '○ 문턱(' + 문턱 + '건)을 넘는 칸이 없습니다'));
process.exit(센 ? 2 : 0);
