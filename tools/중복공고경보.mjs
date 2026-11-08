/* 같은 공고가 **다른 출처로 두 번** 담기면 메일 (2026-11-08 세중님).
 *
 *   node tools/중복공고경보.mjs            30분마다 (크론 · 수집기멈춤경보와 같은 박자)
 *   node tools/중복공고경보.mjs --보기      보내지 않고 화면에만
 *   node tools/중복공고경보.mjs --가짜      가짜 짝 한 개로 보내는 길만 시험 (제목에 「시험」)
 *      ★ 이름이 --시험 이 아닌 까닭 — 공용 tools/쪽나눠받기.mjs 가 argv 의 --시험 을 보고
 *        자기 자기점검을 돌린 뒤 끝내 버립니다(145줄). 그 이름을 피합니다
 *   node tools/중복공고경보.mjs --잊기      쉬는 기록을 비웁니다 (시험 뒤)
 *   node tools/중복공고경보.mjs --쉬기 6    같은 짝을 다시 알리는 간격(시간 · 기본 6)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 한 공고가 병원 홈페이지·알리오·나라일터에 같이 올라오면 회원 화면에 **두 줄**로
 * 보입니다 (docs/중복공고_주소정규화_1018.md — 한림병원 「(경력무관)」 두 줄).
 * 출처마다 주소가 다르니 수집기 열쇠로는 못 막습니다. 그래서 **사람이 보게** 알립니다.
 *
 * ── 하지 않는 것 ─────────────────────────────────────────────
 *   · 숨기기·합치기·지우기 **0** — 읽고 메일만 보냅니다 (세중님 11/8 「숨기기 없음」)
 *   · 문자 없음 — 메일만
 *   · DB 함수 새로 만들지 않음 — 표를 읽어 여기서 셉니다 (셈은 tools/중복공고_짝.mjs 한 자리)
 *
 * ── 시끄럽지 않게 ────────────────────────────────────────────
 * 같은 짝(두 공고 id)은 **6시간에 한 번만** 보냅니다. 안 고친 중복은 30분마다 또 걸리니
 * 그대로 두면 메일이 쌓여 아무도 안 봅니다 (수집기멈춤경보와 같은 결).
 * 쉬는 기록은 서버의 `~/중복경보기록.json` — 저장소 밖. **메일을 정말 보낸 때만** 적습니다.
 *
 * ── 무엇을 보나 ─────────────────────────────────────────────
 * job_posts 에서 **지금 보이는** 공고만 — hidden·hold·시험자료 가 아니고, 마감이 없거나
 * 오늘 이후인 것. (job_posts_pub 는 source 칸이 없어 표를 직접 읽습니다 — hold-digest 와 같음)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { 모두받기 } from './쪽나눠받기.mjs';
import { 짝찾기, 기간 } from './중복공고_짝.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 기록파일 = process.env.POTJOB_DUP_ALARM_STATE || path.join(os.homedir(), '중복경보기록.json');

const argv = process.argv.slice(2);
const 보기만 = argv.includes('--보기');
const 잊기 = argv.includes('--잊기');
const 시험 = argv.includes("--가짜");
const 쉬는시간 = Number(argv.includes('--쉬기') ? argv[argv.indexOf('--쉬기') + 1] : 6) || 6;

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);     /* 이름 없는 줄은 버립니다 (지침 8-12) */
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();

if (잊기) {
  if (fs.existsSync(기록파일)) fs.rmSync(기록파일);
  console.log('쉬는 기록을 비웠습니다 — ' + 기록파일);
  process.exit(0);
}

/* 오늘(한국 날짜) — 서버 시간대가 UTC 라도 한국 날짜로 잽니다 */
const 오늘 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

let 짝들;
let 출처이름 = {};
if (시험) {
  const 가 = { id: '시험-가', source: 'HS3', org_name: '시험병원(가짜)', title: '작업치료사 채용공고', apply_to: 오늘,
    url: 'https://example.invalid/가' };
  const 나 = { id: '시험-나', source: 'GJ2', org_name: '시험병원(가짜)', title: '작업치료사 모집 (경력무관)', apply_to: 오늘,
    url: 'https://example.invalid/나' };
  짝들 = 짝찾기([가, 나]);
} else {
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_KEY) { console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
  const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };
  const 칸 = ['id', 'source', 'org_name', '이름열쇠', 'title', 'apply_from', 'apply_to', 'posted_at', 'first_seen', 'url', '같은공고']
    .map(encodeURIComponent).join(',');
  const 조건 = 'hidden=is.false&hold=is.false&' + encodeURIComponent('시험자료') + '=is.false&or=(apply_to.is.null,apply_to.gte.' + 오늘 + ')';
  /* 한 줄로 둡니다 — 줄을 나누면 `쪽나눠받기_점검` 이 「차례 없는 조회」로 봅니다 */
  const 줄들 = await 모두받기(cfg.SUPABASE_URL + '/rest/v1/job_posts?select=' + 칸 + '&' + 조건, H, { 차례: 'id' });
  try {
    const 표 = await 모두받기(cfg.SUPABASE_URL + '/rest/v1/collect_source?select=code,name', H, { 차례: 'code' });
    for (const r of 표) 출처이름[r.code] = r.name;
  } catch { /* 이름을 못 받아도 코드로 찍으면 됩니다 */ }
  짝들 = 짝찾기(줄들);
  console.log('지금 보이는 공고 ' + 줄들.length + '건(' + 오늘 + ' 기준) · 다른 출처로 겹치는 짝 ' + 짝들.length + '개');
}

const 기록 = (() => {
  try { return JSON.parse(fs.readFileSync(기록파일, 'utf8')); } catch { return {}; }
})();
const 이제 = Date.now();
const 보낼것 = 짝들.filter((p) => {
  const 앞 = 기록[p.열쇠];
  return !앞 || (이제 - 앞) >= 쉬는시간 * 3600e3;
});

const 출처 = (s) => (출처이름[s] ? 출처이름[s] + '(' + s + ')' : s);
const 한줄 = (j) => {
  const [a, b] = 기간(j);
  return '      [' + 출처(j.source) + '] ' + j.title + '  ' + (a || '?') + '~' + (b || '열림') + '\n         ' + (j.url || '') + '  (id ' + j.id + ')';
};
짝들.forEach((p) => console.log('   ' + p.기관 + ' — ' + p.왜
  + (보낼것.includes(p) ? '' : '  ← ' + 쉬는시간 + '시간 안에 이미 보냈습니다') + '\n' + 한줄(p.가) + '\n' + 한줄(p.나)));

if (!보낼것.length) { console.log('보낼 것이 없습니다.'); process.exit(0); }

const 기관들 = [...new Set(보낼것.map((p) => p.기관))];
const 제목 = (시험 ? '[피오티잡 · 시험] ' : '[피오티잡] ') + '⚠ 같은 공고가 두 출처에 — ' + 보낼것.length + '짝 · '
  + 기관들.slice(0, 3).join(' · ') + (기관들.length > 3 ? ' 외 ' + (기관들.length - 3) + '곳' : '');
const 본문 = [
  '██ 같은 기관 · 비슷한 제목 · 겹치는 기간 · 다른 출처 — ' + 보낼것.length + '짝 ██',
  '',
  ...보낼것.flatMap((p) => ['   ' + p.기관 + ' — ' + p.왜, 한줄(p.가), 한줄(p.나), '']),
  '이 도구는 숨기거나 합치지 않습니다. 관리자 화면에서 보고 처리해 주세요.',
  '같은 짝은 ' + 쉬는시간 + '시간에 한 번만 보냅니다. 비슷한 제목 자는 tools/중복공고_짝.mjs 한 자리입니다.',
].join('\n');

if (보기만) {
  console.log('\n제목: ' + 제목 + '\n');
  console.log(본문);
  process.exit(0);
}

if (cfg.RESEND_KEY && cfg.NOTIFY_EMAIL) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>',
      to: [cfg.NOTIFY_EMAIL], subject: 제목, text: 본문,
    }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('메일 못 보냄 · HTTP ' + r.status + ' · ' + t.slice(0, 300)); process.exit(1); }
  let id = '';
  try { id = (JSON.parse(t) || {}).id || ''; } catch { /* 모양이 바뀌어도 넘어갑니다 */ }
  console.log('보냈습니다 — ' + 제목);
  console.log('   Resend id ' + (id || '(응답에 id 가 없습니다: ' + t.slice(0, 120) + ')'));
  /* 보낸 것만 기록합니다 — 못 보냈으면 다음 번에 다시 시도합니다 */
  보낼것.forEach((p) => { 기록[p.열쇠] = 이제; });
  fs.writeFileSync(기록파일, JSON.stringify(기록, null, 1) + '\n');
  console.log('쉬는 기록을 적었습니다 — ' + 기록파일);
} else {
  console.log('※ RESEND_KEY · NOTIFY_EMAIL 이 없어 화면에만 찍습니다\n');
  console.log('제목: ' + 제목 + '\n' + 본문);
  console.log('\n메일을 보내지 않아 쉬는 기록을 남기지 않았습니다 — 다음 번에 다시 시도합니다');
}
