/* 새 1층 공고 → 릴스 만들기 → (허락되면) 인스타 올리기 — 한 바퀴 (2026-11-16)

   node tools/reels/run.mjs                      마른 실행 — 고르고 만들기만. 올리지 않습니다
   node tools/reels/run.mjs --올리기             열쇠(IG_USER_ID · IG_ACCESS_TOKEN)가 있을 때만 올립니다
   node tools/reels/run.mjs --id 306936          그 공고 하나만 (견본 · 다시 만들기)
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
import { 릴스자료, 오늘KST, 일층인가, 같은공고묶기 } from './reel-data.mjs';
import { 기관사진 } from './photos.mjs';
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
const 가림 = (s) => String(s).split(cfg.SUPABASE_SERVICE_KEY).join('‹열쇠›').split(cfg.IG_ACCESS_TOKEN || '\u0000').join('‹IG열쇠›');

const 올리기 = 깃발('올리기');
const 최대 = Number(인수('최대', 2));
const 며칠 = Number(인수('며칠', 3));
const 한건 = 인수('id');
const 오늘 = 오늘KST();
const 나감 = 인수('나감', path.join(ROOT, 'log', 'reels', 오늘));
const 기록파일 = path.join(ROOT, 'log', '릴스_올림.json');
const 기록 = fs.existsSync(기록파일) ? JSON.parse(fs.readFileSync(기록파일, 'utf8')) : {};

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
const 칸 = 'id,title,원문제목,org_name,employ_type,headcount,apply_to,apply_to_time,job_group,조교연구,posted_at';
const 시작일 = new Date(Date.parse(오늘) - 며칠 * 86400e3).toISOString().slice(0, 10);
const 후보 = 한건
  ? await rest(`job_posts_pub?select=${칸}&id=eq.${encodeURIComponent(한건)}`)
  : await 모두받기(`${cfg.SUPABASE_URL}/rest/v1/job_posts_pub?select=${칸}&posted_at=gte.${시작일}`, H);
console.log(`후보 ${후보.length}건 (게시 ${한건 ? '— id ' + 한건 : 시작일 + ' 이후'})`);

const 일층 = [];
for (const 공고 of 후보) {
  if (!한건 && 기록[공고.id]) continue;
  공고.분류 = await 분류(공고.id);
  if (!일층인가(공고.분류)) continue;
  /* 기관 공식 값 — 기관 표 → 심평원 */
  const [jp] = await rest(`job_posts?select=기관번호&id=eq.${encodeURIComponent(공고.id)}`);
  let 기관 = null;
  if (jp?.기관번호) {
    const [g] = await rest(`기관?select=이름,종별이름,설립구분이름,상급종합인가,대학병원인가,ykiho&기관번호=eq.${encodeURIComponent(jp.기관번호)}`);
    기관 = g || null;
    if (g?.ykiho) {
      const [d] = await rest(`hira_detail?select=perm_sbd,pt,ot&ykiho=eq.${encodeURIComponent(g.ykiho)}`);
      const [o] = await rest(`hira_org?select=estb_dd,sido_nm,sggu_nm&ykiho=eq.${encodeURIComponent(g.ykiho)}`);
      기관 = { ...g, ...(d || {}), ...(o || {}) };
    }
  }
  공고.기관 = 기관;
  일층.push(공고);
}
const 할것 = [];
for (const 공고 of 같은공고묶기(일층)) {
  const 자료 = 릴스자료(공고, 공고.기관, { 오늘, 사이트: 'rapojob.co.kr' });
  if (자료.건너뜀) { console.log('  건너뜀', 공고.id, 공고.org_name, '—', 자료.건너뜀); continue; }
  자료.묶은id = 공고.묶은id || [공고.id];
  /* 전경 사진 — 있으면 씁니다 · 화면 맨 아래 「출처: 병원 이름」 (2026-11-16 세중님) */
  const 사진 = await 기관사진([자료.기관, 공고.org_name]);
  if (사진) { 자료.사진 = 사진.파일; 자료.사진출처 = 사진.출처; }
  할것.push(자료);
}
/* 마감이 가까운 것부터 — 늦게 올리면 쓸모가 없어집니다 */
할것.sort((a, b) => Number(a.마감.큰글.slice(2)) - Number(b.마감.큰글.slice(2)));
console.log(`1층 새 공고 ${할것.length}건 · 이번 바퀴 ${Math.min(최대, 할것.length)}건`);

/* ── 2 · 만들기 ── */
fs.mkdirSync(나감, { recursive: true });
const 만든것 = [];
for (const 자료 of 할것.slice(0, 최대)) {
  const 바탕 = path.join(나감, 자료.id);
  fs.writeFileSync(바탕 + '.json', JSON.stringify(자료, null, 2));
  fs.writeFileSync(바탕 + '.txt', 자료.캡션 + '\n');
  const a = ['--자료', 바탕 + '.json', '--나감', 바탕 + '.mp4', '--표지', 바탕 + '-cover.jpg'];
  if (인수('음악')) a.push('--음악', 인수('음악'));
  const r = spawnSync(process.execPath, [path.join(여기, 'render.mjs'), ...a], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('  ✗ 렌더 실패', 자료.id); continue; }
  만든것.push({ 자료, mp4: 바탕 + '.mp4' });
  console.log(`  ○ ${자료.id} · ${자료.기관} · ${자료.직군} · ${자료.마감.큰글}`);
}

if (!올리기) {
  console.log(`\n마른 실행 — ${만든것.length}편 만들었고 올리지 않았습니다 · ${나감}`);
  process.exit(0);
}

/* ── 3 · 올리기 ── */
if (!cfg.IG_USER_ID || !cfg.IG_ACCESS_TOKEN) { console.error('IG_USER_ID · IG_ACCESS_TOKEN 이 없습니다 — 올리지 않습니다'); process.exit(1); }
const VER = cfg.IG_GRAPH_VERSION || 'v23.0';
const G = 'https://graph.facebook.com/' + VER;

async function 그래프(길, 옵션 = {}) {
  const r = await fetch(G + 길, 옵션);
  const 글 = await r.text();
  console.log(`    ${옵션.method || 'GET'} ${길.split('?')[0]} → ${r.status} · ${가림(글).slice(0, 600)}`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return JSON.parse(글);
}
const 폼 = (o) => new URLSearchParams({ ...o, access_token: cfg.IG_ACCESS_TOKEN });

for (const { 자료, mp4 } of 만든것) {
  try {
    const 컨 = await 그래프(`/${cfg.IG_USER_ID}/media`, { method: 'POST',
      body: 폼({ media_type: 'REELS', upload_type: 'resumable', caption: 자료.캡션, share_to_feed: 'true', 'thumb_offset': '2600' }) });
    const 크기 = fs.statSync(mp4).size;
    const up = await fetch(`https://rupload.facebook.com/ig-api-upload/${VER}/${컨.id}`, { method: 'POST',
      headers: { Authorization: 'OAuth ' + cfg.IG_ACCESS_TOKEN, 'offset': '0', 'file_size': String(크기) }, body: fs.readFileSync(mp4) });
    console.log(`    업로드 → ${up.status} · ${가림(await up.text()).slice(0, 600)}`);
    if (!up.ok) throw new Error('업로드 HTTP ' + up.status);

    let 상태 = '';
    for (let i = 0; i < 30; i++) {           /* 최대 5분 */
      await new Promise((z) => setTimeout(z, 10000));
      const s = await 그래프(`/${컨.id}?fields=status_code,status&access_token=${encodeURIComponent(cfg.IG_ACCESS_TOKEN)}`);
      상태 = s.status_code || '';
      if (상태 === 'FINISHED') break;
      if (상태 === 'ERROR' || 상태 === 'EXPIRED') throw new Error('컨테이너 ' + 상태 + ' · ' + (s.status || ''));
    }
    if (상태 !== 'FINISHED') throw new Error('5분 안에 안 끝남 · 마지막 ' + 상태);
    const 올림 = await 그래프(`/${cfg.IG_USER_ID}/media_publish`, { method: 'POST', body: 폼({ creation_id: 컨.id }) });
    for (const id of 자료.묶은id) 기록[id] = { 올린때: new Date().toISOString(), media_id: 올림.id, 기관: 자료.기관, 직군: 자료.직군 };
    fs.writeFileSync(기록파일, JSON.stringify(기록, null, 2));
    console.log(`  ● 올림 ${자료.id} · media ${올림.id}`);
  } catch (e) {
    console.error(`  ✗ 못 올림 ${자료.id} — ${가림(e.message || e)}`);
  }
}
