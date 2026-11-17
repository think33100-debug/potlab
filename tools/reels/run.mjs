/* 새 1층 공고 → 릴스 만들기 → (허락되면) 인스타 올리기 — 한 바퀴 (2026-11-16)

   node tools/reels/run.mjs                      마른 실행 — 고르고 만들기만. 올리지 않습니다
   node tools/reels/run.mjs --메일               ★ 지금 쓰는 길 (2026-11-16 세중님 「가요로」 · 「드라이브에」)
                                                 드라이브 열쇠(drive.mjs --인증)가 있으면 드라이브에 올리고 링크만 메일, 없으면 첨부 메일
                                                 소리 없는 릴스 + 캡션을 메일로 → 휴대폰 인스타 앱에서 인기 가요를 골라 올림
                                                 (API 로는 인스타 음악을 못 붙이고, 가요를 파일에 넣으면 저작권 검사에 걸립니다)
   node tools/reels/run.mjs --올리기             열쇠(IG_USER_ID · IG_ACCESS_TOKEN)가 있을 때만 올립니다 (저작권 없는 곡용)
   node tools/reels/run.mjs --id 306936          그 공고 하나만 (견본 · 다시 만들기)
   node tools/reels/run.mjs --확인만 --며칠 30   후보 전부의 원문만 열어 보고 숫자를 찍음 (만들기·메일·기록 없음)
   선택  --최대 2 (한 바퀴 최대 편수) · --며칠 3 (최근 며칠 게시분) · --음악 <파일> · --나감 <폴더>

   고르는 규칙 (CLAUDE.md 「1층」 · 0-0 「신뢰 셋」)
   · job_posts_pub(회원 화면에 보이는 공고)만 · 공고분류() 에 대학병원·종합병원·공공기관 중 하나
   · 마감일이 있고 내일 이후 (reel-data.mjs 가 거릅니다)
   · 이미 올린 공고는 log/릴스_올림.json 으로 건너뜁니다 — DB 를 바꾸지 않습니다
   · 직군 빈칸·우리 직군 아님은 job_posts_pub 단계에서 이미 빠집니다

   올리기 (Instagram Graph API · 페이스북 로그인 쪽 — resumable 업로드는 그쪽만 됩니다)
     ① POST graph.facebook.com/{ver}/{IG_USER_ID}/media  media_type=REELS · upload_type=resumable · caption
     ② POST rupload.facebook.com/ig-api-upload/{ver}/{컨테이너}  머리글 Authorization(OAuth) · 시작 바이트 0 · file_size
     ③ GET  /{컨테이너}?fields=status_code,status  — 다 될 때까지 기다림
     ④ POST /{IG_USER_ID}/media_publish  creation_id
   ★ 2026-11-16 에 명세 원문을 못 열었습니다 (이 세션에서 developers.facebook.com 이 막힘).
     그래서 응답마다 **원문 앞 600자**를 찍습니다. 첫 실제 호출에서 칸 이름을 맞추고 이 주석을 고칩니다 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 릴스자료, 오늘KST, 릴스대상, 같은공고묶기 } from './reel-data.mjs';
/* 이미지 — RAPO 777기관 묶음 한 자리 (2026-11-17 · tools/reels/rapo777.mjs). 옛 photo-list.json 길은 쓰지 않습니다 */
import { 묶음폴더, 묶음읽기, 이미지붙이기, 게시금지인가 } from './rapo777.mjs';
import { 드라이브되나, 릴스올리기 } from './drive.mjs';
import { 원문확인 } from './원문확인.mjs';
import { 카드만들기, 커버만들기 } from './카드.mjs';
import { 인스타되나, 릴스올리기IG } from './ig.mjs';
import crypto from 'node:crypto';
import { 모두받기, 받아보기 } from '../쪽나눠받기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(여기, '..', '..');

/* .env 는 셸로 읽지 않습니다 (지침 8-12) — KEY=값 꼴만 */
function env() {
  const out = {};
  for (const f of ['.env.local', 'web/.env.local', '.env.server', '.env'].map((x) => path.join(ROOT, x))) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const 인수 = (이름, 기본 = null) => { const i = process.argv.indexOf('--' + 이름); return i > 0 ? process.argv[i + 1] : 기본; };
const 깃발 = (이름) => process.argv.includes('--' + 이름);

const cfg = env();
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) if (!cfg[k]) { console.error(k + ' 가 없습니다'); process.exit(1); }
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };
const 가림 = (s) => String(s).split(cfg.SUPABASE_SERVICE_KEY).join('‹열쇠›').split(cfg.IG_ACCESS_TOKEN || '\u0000').join('‹IG열쇠›').split(cfg.RESEND_KEY || '\u0000').join('‹메일열쇠›');

const 올리기 = 깃발('올리기');
const 메일 = 깃발('메일');
const 최대 = Number(인수('최대', 2));
const 며칠 = Number(인수('며칠', 3));
const 한건 = 인수('id');
const 오늘 = 오늘KST();
const 나감 = 인수('나감', path.join(ROOT, 'log', 'reels', 오늘));
const 기록파일 = path.join(ROOT, 'log', '릴스_올림.json');
/* 한 번에 하나만 (2026-11-17) — 2026-11-17 13:33 에 같은 일산병원 릴스가 드라이브에 두 번 올라갔습니다.
   두 바퀴가 겹치면 둘 다 기록을 「아직 안 보냄」으로 읽어 같은 공고를 두 번 보냅니다. 기록을 읽기 **전에** 잠급니다.
   잠금 파일의 pid 가 죽어 있으면(바퀴가 탈나 끝남) 넘겨받습니다 */
const 잠금 = path.join(ROOT, 'log', '릴스_돌기.lock');
fs.mkdirSync(path.dirname(잠금), { recursive: true });
try { fs.writeFileSync(잠금, String(process.pid), { flag: 'wx' }); }
catch {
  const 앞pid = Number(fs.readFileSync(잠금, 'utf8')) || 0;
  let 살아있나 = false;
  try { if (앞pid) { process.kill(앞pid, 0); 살아있나 = true; } } catch { /* 없는 pid */ }
  if (살아있나) { console.log(`다른 바퀴(pid ${앞pid})가 돌고 있습니다 — 이번 바퀴는 건너뜁니다`); process.exit(0); }
  fs.writeFileSync(잠금, String(process.pid));
  console.log(`  (앞 바퀴 pid ${앞pid} 의 잠금이 남아 있어 넘겨받았습니다)`);
}
process.on('exit', () => { try { if (fs.readFileSync(잠금, 'utf8') === String(process.pid)) fs.rmSync(잠금); } catch { /* 이미 없음 */ } });
const 기록 = fs.existsSync(기록파일) ? JSON.parse(fs.readFileSync(기록파일, 'utf8')) : {};
기록.__발행열쇠 = 기록.__발행열쇠 || {};      /* 「기관|id:…」·「기관|url:…」 → 공고 id — 중복 발행 막기 */
const 대기파일 = path.join(ROOT, 'log', '릴스_대기.json');
const 발행기록파일 = path.join(ROOT, 'log', '릴스_발행기록.jsonl');   /* 시도마다 한 줄 (성공·실패·제외) */
const 발행기록 = (줄) => { fs.mkdirSync(path.dirname(발행기록파일), { recursive: true }); fs.appendFileSync(발행기록파일, JSON.stringify({ 때: new Date().toISOString(), ...줄 }) + '\n'); };
/* 묶음이 없으면 멈춥니다 — 이미지 없이 몰래 내보내지 않습니다 */
const 묶음 = 묶음읽기(묶음폴더(cfg));
console.log(`이미지 묶음 ${묶음.폴더} · 기관 ${묶음.기관들.length}곳 · 스냅샷 ${묶음.스냅샷}`);
/* 옛 내림목록(이름) — 묶음 전에 내려 달라고 한 곳도 계속 막습니다 */
const 옛내림파일 = path.join(여기, '내림목록.json');
const 옛내림 = fs.existsSync(옛내림파일) ? JSON.parse(fs.readFileSync(옛내림파일, 'utf8')) : [];

async function rest(길) {
  const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/' + 길, { headers: H });
  if (!r.ok) throw new Error(길.slice(0, 60) + ' HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return r.json();
}
async function 분류(id) {
  const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent('공고분류'),
    { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ p_id: id }) });
  const 글 = await r.text();
  if (!r.ok) throw new Error('공고분류 HTTP ' + r.status + ' ' + 글.slice(0, 300));
  return JSON.parse(글) || [];
}

/* ── 1 · 후보 ── */
const 칸 = 'id,title,원문제목,org_name,employ_type,headcount,apply_to,apply_to_time,job_group,조교연구,posted_at,url';
const 시작일 = new Date(Date.parse(오늘) - 며칠 * 86400e3).toISOString().slice(0, 10);
const 후보 = 한건
  ? await rest(`job_posts_pub?select=${칸}&id=eq.${encodeURIComponent(한건)}`)
  : await 모두받기(`${cfg.SUPABASE_URL}/rest/v1/job_posts_pub?select=${칸}&posted_at=gte.${시작일}`, H);
console.log(`후보 ${후보.length}건 (게시 ${한건 ? '— id ' + 한건 : 시작일 + ' 이후'})`);

/* 대상 — 1층 전부 · 그밖은 허가 병상 400 이상 또는 급여 기준 (2026-11-17 세중님 · reel-data.mjs 의 릴스대상) */
const 대상들 = [];
let 비대상 = 0;
for (const 공고 of 후보) {
  if (!한건 && 기록[공고.id]) continue;
  /* --id 로 콕 집어 만들면 — 이미 올린 것은 막고, 아직 「확인 대기」인 것은 **새로 만들어 덮어씁니다** (2026-11-17 세중님 「만들기」)
     중복 열쇠도 그 공고 것만 풀어 줍니다. 올린 것·취소된 것·삭제된 것은 그대로 막습니다 */
  if (한건 && 기록[공고.id]) {
    const 전 = 기록[공고.id];
    /* 상태 칸이 없는 옛 기록(메일만 보낸 것 · 2026-11-17 오전)도 아직 안 올렸으면 다시 만듭니다 */
    const 다시되나 = !전.게시물ID && !전.카드게시물ID && (전.상태 === '확인 대기' || (!전.상태 && 전.메일보낸때));
    if (!다시되나) { console.log(`  건너뜀 ${공고.id} — 상태 「${전.상태 || (전.메일보낸때 ? '메일보냄' : '기록 있음')}」 라 다시 만들지 않습니다`); continue; }
    for (const [k, v] of Object.entries(기록.__발행열쇠)) if (v === 공고.id) delete 기록.__발행열쇠[k];
    console.log(`  다시 만들기 ${공고.id} — 확인 대기였던 것을 새로 만들어 덮어씁니다`);
  }
  공고.분류 = await 분류(공고.id);
  /* 기관 공식 값 — 기관 표 → 심평원 · 급여 원문은 상세 화면과 같은 차례(뽑은값.예상연봉 → detail.연봉 → detail.예상연봉) */
  const [jp] = await rest(`job_posts?select=기관번호,뽑은값,detail&id=eq.${encodeURIComponent(공고.id)}`);
  공고.연봉원문 = (jp?.뽑은값?.['예상연봉'] ?? jp?.detail?.['연봉'] ?? jp?.detail?.['예상연봉'] ?? null) || null;
  let 기관 = null;
  if (jp?.기관번호) {
    const [g] = await rest(`기관?select=기관번호,이름,주소,종별이름,설립구분이름,상급종합인가,대학병원인가,ykiho&기관번호=eq.${encodeURIComponent(jp.기관번호)}`);
    기관 = g || null;
    if (g?.ykiho) {
      const [d] = await rest(`hira_detail?select=perm_sbd,pt,ot&ykiho=eq.${encodeURIComponent(g.ykiho)}`);
      const [o] = await rest(`hira_org?select=estb_dd,sido_nm,sggu_nm&ykiho=eq.${encodeURIComponent(g.ykiho)}`);
      기관 = { ...g, ...(d || {}), ...(o || {}) };
    }
  }
  공고.기관 = 기관;
  const 판정 = 릴스대상(공고.분류, 기관, 공고.연봉원문);
  if (!판정.대상) { 비대상++; continue; }
  공고.대상까닭 = 판정.까닭;
  대상들.push(공고);
}
console.log(`대상 ${대상들.length}건 · 대상 아님 ${비대상}건`);
const 할것 = [];
const 대기 = [];   /* 연결·이미지가 불확실해 발행을 미룬 것 — 까닭과 함께 log/릴스_대기.json */
for (const 공고 of 같은공고묶기(대상들)) {
  const 자료 = 릴스자료(공고, 공고.기관, { 오늘, 사이트: 'rapojob.co.kr' });
  if (자료.건너뜀) { console.log('  건너뜀', 공고.id, 공고.org_name, '—', 자료.건너뜀); continue; }
  자료.묶은id = 공고.묶은id || [공고.id];
  자료.원문 = { url: 공고.url, title: 공고.title, 원문제목: 공고.원문제목, org_name: 공고.org_name, 기관이름: 자료.기관, apply_to: 공고.apply_to, job_group: 공고.job_group };
  /* ── 이미지 — RAPO 777 묶음 (2026-11-17) ──
     ① 기관 연결(ykiho → org_id=기관번호 → 이름+주소) ② 게시 금지 ③ 이미지 고르기 ④ 중복 열쇠
     하나라도 불확실하면 **만들지 않고 대기** — 이미지 없이 내보내지도 않습니다 */
  /* 기관 표 줄이 없으면 이름만 — 777 목록에 이름이 같은 곳이 있으면 대기, 없으면 이미지 없이 (rapo777.mjs 기관연결) */
  const 앱 = 공고.기관 ? { 기관번호: 공고.기관.기관번호, ykiho: 공고.기관.ykiho, 이름: 공고.기관.이름, 주소: 공고.기관.주소 }
    : { 기관번호: null, ykiho: null, 이름: 공고.org_name, 주소: null };
  const 붙임 = 이미지붙이기(묶음, 자료, 앱, 공고.url, { 낸열쇠: 기록.__발행열쇠, 옛내림 });
  if (붙임.겹침) { console.log('  건너뜀', 자료.묶은id[0], 자료.기관, '— 이미 낸 공고', 붙임.겹침); continue; }
  if (붙임.대기) { 대기.push({ 공고: 자료.묶은id, 기관: 자료.기관, 원문: 공고.url || null, 까닭: 붙임.대기, 기관ref: 붙임.기관ref || null, 제외: 붙임.제외 || false });
    console.log('  대기', 자료.묶은id[0], 자료.기관, '—', 붙임.대기); continue; }
  할것.push(자료);
}
/* 마감이 가까운 것부터 — 늦게 올리면 쓸모가 없어집니다 */
할것.sort((a, b) => Number(a.마감.큰글.slice(2)) - Number(b.마감.큰글.slice(2)));
console.log(`릴스 대상 새 공고 ${할것.length}건 · 이번 바퀴 ${Math.min(최대, 할것.length)}건`);

/* ── 1-가 · 원문 확인 (2026-11-17 세중님 「공고가 있는지 확인하고 올리자」) ──
   만들기 직전에 원문 주소를 직접 엽니다. 통과한 것만 만듭니다 (tools/reels/원문확인.mjs)
     보류  없어짐 · 마감 표시 · 엉뚱한 쪽 → 만들지 않고 기록 · 따로 메일
     모름  사이트 장애 · 막힘 → 이번 바퀴만 건너뜀. 세 바퀴 연속이면 보류로 */
const 확인만 = 깃발('확인만');       /* 후보 전부의 원문만 확인하고 끝 — 만들기·메일·기록 없음 */
const 적기 = (메일 || 올리기) && !확인만;   /* 마른 실행은 기록을 남기지 않습니다 */
기록.__모름 = 기록.__모름 || {};
const 통과 = []; const 멈춤 = [];
for (const 자료 of 할것) {
  if (!확인만 && 통과.length >= 최대) break;
  if (통과.length + 멈춤.length) await new Promise((z) => setTimeout(z, 1500));   /* 사이트를 줄줄이 때리지 않게 */
  const r = await 원문확인(자료.원문);
  const 열쇠 = 자료.묶은id[0];
  console.log(`  원문 ${열쇠} ${자료.기관} → ${r.판정} · ${r.까닭}`);
  if (r.판정 === '통과') { 자료.원문확인 = r.확인 || []; delete 기록.__모름[열쇠]; 통과.push(자료); continue; }
  if (r.판정 === '모름') {
    기록.__모름[열쇠] = (기록.__모름[열쇠] || 0) + 1;
    if (기록.__모름[열쇠] < 3) continue;
    r.까닭 = `세 바퀴 연속 확인 못 함 — ${r.까닭}`;
  }
  멈춤.push({ 자료, 까닭: r.까닭, 주소: 자료.원문.url });
  if (적기) for (const id of 자료.묶은id) 기록[id] = { 원문보류때: new Date().toISOString(), 까닭: r.까닭, 기관: 자료.기관, 직군: 자료.직군 };
}
if (적기) { fs.mkdirSync(path.dirname(기록파일), { recursive: true }); fs.writeFileSync(기록파일, JSON.stringify(기록, null, 2)); }
console.log(`원문 확인 — 통과 ${통과.length} · 멈춤 ${멈춤.length}`);
/* 발행 대기 — 덮어쓰지 않고 공고 id 로 쌓습니다 (사람이 보고 지울 때까지) */
console.log(`발행 대기 ${대기.length}건`);
if (적기 && 대기.length) {
  const 옛 = fs.existsSync(대기파일) ? JSON.parse(fs.readFileSync(대기파일, 'utf8')) : {};
  const 새것 = [];
  for (const x of 대기) {
    const 전 = 옛[x.공고[0]];
    if (!전 || 전.까닭 !== x.까닭) { 새것.push(x); 발행기록({ 결과: x.제외 ? '제외' : '대기', 공고: x.공고, 기관: x.기관, 기관ref: x.기관ref || null, 까닭: x.까닭 }); }
    옛[x.공고[0]] = { ...x, 마지막때: new Date().toISOString(), 처음때: 전?.처음때 || new Date().toISOString() };
  }
  fs.writeFileSync(대기파일, JSON.stringify(옛, null, 2));
  /* 새로 생긴 대기만 한 통 — 사람이 기관 연결·이미지를 확인합니다 */
  if (메일 && 새것.length && cfg.RESEND_KEY && cfg.NOTIFY_EMAIL) {
    const 글 = ['아래 공고는 기관 연결이나 이미지가 확실하지 않아 릴스를 만들지 않았습니다 (발행 대기).', '',
      ...새것.flatMap((x) => [`· ${x.기관} · 공고 ${x.공고.join('+')}`, `  까닭: ${x.까닭}`, `  원문: ${x.원문 || '없음'}`, '']),
      '대기 목록 전체: 서버 log/릴스_대기.json'].join('\n');
    const r = await fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>', to: [cfg.NOTIFY_EMAIL],
        subject: `[RAPO 릴스] 발행 대기 ${새것.length}건 (기관 연결·이미지 확인)`, text: 글 }) });
    console.log(`  대기 메일 → ${r.status}`);
  }
}
if (확인만) {
  for (const 자료 of 통과) console.log(`  ○ ${자료.묶은id[0]} ${자료.기관} · ${자료.원문확인.join(' / ')}`);
  process.exit(0);
}

/* 멈춘 공고는 따로 한 통 — 사람이 원문을 보고 공고를 고치거나 내립니다 */
if (적기 && 메일 && 멈춤.length && cfg.RESEND_KEY && cfg.NOTIFY_EMAIL) {
  const 글 = ['릴스를 만들기 전에 원문을 열어 봤더니 아래 공고가 이상합니다. 릴스는 만들지 않았습니다.', '',
    ...멈춤.flatMap(({ 자료, 까닭, 주소 }) => [`· ${자료.기관} · ${자료.직군} · ${자료.마감.큰글}`, `  까닭: ${까닭}`, `  원문: ${주소 || '없음'}`,
      `  RAPO: https://www.rapojob.co.kr/jobs/${자료.묶은id[0]}`, '']),
    '회원 화면에서 내리거나 고칠지는 관리자 화면에서 정해 주세요. 이 공고들은 다시 확인하지 않습니다.'].join('\n');
  const r = await fetch('https://api.resend.com/emails', { method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>', to: [cfg.NOTIFY_EMAIL],
      subject: `[RAPO 릴스] 원문 확인에서 멈춘 공고 ${멈춤.length}건`, text: 글 }) });
  console.log(`  멈춤 메일 → ${r.status}`);
}

/* 낸 것 적기 — 공고 id 마다 + 중복 열쇠 + 발행기록 한 줄 */
function 낸것적기(자료, 더) {
  const 줄 = { 기관: 자료.기관, 직군: 자료.직군, 원문: 자료.원문.url || null, 이미지: 자료.이미지, ...더 };
  for (const id of 자료.묶은id) 기록[id] = 줄;
  for (const k of 자료.발행열쇠 || []) 기록.__발행열쇠[k] = 자료.묶은id[0];
  fs.mkdirSync(path.dirname(기록파일), { recursive: true });
  fs.writeFileSync(기록파일, JSON.stringify(기록, null, 2));
  발행기록({ 결과: '성공', 공고: 자료.묶은id, ...줄 });
}
/* 보내기·올리기 **직전**에 게시 금지를 다시 읽습니다 (그사이 삭제 요청이 들어왔을 수 있음) */
function 직전금지(자료) {
  const 왜 = 게시금지인가(묶음.폴더, 자료.기관묶음);
  if (왜) { console.log(`  ✗ 제외 ${자료.묶은id[0]} ${자료.기관} — ${왜}`); 발행기록({ 결과: '제외', 공고: 자료.묶은id, 기관: 자료.기관, 기관ref: 자료.이미지.기관ref, 까닭: 왜 }); }
  return 왜;
}

/* ── 2 · 만들기 ── */
fs.mkdirSync(나감, { recursive: true });
const 만든것 = [];
for (const 자료 of 통과) {
  const 바탕 = path.join(나감, 자료.id);
  fs.writeFileSync(바탕 + '.json', JSON.stringify(자료, null, 2));
  fs.writeFileSync(바탕 + '.txt', 자료.캡션 + '\n');
  const a = ['--자료', 바탕 + '.json', '--나감', 바탕 + '.mp4', '--표지', 바탕 + '-cover.jpg'];
  if (메일) a.push('--무음');
  else if (인수('음악')) a.push('--음악', 인수('음악'));
  const r = spawnSync(process.execPath, [path.join(여기, 'render.mjs'), ...a], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('  ✗ 렌더 실패', 자료.id); continue; }
  /* 카드뉴스 — 같은 장면 3~4장 (2026-11-17 세중님 「릴스와 카드뉴스 둘 다」). 실패해도 릴스는 보냅니다 */
  let 카드 = [];
  try { 카드 = await 카드만들기(바탕 + '.json', 나감); } catch (e) { console.error(`  ✗ 카드 못 만듦 ${자료.id} — ${String(e.message || e).slice(0, 200)}`); }
  /* 커버 (2026-11-17 세중님 「시그니처 컬러에 흰색 글」) — 릴스 커버 · 카드뉴스 첫 장. 못 만들면 영상 2.6초 화면을 표지로 */
  let 커버 = null;
  try { 커버 = await 커버만들기(바탕 + '.json', 나감); } catch (e) { console.error(`  ✗ 커버 못 만듦 ${자료.id} — ${String(e.message || e).slice(0, 200)}`); }
  if (커버?.카드 && 카드.length) 카드 = [커버.카드, ...카드];
  /* 미리보기 — 표지 + 카드를 높이 320 으로 줄여 한 장에 (2026-11-17 세중님 「완성본 나오면 먼저 보여줘」)
     대화에서 이 한 장을 열어 먼저 보여 드리고 확인받은 뒤 올립니다 */
  const 미리보기 = 바탕 + '-미리보기.jpg';
  const 장들 = [커버?.릴스 || 바탕 + '-cover.jpg', ...카드].filter((f) => fs.existsSync(f));
  if (장들.length) {
    const 거름 = 장들.map((_, i) => `[${i}]scale=-2:320[v${i}]`).join(';') + ';' + 장들.map((_, i) => `[v${i}]`).join('') + `hstack=${장들.length}`;
    const m = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...장들.flatMap((f) => ['-i', f]), '-filter_complex', 장들.length > 1 ? 거름 : '[0]scale=-2:320', '-q:v', '6', 미리보기]);
    if (m.status !== 0) console.error(`  ✗ 미리보기 못 만듦 ${자료.id} — ${String(m.stderr || '').slice(0, 200)}`);
  }
  만든것.push({ 자료, mp4: 바탕 + '.mp4', 표지: 커버?.릴스 || 바탕 + '-cover.jpg', 릴스커버: 커버?.릴스 || null, 카드, 미리보기: fs.existsSync(미리보기) ? 미리보기 : null });
  console.log(`  ○ ${자료.id} · ${자료.기관} · ${자료.직군} · ${자료.마감.큰글}`);
}

/* ── 3-가 · 메일로 보내기 (휴대폰에서 받아 가요를 붙여 올림) ── */
if (메일) {
  if (!cfg.RESEND_KEY || !cfg.NOTIFY_EMAIL) { console.error('RESEND_KEY · NOTIFY_EMAIL 이 없습니다 — 보내지 않습니다'); process.exit(1); }
  const 드라이브 = 드라이브되나(cfg);
  console.log(드라이브 ? '드라이브에 올리고 링크 메일' : '드라이브 열쇠 없음 — 첨부 메일');
  for (const { 자료, mp4, 표지, 릴스커버, 카드, 미리보기 } of 만든것) {
    if (직전금지(자료)) continue;
    /* 드라이브 「RAPO 릴스/<YYYY-MM>」 — 영상 · 표지 · 캡션 글 */
    let 링크 = null;
    if (드라이브) {
      try {
        링크 = await 릴스올리기({ mp4, 표지, 카드, 미리보기, 캡션: 자료.캡션, 이름: `${오늘}_${자료.기관}_${자료.직군}_${자료.마감.큰글}`, 달: 오늘.slice(0, 7) });
        console.log(`  드라이브 ${자료.묶은id[0]} → ${링크}`);
      } catch (e) { console.error(`  ✗ 드라이브 못 올림 ${자료.묶은id[0]} — ${가림(e.message || e)} · 첨부 메일로 대신 보냅니다`); }
    }
    const 글 = [
      `${자료.기관} · ${자료.직군} · ${자료.마감.큰글} (${자료.마감.작은글})`,
      '',
      ...(자료.원문확인?.length ? ['원문 확인 (릴스 만들기 전에 원문을 열어 봤습니다)', ...자료.원문확인.map((x) => '  ' + x), '  원문: ' + (자료.원문.url || ''), ''] : []),
      ...(링크 ? ['영상 (드라이브)', 링크, ''] : []),
      자료.이미지.없음 ? `이미지: 없음 — ${자료.이미지.까닭} · 글자 디자인으로 만듦` : `이미지: ${자료.이미지.꼴} · ${자료.이미지.출처글} · 파일 ${자료.이미지.asset_id.slice(0, 12)} · 연결 ${자료.이미지.연결근거} (${자료.이미지.기관ref})`,
      `대상: ${자료.대상까닭 || '1층'}`,
      '',
      ...(인스타되나(cfg) ? ['올리는 법 ① — 확인 뒤 자동 (가요 없이 · 이 영상·캡션 그대로)',
        `   ssh potjob 'cd ~/potlab && node tools/reels/올리기.mjs --id ${자료.묶은id[0]} --실행'`,
        '   (올리기 직전에 게시 금지·마감·원문을 다시 확인하고, 하나라도 걸리면 안 올립니다)', '',
        '올리는 법 ② — 휴대폰에서 가요를 붙여 (①과 ② 중 하나만 하세요 · 둘 다 하면 두 번 올라갑니다)'] : ['올리는 법']),
      링크 ? '1. 위 링크 → 드라이브 앱 → 「기기에 저장」' : '1. 첨부 영상을 휴대폰에 저장',
      '2. 인스타 → 새 릴스 → 이 영상 → 음악에서 지금 인기 가요 고르기',
      '3. 아래 캡션을 그대로 붙여 넣고 공유',
      ...(카드.length ? ['', `카드뉴스 ${카드.length}장도 함께 만들었어요 (${링크 ? '드라이브 같은 폴더' : '첨부'}) — 인스타 새 게시물 → 여러 장 선택 → 같은 캡션`] : []),
      '',
      '── 캡션 (여기부터 복사) ──',
      자료.캡션,
      '── 캡션 끝 ──',
      '',
      `원문 공고: https://www.rapojob.co.kr/jobs/${자료.묶은id[0]}`,
    ].join('\n');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>',
        to: [cfg.NOTIFY_EMAIL],
        subject: `[RAPO 릴스] ${자료.기관} ${자료.직군} · ${자료.마감.큰글}`,
        text: 글,
        attachments: 링크 ? undefined : [
          { filename: `rapo-${자료.묶은id[0]}.mp4`, content: fs.readFileSync(mp4).toString('base64') },
          ...(fs.existsSync(표지) ? [{ filename: `rapo-${자료.묶은id[0]}-cover.jpg`, content: fs.readFileSync(표지).toString('base64') }] : []),
          ...카드.map((f, i) => ({ filename: `rapo-${자료.묶은id[0]}-card${i + 1}.jpg`, content: fs.readFileSync(f).toString('base64') })),
        ],
      }),
    });
    const 답 = await r.text();
    console.log(`  메일 ${자료.묶은id[0]} → ${r.status} · ${가림(답).slice(0, 600)}`);
    if (!r.ok) { 발행기록({ 결과: '실패', 공고: 자료.묶은id, 기관: 자료.기관, 까닭: `메일 HTTP ${r.status} · ${가림(답).slice(0, 200)}` }); continue; }
    /* 보낸 것은 다시 안 보냅니다 — 「올림」이 아니라 「메일보냄」으로 적습니다 (게시물 id 는 휴대폰에서 올린 뒤 생깁니다) */
    /* 확인 뒤 올리기(올리기.mjs)가 **이 영상 그대로** 올리도록 경로·지문·캡션·마감·원문을 남깁니다 */
    낸것적기(자료, { 메일보낸때: new Date().toISOString(), 드라이브: 링크, 게시물ID: null, 상태: '확인 대기',
      영상: mp4, 영상지문: crypto.createHash('sha256').update(fs.readFileSync(mp4)).digest('hex'),
      캡션: 자료.캡션, 마감일: 자료.원문.apply_to || null, 원문자료: 자료.원문, 카드, 커버: 릴스커버 });
  }
  process.exit(0);
}

if (!올리기) {
  console.log(`\n마른 실행 — ${만든것.length}편 만들었고 올리지 않았습니다 · ${나감}`);
  process.exit(0);
}

/* ── 3 · 올리기 — 사람 확인 없이 바로 (--올리기). 확인 뒤에 올리려면 --메일 → tools/reels/올리기.mjs ── */
if (!인스타되나(cfg)) { console.error('IG_USER_ID · IG_ACCESS_TOKEN 이 없습니다 — 올리지 않습니다 (node tools/reels/ig.mjs --열쇠)'); process.exit(1); }
for (const { 자료, mp4 } of 만든것) {
  if (직전금지(자료)) continue;
  try {
    const 올림 = await 릴스올리기IG(cfg, mp4, 자료.캡션);
    낸것적기(자료, { 올린때: new Date().toISOString(), media_id: 올림.media_id, 게시물ID: 올림.media_id, 게시물주소: 올림.주소, 상태: '올림' });
    console.log(`  ● 올림 ${자료.id} · media ${올림.media_id}`);
  } catch (e) {
    console.error(`  ✗ 못 올림 ${자료.id} — ${가림(e.message || e)}`);
    발행기록({ 결과: '실패', 공고: 자료.묶은id, 기관: 자료.기관, 이미지: 자료.이미지, 까닭: 가림(e.message || e).slice(0, 300) });
  }
}
