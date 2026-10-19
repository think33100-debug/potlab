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

/* ★ **글 하나로 들어가는** 링크인가 — 메뉴와 글을 가르는 자리입니다
 *   (2026-10-19 — 씨엠병원 「채용안내」를 공고 목록으로 잘못 봤습니다.
 *    메뉴 `/cmhospital/sub_N_N.php` 가 **87개** 있어서 「같은 꼴 글 링크」로
 *    세어졌습니다. 메뉴는 숫자가 달라도 글이 아닙니다 — **글번호 표식**을 봅니다) */
export const 글번호표식 = /(view|uid=|wr_id|idx=|seq=|no=\d|nttId|articleNo|bbsIdx|board_?no|document_srl|\/\d{2,}(\.html?)?$)/i;

/* ── 이 쪽이 공고 목록인가 ──────────────────────────────────────── */
export function 공고목록인가(html) {
  const 줄수 = Math.max((html.match(/<tr[\s>]/gi) || []).length, (html.match(/<li[\s>]/gi) || []).length);
  const 날짜 = [...new Set([...html.matchAll(/20\d\d\s?[.\-/]\s?\d{1,2}\s?[.\-/]\s?\d{1,2}/g)].map((m) => m[0]))];
  /* 글로 가는 링크 — **글번호 표식이 있는 것만** 세고, 숫자를 N 으로 바꿔 꼴을 셉니다 */
  const 링크 = [...new Set([...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)].map((m) => m[1]))]
    .filter((h) => !/^(#|javascript|mailto|tel)/i.test(h) && 글번호표식.test(h));
  const 꼴셈 = new Map();
  for (const h of 링크) {
    const k = h.replace(/\d+/g, 'N');
    꼴셈.set(k, (꼴셈.get(k) || 0) + 1);
  }
  const [글꼴, 글수] = [...꼴셈].sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const 왜 = [];
  if (줄수 < 3) 왜.push('줄(<tr>·<li>)이 ' + 줄수 + '개');
  if (날짜.length < 2) 왜.push('날짜 꼴이 ' + 날짜.length + '개');
  if (글수 < 3) 왜.push('글번호가 든 링크가 ' + 글수 + '개 (메뉴는 안 셉니다)');
  return { 맞나: 왜.length === 0, 왜: 왜.join(' · '), 줄수, 날짜: 날짜.slice(0, 3), 글꼴, 글수 };
}

/* ★ 뿌리 쪽이 **빈 껍데기**인 때가 많습니다 (2026-10-19 — 11곳 전부 「채용 링크 0개」가
 *   나와 재는 쪽을 의심했고, 원문을 찍어 보니 이것이었습니다)
 *     ① 자바스크립트로 옮겨 가는 쪽   location.href = "/index.jsp" 한 줄만 있는 218바이트
 *     ② meta refresh
 *   그래서 **한 번 따라갑니다.** 주소를 짐작하는 것이 아니라 쪽에 적힌 것을 씁니다 */
export function 옮겨가는곳(html, 밑바탕) {
  const m = html.match(/http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"']+)["']/i)
    || html.match(/location\s*\.\s*(?:href|replace)\s*[=(]\s*["']([^"']+)["']/i)
    || html.match(/location\s*=\s*["']([^"']+)["']/i);
  if (!m) return null;
  try { const u = new URL(m[1], 밑바탕).href; return u === 밑바탕 ? null : u; } catch { return null; }
}

/* ★ 쪽을 자바스크립트가 그리면(SPA) HTML 에 링크가 하나도 없습니다 — 긁을 수 없습니다 */
export function 자바스크립트쪽인가(html) {
  return (html.match(/<a[\s>]/gi) || []).length === 0
    && /<div\s+id=["'](root|app)["']/i.test(html);
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
  /* ⑪~⑮ 빈 껍데기 쪽 — 강북삼성·씨엠·세종여주가 전부 이 꼴이었습니다 */
  재다(옮겨가는곳('<script> location.href = "/index.jsp"; </script>', 'https://a.kr/') === 'https://a.kr/index.jsp',
    'location.href 를 못 따라갑니다');
  재다(옮겨가는곳("<script>location.href='web/';</script>", 'http://a.kr/') === 'http://a.kr/web/',
    '홑따옴표·상대 주소를 못 따라갑니다');
  재다(옮겨가는곳('<meta http-equiv="refresh" content="0;url=/main/main.html">', 'http://a.kr/') === 'http://a.kr/main/main.html',
    'meta refresh 를 못 따라갑니다');
  재다(옮겨가는곳('<a href="/x">그냥 쪽</a>', 'http://a.kr/') === null, '멀쩡한 쪽을 옮겨 간다고 봅니다');
  재다(옮겨가는곳('<script>location.href="/";</script>', 'http://a.kr/') === null, '같은 자리로 맴돕니다');
  재다(자바스크립트쪽인가('<body><div id="root"></div></body>'), 'SPA 를 못 가립니다');
  재다(!자바스크립트쪽인가('<div id="root"></div><a href="/x">채용</a>'), '링크가 있는 쪽을 SPA 라고 봅니다');
  /* ⑯~⑲ 씨엠병원 꼴 — **메뉴**가 같은 꼴로 여러 개 있는 안내 쪽 */
  const 씨엠 = '<table>' + [1, 2, 3, 4, 5].map(() => '<tr><td>채용절차 안내</td></tr>').join('') + '</table>'
    + ['01_1', '04_1', '05_11', '04_5', '02_3'].map((s) => '<a href="/cmhospital/sub_' + s + '.php">메뉴</a>').join('')
    + '<span>2020-11-17</span><span>2025.03.17</span>';
  재다(!공고목록인가(씨엠).맞나, '메뉴 여러 개를 공고 목록으로 봅니다');
  재다(공고목록인가(씨엠).글수 === 0, '메뉴를 글 링크로 셉니다');
  재다(글번호표식.test('/bbs/board.php?bo_table=recruit&wr_id=12'), 'wr_id 를 글번호로 안 봅니다');
  재다(!글번호표식.test('/cmhospital/sub_05_11.php'), '메뉴 주소를 글번호로 봅니다');
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

  /* 빈 껍데기면 **쪽에 적힌 곳으로** 한두 번 따라갑니다 */
  for (let 걸음 = 0; 걸음 < 2; 걸음++) {
    const 다음 = 옮겨가는곳(r.글, r.끝주소);
    if (!다음) break;
    console.log('  → 쪽이 옮겨 갑니다 — ' + 다음);
    try { r = await 받기(다음); } catch (e) { console.log('     ✗ 못 받음 ' + String(e.message).slice(0, 40)); break; }
    console.log('     HTTP ' + r.code + ' · ' + r.바이트 + '바이트');
    await 자고(600);
  }

  if (자바스크립트쪽인가(r.글)) {
    console.log('  → **자바스크립트로 그리는 쪽입니다 (SPA)** — HTML 에 링크가 없어 긁을 수 없습니다');
    결과.push({ 이름, 판정: '자바스크립트 쪽(SPA) — 긁을 수 없음' }); continue;
  }

  const 후보 = 채용링크들(r.글, r.끝주소);
  const 쓸것 = 후보.filter((x) => !x.뺌).slice(0, 5);
  console.log('  채용말 링크 ' + 후보.length + '개 (뺀 것 ' + 후보.filter((x) => x.뺌).length + '개)');
  for (const x of 후보.filter((x) => x.뺌).slice(0, 3)) {
    console.log('     ✗ 뺌 「' + x.t.slice(0, 26) + '」 — ' + x.뺌);
  }
  if (!쓸것.length) {
    /* ★ 「없다」고만 적지 않습니다 — **무엇이 있었나**를 함께 찍습니다 (지침 2절).
     *   메뉴 글자를 보면 채용이 다른 말로 적혀 있는지, 아예 없는지가 가려집니다 */
    const 메뉴 = [...new Set([...r.글.matchAll(/<a[^>]+href=["'][^"']+["'][^>]*>([\s\S]{0,40}?)<\/a>/gi)]
      .map((m) => m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length >= 2 && /[가-힣]/.test(t)))].slice(0, 24);
    console.log('  → **채용 링크가 없습니다** (링크 글 ' + 메뉴.length + '가지)');
    console.log('     메뉴 — ' + (메뉴.join(' · ').slice(0, 300) || '한글 링크 글이 없습니다'));
    결과.push({ 이름, 판정: '쪽에 채용 링크 없음', 메뉴: 메뉴.slice(0, 8).join(' · ') }); continue;
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
