/* 새 회원이 가입하면 세중님께 메일 (2026-11-13 세중님 「회원 가입 하는 사람 있으면 나한테 이메일 오게 하자」).
 *
 *   node tools/가입알림.mjs              새 가입이 있으면 메일
 *   node tools/가입알림.mjs --마른        보내지 않고 보낼 글만 화면에 (기록도 안 남김)
 *   node tools/가입알림.mjs --자기점검    글 꼴만 시험 (DB·메일 안 건드림)
 *   node tools/가입알림.mjs --잊기        본 기록을 비움 (다음 번에 지난 1시간을 다시 봄)
 *
 * ── 언제 도나 ───────────────────────────────────────────────
 * 크론 줄을 새로 만들지 않습니다(크론은 세중님 몫). 중복공고경보와 같이
 * `tools/수집기멈춤경보.mjs` 가 30분마다 돌 때 이 파일을 한 번 부릅니다. 그래서 **30분 안에** 옵니다.
 * 끄려면 POTJOB_SIGNUP_ALARM=off.
 *
 * ── 「가입」의 뜻 ────────────────────────────────────────────
 * 로그인만 하고 가입 화면(/welcome)을 끝내지 않은 분은 `profiles` 줄이 없습니다.
 * 그래서 **`profiles` 에 새 줄이 생긴 것**을 가입으로 셉니다 (`가입하기()` 가 넣습니다).
 * 날마다 도는 가입 그물(tools/가입그물.mjs)의 가상 회원은 뺍니다 — 메일이 `signup-check-` 로 시작하거나,
 * 이미 지워져 계정이 없는 줄입니다 (그물은 끝나면 계정을 지웁니다 · 지침 8-17).
 *
 * ── 메일에 담는 것 / 안 담는 것 ───────────────────────────────
 * 담음     가입 시각 · 직군 · 역할 · 가입 방식(카카오·애플·구글·메일) · 지금 회원 수
 * 안 담음  이메일 주소 · 닉네임 · 회원번호. 메일은 국외(Resend · 받는 메일함)로 나가므로
 *          회원을 알아볼 수 있는 값은 빼고, 누구인지는 관리자 화면(/admin/members)에서 봅니다.
 *
 * ── 하는 것 / 안 하는 것 ─────────────────────────────────────
 * **읽기 + 메일뿐입니다.** DB 에 쓰지 않습니다. 본 기록은 서버의 `~/가입알림기록.json`(저장소 밖)에 둡니다.
 * 못 보냈으면 기록을 안 옮겨 다음 번(30분 뒤)에 다시 보냅니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/* DB 조회는 공용 받아보기() 로 합니다 (지침 8-20 ③ · 2026-10-26 세중님 3번) */
import { 받아보기 } from './쪽나눠받기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 기록파일 = process.env.POTJOB_SIGNUP_STATE || path.join(os.homedir(), '가입알림기록.json');
const 처음돌아보기 = 60;          /* 기록이 없을 때 지난 몇 분을 볼까 */
const 시험계정 = /^signup-check-/;  /* tools/가입그물.mjs 의 가상 회원 메일 앞머리 — 그쪽과 같은 글자 */

const argv = process.argv.slice(2);
const 마른 = argv.includes('--마른');

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

const 가입방식이름 = { kakao: '카카오', apple: '애플', google: '구글', email: '메일' };

/* 한국 시각 「11/13 14:05」 */
export function 한국시각(iso) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600e3);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/* 메일 글 — 한 자리. 새것: [{ 때, 직군, 역할, 방식 }] · 모두: 지금 회원 수(모르면 null) */
export function 메일글(새것, 모두) {
  const 제목 = `[RAPO] 새 회원 ${새것.length}명 가입` + (모두 != null ? ` · 지금 ${모두}명` : '');
  const 본문 = [
    `새 회원 ${새것.length}명이 가입했어요.`,
    '',
    ...새것.map((x) => `   ${한국시각(x.때)} · ${x.직군 || '직군 없음'} · ${x.역할 || '역할 없음'} · ${x.방식}`),
    '',
    모두 != null ? `지금 회원 ${모두}명 (탈퇴한 분·가입 그물 계정 빼고)` : '지금 회원 수는 못 셌어요',
    '누구인지는 관리자 화면 → 회원(/admin/members)에서 보세요. 메일에는 이메일·닉네임을 담지 않아요.',
  ].join('\n');
  return { 제목, 본문 };
}

if (argv.includes('--자기점검')) {
  const { 제목, 본문 } = 메일글([
    { 때: '2026-11-13T05:05:00Z', 직군: '작업치료사', 역할: '현직자', 방식: '카카오' },
    { 때: '2026-11-13T05:31:00Z', 직군: null, 역할: '학생', 방식: '애플' },
  ], 12);
  const 기대 = ['[RAPO] 새 회원 2명 가입 · 지금 12명', '11/13 14:05 · 작업치료사 · 현직자 · 카카오', '11/13 14:31 · 직군 없음 · 학생 · 애플'];
  const 틀림 = 기대.filter((x) => !(제목 + '\n' + 본문).includes(x));
  const 새는것 = /@|닉네임:|회원번호/.test(본문.replace('메일에는 이메일·닉네임을 담지 않아요', ''));
  console.log('제목: ' + 제목 + '\n' + 본문 + '\n');
  if (틀림.length || 새는것) { console.error('✗ 자기점검 실패 — ' + (틀림.join(' / ') || '개인 값이 섞임')); process.exit(1); }
  console.log('✓ 자기점검 통과 (' + 기대.length + '가지)');
  process.exit(0);
}

if (argv.includes('--잊기')) {
  if (fs.existsSync(기록파일)) fs.rmSync(기록파일);
  console.log('본 기록을 비웠습니다 — ' + 기록파일);
  process.exit(0);
}

const cfg = env();
const K = cfg.SUPABASE_SERVICE_KEY;
if (!cfg.SUPABASE_URL || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
const 머리 = { apikey: K, Authorization: 'Bearer ' + K };

const 기록 = (() => { try { return JSON.parse(fs.readFileSync(기록파일, 'utf8')); } catch { return {}; } })();
const 부터 = 기록.마지막 || new Date(Date.now() - 처음돌아보기 * 60e3).toISOString();

/* 새 줄 — 한 번에 200줄까지 (30분에 200명이 넘으면 다음 바퀴가 나머지를 봅니다) */
const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/profiles?select=id,job_group,role,created_at,erased_at'
  + '&created_at=gt.' + encodeURIComponent(부터) + '&order=created_at.asc,id.asc&limit=200', { headers: 머리 });
if (!r.ok) { console.error('✗ profiles 를 못 읽었습니다 · HTTP ' + r.status + ' · ' + (await r.text()).slice(0, 300)); process.exit(1); }
const 줄들 = await r.json();

/* 계정을 하나씩 대 봅니다 — 가입 방식과 가입 그물 계정 가리기 */
const 새것 = [];
let 그물 = 0;
for (const p of 줄들) {
  const a = await 받아보기(cfg.SUPABASE_URL + '/auth/v1/admin/users/' + p.id, { headers: 머리 });
  if (a.status === 404) { 그물++; continue; }                 /* 이미 지워진 계정 — 가입 그물이 치운 것 */
  if (!a.ok) { console.error('✗ 계정을 못 읽었습니다 · HTTP ' + a.status); process.exit(1); }
  const u = await a.json();
  if (시험계정.test(String(u.email ?? ''))) { 그물++; continue; }
  const 방식 = String(u.app_metadata?.provider ?? '');
  새것.push({ 때: p.created_at, 직군: p.job_group, 역할: p.role, 방식: 가입방식이름[방식] || 방식 || '모름' });
}
const 마지막 = 줄들.length ? 줄들[줄들.length - 1].created_at : 부터;

/* 지금 회원 수 — 탈퇴(erased_at)는 빼고 셉니다. 가입 그물 고아 줄이 섞일 수 있어 「대략」입니다 */
let 모두 = null;
try {
  const c = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/profiles?select=id&erased_at=is.null&limit=1',
    { headers: { ...머리, Prefer: 'count=exact', Range: '0-0' } });
  const m = String(c.headers.get('content-range') || '').match(/\/(\d+)$/);
  if (m) 모두 = Number(m[1]);
} catch { /* 수는 못 세도 알림은 보냅니다 */ }

console.log(`${부터} 뒤 새 줄 ${줄들.length} · 가입 그물 ${그물} · 알릴 가입 ${새것.length}`);

const 기록남기기 = () => {
  if (마른) return;
  fs.writeFileSync(기록파일, JSON.stringify({ 마지막, 적은때: new Date().toISOString() }, null, 1) + '\n');
};

if (!새것.length) { 기록남기기(); console.log('보낼 것이 없습니다.'); process.exit(0); }

const { 제목, 본문 } = 메일글(새것, 모두);
if (마른) { console.log('\n제목: ' + 제목 + '\n' + 본문); process.exit(0); }

if (!cfg.RESEND_KEY || !cfg.NOTIFY_EMAIL) {
  console.log('※ RESEND_KEY · NOTIFY_EMAIL 이 없어 화면에만 찍습니다 — 기록을 안 옮겨 다음 번에 다시 시도합니다\n');
  console.log('제목: ' + 제목 + '\n' + 본문);
  process.exit(0);
}
const s = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>', to: [cfg.NOTIFY_EMAIL], subject: 제목, text: 본문 }),
});
const t = await s.text();
if (!s.ok) { console.error('메일 못 보냄 · HTTP ' + s.status + ' · ' + t.slice(0, 300)); process.exit(1); }
기록남기기();
console.log('보냈습니다 — ' + 제목);
