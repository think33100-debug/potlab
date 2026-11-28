/* 댓글에 **그 게시물의 단어**를 남긴 사람에게 DM 으로 링크를 보내고, 댓글에 「보내 드렸어요」 답글을 답니다
   (2026-11-17 세중님 「ㄱ 하자」 → 「게시물마다 다르게 · 아직은 안 달 거야 · 나중에 이벤트 할 때 ·
    링크 달면 그 댓글에도 대댓글로 보내 드렸어요 감사해요」)

   ★ 단어를 정한 게시물에서만 돕니다. 공통 낱말(「링크」)은 없습니다 — 단어가 없으면 아무것도 안 보냅니다
   단어 정하기  node tools/reels/댓글링크.mjs --단어 <게시물 짧은주소> <단어>     (예: Df1jEuVn4OG 이벤트)
               node tools/reels/댓글링크.mjs --단어 <게시물 짧은주소> -          (지우기)
               node tools/reels/댓글링크.mjs --단어목록
               원격: dm-word (job_id = 짧은주소 · word = 단어 또는 -)
   단어 기록   log/댓글링크_단어.json  { 짧은주소: { 단어, 정한때 } }

   node tools/reels/댓글링크.mjs            마른 실행 — 보낼 댓글과 보낼 글만 찍습니다
   node tools/reels/댓글링크.mjs --실행     보냅니다

   길   웹훅 없이 **훑기**입니다. 최근 7일 게시물의 댓글을 읽어 「링크」가 든 댓글을 찾고,
        아직 안 보낸 것에만 비공개 답장(private reply)을 보냅니다.
        (웹훅은 공개 주소 · 앱 설정이 더 필요해 뒤로 미뤘습니다)
   명세 (검색으로 본 것 · 메타 문서 원문은 이 컨테이너에서 못 열었습니다)
        POST /{id}/messages  recipient={"comment_id":…}  message={"text":…}
        댓글 하나에 한 번 · 댓글 단 뒤 7일 안
        → 그래서 응답 원문 600자를 찍습니다 (지침 2절). 첫 실행에서 맞는 길을 확인합니다
   권한 토큰에 instagram_manage_messages 가 있어야 합니다 (없으면 마른 실행에서 알려 줍니다)
   기록 log/댓글링크_보냄.json — 댓글 id 별 { 때, 결과, 게시물, 받는이 }. 실패는 두 번까지만 다시 시도
   보낼 글 — 릴스·카드 게시물이면 그 공고 주소, 아니면 라포 첫 화면 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, 인스타되나, 그래프 } from './ig.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(여기, '..', '..');
const 기록파일 = path.join(ROOT, 'log', '댓글링크_보냄.json');
const 올림파일 = path.join(ROOT, 'log', '릴스_올림.json');
const 사이트 = 'https://www.rapojob.co.kr';
const 단어파일 = path.join(ROOT, 'log', '댓글링크_단어.json');
/* 단어 꼴 — 한글·영문·숫자 1~20자 (원격으로 받으므로 셸 글자를 막습니다) */
/* 공고 게시물의 기본 단어 — 따로 단어를 안 정한 **공고 게시물**(릴스·카드뉴스)은 이 단어를 봅니다
   (2026-11-26 세중님 「댓글로 라포 남겨주시면 바로 볼 수 있는 링크 보내드릴게요 · 각 공고의 링크를 보내도록」)
   브랜드 게시물처럼 공고가 아닌 것은 전처럼 단어를 정한 것만 */
export const 기본단어 = '라포';
export const 게시물단어 = (정한단어, 공고게시물인가) => 정한단어 || (공고게시물인가 ? 기본단어 : null);
export const 단어꼴 = /^[가-힣A-Za-z0-9]{1,20}$/;
export const 짧은주소 = (permalink) => (String(permalink || '').match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/) || [])[1] || null;
/* 기본 단어(「라포」)를 보는 게시물은 「링크」라고 남겨도 보냅니다 (2026-11-26 세중님 「댓글에 링크 남겨주시면」) */
export const 단어맞나 = (글, 단어) => !!단어 && [단어, ...(단어 === '라포' ? ['링크'] : [])].some((w) => String(글 || '').toLowerCase().includes(String(w).toLowerCase()));
export function 단어들() { return fs.existsSync(단어파일) ? JSON.parse(fs.readFileSync(단어파일, 'utf8')) : {}; }
/* 댓글에 다는 공개 답글 — 같은 글이 줄줄이 붙지 않게 댓글 id 로 돌려 씁니다 */
const 답글꼴 = [
  'DM으로 보내 드렸어요! 관심 가져 주셔서 감사해요 😊',
  'DM 확인해 주세요! 댓글 남겨 주셔서 감사해요 🙌',
  '방금 DM으로 보내 드렸어요. 감사해요!',
];
export const 답글고르기 = (id) => 답글꼴[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 답글꼴.length];
const 창 = 7 * 86400e3;

/** 게시물 id → 공고 id (릴스·카드뉴스로 올린 것) */
function 게시물공고() {
  const m = new Map();
  if (!fs.existsSync(올림파일)) return m;
  const 기록 = JSON.parse(fs.readFileSync(올림파일, 'utf8'));
  for (const [k, v] of Object.entries(기록)) {
    if (k.startsWith('__') || !v) continue;
    for (const g of [v.게시물ID, v.카드게시물ID]) if (g && !m.has(String(g))) m.set(String(g), k);
  }
  return m;
}

export function 보낼글(공고id) {
  return 공고id
    ? `안녕하세요, 라포예요! 말씀하신 공고 링크예요. 가입 없이 바로 볼 수 있어요.\n\n${사이트}/jobs/${공고id}\n\n지원 전에 원문 공고도 꼭 한 번 확인해 주세요!`
    : `안녕하세요, 라포예요! 말씀하신 링크예요.\n\n${사이트}\n\n치료사 채용 공고를 한곳에 모아 두고 있어요!`;
}

/** 누르는 단추가 달린 꼴 (button template · web_url) — 글 속 주소가 안 눌린다는 분이 있어서 (2026-11-28 세중님 화면 · rebodypt 「링크가 안 눌리는데요」).
    글에도 주소를 그대로 둡니다(단추가 안 보이는 앱에서는 길게 눌러 복사). 댓글 답장(comment_id)에서 이 꼴을 받는지는 명세에 안 적혀 있어
    **먼저 이 꼴로 보내 보고, 거절되면 전처럼 글로** 보냅니다 */
export function 보낼단추(공고id) {
  return { attachment: { type: 'template', payload: { template_type: 'button', text: 보낼글(공고id),
    buttons: [{ type: 'web_url', url: 공고id ? `${사이트}/jobs/${공고id}` : 사이트, title: 공고id ? '공고 보러 가기' : '라포 열기' }] } } };
}

async function 다받기(cfg, 길) {
  const 줄 = [];
  let 다음 = `https://graph.facebook.com/${cfg.IG_GRAPH_VERSION || 'v23.0'}${길}`;
  for (let i = 0; 다음 && i < 10; i++) {
    const r = await fetch(다음); const d = await r.json();
    if (!r.ok) throw new Error(`HTTP ${r.status} · ${JSON.stringify(d).slice(0, 300)}`);
    줄.push(...(d.data || []));
    다음 = d.paging?.next || null;            /* 메타가 준 다음 쪽 주소를 그대로 따라갑니다 */
  }
  return 줄;
}

function 자기점검() {
  const 틀림 = []; const 봐 = (n, c) => { console.log((c ? '○ ' : '✗ ') + n); if (!c) 틀림.push(n); };
  봐('단어가 든 댓글은 걸림 (대소문자 무시)', 단어맞나('이벤트 참여해요!', '이벤트') && 단어맞나('Rapo!', 'rapo'));
  봐('단어 없는 게시물 · 다른 댓글은 안 걸림', !단어맞나('링크', null) && !단어맞나('좋아요', '이벤트'));
  봐('단어 꼴 — 셸 글자 막음', 단어꼴.test('일산') && 단어꼴.test('RAPO2') && !단어꼴.test('a;b') && !단어꼴.test('') && !단어꼴.test('$(id)'));
  봐('짧은주소', 짧은주소('https://www.instagram.com/p/Df1jEuVn4OG/') === 'Df1jEuVn4OG' && 짧은주소('https://www.instagram.com/reel/AbC_1-x/') === 'AbC_1-x');
  봐('답글은 늘 같은 댓글엔 같은 꼴', 답글고르기('123') === 답글고르기('123') && 답글꼴.includes(답글고르기('9')));
  봐('기본 단어 게시물은 「링크」도 받음 · 따로 정한 단어 게시물은 그 단어만', 단어맞나('링크 주세요', '라포') && 단어맞나('라포!', '라포') && !단어맞나('링크', '이벤트'));
  봐('공고 게시물은 기본 단어 「라포」 · 정한 단어가 먼저 · 공고 아닌 게시물은 안 봄', 게시물단어(null, true) === '라포' && 게시물단어('이벤트', true) === '이벤트' && 게시물단어(null, false) === null);
  봐('공고 게시물이면 그 공고 주소', 보낼글('306973-PT').includes('/jobs/306973-PT'));
  봐('아니면 첫 화면', 보낼글(null).includes(사이트 + '\n'));
  console.log(`\n견본 ${틀림.length ? '✗ 틀림 ' + 틀림.length : '틀림 0'}`);
  if (틀림.length) process.exit(1);
}

function 단어정하기() {
  const i = process.argv.indexOf('--단어');
  const 주소 = process.argv[i + 1], 단어 = process.argv[i + 2];
  if (!/^[A-Za-z0-9_-]{5,40}$/.test(주소 || '')) { console.error('게시물 짧은주소가 필요합니다 (예: Df1jEuVn4OG)'); process.exit(2); }
  const 표 = 단어들();
  if (단어 === '-') { delete 표[주소]; console.log(`○ ${주소} 단어를 지웠습니다`); }
  else if (단어꼴.test(단어 || '')) { 표[주소] = { 단어, 정한때: new Date().toISOString() }; console.log(`○ ${주소} 단어 「${단어}」`); }
  else { console.error('단어는 한글·영문·숫자 1~20자 (지우기는 -)'); process.exit(2); }
  fs.mkdirSync(path.dirname(단어파일), { recursive: true });
  fs.writeFileSync(단어파일, JSON.stringify(표, null, 2));
}

/* --빠르게 (2026-11-26 세중님 「댓글 달면 바로 가야지」) — 1분마다 도는 길.
   게시물 목록 한 번(comments_count 포함)만 묻고, **댓글 수가 바뀐 게시물만** 댓글을 읽습니다 (평소 호출 1번).
   권한 확인·계정 이름은 상태 파일에 적어 둔 것을 씁니다. 못 보낸 댓글이 있으면 그 게시물은 다음에도 다시 봅니다 */
const 상태파일 = path.join(ROOT, 'log', '댓글링크_상태.json');
async function 돌기() {
  const 실행 = process.argv.includes('--실행');
  const 빠르게 = process.argv.includes('--빠르게');
  const 상태 = fs.existsSync(상태파일) ? JSON.parse(fs.readFileSync(상태파일, 'utf8')) : {};
  상태.댓글수 = 상태.댓글수 || {};
  const cfg = env();
  if (!인스타되나(cfg)) { console.error('IG 열쇠가 없습니다 (node tools/reels/ig.mjs --열쇠)'); process.exit(1); }
  const 열쇠 = encodeURIComponent(cfg.IG_ACCESS_TOKEN);

  /* 권한 */
  let 권한 = 빠르게 && 상태.DM권한 ? ['instagram_manage_messages'] : [];
  if (!권한.length && cfg.META_APP_ID && cfg.META_APP_SECRET) {
    const d = (await 그래프(cfg, `/debug_token?input_token=${열쇠}&access_token=${encodeURIComponent(cfg.META_APP_ID + '|' + cfg.META_APP_SECRET)}`)).data || {};
    권한 = d.scopes || [];
  }
  const DM권한 = 권한.includes('instagram_manage_messages');
  상태.DM권한 = DM권한;
  if (!빠르게) console.log(DM권한 ? '○ instagram_manage_messages 있음' : '✗ instagram_manage_messages 없음 — 토큰을 다시 받아야 보낼 수 있습니다 (지금은 찾기만)');

  const 나 = 빠르게 && 상태.나 ? { username: 상태.나 } : await 그래프(cfg, `/${cfg.IG_USER_ID}?fields=username&access_token=${열쇠}`);
  상태.나 = 나.username;
  const 기록 = fs.existsSync(기록파일) ? JSON.parse(fs.readFileSync(기록파일, 'utf8')) : {};
  const 공고들 = 게시물공고();
  const 이제 = Date.now();

  const 게시물 = (await 다받기(cfg, `/${cfg.IG_USER_ID}/media?fields=id,timestamp,permalink,comments_count&limit=25&access_token=${열쇠}`))
    .filter((g) => 이제 - Date.parse(g.timestamp) < 창);
  if (!빠르게) console.log(`최근 7일 게시물 ${게시물.length}개`);
  const 표 = 단어들();
  if (!빠르게) for (const g of 게시물) console.log(`  게시물 ${g.id} · ${g.timestamp} · ${g.permalink} · 단어 ${게시물단어(표[짧은주소(g.permalink)]?.단어 || null, 공고들.has(String(g.id))) ? '「' + 게시물단어(표[짧은주소(g.permalink)]?.단어 || null, 공고들.has(String(g.id))) + '」' : '없음(안 봄)'}`);

  const 할것 = [];
  for (const g of 게시물) {
    const 단어 = 게시물단어(표[짧은주소(g.permalink)]?.단어 || null, 공고들.has(String(g.id)));
    if (!단어) continue;                                         /* 단어를 안 정한 게시물은 안 봅니다 */
    if (빠르게 && 상태.댓글수[g.id] === (g.comments_count ?? -1)) continue;   /* 빠르게 — 댓글 수가 그대로면 안 읽습니다 */
    const 댓글 = await 다받기(cfg, `/${g.id}/comments?fields=id,text,username,timestamp&limit=50&access_token=${열쇠}`);
    /* 진단 — 댓글 원문(앞 40자) · 받은 칸 이름 (지침 2절) */
    if (!빠르게) console.log(`  ${g.permalink} 댓글 ${댓글.length}개`);
    if (!빠르게) for (const c of 댓글) console.log(`    · ${c.id} · 칸 ${Object.keys(c).join(',')} · @${c.username ?? '?'} · ${c.timestamp} · 「${String(c.text ?? '').slice(0, 40)}」`);
    for (const c of 댓글) {
      if (c.username === 나.username) continue;                 /* 우리가 단 첫 댓글 */
      if (!단어맞나(c.text, 단어)) continue;
      if (이제 - Date.parse(c.timestamp) >= 창) continue;          /* 7일 지나면 못 보냅니다 */
      const 전 = 기록[c.id];
      if (전?.결과 === '보냄' || (전?.시도 || 0) >= 2) continue;
      할것.push({ 게시물: g, 댓글: c, 공고: 공고들.get(String(g.id)) || null });
    }
  }
  const 상태적기 = (다시볼 = new Set()) => {
    for (const g of 게시물) if (!다시볼.has(g.id)) 상태.댓글수[g.id] = g.comments_count ?? -1;
    for (const k of Object.keys(상태.댓글수)) if (!게시물.some((g) => g.id === k)) delete 상태.댓글수[k];
    fs.mkdirSync(path.dirname(상태파일), { recursive: true }); fs.writeFileSync(상태파일, JSON.stringify(상태));
  };
  if (빠르게 && !할것.length) { if (실행) 상태적기(); return; }      /* 할 일 없으면 조용히 */
  console.log(`${빠르게 ? new Date().toISOString() + ' ' : ''}보낼 댓글 ${할것.length}개`);
  for (const x of 할것) console.log(`  · @${x.댓글.username} 「${String(x.댓글.text).slice(0, 40)}」 · ${x.게시물.permalink} · ${x.공고 ? '공고 ' + x.공고 : '첫 화면'} · 댓글 단 때 ${x.댓글.timestamp} · 찾기까지 ${Math.round((Date.now() - Date.parse(x.댓글.timestamp)) / 1000)}초`);
  if (!실행) { console.log('\n마른 실행 — 보내지 않았습니다. --실행 을 붙이면 보냅니다'); return; }
  if (!DM권한) { console.error('✗ 권한이 없어 보내지 않습니다'); process.exit(1); }

  const 못보냄 = new Set();
  for (const x of 할것) {
    let 결과 = '실패', 응답 = '', 꼴 = null;
    /* 꼴 두 가지(단추 → 글) × 길 두 가지 — 명세 원문을 못 봐서 IG 계정 쪽을 먼저, 안 되면 페이지 쪽(/me = 페이지 토큰의 페이지) */
    보내기: for (const [이름, 말] of [['단추', 보낼단추(x.공고)], ['글', { text: 보낼글(x.공고) }]]) {
      const 몸 = () => new URLSearchParams({ recipient: JSON.stringify({ comment_id: x.댓글.id }), message: JSON.stringify(말), access_token: cfg.IG_ACCESS_TOKEN });
      for (const 길 of [`/${cfg.IG_USER_ID}/messages`, '/me/messages']) {
        try { const r = await 그래프(cfg, 길, { method: 'POST', body: 몸() }); 결과 = '보냄'; 꼴 = 이름; 응답 = `${이름} · ${길} · ${JSON.stringify(r).slice(0, 200)}`; break 보내기; }
        catch (e) { 응답 = `${이름} · ${길} · ${String(e.message || e).slice(0, 300)}`; console.log(`    (${이름} 꼴 안 됨 — ${응답.slice(0, 200)})`); }
      }
    }
    /* DM 이 나간 댓글에만 공개 답글 — 실패해도 DM 은 이미 갔습니다 */
    let 답글ID = null;
    if (결과 === '보냄') {
      try { 답글ID = (await 그래프(cfg, `/${x.댓글.id}/replies`, { method: 'POST', body: new URLSearchParams({ message: 답글고르기(x.댓글.id), access_token: cfg.IG_ACCESS_TOKEN }) })).id; }
      catch (e) { console.error(`  ✗ 답글을 못 달았습니다 — ${String(e.message || e).slice(0, 200)}`); }
    }
    기록[x.댓글.id] = { 때: new Date().toISOString(), 결과, 꼴, 답글ID, 시도: (기록[x.댓글.id]?.시도 || 0) + 1, 게시물: x.게시물.id, 받는이: x.댓글.username, 공고: x.공고, 응답 };
    console.log(`${결과 === '보냄' ? '  ○' : '  ✗'} @${x.댓글.username} — ${결과} · ${응답}`);
    fs.mkdirSync(path.dirname(기록파일), { recursive: true });
    fs.writeFileSync(기록파일, JSON.stringify(기록, null, 2));
    if (결과 !== '보냄') 못보냄.add(x.게시물.id);
  }
  /* 못 보낸 게시물만 다음 바퀴에 다시 읽습니다. 보낸 게시물은 답글로 댓글 수가 늘어 한 번 더 읽히고(기록에 있어 다시 안 보냄) 조용해집니다 */
  상태적기(못보냄);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--자기점검')) 자기점검();
  else if (process.argv.includes('--단어')) 단어정하기();
  else if (process.argv.includes('--단어목록')) console.log(JSON.stringify(단어들(), null, 2));
  else if (process.argv.includes('--빠르게') && process.argv.includes('--실행')) {
    /* 크론은 1분에 한 번이라 댓글 뒤 40~55초가 걸렸습니다 (2026-11-28 로그 — 42초 · 53초 · 42초 · 세중님 「바로 디엠 오게」).
       그 1분 안에서 8초마다 다시 봅니다 (0 · 8 · … · 48초 = 일곱 번 · 다음 크론과 안 겹치게 55초 안에 끝냄 — 겹쳐도 flock 이 막음).
       한 번 보는 데 호출 1번(게시물 목록)입니다. 호출이 막히면(한도·오류) 그 분은 거기서 멈춥니다 */
    const 시작 = Date.now();
    for (let n = 0; n < 7; n++) {
      const 기다림 = 시작 + n * 8000 - Date.now();
      if (기다림 > 0) await new Promise((r) => setTimeout(r, 기다림));
      if (Date.now() - 시작 > 52000) break;
      try { await 돌기(); }
      catch (e) { console.error(`${new Date().toISOString()} ✗ 이 분은 여기서 멈춤 — ${String(e.message || e).slice(0, 200)}`); break; }
    }
  } else await 돌기();
}
