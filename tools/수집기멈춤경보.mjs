/* 수집기가 **2시간 넘게** 안 돌면 요약을 기다리지 않고 바로 메일 (2026-10-12).
 *
 *   node tools/수집기멈춤경보.mjs            30분마다 (크론)
 *   node tools/수집기멈춤경보.mjs --보기      보내지 않고 화면에만
 *   node tools/수집기멈춤경보.mjs --기준 0.1  기준을 낮춰 시험 (시간 단위)
 *   node tools/수집기멈춤경보.mjs --잊기      쉬는 기록을 비웁니다 (시험 뒤)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 요약 메일은 하루 두 번(08:00·15:00)입니다. 2026-10-12 에 알리오·클린아이가
 * **07:15 에 멈췄는데** 08:00 요약에는 45분째라 안 걸리고, **15:00 까지
 * 아무도 몰랐습니다** (제가 미리보기로 먼저 봤습니다 — 운이었습니다).
 * 그날 올라온 물리치료사 공고 1건을 5시간 늦게 담았습니다.
 *
 * 그래서 30분마다 묻습니다 — 「2시간 넘게 안 돈 수집기가 있나」.
 *
 * ── 시끄럽지 않게 ────────────────────────────────────────────
 * 같은 수집기는 **6시간에 한 번만** 보냅니다. 멈춘 수집기는 고칠 때까지
 * 계속 멈춰 있으니, 30분마다 메일이 오면 아무도 안 봅니다 (지침 15절의 결 —
 * 「날마다 경보가 뜨면 아무도 경보를 안 믿게 됩니다」).
 * 쉬는 기록은 서버의 `~/경보기록.json` 에 둡니다 — 저장소 밖입니다.
 *
 * ── 판정은 DB 가 합니다 ──────────────────────────────────────
 * 「늦었나」는 `hold_digest` 의 `늦은 수집기` 를 그대로 씁니다. 여기서 또
 * 재면 기준이 두 벌이 됩니다 (지침 6절 — 기준은 한 자리).
 */
import fs from 'node:fs';
/* ★ 2026-10-26 세중님 3번 — DB 조회는 **공용 받아보기()** 로 합니다.
   지나가는 401(PGRST303 "JWT issued at future")·408·429·5xx·연결 탈을 1·2초 뒤 다시
   두드립니다 (404·403 은 바로 올립니다). 자는 tools/쪽나눠받기.mjs 한 자리입니다. */
import { 받아보기 } from './쪽나눠받기.mjs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 기록파일 = process.env.POTJOB_ALARM_STATE || path.join(os.homedir(), '경보기록.json');

const argv = process.argv.slice(2);
const 보기만 = argv.includes('--보기');
const 잊기 = argv.includes('--잊기');
const 기준시간 = Number(argv.includes('--기준') ? argv[argv.indexOf('--기준') + 1] : 2) || 2;
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

/* ── 쉬운 말 요약 (2026-11-18 세중님) ─────────────────────────
   작업마다 「무엇을 하나 · 멈추면 회원에게 무슨 일」 한 줄. 모르는 이름은 수집기로 봅니다 */
const 작업뜻 = [
  [/알림/, '회원에게 새 공고·마감 알림을 보내는 작업', '멈추면 알림이 늦게 가거나 안 갑니다'],
  [/경쟁사/, '경쟁사 공고 목록과 우리 속도를 견주는 작업', '회원 화면과는 무관합니다'],
  [/정찰|살아/, '올린 공고의 원문이 아직 살아 있는지 보는 작업', '멈추면 내려간 공고가 늦게 숨겨집니다'],
  [/교육|학술/, '교육·학술 일정을 모아 오는 작업', '멈추면 교육 일정이 늦게 올라옵니다'],
  [/경쟁률/, '공고 경쟁률을 모아 오는 작업', '멈추면 경쟁률 숫자가 늦게 바뀝니다'],
  [/봉사|청년/, '봉사·청년정책 정보를 모아 오는 작업', '멈추면 그 정보가 늦게 올라옵니다'],
];
const 간격말 = (h) => {
  const n = Number(h);
  if (!Number.isFinite(n) || n <= 0) return '알 수 없음';
  return n < 1 ? Math.round(n * 60) + '분마다' : (Math.round(n * 10) / 10) + '시간마다';
};
const 때말 = (iso) => {
  if (!iso) return '기록 없음';
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};
function 쉬운요약(보낼것, 상태 = []) {
  const 줄 = ['■ 한눈에 — ' + 보낼것.length + '가지 자동 작업이 제때 안 돌았습니다', ''];
  for (const x of 보낼것) {
    const s = 상태.find((b) => b.이름 === x.경로 || b.경로 === x.경로) || {};
    const 뜻 = 작업뜻.find(([re]) => re.test(String(x.경로))) || [null, '공고를 모아 오는 수집기', '멈추면 새 공고가 늦게 올라옵니다'];
    const 평소 = Number(s.평소간격시간), 기준 = Number(s.기대간격시간), 지난 = Number(x.몇시간째);
    줄.push('● ' + x.경로 + ' — ' + 지난 + '시간째 안 돌았어요');
    줄.push('   무엇: ' + 뜻[1]);
    if (s.마지막) 줄.push('   마지막으로 돈 때: ' + 때말(s.마지막) + ' · 평소 ' + 간격말(평소) + ' · 경보 기준 ' + (기준 || '?') + '시간');
    if (s.마지막탈) 줄.push('   마지막 실행이 탈났어요: ' + String(s.마지막탈).slice(0, 120));
    줄.push('   회원에게: ' + 뜻[2]);
    /* 기준을 조금 넘긴 것은 밤사이 쉬는 일정일 수 있습니다 — 판단은 사람이 합니다(문구만) */
    if (!s.마지막탈 && 기준 && 지난 < 기준 * 1.5) 줄.push('   참고: 기준을 조금 넘긴 정도예요 — 밤에 쉬는 일정이면 헛경보일 수 있어요');
    줄.push('');
  }
  줄.push('할 일: 서버 예약(크론)·로그 확인은 세중님 몫입니다. 이 메일을 앱 Claude 에게 보여 주면 원인을 찾아 드려요.');
  return 줄;
}

/* `--글시험` — 네트워크 없이 요약 글이 맞게 나오는지 (2026-11-18 · 11/18 실제 두 경보 값 그대로) */
if (argv.includes('--글시험')) {
  const 글 = 쉬운요약(
    [{ 경로: '알림 보내기', 몇시간째: 32.9, 왜: '와야 할 때가 지났는데 안 왔습니다' },
     { 경로: '경쟁사 관찰', 몇시간째: 12.3, 왜: '와야 할 때가 지났는데 안 왔습니다' }],
    [{ 경로: 'PUSH', 이름: '알림 보내기', 마지막: '2026-11-16T12:38:02Z', 평소간격시간: '0.5', 기대간격시간: '12.0', 마지막탈: '' },
     { 경로: 'RIVAL', 이름: '경쟁사 관찰', 마지막: '2026-11-17T09:15:05Z', 평소간격시간: '9.0', 기대간격시간: '12.0', 마지막탈: '' }]).join('\n');
  const 봐 = (말, 참) => { if (!참) { console.error('✗ ' + 말); process.exitCode = 1; } };
  봐('알림 — 30분마다', /알림 보내기 — 32\.9시간째[\s\S]*평소 30분마다/.test(글));
  봐('알림 — 회원 영향', /알림이 늦게 가거나 안 갑니다/.test(글));
  봐('알림 — 마지막 시각은 한국 시간', /11\. 16\. 21:38/.test(글));
  봐('경쟁사 — 회원 무관', /경쟁사[\s\S]*회원 화면과는 무관합니다/.test(글));
  봐('경쟁사 — 헛경보 참고', /경쟁사 관찰 — 12\.3[\s\S]*헛경보일 수 있어요/.test(글));
  봐('알림은 헛경보 참고 없음', !/알림 보내기 — 32\.9[^●]*헛경보/.test(글));
  봐('모르는 이름은 수집기', /공고를 모아 오는 수집기/.test(쉬운요약([{ 경로: 'HS3', 몇시간째: 3 }]).join('\n')));
  console.log(글);
  console.log(process.exitCode ? '✗ 글시험 실패' : '○ 글시험 통과 — 7가지');
  process.exit(process.exitCode || 0);
}

if (잊기) {
  if (fs.existsSync(기록파일)) fs.rmSync(기록파일);
  console.log('쉬는 기록을 비웠습니다 — ' + 기록파일);
  process.exit(0);
}
/* ★ 2026-11-08 세중님 — 「같은 공고가 두 번 보이나」 알림을 **여기서 함께** 부릅니다.
   크론 줄을 새로 만들지 않으려고 30분마다 도는 이 파일에 얹었습니다 (크론은 세중님 몫).
   **따로 떨어진 프로세스로** 부르고 2분에서 끊습니다 — 그쪽이 탈 나도 멈춤 경보는 그대로 갑니다.
   읽기 + 메일뿐입니다 (숨기지 않습니다). 끄려면 POTJOB_DUP_ALARM=off */
if (process.env.POTJOB_DUP_ALARM !== 'off') {
  try {
    const r = spawnSync(process.execPath, [path.join(여기, '중복공고경보.mjs'), ...(보기만 ? ['--마른'] : [])],
      { stdio: 'inherit', timeout: 120e3, env: process.env });
    if (r.error || r.status !== 0) console.error('  ⚠ 중복공고경보가 끝까지 못 돌았습니다 ('
      + (r.error ? String(r.error.message).slice(0, 80) : 'exit ' + r.status) + ') — 멈춤 경보는 이어서 봅니다');
  } catch (e) { console.error('  ⚠ 중복공고경보를 못 불렀습니다 — ' + String(e.message).slice(0, 80)); }
}
/* ★ 2026-11-13 세중님 — 「회원 가입 하는 사람 있으면 나한테 이메일」. 위 중복공고경보와 같은 결로 얹습니다
   (크론 줄을 새로 만들지 않습니다). 따로 떨어진 프로세스 · 2분에서 끊음 · 읽기 + 메일뿐. 끄려면 POTJOB_SIGNUP_ALARM=off */
if (process.env.POTJOB_SIGNUP_ALARM !== 'off') {
  try {
    const r = spawnSync(process.execPath, [path.join(여기, '가입알림.mjs'), ...(보기만 ? ['--마른'] : [])],
      { stdio: 'inherit', timeout: 120e3, env: process.env });
    if (r.error || r.status !== 0) console.error('  ⚠ 가입알림이 끝까지 못 돌았습니다 ('
      + (r.error ? String(r.error.message).slice(0, 80) : 'exit ' + r.status) + ') — 멈춤 경보는 이어서 봅니다');
  } catch (e) { console.error('  ⚠ 가입알림을 못 불렀습니다 — ' + String(e.message).slice(0, 80)); }
}

if (!cfg.COLLECT_KEY_HS3) { console.error('COLLECT_KEY_HS3 가 없습니다'); process.exit(1); }

async function rpc(fn, body) {
  const k = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY;
  const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(fn), {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

const d = await rpc('hold_digest', { p_secret: cfg.COLLECT_KEY_HS3, p_source: 'HS3', p_hours: 24 });
let 늦음 = (d['늦은 수집기'] || []).filter((x) => Number(x['몇시간째']) >= 기준시간);

/* `--시험` — **보내는 길이 정말 되는지** 보려고 가짜 한 줄을 넣습니다.
   기준을 낮추는 것만으로는 시험이 안 됩니다 — 수집기가 다 멀쩡하면
   「늦은 수집기 0곳」 이라 메일이 안 나가기 때문입니다 (2026-10-12 에 그랬습니다).
   제목에 「시험」 을 박아 두어 받는 쪽이 헷갈리지 않게 합니다.
   쓰고 나면 `--잊기` 로 쉬는 기록을 비우십시오. */
if (argv.includes('--시험')) {
  늦음 = [{ 경로: '시험(가짜)', 왜: '보내는 길이 되는지 보는 시험입니다 — 멈춘 수집기가 아닙니다',
    몇시간째: 99 }];
}

const 기록 = (() => {
  try { return JSON.parse(fs.readFileSync(기록파일, 'utf8')); } catch { return {}; }
})();
const 이제 = Date.now();
const 보낼것 = 늦음.filter((x) => {
  const 앞 = 기록[x.경로];
  return !앞 || (이제 - 앞) >= 쉬는시간 * 3600e3;
});

console.log('늦은 수집기 ' + (d['늦은 수집기'] || []).length + '곳 · 기준(' + 기준시간
  + '시간) 넘은 것 ' + 늦음.length + '곳 · 쉬는 시간을 지나 보낼 것 ' + 보낼것.length + '곳');
늦음.forEach((x) => console.log('   ' + x.경로 + ' — ' + x.왜 + ' (' + x.몇시간째 + '시간째)'
  + (보낼것.includes(x) ? '' : '  ← ' + 쉬는시간 + '시간 안에 이미 보냈습니다')));

if (!보낼것.length) { console.log('보낼 것이 없습니다.'); process.exit(0); }

/* ★ 2026-11-18 세중님 「경보가 왜 뜨는거?」 → 「간략하게 보고도 메일로 하게 해줘」.
   메일 맨 위에 **쉬운 말 요약**을 둡니다 — 무엇이 · 평소 언제 도는데 · 몇 시간째 · 회원에게 무슨 일.
   평소 간격·기준·마지막 시각은 DB beat_health() 한 자리에서 읽습니다(판정과 같은 자 · 지침 6절).
   서버 명령은 아래 「서버에서 볼 것」으로 내립니다. 서비스 이름은 RAPO (11/11 세중님). */
let 상태 = [];
try { const b = await rpc('beat_health', {}); 상태 = Array.isArray(b) ? b : []; } catch (e) {
  console.error('  ⚠ beat_health 를 못 읽었습니다 — 요약 없이 보냅니다 (' + String(e.message).slice(0, 80) + ')');
}
const 제목 = (argv.includes('--시험') ? '[RAPO · 시험] ' : '[RAPO] ')
  + '⚠ 자동 작업 멈춤 — '
  + 보낼것.map((x) => x.경로 + ' ' + x.몇시간째 + '시간째').join(' · ');
const 본문 = [
  ...쉬운요약(보낼것, 상태),
  '',
  '── 자세히 (개발용) ──',
  '██ ' + 기준시간 + '시간 넘게 안 돌았습니다 ██',
  '',
  ...보낼것.map((x) => '   ' + x.경로 + ' — ' + x.왜 + ' (' + x.몇시간째 + '시간째)'),
  '',
  '서버에서 볼 것 —',
  '   ls -la ~/lock/            그 수집기의 잠금 시각이 멈춰 있나',
  '   ls -l ~/수집크론.sh        실행 권한이 있나 (-rwx…)  ← 2026-10-12 에 이것이었습니다',
  '   ps -eo pid,etime,cmd | grep "[t]ools/"   멈춰 선 프로세스가 있나 (pid 로 죽입니다)',
  '   tail ~/log/<그 수집기>.log  끝줄이 이미 끝난 꼴이면 프로세스가 선 것입니다',
  '',
  '같은 수집기는 ' + 쉬는시간 + '시간에 한 번만 보냅니다. 요약 메일(08:00·15:00)에도 함께 뜹니다.',
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
  보낼것.forEach((x) => { 기록[x.경로] = 이제; });
  fs.writeFileSync(기록파일, JSON.stringify(기록, null, 1) + '\n');
  console.log('쉬는 기록을 적었습니다 — ' + 기록파일);
} else {
  console.log('※ RESEND_KEY · NOTIFY_EMAIL 이 없어 화면에만 찍습니다\n');
  console.log('제목: ' + 제목 + '\n' + 본문);
  console.log('\n메일을 보내지 않아 쉬는 기록을 남기지 않았습니다 — 다음 번에 다시 시도합니다');
}
