/* **직군 근거가 뺀 줄에만** 있던 공고의 직군을 비웁니다 (2026-10-22 세중님 3번)
 *
 *   node tools/직군바로잡기.mjs                무엇이 바뀔지만 (기본 · 마른)
 *   node tools/직군바로잡기.mjs --진짜         바꿉니다
 *   node tools/직군바로잡기.mjs --쪽다시        본문이 CSS 찌꺼기인 건은 쪽을 다시 받아 판단
 *
 * ── 왜 ──────────────────────────────────────────────────────────
 * 셋째 표본에서 직군 의심 2건이 나와 근거에서 빼는 꼴 셋을 넣었습니다
 * (법령 정의 줄 · 제목이 붙은 이전글 꼬리표 · 결과 발표 글 제목).
 * 전수로 세니 **본문 있는 78건 중 15건**이 그 줄에만 근거가 있었고,
 * **제목에도 없는 12건**이 고칠 거리입니다.
 *
 * ★ 지우지 않습니다 — `job_group` 을 **null 로 비우고** 옛값을 `칸기록` 에 남깁니다.
 *   되돌리는 법: 칸기록에서 옛값을 꺼내 job_group 에 다시 넣습니다.
 * ★ `edited_fields` 에 job_group 이 있거나 `admin_locked` 인 공고는 건너뜁니다.
 * ★ 본문이 **CSS·JS 찌꺼기**인 공고는 그 글자로 직군이 붙은 것이라 따로 셉니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 본문직군 } from './공고문읽기.mjs';
import { matchJob, notOurs } from './gas-rules.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 쪽다시 = argv.includes('--쪽다시');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const cfg = {};
for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const 바탕 = cfg.SUPABASE_URL;
const 열쇠 = cfg.SUPABASE_SERVICE_KEY;
if (!바탕 || !열쇠) { console.error('SUPABASE_URL·SUPABASE_SERVICE_KEY 가 있어야 합니다'); process.exit(1); }
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

/** 본문이 **CSS·JS 찌꺼기**인가 — 스타일·스크립트가 글로 담긴 것 */
export function 찌꺼기본문(글) {
  const t = String(글 || '').trim();
  if (!t) return false;
  /* ★ 2026-10-22 — **앞 200자**로 봅니다. 강진의료원 본문은 2,306자 한 줄인데
     앞은 CSS 이고 뒤에 쪽 글자가 섞여 있어 「공고말이 있다」로 빠져나갔습니다.
     공고문은 **앞머리가 CSS 가 아닙니다** */
  const 앞머리찌꺼기 = t.slice(0, 200);
  const 표 = [/!important/, /\{[^}]{0,80}:[^}]{0,80};/, /function\s*\(/, /<style/i, /<script/i,
    /\bvar\s+\w+\s*=/, /px\s*;/, /-webkit-|-moz-/, /^\s*\/\*/];
  return 표.filter((re) => re.test(앞머리찌꺼기)).length >= 2;
}

const 우리말 = /(물리|작업|도수)\s*치료/;
const 공고 = await 전부('job_posts?select=id,source,org_name,title,url,job_group,hidden,hold,edited_fields,admin_locked');
const 우리것 = 공고.filter((j) => ['물리치료사', '작업치료사', '공통'].includes(j.job_group || ''));
const 글별 = new Map();
const ids = 우리것.map((x) => x.id);
for (let i = 0; i < ids.length; i += 50) {
  const 조각 = ids.slice(i, i + 50).map(encodeURIComponent).join(',');
  for (const b of await 전부('job_body?select=job_id,body&job_id=in.(' + 조각 + ')')) {
    글별.set(b.job_id, (글별.get(b.job_id) || '') + '\n' + String(b.body || ''));
  }
}

const 의심 = [];
let 찌꺼기수 = 0;
for (const j of 우리것) {
  const 글 = 글별.get(j.id);
  if (!글) continue;
  if (!우리말.test(글)) continue;            /* 본문에 아예 없음 — 다른 갈래 */
  if (본문직군(글)) continue;                /* 떼고 봐도 있음 — 멀쩡 */
  if (matchJob(j.title || '') && !notOurs(j.title || '')) continue;   /* 제목이 원문입니다 */
  /* ★ 2026-10-22 — **조교·연구 갈래는 빼둡니다.** 세중님 2026-10-14 결정대로
     보여 주는 갈래이고, 응시자격에 「작업치료**학** 전공자」 처럼 학과명으로만
     적히는 때가 많아 본문직군() 이 빈 값을 내는 것이 맞습니다 (ND1724) */
  if (/조\s*교|연구\s*(?:원|위원|교수)/.test(j.title || '')) continue;
  const 찌 = 찌꺼기본문(글);
  if (찌) 찌꺼기수++;
  의심.push({ ...j, 찌꺼기: 찌 });
}
console.log('우리 직군이 붙은 공고 ' + 우리것.length + '건 · 본문 있는 것 ' + 글별.size + '건');
console.log('★ 직군 근거가 **뺀 줄에만** 있고 제목에도 없는 것 ' + 의심.length + '건'
  + ' (그 가운데 본문이 CSS·JS 찌꺼기 ' + 찌꺼기수 + '건)');

/* 본문=CSS 꼴은 **전수**로도 셉니다 (우리 직군 밖까지) */
{
  const 모든글 = new Map();
  const 모든ids = 공고.map((x) => x.id);
  let 센것 = 0, 찌 = 0;
  for (let i = 0; i < 모든ids.length; i += 50) {
    const 조각 = 모든ids.slice(i, i + 50).map(encodeURIComponent).join(',');
    for (const b of await 전부('job_body?select=job_id,body&job_id=in.(' + 조각 + ')')) {
      모든글.set(b.job_id, (모든글.get(b.job_id) || '') + '\n' + String(b.body || ''));
    }
  }
  for (const [, g] of 모든글) { 센것++; if (찌꺼기본문(g)) 찌++; }
  console.log('본문이 있는 공고 ' + 센것 + '건 중 **CSS·JS 찌꺼기 본문** ' + 찌 + '건');
}

/* 쪽을 다시 받아 판단 (찌꺼기 본문 건) */
if (쪽다시) {
  for (const x of 의심.filter((y) => y.찌꺼기 && y.url)) {
    try {
      const r = await fetch(x.url, { headers: { 'User-Agent': UA } });
      const 글 = (await r.text()).replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, '\n');
      x.쪽직군 = 본문직군(글);
      x.쪽자 = 글.replace(/\s+/g, ' ').trim().length;
      console.log('  쪽 다시 — ' + x.id + ' HTTP ' + r.status + ' · ' + x.쪽자 + '자 · 직군 '
        + JSON.stringify(x.쪽직군));
    } catch (e) { console.log('  쪽 다시 ✗ ' + x.id + ' — ' + String(e.message).slice(0, 50)); }
    await new Promise((y) => setTimeout(y, 3000));
  }
}

const 바꿀것 = 의심.filter((x) => !x.admin_locked
  && !(x.edited_fields || []).includes('job_group')
  && !(x.쪽직군));                                   /* 쪽을 다시 받아 직군이 나오면 그대로 둡니다 */
const 건너뜀 = 의심.length - 바꿀것.length;

console.log('\n바꿀 것 ' + 바꿀것.length + '건 (건너뜀 ' + 건너뜀 + '건 — 관리자 손댐·사람이 고친 칸·쪽에서 직군 나옴)');
for (const x of 바꿀것) {
  console.log('  ' + x.id.padEnd(16) + String(x.source).padEnd(5) + String(x.job_group).padEnd(7)
    + (x.hidden ? '숨김' : '보임') + (x.찌꺼기 ? ' [CSS본문]' : '        ') + ' '
    + String(x.org_name || '').slice(0, 14).padEnd(16) + String(x.title || '').slice(0, 40));
}

if (!진짜) { console.log('\n[마른] 아무것도 안 바꿨습니다 — 바꾸려면 --진짜'); process.exit(0); }

let 담음 = 0;
for (const x of 바꿀것) {
  /* ① 칸기록에 옛값을 남깁니다 */
  const 기록 = await fetch(바탕 + '/rest/v1/' + encodeURIComponent('칸기록'), {
    method: 'POST',
    headers: { ...머리, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify([{
      job_id: x.id, 칸: 'job_group', 옛값: x.job_group, 새값: null,
      누가: '직군 바로잡기', 왜: '직군 근거가 뺀 줄(이전글 제목·법령 정의·결과 발표 제목)에만 있었습니다'
        + (x.찌꺼기 ? ' · 본문이 CSS·JS 찌꺼기입니다' : ''),
    }]),
  });
  if (!기록.ok) { console.error('  ✗ 칸기록 ' + x.id + ' — ' + (await 기록.text()).slice(0, 100)); continue; }
  /* ② 직군을 비웁니다 (updated_at 은 안 건드립니다 — 칸만 고칩니다) */
  const u = await fetch(바탕 + '/rest/v1/job_posts?id=eq.' + encodeURIComponent(x.id), {
    method: 'PATCH',
    headers: { ...머리, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ job_group: null }),
  });
  if (!u.ok) { console.error('  ✗ 비우기 ' + x.id + ' — ' + (await u.text()).slice(0, 100)); continue; }
  담음++;
}
console.log('\n비웠습니다 — ' + 담음 + '건');
console.log('되돌리는 법 — select job_id, 옛값 from 칸기록 where 누가=\'직군 바로잡기\' 로 꺼내 job_group 에 다시 넣습니다');
