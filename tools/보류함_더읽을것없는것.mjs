/* 보류함에서 **더 읽을 것이 없는데 우리 직군이 안 나온 공고**를 숨김보관으로
 * 보냅니다 (2026-10-19 세중님 ㉡ 승인 · 「쓰레기통 아님」)
 *
 *   node tools/보류함_더읽을것없는것.mjs          무엇을 보낼지만 (기본)
 *   node tools/보류함_더읽을것없는것.mjs --진짜   보냅니다
 *
 * ── 조건 ────────────────────────────────────────────────────────
 *   ⓐ 상세 본문을 200자 넘게 읽었거나, 첨부를 **하나라도** 읽었다
 *   ⓑ 그 글(본문 + 읽은 첨부)에 우리 직군 말이 **0**
 *   ⓒ **아직 안 읽은 첨부가 없다**  ← 「더 읽을 것이 없다」의 뜻
 *   ⓓ 관리자가 손댄 것(admin_locked)·고친 칸(edited_fields)은 건너뜁니다
 *
 * ── 쓰레기통이 아니라 숨김보관인 까닭 ──────────────────────────
 * CLAUDE.md — 「못 가린 공고는 **버리지 말고** 보류함으로. 관리자가 확인 후 올림」
 * 그 뜻을 「버리지 말고 **숨김보관**으로」로 좁히는 것입니다. 사람이 볼 것에서만
 * 빼고 줄은 남깁니다. 우리 직군 말이 없어도 **첨부 그림만 있는 공고**가 있습니다
 * (중앙보훈 꼴 · 2026-10-07 에 사람이 읽어 찾았습니다).
 *
 * ── ★ 되돌아오는 길 (세중님 물음) ──────────────────────────────
 *   첨부 읽기     ○ 계속 읽습니다 — `첨부되메우기.mjs` 는 hidden 을 안 거릅니다
 *   상세 본문     ✗ **안 읽습니다** — collect-hosp:425 가 숨김보관을 상세에서 뺍니다
 *   갈래 되살리기  ✗ **자동 장치가 없습니다.** 첨부에서 우리 직군이 나와도 숨김보관에
 *                 그대로 남습니다. 그래서 이 도구는 `--되살릴것` 으로 **그런 공고를
 *                 세어 보여 줍니다** — 0 이 아니면 사람이 되살려야 합니다
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 되살릴것만 = argv.includes('--되살릴것');
const 뚜껑 = Number(argv.includes('--뚜껑') ? argv[argv.indexOf('--뚜껑') + 1] : 300) || 300;

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
const SEC = cfg.COLLECT_KEY_HS3;
if (!U || !K || !SEC) { console.error('✗ 열쇠가 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };

/* 100줄에서 끊기므로 offset 으로 넘깁니다 (지침) */
async function 전부(길) {
  const out = [];
  for (let off = 0; ; off += 100) {
    const r = await fetch(U + '/rest/v1/' + 길 + (길.includes('?') ? '&' : '?')
      + 'limit=100&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(길.slice(0, 40) + ' ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const 한쪽 = await r.json();
    out.push(...한쪽);
    if (한쪽.length < 100) break;
    if (off > 20000) break;
  }
  return out;
}

/* 우리 직군 말 — `직군의심()` 과 같은 잣대입니다 (지침 6절) */
const 우리직군말 = /(물리|작업|도수)\s*치료\s*(?:사|직|선생)/;

const 보류 = await 전부('job_posts?select=id,source,org_name,title,edited_fields,admin_locked'
  + '&hold=is.true&hidden=is.false&order=db_insert_at.asc,id.asc');
console.log('보류함 ' + 보류.length + '건을 받았습니다');

const ids = 보류.map((x) => x.id);
const 첨부 = []; const 본문 = [];
for (let i = 0; i < ids.length; i += 50) {
  const 조각 = ids.slice(i, i + 50).map(encodeURIComponent).join(',');
  /* 첨부 표에는 **읽은 글이 없습니다** — parsed_at·읽기탈 만 있습니다.
     읽은 글은 상세든 첨부든 `job_body` 에 `kind` 로 구분해 들어갑니다
     (2026-10-19 에 칸 이름을 찍어 확인했습니다 · 지침 3절) */
  첨부.push(...await 전부('job_attachments?select=job_id,parsed_at,'
    + encodeURIComponent('읽기탈') + '&job_id=in.(' + 조각 + ')'));
  본문.push(...await 전부('job_body?select=job_id,kind,body&job_id=in.(' + 조각 + ')'));
}
const 첨부별 = new Map(); for (const a of 첨부) {
  if (!첨부별.has(a.job_id)) 첨부별.set(a.job_id, []);
  첨부별.get(a.job_id).push(a);
}
/* 상세 본문과 첨부 글을 **따로** 모읍니다 — 「본문을 읽었나」와
   「첨부를 읽었나」가 조건에서 다른 뜻이기 때문입니다 */
const 상세별 = new Map(); const 첨부글별 = new Map();
for (const b of 본문) {
  const 통 = b.kind === '상세' ? 상세별 : 첨부글별;
  통.set(b.job_id, (통.get(b.job_id) || '') + '\n' + String(b.body || ''));
}

/* ★ 2026-10-19 세중님이 눈으로 보고 **빼라고 한 것** (목록 129건 중) ──
 *   HS640656575  중앙보훈병원 기간제 — 보류함 유지. CLAUDE.md 10-2 에
 *                「사람이 첨부를 읽어 물리치료사 1명을 찾았다」가 적힌 기관이고,
 *                본문에 「재활」이 한 번 나옵니다. 접수마감도 빈칸입니다
 *   GJ304558     서울고등법원 — 본문 0자 (더 읽을 것이 있습니다)
 *   CE78046      울진군의료원 — 본문 0자 (같음)
 *   HS1401157550 경찰병원 — 숨김보관이 아니라 **쓰레기통**입니다
 *                (제목이 「최종합격자 발표」 · 따로 보냅니다) */
const 빼라고한것 = new Set(['HS640656575', 'GJ304558', 'CE78046', 'HS1401157550']);

const 고름 = [];      /* 숨김보관으로 보낼 것 */
const 되살릴것 = [];  /* ★ 글에 우리 직군이 있는데 보류함에 있는 것 — 올려야 할 수 있음 */
const 남김 = { '안 읽은 첨부가 있음': 0, '아무것도 못 읽음': 0, '관리자가 손댐': 0,
  '세중님이 빼라고 한 것': 0 };

for (const j of 보류) {
  if (빼라고한것.has(j.id)) { 남김['세중님이 빼라고 한 것']++; continue; }
  if (j.admin_locked || (j.edited_fields || []).length) { 남김['관리자가 손댐']++; continue; }
  const as = 첨부별.get(j.id) || [];
  const 안읽은첨부 = as.filter((a) => !a.parsed_at).length;
  const 본문글 = 상세별.get(j.id) || '';
  const 첨부글 = 첨부글별.get(j.id) || '';
  const 읽은것있나 = 본문글.trim().length > 200 || as.some((a) => a.parsed_at);
  const 글 = j.title + '\n' + 본문글 + '\n' + 첨부글;

  if (우리직군말.test(글)) { 되살릴것.push({ ...j, 왜: '글에 우리 직군 말이 있습니다' }); continue; }
  if (안읽은첨부) { 남김['안 읽은 첨부가 있음']++; continue; }
  if (!읽은것있나) { 남김['아무것도 못 읽음']++; continue; }
  고름.push({ ...j,
    왜: '더 읽을 것이 없는데 우리 직군 말이 없습니다 · 본문 ' + 본문글.trim().length + '자'
      + ' · 첨부 ' + as.length + '개(모두 읽음)' });
}

console.log('\n★ 글에 우리 직군 말이 있는데 보류함에 있는 것 — ' + 되살릴것.length + '건'
  + (되살릴것.length ? '  ← **올려야 할 수 있습니다**' : '  (없습니다 ○)'));
for (const x of 되살릴것.slice(0, 12)) {
  console.log('    ' + x.id + ' [' + x.source + '] ' + String(x.org_name).slice(0, 16)
    + ' | ' + String(x.title).slice(0, 40));
}
if (되살릴것.length > 12) console.log('    … 그밖 ' + (되살릴것.length - 12) + '건');
if (되살릴것만) process.exit(0);

console.log('\n숨김보관으로 보낼 것 ' + 고름.length + '건');
console.log('  남기는 것 — ' + Object.entries(남김).map(([k, v]) => k + ' ' + v).join(' · '));
const 출처별 = {}; for (const x of 고름) 출처별[x.source] = (출처별[x.source] || 0) + 1;
console.log('  출처별 — ' + Object.entries(출처별).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => k + ' ' + v).join(' · ') + '\n');
for (const x of 고름.slice(0, 15)) {
  console.log('    ' + x.id + ' [' + x.source + '] ' + String(x.org_name).slice(0, 16)
    + ' | ' + String(x.title).slice(0, 36));
  console.log('        ' + x.왜);
}
if (고름.length > 15) console.log('    … 그밖 ' + (고름.length - 15) + '건');

if (!고름.length) { console.log('\n보낼 것이 없습니다'); process.exit(0); }
if (고름.length > 뚜껑) {
  console.error('\n★ ' + 고름.length + '건은 뚜껑(' + 뚜껑 + ')을 넘습니다 — 멈춥니다');
  process.exit(1);
}
if (!진짜) { console.log('\n[마른] 아무것도 안 바꿉니다 — 보내려면 --진짜'); process.exit(0); }

/* 창구로만 — `rejudge_hold_apply` 가 hidden=true·hold=false·hidden_why 를 함께 적습니다.
   「숨김보관」이라는 뜻이 까닭 글귀에 드러나야 나중에 찾을 수 있습니다 */
let 감춤 = 0;
for (let i = 0; i < 고름.length; i += 200) {
  const 토막 = 고름.slice(i, i + 200).map((x) => x.id);
  const r = await fetch(U + '/rest/v1/rpc/rejudge_hold_apply', {
    method: 'POST', headers: H,
    body: JSON.stringify({ p_secret: SEC, p_show: [], p_hide: 토막,
      p_why: '숨김보관 — 본문·첨부를 다 읽었는데 우리 직군이 없습니다 (2026-10-19 규칙)' }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('✗ rejudge_hold_apply ' + r.status + ' · ' + t.slice(0, 250)); process.exit(1); }
  console.log('  ' + (i + 토막.length) + '/' + 고름.length + ' — ' + t.slice(0, 140));
  감춤 += 토막.length;
}
console.log('\n보냈습니다 — ' + 감춤 + '건');
