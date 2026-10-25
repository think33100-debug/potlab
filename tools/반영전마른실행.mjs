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
/* ★ 2026-10-25 — 쪽을 넘길 때는 **차례(order)를 반드시** 붙입니다. 안 붙이면 줄이
   겹치거나 빠집니다 (지침 8-20 ③ · 10/23 에 292→231, 10/25 에 281→219 로 잘못 셌습니다).
   자는 tools/쪽나눠받기.mjs 의 차례붙이기() 하나입니다 — **직접 offset 을 쓰지 않습니다**. */
import { 차례붙이기 } from './쪽나눠받기.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 칸뽑기, 고용형태고르기, 본문직군 } from './공고문읽기.mjs';
import { spawnSync } from 'node:child_process';

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
    const r = await fetch(바탕 + '/rest/v1/' + 차례붙이기(길)
      + '&limit=1000&offset=' + off, { headers: 머리 });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 160));
    const 줄 = await r.json();
    모은것.push(...줄);
    if (!줄.length) break;
    off += 줄.length;
    if (off > 200000) throw new Error('너무 많습니다');
  }
  return 모은것;
}

/* ★ `--기준 <커밋>` 이면 그 커밋의 공고문읽기.mjs 를 꺼내 **옛 코드 ↔ 새 코드**를
   같은 글로 견줍니다. 이것이 「규칙 바꿈이 미치는 바」의 참 잣대입니다.
   안 주면 「DB ↔ 지금 코드」 를 보여 줍니다 (되먹일 거리를 보는 눈) */
const 기준커밋 = 값('--기준', '');
let 옛 = null;
if (기준커밋) {
  const 낼곳 = path.join(여기, '공고문읽기_기준.mjs');
  const r = spawnSync('git', ['show', 기준커밋 + ':tools/공고문읽기.mjs'],
    { encoding: 'utf8', cwd: path.join(여기, '..'), maxBuffer: 1 << 26 });
  if (r.status !== 0) { console.error('✗ 기준 코드를 못 꺼냈습니다 — ' + String(r.stderr || '').slice(0, 200)); process.exit(1); }
  fs.writeFileSync(낼곳, r.stdout, 'utf8');
  옛 = await import('./공고문읽기_기준.mjs');
  console.log('기준 코드 — ' + 기준커밋 + ' (tools/공고문읽기_기준.mjs 로 꺼냈습니다)');
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
/** ★ 2026-10-22 — **꼴을 맞춘 뒤** 견줍니다. 안 맞추면 「11:00:00 ↔ 11:00」·
    「2026-10-06T00:00 ↔ 2026-10-06」 처럼 **같은 값이 바뀜으로 찍힙니다**
    (첫 실행에서 마감시각 151건이 그 꼴이었습니다) */
const 꼴맞추기 = (v) => {
  let t = (v == null ? '' : String(v)).trim().replace(/\s+/g, ' ');
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) t = t.slice(0, 5);                 /* 시각 — 초를 뗍니다 */
  const d = t.match(/^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/);
  if (d) t = d[1] + '-' + String(d[2]).padStart(2, '0') + '-' + String(d[3]).padStart(2, '0');
  return t;
};
const 글자 = 꼴맞추기;

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
  /* 기준 코드가 있으면 **옛 코드가 낸 값**과 견줍니다 (없으면 DB 값과) */
  const 지금 = 옛 ? (() => {
    let o;
    try { o = 옛.칸뽑기(글, ''); } catch { o = {}; }
    return {
      모집인원: o.모집인원 && Object.keys(o.모집인원).length
        ? Object.values(o.모집인원)[0] : (o.모집인원글 ? Object.values(o.모집인원글)[0] : null),
      접수마감: o.접수마감, 마감시각: o.접수시각, 근무지: o.근무지,
      지원자격: o.지원자격, 예상연봉: o.예상연봉,
      고용형태: (() => { try { return 옛.고용형태고르기(j.title || '', 글).값 || null; } catch { return null; } })(),
      직군: (() => { try { return 옛.본문직군(글) || null; } catch { return null; } })(),
    };
  })() : {
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
    /* ★ 2026-10-22 — **덮어쓰거나 비우는 것은 몇 건이든 전부** 찍습니다.
       빈칸을 채우는 것과 달리 「값 → 다른 값」·「값 → 빈칸」은 **전에 맞았을 수도
       있는 값을 지우는** 자리입니다. 앞 3건만 찍으면 그 줄이 목록에 안 들 수
       있습니다 — 오늘 고용형태 「값→다른값 4건」이 견본에 하나도 안 보였습니다
       (고용형태_바로잡기.mjs 에 같은 고침을 했습니다) */
    const 다덮나 = 갈래 !== '빈칸→값';
    if (다덮나 || 견본[k].length < 3) {
      견본[k].push((다덮나 ? '★ ' : '') + j.id + ' ' + 갈래
        + ' 「' + a.slice(0, 26) + '」 → 「' + b.slice(0, 26) + '」');
    }
    if (k === '직군') {
      직군바뀜.push({ id: j.id, source: j.source, 기관: j.org_name, 제목: j.title,
        숨김: j.hidden, 갈래, 지금: a, 새: b });
    }
  }
}

console.log('── 값이 바뀌는 공고 수 (칸별) — '
  + (옛 ? '**옛 코드(' + 기준커밋 + ') ↔ 지금 코드**, 같은 본문 글' : 'DB 값 ↔ 지금 코드(본문 글만)') + ' ──');
if (!옛) console.log('  ※ 「값→빈칸」 은 잃음이 아닙니다 — API 가 준 값(접수마감 따위)은 본문만으론 못 냅니다.');
if (!옛) console.log('  ※ 규칙 바꿈을 보려면 --기준 <커밋> 으로 **옛 코드와** 견주십시오.');
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
if (기준커밋) { try { fs.unlinkSync(path.join(여기, '공고문읽기_기준.mjs')); } catch { /* 이미 없으면 그대로 */ } }
process.exit(센 ? 2 : 0);
