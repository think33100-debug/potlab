/* 이미 담긴 공고의 **빈 칸을 다시 뽑습니다** (2026-10-09).
 *
 *   node tools/공고칸채우기.mjs --dry            몇 건·얼마쯤 드는지만 셉니다
 *   node tools/공고칸채우기.mjs --몇개 50        50건만
 *   node tools/공고칸채우기.mjs                  이어서 끝까지
 *
 * ★ 2026-10-09 밤 기준 **실행은 승인대기**입니다. --dry 만 돌려 두었습니다.
 *
 * ── 채우는 순서 (세중님 확정) ───────────────────────────────
 *   ① 제목  ② 상세 API 가 준 detail  ③ 첨부 공고문
 * ③ 은 PDF·HWP 는 kordoc(서버 ~/hwp읽기 · pdftotext), **그림은 Haiku** 입니다.
 * 끝내 못 찾으면 **「공고에 없음」을 쓰지 않습니다.** 칸을 비워 두고
 * 관리자 「빈칸 공고」(/admin/blanks) 로 보냅니다.
 *
 * ── 지키는 것 ───────────────────────────────────────────────
 *   · 모집인원은 **우리 직군 인원만**. 통합 공고의 전체 인원을 쓰지 않습니다
 *   · 「내규에 따름」·「협의」는 공고 말 그대로. 숫자를 만들지 않습니다
 *   · 근무지는 공고문 우선, 없으면 기관표 주소
 *   · admin_locked · edited_fields 가 걸린 칸은 **안 건드립니다**
 *   · updated_at 을 안 바꿉니다 (지침 9절 — 알림과 다리가 그 값을 봅니다)
 *   · 어디까지 했는지 기억했다가 이어갑니다 (job_posts.뽑은때)
 *   · 원문 detail 은 그대로 두고 **뽑은값** 칸에 따로 담습니다
 *
 * ── 비용 ────────────────────────────────────────────────────
 * 그림 한 장에 Haiku 한 번. --dry 가 그림 건수와 어림 비용을 적습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');

function env() {
  const out = {};
  for (const f of [path.join(뿌리, '.env'), path.join(뿌리, '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  return out;
}

const cfg = env();
const dry = process.argv.includes('--dry');
const 몇개 = (() => {
  const i = process.argv.indexOf('--몇개');
  return i >= 0 ? Number(process.argv[i + 1]) : null;
})();

const URL_ = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
const KEY = cfg.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) {
  console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다 (.env).');
  process.exit(2);
}

async function sb(길, 옵션 = {}) {
  const r = await fetch(URL_ + '/rest/v1/' + 길, {
    ...옵션,
    headers: {
      apikey: KEY, Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json',
      Prefer: 옵션.method === 'PATCH' ? 'return=minimal' : '',
      ...(옵션.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 300));
  return r.status === 204 ? null : r.json();
}

/* ★ PostgREST 는 **한 번에 100줄**에서 끊습니다. `limit=5000` 을 줘도
   서버 상한이 이깁니다 — 2026-10-09 에 「본 공고 100건」으로 나와서 알았습니다.
   Range 머리말로 쪽을 넘겨 가며 다 받습니다 (저장소의 tools/check.js 가
   「100줄에서 잘릴 수 있는 조회」를 세는 것이 바로 이 함정입니다) */
async function 전부(길, 한쪽 = 100, 최대 = 20000) {
  const out = [];
  for (let 부터 = 0; 부터 < 최대; 부터 += 한쪽) {
    const 묶음 = await sb(길, { headers: { Range: `${부터}-${부터 + 한쪽 - 1}` } });
    if (!묶음 || !묶음.length) break;
    out.push(...묶음);
    if (묶음.length < 한쪽) break;
  }
  return out;
}

/* 빈 칸이 있는 공고를 셉니다. 화면의 빈칸공고() 와 **같은 기준**입니다 —
   기준이 두 벌이 되면 화면 숫자와 도구 숫자가 달라집니다 (지침 6절) */
const 고를칸 = 'id,source,org_name,title,job_group,headcount,apply_to,work_place,'
  + 'detail,뽑은값,뽑은때,edited_fields,admin_locked,hidden,hold';

function 빈칸들(j) {
  const d = j.detail ?? {}; const p = j.뽑은값 ?? {};
  const 잠김 = new Set(j.edited_fields ?? []);
  const xs = [];
  if (j.headcount == null && !p.모집인원 && !잠김.has('모집인원')) xs.push('모집인원');
  if (!j.apply_to && !잠김.has('접수마감')) xs.push('접수마감');
  if (!j.work_place && !p.근무지 && !잠김.has('근무지')) xs.push('근무지');
  if (!d.지원자격 && !p.지원자격 && !잠김.has('지원자격')) xs.push('지원자격');
  if (!d.연봉 && !p.예상연봉 && !잠김.has('예상연봉')) xs.push('예상연봉');
  return xs;
}

const 길 = `job_posts?select=${encodeURIComponent(고를칸)}`
  + '&hidden=eq.false&hold=eq.false&admin_locked=eq.false'
  + '&order=뽑은때.asc.nullsfirst,id.asc';
const 공고들 = 몇개 ? await sb(길, { headers: { Range: `0-${몇개 - 1}` } }) : await 전부(길);

const 볼것 = 공고들.map((j) => ({ j, 빈칸: 빈칸들(j) })).filter((x) => x.빈칸.length);

/* 첨부가 있는 공고 — 그림은 Haiku, PDF·HWP 는 kordoc */
const 번호들 = 볼것.map((x) => x.j.id);
const 첨부 = [];
for (let i = 0; i < 번호들.length; i += 200) {
  const 조각 = 번호들.slice(i, i + 200).map(encodeURIComponent).join(',');
  첨부.push(...await 전부('job_attachments?select=job_id,kind,url&job_id=in.(' + 조각 + ')'));
}
const 첨부수 = new Map();
첨부.forEach((a) => 첨부수.set(a.job_id, (첨부수.get(a.job_id) ?? 0) + 1));
const 그림첨부 = 첨부.filter((a) => /\.(jpe?g|png|gif|webp)(\?|$)/i.test(a.url ?? ''));

const 칸별 = {};
볼것.forEach((x) => x.빈칸.forEach((k) => { 칸별[k] = (칸별[k] ?? 0) + 1; }));

console.log('\n── 빈칸 공고 ──────────────────────────────');
console.log('  본 공고        ' + 공고들.length + '건 (감춤·보류·관리자잠금 뺀 것)');
console.log('  빈칸 있는 공고 ' + 볼것.length + '건');
Object.entries(칸별).sort((a, b) => b[1] - a[1])
  .forEach(([k, n]) => console.log('    ' + k.padEnd(8) + n + '건'));
console.log('  첨부가 있는 공고 ' + 첨부수.size + '건 · 그림 첨부 ' + 그림첨부.length + '장');

/* Haiku 어림 비용 — 그림 한 장에 한 번. 2026-10 기준 입력 $1/백만 토큰 ·
   출력 $5/백만 토큰. 공고문 그림 한 장을 대략 입력 2,000 · 출력 300 으로 봅니다.
   **어림입니다** — 실제 값은 돌려 봐야 압니다 */
const 한장입력 = 2000, 한장출력 = 300;
const 달러 = (그림첨부.length * 한장입력 / 1e6) * 1
           + (그림첨부.length * 한장출력 / 1e6) * 5;
console.log('  Haiku 부를 횟수 ' + 그림첨부.length + '번 · 어림 비용 약 $'
  + 달러.toFixed(2) + ' (그림 한 장 입력 2,000·출력 300 토큰으로 본 값)');

if (dry) {
  console.log('\n--dry 라 아무것도 안 바꿨습니다.');
  console.log('실제로 돌리는 것은 **승인대기**입니다 (docs/승인대기_1009.md ⑨).');
  process.exit(0);
}

console.error('\n실행은 아직 막아 두었습니다 (2026-10-09 밤 · 승인대기 ⑨).');
console.error('세중님 승인을 받은 뒤 이 줄을 지우고 ②③ 단계를 붙입니다 —');
console.error('  ② detail 다시 읽기   ③ 첨부 공고문 (kordoc · 그림은 Haiku)');
process.exit(1);
