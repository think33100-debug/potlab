/* 마감일이 **빈 채로 회원 화면에 보이는 공고** — 세어 보고(그물), 원문을 열어 채웁니다
 *
 *   node tools/마감비어보임.mjs                 목록만 (그물 · 날마다 돌릴 것)
 *   node tools/마감비어보임.mjs --원문           원문을 열어 접수기간 줄을 찍습니다
 *   node tools/마감비어보임.mjs --채우기         무엇을 채울지만 (마른)
 *   node tools/마감비어보임.mjs --채우기 --진짜   채웁니다
 *   node tools/마감비어보임.mjs --자기점검        규칙만 (쪽·DB 안 두드림)
 *
 * ── 왜 만들었나 (2026-10-19 밤 · 능력시험이 찾았습니다) ──────────────
 * 네숫자의 「②마감인데 보임」은 **apply_to 를 오늘과 견주는** 지표입니다.
 * apply_to 가 **비어 있으면 견줄 값이 없어 0 으로 나옵니다** — 그 0 이
 * 「마감 지난 공고가 회원에게 보이는 것」을 가리고 있었습니다
 * (청주의료원 103일 · 상주적십자 75일 · 인천적십자 46일 · **광주씨티 2021년 공고**).
 *
 * ★ 채우는 길은 창구 `칸되메우기` 하나입니다 (표를 직접 안 고칩니다).
 *   apply_to 는 **비어 있을 때만** 찹니다 — 창구가 지킵니다.
 * ★ 숨기지 않습니다. 마감일이 차면 **정리매시**가 규칙대로 내립니다.
 * ★ 채울 공고는 **제가 원문을 한 건씩 읽어 적은 표**입니다 (아래 `채울것`).
 *   돌릴 때마다 **원문을 다시 열어 그 글귀가 아직 있는지 확인**하고,
 *   없으면 그 건은 **건너뜁니다** — 짐작으로 날짜를 넣지 않습니다.
 */
import fs from 'node:fs';
import { 첨부읽기, 진짜형식, 워커끝내기 } from './공고문읽기.mjs';

const argv = process.argv.slice(2);
const 원문보기 = argv.includes('--원문');
const 채우기 = argv.includes('--채우기');
const 진짜 = argv.includes('--진짜');
const 자기점검만 = argv.includes('--자기점검');

/* ── 그물 — 며칠이 지나면 「오래된 것」으로 세나 ───────────────── */
export const 오래됨일수 = 60;

/** 올린날·담은날 가운데 **이른 것**을 기준으로 며칠 지났나 (둘 다 없으면 null) */
export function 지난날(올린날, 담은날, 오늘) {
  const 날 = [올린날, 담은날].filter(Boolean).map((d) => new Date(d + 'T00:00:00+09:00').getTime());
  if (!날.length) return null;
  return Math.floor((new Date(오늘 + 'T00:00:00+09:00').getTime() - Math.min(...날)) / 86400000);
}

/** 두 자리 해(21년 5월 31일)도 읽습니다 — 4자리로 늘려 돌려줍니다 */
export function 해네자리(연) {
  const n = Number(연);
  if (!Number.isFinite(n)) return null;
  if (n >= 1900) return n;
  if (n >= 0 && n <= 99) return 2000 + n;      /* 21년 → 2021년 */
  return null;
}

const 날꼴 = (y, mo, d) => y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');

/** 글귀에서 **끝 날짜**를 읽습니다 — 범위면 뒤쪽 날짜입니다
 *
 * ★ 공고문은 끝 날짜의 **해를 자주 생략**합니다 —
 *   「접수기간 2026. 7. 21.(화) ∼ 8. 6.(목) 18:00」 (상주적십자).
 *   앞 날짜만 읽으면 **시작일을 마감일로** 적게 됩니다. 그래서 「~」 뒤에
 *   해 없는 「월. 일」이 있으면 **앞 날짜의 해를 물려받습니다.**
 */
export function 끝날짜(글) {
  const s = String(글 || '').replace(/ /g, ' ');
  const 꼴 = /(\d{2,4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*[.일]?/g;
  const 나온것 = [];
  for (const m of s.matchAll(꼴)) {
    const y = 해네자리(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    나온것.push({ y, mo, d, 끝: m.index + m[0].length });
  }
  if (!나온것.length) return null;
  const 마지막 = 나온것[나온것.length - 1];
  const 범위 = s.slice(마지막.끝).match(/[~∼〜–—-]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*[.일]?/);
  if (범위) {
    const mo = Number(범위[1]);
    const d = Number(범위[2]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return 날꼴(마지막.y, mo, d);
  }
  return 날꼴(마지막.y, 마지막.mo, 마지막.d);
}

/** 글귀에서 시각 (17:00 · 17시 · 17시 30분) */
export function 시각(글) {
  const s = String(글 || '');
  let m = s.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (m) return String(Math.min(23, Number(m[1]))).padStart(2, '0') + ':' + m[2];
  m = s.match(/(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  if (m) return String(Math.min(23, Number(m[1]))).padStart(2, '0') + ':' + String(Number(m[2] || 0)).padStart(2, '0');
  return null;
}

/* ── 채울 것 — 제가 원문을 읽어 적은 표입니다 ───────────────────
   찾을말 = 원문에 **아직 그 글귀가 있는지** 확인하는 잣대입니다 */
export const 채울것 = [
  { id: 'HS236379585', 기관: '충청북도 청주의료원', 마감: '2026-07-09', 시각: '17:00',
    어디: '첨부 HWP', 찾을말: /접수\s*기간[^\n]{0,90}2026[.\s]*0?7[.\s]*0?9/,
    근거: '접수기간 2026.06.29 ~ 2026.07.09.(17:00)까지' },
  { id: 'HS420894575', 기관: '인천적십자병원', 마감: '2026-09-04', 시각: '10:00',
    어디: '첨부 PDF', 찾을말: /2026[.\s]*0?9[.\s]*0?4[^\n]{0,30}10\s*:\s*00/,
    근거: '원서접수 2026.08.19 ~ 2026.09.04.(금) 10:00' },
  { id: 'HS638584095', 기관: '상주적십자병원', 마감: '2026-08-06', 시각: '18:00',
    어디: '첨부 PDF', 찾을말: /8[.\s]*0?6[^\n]{0,30}18\s*:\s*00/,
    근거: '접수기간 2026. 7. 21.(화) ∼ 8. 6.(목) 18:00' },
  { id: 'HS1650428387', 기관: '광주씨티병원', 마감: '2021-05-31', 시각: null,
    어디: '쪽 본문', 찾을말: /21\s*년\s*5\s*월\s*31\s*일/,
    근거: '원서 접수 마감일: 21년 5월 31일(월)까지' },
];

/* ── 자기점검 ─────────────────────────────────────────── */
function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('두 자리 해 21 → 2021', 해네자리('21') === 2021);
  보('네 자리 해 2026 → 그대로', 해네자리('2026') === 2026);
  보('해가 아니면 null', 해네자리('abc') === null);
  보('범위면 끝 날짜', 끝날짜('2026.06.29 ~ 2026.07.09.(17:00)까지') === '2026-07-09');
  보('두 자리 해 끝날짜', 끝날짜('원서 접수 마감일: 21년 5월 31일(월)까지') === '2021-05-31');
  보('점 꼴 범위 — 끝 날짜의 해를 물려받습니다', 끝날짜('2026. 7. 21.(화) ∼ 8. 6.(목) 18:00') === '2026-08-06');
  보('해를 둘 다 적은 범위', 끝날짜('원서접수 2026.08.19 ~ 2026.09.04.(금) 10:00') === '2026-09-04');
  보('날짜 하나면 그 날짜', 끝날짜('접수 마감 2026. 10. 27.(화) 17:00') === '2026-10-27');
  보('시각을 날짜로 읽지 않습니다', 끝날짜('2026. 9. 14.(월) ~ 17:00') === '2026-09-14');
  보('날짜가 없으면 null', 끝날짜('채용 시 까지') === null);
  보('시각 17:00', 시각('2026.07.09.(17:00)까지') === '17:00');
  보('시각 17시', 시각('9. 14.(월) 17시까지') === '17:00');
  보('시각 없으면 null', 시각('2026-10-06') === null);
  보('지난날 — 이른 날 기준', 지난날('2026-09-03', '2026-10-01', '2026-10-20') === 47);
  보('지난날 — 올린날 없으면 담은날', 지난날(null, '2026-10-01', '2026-10-20') === 19);
  보('지난날 — 둘 다 없으면 null', 지난날(null, null, '2026-10-20') === null);
  보('채울것 네 건 모두 근거에서 끝날짜가 나온다', 채울것.every((x) => 끝날짜(x.근거) === x.마감));
  보('채울것 시각이 근거와 맞다', 채울것.every((x) => (시각(x.근거) || null) === (x.시각 || null)));
  보('채울것 아이디가 겹치지 않는다', new Set(채울것.map((x) => x.id)).size === 채울것.length);
  const 탈 = 잼.filter((y) => !y[1]);
  for (const y of 잼) if (!y[1]) console.log('  ✗ ' + y[0]);
  console.log((탈.length ? '✗ 자기점검 ' + 탈.length + '가지 탈'
    : '○ 마감비어보임 자기점검 통과 — ' + 잼.length + '가지') + ' (쪽·DB 를 두드리지 않았습니다)');
  return !탈.length;
}
if (!자기점검()) process.exit(1);
if (자기점검만) process.exit(0);

/* ── 열쇠 ──────────────────────────────────────────────── */
const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_ROLE_KEY || cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL · SERVICE KEY 가 없습니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const 오늘 = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

/* ── ① 그물 — 마감일이 빈 회원 화면 공고 ─────────────────────── */
/* ★ `job_posts_pub` 에는 `source` · `db_insert_at` 이 없습니다 (칸 목록을 찍어
   확인했습니다). 창구 둘을 따로 묻고 id 로 맞춥니다 — PostgREST 는 표끼리
   이어 주지 못합니다. 100줄에서 끊기니 **offset 으로 넘깁니다** (지침) */
async function 다받기(길) {
  const 모두 = [];
  for (let off = 0; off < 2000; off += 100) {
    const r = await fetch(U + '/rest/v1/' + 길 + '&limit=100&offset=' + off, { headers: H });
    if (!r.ok) { console.error('✗ ' + r.status + ' · ' + (await r.text()).slice(0, 200)); process.exit(1); }
    const j = await r.json();
    모두.push(...j);
    if (j.length < 100) break;
  }
  return 모두;
}
const 빈것 = await 다받기('job_posts_pub?select='
  + encodeURIComponent('id,org_name,title,url,apply_to,posted_at,접수문장')
  + '&apply_to=is.null&order=posted_at.asc');
const 더 = new Map();
for (let i = 0; i < 빈것.length; i += 50) {
  const ids = 빈것.slice(i, i + 50).map((x) => x.id);
  const j = await 다받기('job_posts?select=id,source,db_insert_at,deadline_src'
    + '&id=in.(' + ids.join(',') + ')&order=id.asc');
  for (const y of j) 더.set(y.id, y);
}
const 줄 = 빈것.map((x) => {
  const y = 더.get(x.id) || {};
  return { ...x, source: y.source, db_insert_at: y.db_insert_at,
    지남: 지난날(x.posted_at, String(y.db_insert_at || '').slice(0, 10), 오늘) };
});
const 오래된것 = 줄.filter((x) => x.지남 != null && x.지남 >= 오래됨일수);

console.log('\n── 마감일이 빈 회원 화면 공고 ' + 줄.length + '건 (' + 오늘 + ') ──');
for (const x of [...줄].sort((a, b) => (b.지남 ?? -1) - (a.지남 ?? -1))) {
  console.log('  ' + (x.지남 == null ? '  ?' : String(x.지남).padStart(3)) + '일  '
    + String(x.id).padEnd(14) + String(x.source || '').padEnd(4) + ' '
    + String(x.org_name || '').slice(0, 16).padEnd(17) + String(x.title || '').slice(0, 40));
}
console.log('\n  ★ ' + 오래됨일수 + '일 넘은 것 — ' + 오래된것.length + '건'
  + (오래된것.length ? ' (원문을 확인해야 합니다)' : ' (없습니다)'));

/* ── 원문 받기 — 쪽 쿠키와 Referer 를 함께 보냅니다 ───────────── */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0';
const 파일꼴 = /[.](pdf|hwpx?|docx?|xlsx?|zip)([?]|$|#)/i;
const 내려받기길 = /(download|filedown|fileDown|getFile|nttFileDownload|downFile|atchFile|cmm\/fms)/i;
const 엔티티 = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
const 태그걷기 = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<td[^>]*>/gi, ' | ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

async function 원문글(주소) {
  const 모음 = [];
  const r = await fetch(주소, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' },
    redirect: 'follow', signal: AbortSignal.timeout(30000) });
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || '';
  const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
    || (buf.subarray(0, 3000).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  let html;
  try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
  const 쿠키 = (r.headers.getSetCookie?.() || []).map((c) => String(c).split(';')[0]).join('; ');
  const 끝 = r.url || 주소;
  모음.push({ 어디: '쪽 본문', 글: 태그걷기(html) });

  const 본것 = new Set();
  for (const m of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
    const h = 엔티티(m[1]);
    if (!(파일꼴.test(h) || 내려받기길.test(h))) continue;
    if (/\/(images?|img|css|js|favicons?|icons?)\//i.test(h) && !파일꼴.test(h)) continue;
    let u;
    try { u = new URL(h, 끝).href; } catch { continue; }
    const 열쇠 = u.replace(/;jsessionid=[^?#]*/i, '');
    if (본것.has(열쇠)) continue;
    본것.add(열쇠);
    if (본것.size > 5) break;
    try {
      const a = await fetch(u, { headers: { 'User-Agent': UA, Referer: 끝, Cookie: 쿠키 },
        redirect: 'follow', signal: AbortSignal.timeout(30000) });
      const ab = Buffer.from(await a.arrayBuffer());
      const 꼴 = 진짜형식(ab);
      const 이름 = decodeURIComponent((a.headers.get('content-disposition') || '')
        .match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i)?.[1] || u.split('/').pop()).slice(0, 60);
      if (!['pdf', 'hwp', 'zip계열'].includes(꼴)) {
        모음.push({ 어디: '첨부 ' + 이름, 글: '', 왜: 꼴 + ' · ' + ab.length + '바이트' });
        continue;
      }
      const 읽 = await 첨부읽기(ab, 이름);
      모음.push({ 어디: '첨부 ' + 이름 + ' (' + 꼴 + ' · ' + ab.length + '바이트)', 글: String((읽 && 읽.md) || '') });
    } catch (e) { 모음.push({ 어디: '첨부 ' + u.slice(-40), 글: '', 왜: String(e.message).slice(0, 50) }); }
    await new Promise((x) => setTimeout(x, 600));
  }
  return 모음;
}

const 마감꼴 = /(접수\s*기간|접수\s*마감|원서\s*접수|제출\s*기간|마감일|마감\s*:|까지|상시|수시|채용\s*시|충원\s*시)/;

/* ── ② 원문 열어 보기 ──────────────────────────────────── */
if (원문보기) {
  for (const x of (오래된것.length ? 오래된것 : 줄)) {
    console.log('\n════ ' + x.id + ' · ' + x.org_name + '\n  ' + x.url);
    try {
      for (const g of await 원문글(x.url)) {
        if (!g.글) { console.log('  ── ' + g.어디 + ' — 글로 못 바꿈 (' + (g.왜 || '') + ')'); continue; }
        console.log('  ── ' + g.어디 + ' (' + g.글.length + '자)');
        const ls = g.글.split('\n').map((l) => l.trim()).filter((l) => l.length > 3 && 마감꼴.test(l));
        for (const l of ls.slice(0, 6)) console.log('     ▸ ' + l.slice(0, 180));
        if (!ls.length) console.log('     (마감 글귀가 없습니다)');
      }
    } catch (e) { console.log('  ✗ ' + String(e.message).slice(0, 60)); }
  }
}

/* ── ③ 채우기 ─────────────────────────────────────────── */
if (채우기) {
  const 보임 = new Map(줄.map((x) => [x.id, x]));
  const 칸줄 = [];
  const 적음 = [];
  for (const c of 채울것) {
    const x = 보임.get(c.id);
    if (!x) {
      console.log('\n  — ' + c.id + ' ' + c.기관 + ' : 이미 마감일이 찼거나 회원 화면에 없습니다 — 건너뜁니다');
      continue;
    }
    console.log('\n════ ' + c.id + ' · ' + c.기관 + '  (' + x.지남 + '일 지남)');
    let 찾음 = null;
    try {
      for (const g of await 원문글(x.url)) {
        if (!g.글) continue;
        const l = g.글.split('\n').map((s) => s.trim()).find((s) => c.찾을말.test(s));
        if (l) { 찾음 = { 어디: g.어디, 줄: l.slice(0, 200) }; break; }
      }
    } catch (e) { console.log('  ✗ 원문을 못 열었습니다 — ' + String(e.message).slice(0, 60)); continue; }
    if (!찾음) { console.log('  ✗ 원문에서 그 글귀를 못 찾았습니다 — **건너뜁니다**'); continue; }
    const 읽은날 = 끝날짜(찾음.줄);
    console.log('  원문  ' + 찾음.어디);
    console.log('        「' + 찾음.줄 + '」');
    console.log('  읽은 끝 날짜 ' + 읽은날 + ' · 제가 적어 둔 값 ' + c.마감 + (c.시각 ? ' ' + c.시각 : ''));
    if (읽은날 !== c.마감) { console.log('  ✗ 원문에서 읽은 날짜가 제 표와 다릅니다 — **건너뜁니다**'); continue; }
    칸줄.push({ id: c.id, apply_to: c.마감, 마감일출처: '원문 ' + c.어디 });
    적음.push({ ...c, 찾음, 지남: x.지남 });
  }

  console.log('\n── 채울 것 ' + 칸줄.length + '건 / 적어 둔 것 ' + 채울것.length + '건 ──');
  for (const a of 적음) console.log('  ' + a.id + '  apply_to → ' + a.마감 + '  (' + a.어디 + ')');
  if (!칸줄.length) { console.log('\n채울 것이 없습니다.'); await 워커끝내기?.(); process.exit(0); }
  if (!진짜) { console.log('\n[마른] 아무것도 안 채웁니다 — 채우려면 --진짜'); await 워커끝내기?.(); process.exit(0); }

  const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
    method: 'POST', headers: H, body: JSON.stringify({ p_rows: 칸줄 }),
  });
  const t = await r.text();
  console.log('\n창구 칸되메우기 ' + r.status + ' · ' + t.slice(0, 300));
  if (!r.ok) process.exit(1);
  console.log('\n★ 되돌리는 법 — 칸기록에 옛 값(빈칸)이 남습니다:');
  console.log('   update job_posts j set apply_to = null, deadline_src = null');
  console.log('     from "칸기록" k where k.job_id = j.id and k."칸" = ' + "'apply_to'");
  console.log('      and k."누가" = ' + "'첨부 되메우기' and k.\"옛값\" is null");
  console.log('      and k."바뀐때" >= ' + "'" + 오늘 + "'::date;");
  console.log('\n※ 숨기지 않았습니다 — 마감일이 찼으니 **정리매시**가 규칙대로 내립니다.');
}
await 워커끝내기?.();
