/* 공공 API 네 출처 경보 — 부르는 쪽 (2026-11-18 · 멘토-1.7-2 · 멘토-1.7-3 · 멘토-1.7-4)
 *
 *   node tools/공공출처경보.mjs            수집기멈춤경보.mjs 가 30분마다 따로 떨어진 프로세스로 부릅니다
 *   node tools/공공출처경보.mjs --보기      보내지도 적지도 않고 화면에만
 *   node tools/공공출처경보.mjs --시험      가짜 경보 한 줄을 넣어 보내는 길이 되는지 봅니다 (제목에 「시험」)
 *   node tools/공공출처경보.mjs --잊기      보낸 기록을 비웁니다 (시험 뒤 · 하루 값 기록은 남깁니다)
 *
 * 규칙은 tools/공공출처경보규칙.mjs 한 자리입니다. 여기는 읽고 · 쌓고 · 보내기만 합니다.
 * **읽기 + 메일뿐입니다** — DB 에 아무것도 안 씁니다. 크론 줄을 새로 만들지 않습니다 (수집기멈춤경보에 얹음).
 *
 * 읽는 것 (service_role 열쇠 · 표는 RLS 라 anon 으로는 못 읽습니다)
 *   collector_beat   최근 30일 · 네 출처 박동 (① 연속 실패 · ② 하루 값)
 *   job_posts        db_insert_at  — ③ 그날 새로 들어온 줄 수 (보류·회원 다)
 *   job_trash        trashed_at    — ③ 그날 버린 줄 수 (새로 받았지만 우리 것이 아니던 것)
 *   공휴일            ③ 평일 판정
 * 서버 파일 `POTJOB_SOURCE_ALARM_STATE || ~/출처경보기록.json` (저장소 밖)
 *   { 보냄: { 열쇠: ms }, 하루: { 출처: { 날: 그날 가장 큰 받은 건수 } } }
 *   박동 표가 출처마다 500줄만 남기 때문에 4주치 하루 값을 여기 쌓습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { 받아보기, 모두받기 } from './쪽나눠받기.mjs';
import {
  출처들, 새공고볼출처, 연속실패, 하루최대, 하루합치기, 반토막, 새공고볼날, 새공고없음, 평일인가,
  보낼것고르기, 보냄적기, 메일글, 한국날,
} from './공공출처경보규칙.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 기록파일 = process.env.POTJOB_SOURCE_ALARM_STATE || path.join(os.homedir(), '출처경보기록.json');
const argv = process.argv.slice(2);
const 보기만 = argv.includes('--보기');
const 시험 = argv.includes('--시험');

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

let 기록 = {};
try { if (fs.existsSync(기록파일)) 기록 = JSON.parse(fs.readFileSync(기록파일, 'utf8')) || {}; }
catch (e) { console.log('  출처 경보 기록을 못 읽어 빈 것으로 시작 · ' + String(e.message || e).slice(0, 80)); 기록 = {}; }
const 적기 = () => fs.writeFileSync(기록파일, JSON.stringify(기록, null, 1) + '\n', 'utf8');

if (argv.includes('--잊기')) {
  기록.보냄 = {};
  적기();
  console.log('보낸 기록을 비웠습니다 — ' + 기록파일);
  process.exit(0);
}

const cfg = env();
if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_KEY) {
  console.error('공공출처경보 — SUPABASE_URL · SUPABASE_SERVICE_KEY 가 있어야 박동 표를 읽습니다 (못 봄)');
  process.exit(1);
}
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };
const 길 = (s) => cfg.SUPABASE_URL + '/rest/v1/' + s;
const 칸 = encodeURIComponent;
const 지금 = Date.now();

/* 줄 수만 — Content-Range 의 뒷자리 */
async function 줄수(표, 때칸, 출처, 날) {
  const 부터 = new Date(Date.parse(날 + 'T00:00:00+09:00')).toISOString();
  const 까지 = new Date(Date.parse(날 + 'T00:00:00+09:00') + 86400e3).toISOString();
  const r = await 받아보기(길(표 + '?select=id&source=eq.' + 출처 + '&' + 때칸 + '=gte.' + 칸(부터) + '&' + 때칸 + '=lt.' + 칸(까지) + '&limit=1'),
    { headers: { ...H, Prefer: 'count=exact' } });
  if (!r.ok) throw new Error(표 + ' HTTP ' + r.status);
  const m = String(r.headers.get('content-range') || '').match(/\/(\d+)\s*$/);
  if (!m) throw new Error(표 + ' 줄 수를 못 읽음');
  return Number(m[1]);
}

const 경보 = [];

/* ① · ② 박동 */
let 박동 = [];
try {
  박동 = await 모두받기(길('collector_beat?select=id,source,ran_at,ok,' + 칸('못받음') + ',' + 칸('왜') + ',' + 칸('메모')
    + '&source=in.(' + 출처들.join(',') + ')&ran_at=gte.' + 칸(new Date(지금 - 30 * 86400e3).toISOString())), H, { 차례: 'id' });
} catch (e) { console.error('  ⚠ 박동을 못 읽었습니다 — ①② 를 건너뜁니다 (' + String(e.message).slice(0, 100) + ')'); }
if (박동.length) {
  const 연속 = 연속실패(박동);
  경보.push(...연속);
  기록.하루 = 하루합치기(기록.하루, 하루최대(박동), 지금);
  const 어제 = 한국날(지금 - 86400e3);
  const 반 = 반토막(기록.하루, 어제);
  경보.push(...반.경보);
  console.log('① 연속 실패 ' + (연속.length ? 연속.map((x) => x.출처).join(' · ') : '없음')
    + ' · ② ' + 어제 + ' 받은 건수 절반 이하 ' + (반.경보.length ? 반.경보.map((x) => x.출처 + ' ' + x.받은 + '/' + x.평균).join(' · ') : '없음')
    + (반.기준부족.length ? ' (같은 요일 기준 부족 — ' + 반.기준부족.map((x) => x.출처 + ' ' + x.몇주 + '주').join(' · ') + ')' : ''));
}

/* ③ 평일 새 공고 0 */
const 볼날 = 새공고볼날(지금);
try {
  const 쉬는날 = (await 모두받기(길(칸('공휴일') + '?select=' + 칸('날') + '&' + 칸('날') + '=eq.' + 볼날), H, { 차례: '날' }))
    .map((x) => x['날']);
  if (평일인가(볼날, 쉬는날)) {
    const 셈 = {};
    for (const s of 새공고볼출처) 셈[s] = (await 줄수('job_posts', 'db_insert_at', s, 볼날)) + (await 줄수('job_trash', 'trashed_at', s, 볼날));
    경보.push(...새공고없음(셈, 볼날, 쉬는날));
    console.log('③ ' + 볼날 + '(평일) 새로 들어온 줄 — ' + 새공고볼출처.map((s) => s + ' ' + 셈[s]).join(' · '));
  } else {
    console.log('③ ' + 볼날 + ' 은 주말·공휴일이라 안 봅니다');
  }
} catch (e) { console.error('  ⚠ ③ 을 못 쟀습니다 — ' + String(e.message).slice(0, 100)); }

if (시험) 경보.push({ 종류: '연속실패', 출처: 'WN2', 때: new Date(지금).toISOString(), 앞때: new Date(지금 - 1800e3).toISOString(), 왜: '보내는 길 시험입니다 — 실제 실패가 아닙니다' });

기록.보냄 = 기록.보냄 || {};
const 보낼것 = 보낼것고르기(경보, 시험 ? {} : 기록.보냄, 지금);
console.log('경보 ' + 경보.length + '가지 · 6시간·하루 한 번 거른 뒤 보낼 것 ' + 보낼것.length + '가지');

if (보기만) {
  if (보낼것.length) { const m = 메일글(보낼것, { 시험 }); console.log('\n제목: ' + m.제목 + '\n\n' + m.본문); }
  process.exit(0);
}
/* 하루 값은 보낼 것이 없어도 쌓습니다 */
try { 적기(); } catch (e) { console.error('  ⚠ 기록을 못 썼습니다 ' + 기록파일 + ' · ' + String(e.message).slice(0, 80)); }
if (!보낼것.length) process.exit(0);

const { 제목, 본문 } = 메일글(보낼것, { 시험 });
if (cfg.RESEND_KEY && cfg.NOTIFY_EMAIL) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>', to: [cfg.NOTIFY_EMAIL], subject: 제목, text: 본문 }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('메일 못 보냄 · HTTP ' + r.status + ' · ' + t.slice(0, 200)); process.exit(1); }
  let id = '';
  try { id = (JSON.parse(t) || {}).id || ''; } catch { /* 모양이 바뀌어도 넘어갑니다 */ }
  console.log('보냈습니다 — ' + 제목 + '\n   Resend id ' + (id || '(없음)'));
  /* 보낸 것만 적습니다 — 못 보냈으면 다음 번에 다시 · 시험은 안 적습니다 */
  if (!시험) { 기록.보냄 = 보냄적기(기록.보냄, 보낼것, 지금); 적기(); }
} else {
  console.log('※ RESEND_KEY · NOTIFY_EMAIL 이 없어 화면에만 찍습니다 (보낸 기록은 안 남깁니다)\n');
  console.log('제목: ' + 제목 + '\n\n' + 본문);
}
