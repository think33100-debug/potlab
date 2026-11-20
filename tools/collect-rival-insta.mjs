/* 경쟁 인스타 계정 관찰 — 공개 게시물의 **첫 줄만** 읽어 「이 기관 공고를 우리도 갖고 있나」 신호로 씁니다 (2026-11-21 세중님).
 *
 *   node tools/collect-rival-insta.mjs --dry   담지 않고 보기만 (처음에 이걸로 되는지 봅니다)
 *   node tools/collect-rival-insta.mjs         담고 견줍니다
 *   선택  --계정 pt__review (기본) · --몇개 12
 *
 * ── 읽는 길 ──────────────────────────────────────────────────
 * 인스타 **공식 창구**(Graph API 의 business_discovery)만 씁니다. 우리 계정의 열쇠로 「다른 비즈니스·크리에이터 계정의
 * 공개 게시물」을 묻는 기능입니다. 로그인해서 화면을 넘기거나 긁지 않습니다.
 * 상대 계정이 개인 계정이거나 우리 열쇠에 권한이 없으면 창구가 거절합니다 — 그때는 까닭을 찍고 끝냅니다(다른 길로 돌아가지 않음).
 *
 * ── 지키는 선 (tools/collect-rival.mjs 와 같음) ───────────────
 * · 한 번 돌 때 요청 1번 · 최근 게시물 12개까지
 * · 담는 것은 글번호 · 첫 줄(80자) · 어림한 기관 이름 · 링크뿐. 본문·사진은 안 담습니다
 * · **관리자만** 봅니다(rival_post). 회원 화면에 안 쓰고, 그 글을 우리 공고로 옮겨 싣지 않습니다
 * · 쓰는 것은 「이 기관을 우리도 봐야겠다」는 신호뿐 — 공고는 그 기관 홈페이지에서 가져옵니다
 */
import { 받아보기 } from './쪽나눠받기.mjs';
import { env, 인스타되나 } from './reels/ig.mjs';

const 인수 = (이름, 기본 = null) => { const i = process.argv.indexOf('--' + 이름); return i > 0 ? process.argv[i + 1] : 기본; };
const dry = process.argv.includes('--dry');
const 계정 = String(인수('계정', 'pt__review')).replace(/[^A-Za-z0-9._]/g, '');   /* 밑줄 두 개 — pt_review(밑줄 하나)는 다른 비공개 계정입니다 */
const 몇개 = Math.min(Math.max(Number(인수('몇개', 12)) || 12, 1), 25);
const 경쟁사 = 계정 + '(인스타)';
const SOURCE = 'HS3';                 /* 열쇠는 서버 전용 값을 함께 씁니다 (collect-rival.mjs 와 같음) */
const cfg = env();
const 가림 = (s) => [cfg.IG_ACCESS_TOKEN, cfg.META_APP_SECRET, cfg.SUPABASE_SERVICE_KEY, cfg.COLLECT_KEY_HS3].filter(Boolean)
  .reduce((a, k) => a.split(k).join('‹열쇠›'), String(s));

if (!인스타되나(cfg)) { console.error('IG_USER_ID · IG_ACCESS_TOKEN 이 없습니다 — 아무것도 안 했습니다'); process.exit(1); }
if (!계정) { console.error('--계정 이 비었습니다'); process.exit(2); }

async function rpc(fn, body) {
  const k = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY || cfg.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST', headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(fn + ' HTTP ' + r.status + ' · ' + 가림(t).slice(0, 250));
  try { return JSON.parse(t); } catch { return t; }
}

/* 첫 줄에서 기관 이름을 어림합니다 (collect-rival.mjs 의 기관어림과 같은 꼴 — 틀릴 수 있음) */
function 기관어림(글) {
  const m = String(글 || '').match(/([가-힣A-Za-z0-9()·\s]{2,24}?(?:대학교병원|대학병원|의료원|병원|의원|센터|공단|재단|개발원|보건소))/);
  return m ? m[1].replace(/^[\s·\-–—[\](){}#]+/, '').trim() : '';
}

console.log('경쟁 인스타 관찰 (' + 계정 + ') · ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + (dry ? ' · --dry' : ''));

/* ── ① 공식 창구로 한 번 묻기 ── */
const 버전 = cfg.IG_GRAPH_VERSION || 'v23.0';
const 칸 = `business_discovery.username(${계정}){username,media_count,media.limit(${몇개}){id,caption,permalink,timestamp,media_type}}`;
const r = await fetch(`https://graph.facebook.com/${버전}/${encodeURIComponent(cfg.IG_USER_ID)}?fields=${encodeURIComponent(칸)}&access_token=${encodeURIComponent(cfg.IG_ACCESS_TOKEN)}`);
const 글 = await r.text();
if (!r.ok) {
  console.error('① 창구가 거절했습니다 — HTTP ' + r.status + ' · ' + 가림(글).replace(/\s+/g, ' ').slice(0, 400));
  console.error('   (상대가 개인 계정이거나 우리 열쇠에 이 기능 권한이 없을 때 납니다. 다른 길로 돌아가지 않습니다)');
  process.exit(1);
}
let 답;
try { 답 = JSON.parse(글); } catch { console.error('① 답이 JSON 이 아닙니다 — ' + 가림(글).slice(0, 200)); process.exit(1); }
const 게시물 = 답?.business_discovery?.media?.data || [];
console.log('① 받은 게시물 ' + 게시물.length + '개 (계정 게시물 수 ' + (답?.business_discovery?.media_count ?? '?') + ')');

/* ── ② 채용 글만 고르기 — 첫 줄 + 기관 이름이 어림되는 것 ── */
const 볼것 = [];
for (const m of 게시물) {
  const 캡션 = String(m.caption || '');
  if (!/(채용|모집|구인|공고|선발)/.test(캡션) || !/(물리치료|작업치료|치료사)/.test(캡션)) continue;
  const 첫줄 = (캡션.split(/\r?\n/).map((s) => s.trim()).find((s) => s) || '').replace(/\s+/g, ' ').slice(0, 80);
  /* 공고 글은 첫 줄이 「[지역] ○○병원 … 채용공고(~마감)」 꼴입니다. 첫 줄에 채용·모집 말과 기관 이름이 **둘 다** 있어야 담습니다 —
     본문에서 기관을 찾으면 「채용공고, 꼼꼼하게 확인하고 계신가요?」 같은 안내 글이 섞입니다 (2026-11-21 시험) */
  if (!/(채용|모집)/.test(첫줄) || /[?？]\s*\S{0,3}$/.test(첫줄)) continue;
  const 기관 = 기관어림(첫줄.replace(/^\[[^\]]*\]\s*/, ''));
  if (!기관) continue;
  const 번호 = (String(m.permalink || '').match(/\/(?:p|reel|tv)\/([^/?#]+)/) || [])[1] || String(m.id);
  볼것.push({ 경쟁사, 글번호: 번호, 제목: 첫줄 || 기관 + ' 채용', 기관분류: '인스타', 기관명: 기관, 지역: '', 고용형태: '', 링크: m.permalink || '', 때: m.timestamp });
}
console.log('② 채용 글로 보이는 것 ' + 볼것.length + '개 (나머지 ' + (게시물.length - 볼것.length) + '개는 담지 않습니다)');
볼것.forEach((x) => console.log('     ' + String(x.때 || '').slice(0, 10) + '  ' + x.기관명.slice(0, 20).padEnd(22) + x.제목.slice(0, 44)));

if (dry) { console.log('\n--dry 라 담지 않았습니다'); process.exit(0); }
if (!볼것.length) { console.log('담을 것이 없습니다'); process.exit(0); }

/* ── ③ 담기 · ④ 견주기 — 땡큐오티와 같은 표·같은 창구 (rival_post · rival_match) ── */
const 줄 = 볼것.map(({ 때, ...x }) => x);
const 담음 = await rpc('rival_put', { p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE, p_rows: 줄 });
console.log('③ 담음 — ' + (typeof 담음 === 'object' ? Object.entries(담음).map(([k, v]) => k + ' ' + v).join(' · ') : String(담음).slice(0, 120)));
const 견줌 = await rpc('rival_match_go', { p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE });
console.log('④ 견줌 — ' + (typeof 견줌 === 'object' ? Object.entries(견줌).map(([k, v]) => k + ' ' + v).join(' · ') : String(견줌).slice(0, 120)));
