/* 보건소 → **구청 고시공고**가 어떤 틀로 돌아가나 — 읽기 전용 조사 (2026-10-30 세중님 B)
 *
 *   node tools/collect-health/고시공고틀_1030.mjs            표본 10곳
 *   node tools/collect-health/고시공고틀_1030.mjs --자기점검
 *   node tools/collect-health/고시공고틀_1030.mjs --곳 노원구보건소
 *
 * ── 이 도구가 하는 일 ────────────────────────────────────────
 *   ① 청·보건소 첫 화면을 **한 번** 엽니다 (robots 먼저 · tools/긁기/공통.mjs 의 받기())
 *   ② 그 쪽에서 「고시공고」 쪽으로 가는 링크를 **찾습니다** (주소를 짐작하지 않습니다)
 *   ③ 그 목록 쪽을 **한 번** 엽니다 → 주소 꼴과 **틀 지문**을 적습니다
 *   한 곳 요청 = robots(집마다 한 번) + 첫 화면 1 + 목록 1 → **상한 3번** (세중님 B-2)
 *
 * ── 안 하는 일 ───────────────────────────────────────────────
 *   · 공고를 **담지 않습니다** (DB 를 아예 안 봅니다 · 열쇠도 안 읽습니다)
 *   · 쪽을 넘기지 않습니다 (목록 첫 쪽만)
 *   · robots 가 막으면 **그 자리에서 멈춥니다** (우회 없음)
 *   · 수집기·크론에 넣지 않습니다 — 이 폴더는 `collect-health` 갈래에만 있습니다
 *
 * ── 표본 10곳은 어디서 왔나 (짐작 아님) ──────────────────────
 *   운영 DB `기관` 표의 **홈페이지** 칸입니다 (2026-10-30 읽기 전용으로 뽑음 ·
 *   보건 기관줄 76 가운데 홈페이지가 있는 곳 **43**곳에서 골랐습니다).
 *   섞음은 세중님이 정한 **서울 구 3 · 광역시 구 3 · 시 2 · 군 2** 입니다.
 *   ★ 광역시 구를 **인력 순으로 못 골랐습니다** — `심평원인원월별` 표(534곳 · 2026-10)에
 *     보건소 줄이 없습니다(전부 병원). 인력은 API 를 직접 불러야 합니다(10/11 때처럼).
 *     그래서 지역이 겹치지 않게(부산·대구·인천) 골랐고, **인력 순 다시 고르기는 11/2** 입니다.
 */
import { 받기, 자고 } from '../긁기/공통.mjs';

const argv = process.argv.slice(2);

/* ── 표본 10곳 — 주소는 `기관` 표 홈페이지 칸 그대로입니다 ── */
export const 곳들 = [
  { 이름: '노원구보건소', 갈래: '서울 구', 시도: '서울', 시군구: '노원구', 집: 'https://www.nowon.kr/www/index.do' },
  { 이름: '영등포구보건소', 갈래: '서울 구', 시도: '서울', 시군구: '영등포구', 집: 'https://www.ydp.go.kr/www/index.do' },
  { 이름: '은평구보건소', 갈래: '서울 구', 시도: '서울', 시군구: '은평구', 집: 'https://www.ep.go.kr/health/index.do' },
  { 이름: '부산광역시해운대구보건소', 갈래: '광역시 구', 시도: '부산', 시군구: '해운대구', 집: 'http://www.haeundae.go.kr/health/index.do' },
  { 이름: '대구광역시달서구보건소', 갈래: '광역시 구', 시도: '대구', 시군구: '달서구', 집: 'https://www.dalseo.daegu.kr/healthcenter/index.do' },
  { 이름: '남동구보건소', 갈래: '광역시 구', 시도: '인천', 시군구: '남동구', 집: 'https://www.namdong.go.kr/' },
  { 이름: '아산시보건소', 갈래: '시', 시도: '충남', 시군구: '아산시', 집: 'https://www.asan.go.kr/health/main/' },
  { 이름: '목포시보건소', 갈래: '시', 시도: '전남', 시군구: '목포시', 집: 'https://health.mokpo.go.kr/www' },
  { 이름: '옥천군보건소', 갈래: '군', 시도: '충북', 시군구: '옥천군', 집: 'https://www.oc.go.kr/health/index.do' },
  { 이름: '해남군보건소', 갈래: '군', 시도: '전남', 시군구: '해남군', 집: 'http://www.haenam.go.kr/health/index.9is?contentUid=18e3368f6797832401681169c3cf5d94' },
];

/** 링크 글자가 고시공고 자리를 가리키나 — 센 순서대로 점수를 줍니다 */
export function 링크점수(글자) {
  const t = String(글자 || '').replace(/\s+/g, '');
  if (!t || t.length > 30) return 0;
  if (/고시.{0,2}공고|공고.{0,2}고시/.test(t)) return 5;   /* 「고시공고」·「공고/고시」 */
  if (/^고시$|고시문|고시$/.test(t)) return 4;
  if (/채용공고|채용정보|구인/.test(t)) return 3;
  if (/^공고$|공고문|공고목록|알림마당|새소식|공지사항/.test(t)) return 2;
  return 0;
}

/** HTML 에서 <a href> 와 글자를 떼어 냅니다 (쪽 원문 그대로) */
export function 링크들(html, 밑주소) {
  const 낸것 = [];
  for (const m of String(html || '').matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const 글자 = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    let 주소;
    /* ★ 쪽 원문의 `&amp;` 를 풀어야 질의 칸이 살아 있습니다 (지침 5절) */
    try { 주소 = new URL(m[1].replace(/&amp;/g, '&'), 밑주소).href; } catch { continue; }
    if (!/^https?:/.test(주소)) continue;
    낸것.push({ 글자, 주소, 점수: 링크점수(글자) });
  }
  return 낸것;
}

/** 주소에서 **틀 지문**을 만듭니다 — 장사 이름을 지어내지 않고 **보이는 표식**만 적습니다 */
export function 틀지문(주소) {
  let U;
  try { U = new URL(주소); } catch { return { 지문: '(주소 꼴 아님)', 표식: [], 칸: [] }; }
  /* `;jsessionid=…` 는 쪽마다 바뀌는 값이라 떼어 냅니다 (틀이 아닙니다) */
  const 길 = U.pathname.replace(/;jsessionid=[^/?]*/i, '');
  const 칸 = [...U.searchParams.keys()];
  const 표식 = [];
  if (/\/emwp\/|eminwon|jsp\/ofr/i.test(주소)) 표식.push('eminwon(새올)');
  if (/BD_selectBbsList\.do|q_bbsCode/i.test(주소)) 표식.push('BD_selectBbsList.do');
  if (/\/bbs\/board\.do/i.test(주소)) 표식.push('bbs/board.do');
  if (/selectBbsNttList\.do/i.test(주소)) 표식.push('selectBbsNttList.do');
  if (/\.9is\b/i.test(길)) 표식.push('.9is');
  if (/\/board\/list\.(do|9is|jsp|php)\b/i.test(길)) 표식.push('board/list');
  if (/gosi|notice|announce|notification/i.test(길)) 표식.push('길에 gosi/notice');
  if (/\.do\b/i.test(길)) 표식.push('.do');
  if (/\.php\b/i.test(길)) 표식.push('.php');
  if (/\.jsp\b/i.test(길)) 표식.push('.jsp');
  if (/\.asp(x)?\b/i.test(길)) 표식.push('.asp');
  if (/\/kor(\.do|\/)/i.test(길)) 표식.push('/kor');
  /* 꼴 — 숫자·열쇠는 N 으로 눕히고 **마지막 토막**(게시판 프로그램 이름)을 남깁니다 */
  const 꼴 = 길.replace(/\d{2,}/g, 'N');
  const 끝토막 = 꼴.split('/').filter(Boolean).pop() || '/';
  return { 지문: (표식.length ? 표식.join('+') : '표식 없음') + ' | ' + 꼴
    + (칸.length ? ' ?' + 칸.slice(0, 6).join(',') : ''), 표식, 칸, 꼴, 끝토막 };
}

/** 작은 껍데기 쪽이 **스스로 적어 둔 다음 주소**를 찾습니다 (짐작 아님 — 쪽에 적힌 값)
 *  청 뿌리(`https://www.oc.go.kr/`)가 298자 껍데기이고 `/kor.do` 로 보내는 꼴이 흔합니다 */
export function 리다이렉트찾기(html, 밑주소) {
  const h = String(html || '');
  const 후보 = [];
  const meta = h.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"'>\s]+)/i);
  if (meta) 후보.push(meta[1]);
  const loc = h.match(/location(?:\.href|\.replace)?\s*(?:=|\(\s*)\s*["']([^"']+)["']/i);
  if (loc) 후보.push(loc[1]);
  const fr = h.match(/<(?:i?frame)[^>]+src=["']([^"']+)["']/i);
  if (fr) 후보.push(fr[1]);
  const as = [...h.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
  if (as.length === 1) 후보.push(as[0]);
  for (const c of 후보) {
    try { const u = new URL(c.replace(/&amp;/g, '&'), 밑주소); if (/^https?:/.test(u.href)) return u.href; } catch { /* 다음 후보 */ }
  }
  return '';
}

/** 그 쪽이 **글 목록**처럼 보이나 — 글 번호가 든 링크 수로 셉니다 */
export function 목록인가(html, 밑주소) {
  const ls = 링크들(html, 밑주소);
  const 번호링크 = ls.filter((x) => /(\?|&)(?:[a-zA-Z_]*(?:no|No|idx|Idx|seq|Seq|id|Id|nttId|bbsIdx|articleNo|boardSeq))=\d+/.test(x.주소));
  return { 줄: 번호링크.length, 견본: 번호링크.slice(0, 3).map((x) => x.글자.slice(0, 40)) };
}

/* ── 자기점검 ───────────────────────────────────────────────── */
if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => jam(잼, 무엇, 참);
  function jam(a, 무엇, 참) { a.push([무엇, !!참]); }
  보('링크점수 — 고시공고가 가장 높음', 링크점수('고시공고') === 5);
  보('링크점수 — 「공고/고시」도 높음', 링크점수('공고 / 고시') === 5);
  보('링크점수 — 채용공고는 3', 링크점수('채용공고') === 3);
  보('링크점수 — 공지사항은 2', 링크점수('공지사항') === 2);
  보('링크점수 — 입찰공고는 0 아님(공고문 꼴 아님)', 링크점수('입찰') === 0);
  보('링크점수 — 긴 글자는 0', 링크점수('고시공고'.repeat(10)) === 0);
  const h = '<a href="/www/user/bbs/BD_selectBbsList.do?q_bbsCode=1001">고시공고</a>'
    + '<a href="http://x.kr/a?nttId=12345">어떤 글</a>';
  const ls = 링크들(h, 'https://www.nowon.kr/www/index.do');
  보('링크들 — 두 줄', ls.length === 2);
  보('링크들 — 상대 주소를 절대로', ls[0].주소.startsWith('https://www.nowon.kr/www/user/bbs/'));
  보('링크들 — 글자를 떼어 냄', ls[0].글자 === '고시공고');
  const f = 틀지문('https://www.nowon.kr/www/user/bbs/BD_selectBbsList.do?q_bbsCode=1001');
  보('틀지문 — BD_selectBbsList 표식', f.표식.includes('BD_selectBbsList.do'));
  보('틀지문 — 질의 칸 이름', f.칸.includes('q_bbsCode'));
  보('틀지문 — 숫자는 N 으로', 틀지문('https://a.kr/bbs/12345/list.do').꼴 === '/bbs/N/list.do');
  보('리다이렉트찾기 — meta refresh',
    리다이렉트찾기('<meta http-equiv="refresh" content="0;url=/kor.do">', 'https://www.oc.go.kr/') === 'https://www.oc.go.kr/kor.do');
  보('리다이렉트찾기 — location.href',
    리다이렉트찾기('<script>location.href="/main/index.do"</script>', 'https://a.kr/') === 'https://a.kr/main/index.do');
  보('리다이렉트찾기 — 없으면 빈 글', 리다이렉트찾기('<p>가</p>', 'https://a.kr/') === '');
  const m = 목록인가(h, 'https://x.kr');
  보('목록인가 — 번호 링크 하나', m.줄 === 1);
  보('목록인가 — 번호 없는 쪽은 0', 목록인가('<a href="/a">가</a>', 'https://x.kr').줄 === 0);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

/* ── 한 곳 보기 — 요청 **두 번**(첫 화면·목록) + robots(집마다 한 번) ── */
async function 한곳(곳) {
  const 줄 = { ...곳, 첫화면: '', 링크글자: '', 목록주소: '', 지문: '', 표식: [], 목록줄: 0, 까닭: '' };
  /* ★ **청 첫 화면**(뿌리)을 봅니다 — 고시공고는 보건소 하위 쪽이 아니라 청 쪽에 있습니다
     (2026-10-30 첫 바퀴에서 보건소 쪽을 열었더니 「공지사항」만 걸렸습니다) */
  const 뿌리 = new URL(곳.집).origin + '/';
  줄.뿌리 = 뿌리;
  /* ★ 보건소 쪽을 먼저 보고, 「고시공고」(4점 이상)가 없으면 **청 뿌리**를 한 번 더 봅니다.
     청 뿌리가 봇에게 껍데기를 주는 곳이 있어서 둘 다 봐야 합니다 (요청 상한 3번) */
  const 본것 = [];
  let r = await 받기(곳.집);
  본것.push('보건소 ' + (r.됨 ? (r.html || '').length.toLocaleString() + '자' : '✗ ' + r.왜));
  let 밑 = r.주소 || 곳.집;
  let 후보 = r.됨 ? 링크들(r.html, 밑).filter((x) => x.점수 > 0).sort((a, b) => b.점수 - a.점수) : [];
  줄.보건소후보 = 후보.slice(0, 5).map((x) => x.글자 + '(' + x.점수 + ')');
  if (!후보.some((x) => x.점수 >= 4) && 뿌리 !== 곳.집) {
    await 자고(1200);
    const r2 = await 받기(뿌리);
    본것.push('청뿌리 ' + (r2.됨 ? (r2.html || '').length.toLocaleString() + '자' : '✗ ' + r2.왜));
    if (r2.됨) {
      const 후보2 = 링크들(r2.html, r2.주소 || 뿌리).filter((x) => x.점수 > 0).sort((a, b) => b.점수 - a.점수);
      줄.청후보 = 후보2.slice(0, 5).map((x) => x.글자 + '(' + x.점수 + ')');
      if (후보2.some((x) => x.점수 >= 4) || 후보2.length > 후보.length) { 후보 = 후보2; r = r2; 밑 = r2.주소 || 뿌리; }
      if ((r2.html || '').length < 3000) 줄.껍데기 = (r2.html || '').length + '자 (봇에게 껍데기를 줍니다 — 다음 주소도 안 적혀 있습니다)';
    }
  }
  줄.첫화면 = 본것.join(' · ');
  if (!후보.length) { 줄.까닭 = '보건소·청 첫 화면에 고시공고/공고 링크가 없습니다 (짐작하지 않고 멈춤)'; return 줄; }
  if (!r.됨) { 줄.까닭 = '쪽을 못 봤습니다'; return 줄; }
  const 고른것 = 후보[0];
  줄.링크글자 = 고른것.글자 + ' (점수 ' + 고른것.점수 + ' · 후보 ' + 후보.length + '개)';
  줄.목록주소 = 고른것.주소;
  await 자고(1200);
  const r2 = await 받기(고른것.주소);
  if (!r2.됨) { 줄.까닭 = '목록 쪽을 못 봤습니다 — ' + r2.왜; return 줄; }
  /* ★ **열린 뒤 주소**로 지문을 뜹니다 — 메뉴 주소(index.do?menuCd)가 게시판 쪽으로
     넘기는 곳이 있어서, 링크에 적힌 주소로 묶으면 틀이 잘못 갈립니다 */
  줄.최종주소 = r2.주소 || 고른것.주소;
  const f = 틀지문(줄.최종주소);
  줄.지문 = f.지문; 줄.표식 = f.표식;
  const m = 목록인가(r2.html, r2.주소 || 고른것.주소);
  줄.목록줄 = m.줄;
  줄.견본 = m.견본;
  if (!m.줄) 줄.까닭 = '글 번호가 든 링크가 0 — 자바로 그리는 쪽이거나 표 꼴일 수 있습니다';
  return 줄;
}

const 볼곳 = argv.includes('--곳')
  ? 곳들.filter((x) => x.이름.includes(argv[argv.indexOf('--곳') + 1]))
  : 곳들;

console.log('보건소 → 구청 고시공고 **틀 재기** (읽기 전용 · ' + 볼곳.length + '곳)\n');
const 잰것 = [];
for (const 곳 of 볼곳) {
  const 줄 = await 한곳(곳);
  잰것.push(줄);
  console.log('■ ' + 줄.이름 + '  [' + 줄.갈래 + ' · ' + 줄.시도 + ' ' + 줄.시군구 + ']');
  console.log('   본 쪽    ' + (줄.첫화면 || '—'));
  if (줄.보건소후보 && 줄.보건소후보.length) console.log('   보건소 후보 ' + 줄.보건소후보.join(' · '));
  if (줄.청후보 && 줄.청후보.length) console.log('   청 후보  ' + 줄.청후보.join(' · '));
  if (줄.껍데기) console.log('   청 뿌리  ' + 줄.껍데기);
  console.log('   고른 링크 ' + (줄.링크글자 || '—'));
  console.log('   목록 주소 ' + (줄.목록주소 || '—'));
  console.log('   틀 지문  ' + (줄.지문 || '—'));
  console.log('   글 줄 수  ' + 줄.목록줄 + (줄.견본 && 줄.견본.length ? '  견본 — ' + 줄.견본.join(' / ') : ''));
  if (줄.까닭) console.log('   ✗ ' + 줄.까닭);
  console.log('');
  await 자고(1500);
}

/* ── 틀을 묶습니다 — 표식이 같은 것끼리 ── */
const 묶음 = new Map();
for (const 줄 of 잰것) {
  if (!줄.목록주소) continue;
  /* 묶는 열쇠 — **게시판 프로그램 이름(길 끝 토막) + 질의 칸 이름**이 틀을 가립니다.
     표식만으로 묶으면 「표식 없음」 한 덩어리가 돼서 틀이 안 갈립니다 (10/30 첫 바퀴) */
  const f = 틀지문(줄.최종주소 || 줄.목록주소);
  const 열쇠 = f.끝토막 + (f.칸.length ? ' ?' + f.칸.slice(0, 4).join(',') : '');
  if (!묶음.has(열쇠)) 묶음.set(열쇠, []);
  묶음.get(열쇠).push(줄.이름);
}
const 센것 = [...묶음.entries()].sort((a, b) => b[1].length - a[1].length);
console.log('── 틀 묶음 ──');
for (const [열쇠, 곳들2] of 센것) console.log('  ' + 열쇠 + '  —  ' + 곳들2.length + '곳  (' + 곳들2.join(' · ') + ')');
const 본곳 = 잰것.filter((x) => x.목록주소).length;
console.log('\n한 줄 — 틀 **' + 센것.length + '가지** · 가장 큰 틀이 **' + (센것[0] ? 센것[0][1].length : 0)
  + '곳** 덮음 (목록까지 본 곳 ' + 본곳 + '/' + 볼곳.length + ')');
console.log('★ 담지 않았습니다 · DB 를 안 봤습니다 · 쪽을 넘기지 않았습니다');
