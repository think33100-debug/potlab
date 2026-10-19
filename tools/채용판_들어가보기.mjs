/* 기관 홈페이지에서 **채용 게시판으로 들어가** 공고 목록인지 봅니다 (2026-10-19)
 *
 *   node tools/채용판_들어가보기.mjs <홈페이지> [<홈페이지> …]
 *   node tools/채용판_들어가보기.mjs --모름14            ← 그 14곳을 한꺼번에
 *   node tools/채용판_들어가보기.mjs --검사              ← 자기점검만
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * 화성유일병원에서 꼴 가리기가 「국가/**채용검진** 안내」를 「채용 링크」로
 * 잡았습니다. **링크 글자만 보고 짐작한 것**입니다 (세중님 지적).
 * 그래서 이 도구는 **링크를 따라 들어가** 그 쪽이 **공고 목록인지** 봅니다 —
 *   · 줄(<tr>·<li>)이 3개 이상
 *   · 날짜 꼴이 2개 이상
 *   · 글로 가는 링크가 **같은 꼴로 여러 개** (글번호 자리만 다른)
 * 셋을 다 지나야 「공고 목록」입니다. 하나라도 못 지나면 **까닭을 적습니다.**
 *
 * ★ 주소를 짐작하지 않습니다 — 쪽에 있는 링크만 따라갑니다 (지침 3절).
 * ★ robots.txt 전면 금지면 멈춥니다.
 * ★ 아무것도 바꾸지 않습니다.
 */
const UA = 'Mozilla/5.0 (compatible; potjob/1.0)';
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

/* 채용말 — 「검진」이 붙은 것은 **빼야 합니다** (화성유일 교훈) */
export const 채용말 = /채용|인재|구인|입사|모집|리크루트|recruit|job|employ/i;
export const 채용말아닌것 = /검진|검사|진료|예약|증명|건강|실습|수련\s*의|전공의|교육\s*신청/;

/* ── 이 쪽이 공고 목록인가 ──────────────────────────────────────── */
export function 공고목록인가(html) {
  const 줄수 = Math.max((html.match(/<tr[\s>]/gi) || []).length, (html.match(/<li[\s>]/gi) || []).length);
  const 날짜 = [...new Set([...html.matchAll(/20\d\d\s?[.\-/]\s?\d{1,2}\s?[.\-/]\s?\d{1,2}/g)].map((m) => m[0]))];
  /* 글로 가는 링크 — 숫자를 N 으로 바꿔 **같은 꼴이 몇 개**인지 셉니다 */
  const 링크 = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)].map((m) => m[1])
    .filter((h) => /\d/.test(h) && !/^(#|javascript|mailto|tel)/i.test(h));
  const 꼴셈 = new Map();
  for (const h of 링크) {
    const k = h.replace(/\d+/g, 'N');
    꼴셈.set(k, (꼴셈.get(k) || 0) + 1);
  }
  const [글꼴, 글수] = [...꼴셈].sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const 왜 = [];
  if (줄수 < 3) 왜.push('줄(<tr>·<li>)이 ' + 줄수 + '개');
  if (날짜.length < 2) 왜.push('날짜 꼴이 ' + 날짜.length + '개');
  if (글수 < 3) 왜.push('같은 꼴 글 링크가 ' + 글수 + '개');
  return { 맞나: 왜.length === 0, 왜: 왜.join(' · '), 줄수, 날짜: 날짜.slice(0, 3), 글꼴, 글수 };
}

/* ── 쪽 받기 ────────────────────────────────────────────────────── */
async function 받기(u) {
  const r = await fetch(u, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko' },
    redirect: 'follow', signal: AbortSignal.timeout(20000),
  });
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || '';
  const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
    || (buf.subarray(0, 3000).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  let 글; try { 글 = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { 글 = buf.toString('utf8'); }
  return { code: r.status, 끝주소: r.url || u, 글, 바이트: buf.length };
}

/* 쪽에서 채용 쪽으로 보이는 링크를 **글자와 주소 둘 다** 보고 고릅니다 */
export function 채용링크들(html, 밑바탕) {
  const 나온것 = [];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) {
    const h = m[1]; const t = m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (/^(#|javascript|mailto|tel)/i.test(h)) continue;
    const 어디 = 채용말.test(t) ? '글자' : (채용말.test(h) ? '주소' : null);
    if (!어디) continue;
    if (채용말아닌것.test(t)) { 나온것.push({ h, t, 어디, 뺌: '검진·진료 말이 섞였습니다' }); continue; }
    let u; try { u = new URL(h, 밑바탕).href; } catch { continue; }
    나온것.push({ h: u, t, 어디 });
  }
  /* 같은 주소는 한 번만 */
  const 본것 = new Set(); const out = [];
  for (const x of 나온것) { if (본것.has(x.h)) continue; 본것.add(x.h); out.push(x); }
  return out;
}

/* ── 자기점검 ──────────────────────────────────────────────────── */
function 검사() {
  let n = 0; const 재다 = (조건, 글) => { n++; if (!조건) throw new Error('자기점검 ' + n + ' ' + 글); };
  /* ① 진짜 게시판 꼴 */
  const 판 = '<table>' + [1, 2, 3, 4].map((i) =>
    '<tr><td><a href="/bbs/board.php?bo_table=recruit&wr_id=' + (100 + i)
    + '">물리치료사 채용 공고</a></td><td>2026-10-0' + i + '</td></tr>').join('') + '</table>';
  재다(공고목록인가(판).맞나, '게시판을 게시판으로 안 봅니다');
  재다(공고목록인가(판).글수 >= 3, '글 링크 셈이 틀립니다');
  /* ② 화성유일 꼴 — 안내 쪽 (줄도 날짜도 없음) */
  재다(!공고목록인가('<div><h2>국가/채용검진 안내</h2><p>검진 절차를 안내합니다.</p></div>').맞나,
    '안내 쪽을 게시판으로 봅니다');
  /* ③ 조은금강 꼴 — 메뉴만 (<tr> 0개) */
  재다(!공고목록인가('<ul><li><a href="/html/?pCode=97">브라우저 안내</a></li></ul>').맞나,
    '메뉴를 게시판으로 봅니다');
  /* ④ 날짜만 있고 글이 없는 쪽 */
  재다(!공고목록인가('<p>2026-10-01 2026-10-02 2026-10-03</p>').맞나, '글 없는 쪽을 게시판으로 봅니다');
  /* ⑤ 줄은 많은데 글 링크가 하나뿐 (한 건 공고 상세) */
  const 상세 = '<table>' + [1, 2, 3, 4].map(() => '<tr><td>항목</td><td>2026-10-01</td></tr>').join('')
    + '</table><a href="/view.php?id=7">목록</a>';
  재다(!공고목록인가(상세).맞나, '상세 한 건을 목록으로 봅니다');
  /* ⑥ 채용 링크 고르기 — 「채용검진」은 뺍니다 */
  const ls = 채용링크들('<a href="/health/national.php">국가/채용검진 안내</a>'
    + '<a href="/bbs/board.php?bo_table=recruit">인재채용</a>', 'http://x.kr/');
  재다(ls.find((x) => /national/.test(x.h)).뺌, '「채용검진」을 안 뺍니다');
  재다(ls.find((x) => /recruit/.test(x.h)) && !ls.find((x) => /recruit/.test(x.h)).뺌, '인재채용을 뺍니다');
  /* ⑦ 주소만 채용말인 것도 잡습니다 */
  재다(채용링크들('<a href="/recruit/list.do">공지사항</a>', 'http://x.kr/')[0].어디 === '주소',
    '주소에 든 채용말을 못 봅니다');
  /* ⑧ 상대 주소를 온주소로 */
  재다(채용링크들('<a href="sub/recruit.php">채용</a>', 'http://x.kr/a/')[0].h === 'http://x.kr/a/sub/recruit.php',
    '상대 주소를 못 폅니다');
  /* ⑨ javascript: 는 버립니다 */
  재다(채용링크들('<a href="javascript:recruit()">채용</a>', 'http://x.kr/').length === 0, 'javascript 를 씁니다');
  /* ⑩ 「전공의 모집」은 우리 쪽이 아닙니다 */
  재다(채용링크들('<a href="/x/1">2027년도 전공의 모집</a>', 'http://x.kr/')[0].뺌, '전공의 모집을 안 뺍니다');
  console.log('자기점검 ' + n + '가지 통과');
}

/* ── 돌리기 ────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
검사();
if (argv.includes('--검사')) process.exit(0);

/* ★ 이 14곳은 `사각지대_꼴가리기.mjs` 가 「모름」으로 낸 것을 그대로 옮긴 것입니다
 *   (주소는 hira_org·기관주소 표에서 나온 것 — 짐작한 것이 하나도 없습니다) */
const 모름14 = [
  ['강북삼성병원', 'https://www.kbsmc.co.kr/'],
  ['강남을지대학교병원', 'https://gangnam.eulji.or.kr/'],
  ['부천세종병원', 'http://www.sejongh.co.kr/'],
  ['서울산보람병원', 'http://www.imc-boram.co.kr/'],
  ['서울성심병원', 'http://www.sshosp.co.kr/main/main.html'],
  ['세종여주병원', 'http://xn--om3bn4fhxed0am6dpua.com/'],
  ['씨엠병원', 'https://www.cmhospital.co.kr/'],
  ['우리들병원', 'https://www.wooridul.co.kr/'],
  ['의료법인 박애의료재단 박애병원', 'http://www.bagaehospital.com/'],
  ['의료법인갑을의료재단 갑을장유병원', 'https://www.kbhospital.com/'],
  ['의료법인삼백의료재단상주성모병원', 'http://www.ssmh.co.kr/'],
  ['의료법인영성의료재단 고흥종합병원', 'https://kgh.kr/'],
  ['재단법인일신기독교선교회 일신기독병원', 'http://www.ilsin.or.kr/'],
  ['하남성심병원', 'https://www.sungshim.co.kr/'],
];
const 볼것 = argv.includes('--모름14') ? 모름14
  : argv.filter((a) => !a.startsWith('--')).map((u) => [u, u]);
if (!볼것.length) { console.log('볼 주소를 주십시오 (또는 --모름14)'); process.exit(0); }

const 결과 = [];
for (const [이름, 뿌리] of 볼것) {
  console.log('\n════════ ' + 이름 + '   ' + 뿌리);
  let 기원; try { 기원 = new URL(뿌리).origin; } catch { console.log('  ✗ 주소 꼴이 아닙니다'); continue; }
  try {
    const rb = await 받기(기원 + '/robots.txt');
    if (/User-agent:\s*\*[^\n]*\n(?:[^\n]*\n)*?\s*Disallow:\s*\/\s*(\n|$)/i.test(rb.글)) {
      console.log('  robots **전면 금지** — 멈춥니다');
      결과.push({ 이름, 판정: 'robots 전면 금지' }); continue;
    }
  } catch { /* 없으면 넘어갑니다 */ }

  let r;
  try { r = await 받기(뿌리); } catch (e) {
    console.log('  ✗ ' + String(e.message).slice(0, 60));
    결과.push({ 이름, 판정: '못 받음 — ' + String(e.message).slice(0, 40) }); continue;
  }
  console.log('  뿌리 HTTP ' + r.code + ' · ' + r.바이트 + '바이트');
  const 후보 = 채용링크들(r.글, r.끝주소);
  const 쓸것 = 후보.filter((x) => !x.뺌).slice(0, 5);
  console.log('  채용말 링크 ' + 후보.length + '개 (뺀 것 ' + 후보.filter((x) => x.뺌).length + '개)');
  for (const x of 후보.filter((x) => x.뺌).slice(0, 3)) {
    console.log('     ✗ 뺌 「' + x.t.slice(0, 26) + '」 — ' + x.뺌);
  }
  if (!쓸것.length) {
    console.log('  → **채용 링크가 없습니다**');
    결과.push({ 이름, 판정: '뿌리에 채용 링크 없음' }); continue;
  }

  let 찾음 = null;
  for (const x of 쓸것) {
    let p;
    try { p = await 받기(x.h); } catch (e) {
      console.log('     ✗ 「' + x.t.slice(0, 20) + '」 못 받음 ' + String(e.message).slice(0, 30)); continue;
    }
    const j = 공고목록인가(p.글);
    console.log('     ' + (j.맞나 ? '★ 공고 목록' : '· 아님') + ' 「' + x.t.slice(0, 22) + '」 ' + x.h.slice(0, 58));
    console.log('        줄 ' + j.줄수 + ' · 날짜 ' + (j.날짜.join(',') || '없음')
      + ' · 글꼴 ' + String(j.글꼴).slice(0, 44) + ' ×' + j.글수 + (j.맞나 ? '' : '  ← ' + j.왜));
    if (j.맞나 && !찾음) {
      찾음 = { 주소: p.끝주소, j };
      const 줄 = p.글.match(/<tr[\s>][\s\S]{40,900}?<\/tr>/i) || p.글.match(/<li[\s>][\s\S]{40,900}?<\/li>/i);
      if (줄) console.log('        ── 줄 하나 원문 ──\n        ' + 줄[0].replace(/\s+/g, ' ').slice(0, 520));
      const 우리 = [...p.글.matchAll(/>([^<]{0,60}?(?:물리|작업|도수)\s*치료[^<]{0,40})</g)]
        .map((m) => m[1].trim()).slice(0, 3);
      console.log('        ★ 우리 직군 글 — ' + (우리.length ? 우리.join(' · ') : '지금은 없음'));
    }
    await 자고(1200);
  }
  결과.push({ 이름, 판정: 찾음 ? '공고 목록 찾음' : '채용 링크는 있지만 공고 목록이 아님', 주소: 찾음?.주소 });
  await 자고(600);
}

console.log('\n── 한눈에 ──');
for (const x of 결과) {
  console.log('  ' + x.이름.slice(0, 26).padEnd(28) + x.판정 + (x.주소 ? '  ' + x.주소.slice(0, 60) : ''));
}
console.log('\n아무것도 바꾸지 않았습니다.');
