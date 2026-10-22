/* **회원이 신뢰를 느끼는 셋** — 아침마다 한 자리에서 셉니다 (2026-10-22 세중님 · 오픈 11/10)
 *
 *   node tools/신뢰셋.mjs              세 숫자와 목록
 *   node tools/신뢰셋.mjs --조용히     세 줄만 (아침 메일·보고에 붙일 꼴)
 *
 * 목표는 **셋 다 0** 입니다 (docs/오픈일정_1110.md).
 *
 *   ① 마감 지난 공고가 회원 화면에 보임        `네숫자()` 의 ②번들
 *   ② 회원 화면에 틀린 값                      주 1회 표본 40건 원문 대조 (손으로 재고 여기에 적습니다)
 *   ③ 우리 직군이 아닌 공고·직군 빈칸이 보임    직군 빈칸 + 직군 판별이 **자격증 목록·서식 안내**에만 걸린 것
 *
 * ★ 읽기만 합니다. DB·화면을 안 건드립니다.
 * ★ ③의 「자격증 목록꼴」은 2026-10-22 에 찾은 꼴입니다 — 제목에 우리 직군이 없고,
 *   원문의 직군 말이 「간호사, 사회복지사, **작업치료사**, 임상심리사 중 1개 이상」처럼
 *   **여러 직종을 나열한 자격 요건**이거나 「‘담당업무’는 물리·작업치료 관련 경력임을
 *   기재」처럼 **서식 안내문**인 것입니다. 네 건이 그렇게 「작업치료사 공고」로 떠 있었습니다.
 *   `직군의심()` 은 원문에 글자가 있으면 통과시키므로 이 꼴을 못 봅니다 — 그래서 따로 셉니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 조용히 = process.argv.includes('--조용히');

const cfg = {};
for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const 바탕 = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
const 열쇠 = cfg.SUPABASE_SERVICE_KEY;
if (!바탕 || !열쇠) { console.error('SUPABASE_URL·열쇠가 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const 머리 = { apikey: 열쇠, Authorization: 'Bearer ' + 열쇠 };

async function 창구(이름, 몸 = {}) {
  const r = await fetch(바탕 + '/rest/v1/rpc/' + encodeURIComponent(이름), {
    method: 'POST', headers: { ...머리, 'Content-Type': 'application/json' },
    body: JSON.stringify(몸),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(이름 + ' → ' + r.status + ' ' + t.slice(0, 120));
  return JSON.parse(t);
}
/** ★ 100줄에서 끊깁니다 — 받은 줄 수만큼 넘기고 0줄일 때 멈춥니다 */
async function 다받기(길) {
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

const 네 = await 창구('네숫자');
const 의심 = await 창구('직군의심');

/* ③ — 직군 빈칸 + 자격증 목록·서식꼴 */
const 보임 = await 다받기('job_posts_pub?select=id,job_group,원문제목,title'
  .replace('원문제목', encodeURIComponent('원문제목')));
const 공고 = new Map((await 다받기('job_posts?select=id,source,org_name,detail,'
  + encodeURIComponent('뽑은값') + ',evidence')).map((x) => [x.id, x]));

const 직군빈칸 = 보임.filter((v) => !String(v.job_group || '').trim());
const 직군말 = /(물리|작업|도수)\s*치료/;
const 제목직군 = /(물리|작업|도수)\s*치료|물리\(작업\)|작업\(물리\)/;
const 목록꼴 = /(중\s*1\s*개\s*이상|중\s*하나|각\s*2급\s*이상|관련\s*경력임을)/;
const 자격증목록꼴 = [];
for (const v of 보임) {
  if (!String(v.job_group || '').trim()) continue;
  const 제목 = String(v['원문제목'] || v.title || '');
  if (제목직군.test(제목)) continue;                        /* 제목에 있으면 볼 것 없습니다 */
  const j = 공고.get(v.id) || {};
  const d = j.detail || {}; const 뽑 = j['뽑은값'] || {};
  /* 기관이 적은 글만 봅니다 — 우리가 쓴 「근거」 칸은 근거로 안 씁니다 (직군의심() 과 같은 결) */
  const 글 = [d['지원자격'], d['걸린줄'], d['본문'], 뽑['지원자격']].filter(Boolean).join('\n');
  if (!직군말.test(글)) continue;                            /* 그쪽은 직군의심() 이 봅니다 */
  if (!목록꼴.test(글)) continue;
  /* 「(필수) 물리치료사 면허증 소지자」처럼 **우리 직군만** 적힌 것은 맞는 공고입니다 */
  const 여러직종 = /(간호사|사회복지사|임상심리사|상담심리사|정신건강|보건교사|영양사)/.test(글);
  if (!여러직종) continue;
  자격증목록꼴.push({ id: v.id, 기관: (j.org_name || ''), 제목: 제목.slice(0, 44) });
}

/* ② — 주 1회 손으로 재서 적는 값 (log/신뢰셋_틀림.json) */
/* 서버의 로그 자리는 저장소 **바깥**(~/log)입니다 — 둘 다 봅니다 */
const 틀림터들 = [path.join(여기, '..', 'log', '신뢰셋_틀림.json'),
  path.join(process.env.HOME || '', 'log', '신뢰셋_틀림.json')];
let 틀림 = null;
for (const t of 틀림터들) {
  try { 틀림 = JSON.parse(fs.readFileSync(t, 'utf8')); break; } catch { /* 다음 자리 */ }
}

const 첫째 = (네['②마감인데보임'] ?? 0) + (네['②원문없어짐인데보임'] ?? 0);
const 셋째 = 직군빈칸.length + 자격증목록꼴.length + (의심['의심'] ?? 0);

console.log('① 마감 지난 공고가 보임        ' + 첫째 + '건'
  + '   (마감인데보임 ' + (네['②마감인데보임'] ?? '?')
  + ' · 원문없어짐인데보임 ' + (네['②원문없어짐인데보임'] ?? '?') + ')');
console.log('② 회원 화면에 틀린 값          '
  + (틀림 ? 틀림.틀림 + '건   (' + 틀림.잰날 + ' · 표본 ' + 틀림.표본 + ')'
    : '아직 안 쟀습니다   (주 1회 · 새 표본 40건 원문 대조)'));
console.log('③ 우리 직군이 아닌 공고·빈칸   ' + 셋째 + '건'
  + '   (직군 빈칸 ' + 직군빈칸.length + ' · 자격증 목록꼴 ' + 자격증목록꼴.length
  + ' · 직군의심 ' + (의심['의심'] ?? '?') + ')');
if (조용히) process.exit(0);

console.log('\n회원 화면 ' + (네['회원화면'] ?? '?') + '건 · 잰 때 ' + (네['잰때'] || ''));
if (직군빈칸.length) {
  console.log('\n── 직군 빈칸 ──');
  for (const v of 직군빈칸.slice(0, 12)) {
    const j = 공고.get(v.id) || {};
    console.log('  ' + v.id.padEnd(13) + String(j.source || '').padEnd(5)
      + String(j.org_name || '').slice(0, 14).padEnd(16)
      + String(v['원문제목'] || v.title || '').slice(0, 44));
  }
}
if (자격증목록꼴.length) {
  console.log('\n── 직군 말이 **여러 직종 자격 요건·서식 안내**에만 있는 것 ──');
  for (const x of 자격증목록꼴.slice(0, 12)) {
    console.log('  ' + x.id.padEnd(13) + String(x.기관).slice(0, 14).padEnd(16) + x.제목);
  }
}
if ((의심['의심'] ?? 0) && Array.isArray(의심['의심목록'])) {
  console.log('\n── 직군의심() 이 본 것 ──');
  for (const x of 의심['의심목록'].slice(0, 12)) console.log('  ' + JSON.stringify(x).slice(0, 150));
}
