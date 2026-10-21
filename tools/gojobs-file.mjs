/* 나라일터(gojobs.go.kr) 첨부를 **두 걸음**으로 받습니다 (2026-10-22 세중님 3번 ②)
 *
 *   import { 첨부받기, 부름찾기, 기본간격 } from './gojobs-file.mjs';
 *   const r = await 첨부받기('https://www.gojobs.go.kr/apmView.do?empmnsn=304423');
 *   r.buf · r.이름 · r.목록[] · r.왜
 *
 *   node tools/gojobs-file.mjs --자기점검        그물을 안 두드리고 가름만 봅니다
 *   node tools/gojobs-file.mjs <공고주소>        한 건 받아 앞글자를 찍습니다
 *
 * ── 왜 두 걸음인가 (원문으로 확인했습니다 · 지침 3·5절) ────────
 * 공고 쪽의 첨부 자리에 **진짜 주소가 없습니다** —
 *     javascript:gfn_fileDown('공고문_….pdf','1460603110634732','employ/서울특별시 은평병원')
 * 그 함수는 쪽이 싣는 `/jsp/cmmn/js/common.js` 에 있고, 이렇게 생겼습니다 —
 *     function gfn_fileDown(filenm, uuid, saveGbn) {
 *       document.fileFrm.filenm.value = filenm;
 *       document.fileFrm.uuid.value   = uuid;
 *       document.fileFrm.saveGbn.value= saveGbn;
 *       document.fileFrm.action = "/downFile.do";      ← 진짜 주소
 *     }
 * 그래서 ① 쪽을 열어 쿠키(JSESSIONID)와 그 셋을 얻고
 *        ② `POST /downFile.do` 에 form 꼴로 보냅니다 (Referer 를 붙입니다).
 * 2026-10-22 에 304423 으로 확인 — 663,103바이트 `%PDF-1.4` · 90,112바이트 hwp.
 *
 * ★ 첨부 주소를 **지어내지 않습니다.** 쪽을 열어 그 쪽이 말하는 값만 씁니다.
 */
import { 점수 } from './hosp/hs_files.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
export const 기본간격 = 1500;        /* 같은 집을 두드리는 사이 — 쪽 열기 + 받기 둘 다 */
export const 받는주소 = 'https://www.gojobs.go.kr/downFile.do';

/** 쪽글에서 `gfn_fileDown('이름','uuid','갈래')` 부름을 모읍니다 */
export function 부름찾기(글) {
  const 본것 = new Set();
  const 목록 = [];
  for (const m of String(글 || '').matchAll(/gfn_fileDown\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/g)) {
    const 이름 = m[1].trim();
    const uuid = m[2].trim();
    if (!uuid || 본것.has(uuid)) continue;
    본것.add(uuid);
    목록.push({ 이름, uuid, saveGbn: m[3], 점수: 점수(이름) });
  }
  /* 공고문 > 그밖 > 지원서·서식 — hs_files 의 점수 한 자리를 씁니다 (지침 6절) */
  return 목록.sort((a, b) => b.점수 - a.점수);
}

/** 공고 쪽 주소 하나로 **공고문을 받아** 옵니다 */
export async function 첨부받기(공고주소, opt = {}) {
  let r1, 글;
  try {
    r1 = await fetch(공고주소, { headers: { 'User-Agent': UA } });
    글 = await r1.text();
  } catch (e) { return { 왜: '공고 쪽을 못 열었습니다 · ' + String((e && e.message) || e).slice(0, 60) }; }
  if (!r1.ok) return { 왜: '공고 쪽 HTTP ' + r1.status };

  const 쿠키 = (r1.headers.getSetCookie ? r1.headers.getSetCookie() : [])
    .map((c) => String(c).split(';')[0]).join('; ');
  const 목록 = 부름찾기(글);
  if (!목록.length) return { 왜: '쪽에 gfn_fileDown 이 없습니다 (첨부가 없는 공고)', 목록: [] };

  const 고른것 = opt.고를것 ? 목록.find((f) => f.uuid === opt.고를것) || 목록[0] : 목록[0];
  const 몸 = new URLSearchParams({ filenm: 고른것.이름, uuid: 고른것.uuid, saveGbn: 고른것.saveGbn });
  let r2, buf;
  try {
    r2 = await fetch(받는주소, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 공고주소,
        ...(쿠키 ? { Cookie: 쿠키 } : {}),
      },
      body: 몸.toString(),
    });
    buf = Buffer.from(await r2.arrayBuffer());
  } catch (e) { return { 왜: '받다 탈 · ' + String((e && e.message) || e).slice(0, 60), 목록 }; }
  if (!r2.ok) return { 왜: 'downFile.do HTTP ' + r2.status, 목록 };
  if (!buf.length) return { 왜: '0바이트가 왔습니다', 목록 };
  /* HTML 이 오면 받은 것이 아닙니다 (지침 5절 — 받은 파일이 정말 그 형식인가) */
  const 앞 = buf.slice(0, 2).toString('latin1');
  if (앞 === '<!' || 앞 === '<h' || 앞 === '<H') {
    return { 왜: 'HTML 이 왔습니다 (' + buf.length + '바이트)', 목록 };
  }
  return { buf, 이름: 고른것.이름, 고른것, 목록 };
}

/* ── 자기 점검 (그물을 안 두드립니다) ────────────────────────── */
if (process.argv[1] && process.argv[1].endsWith('gojobs-file.mjs')) {
  const 주소 = process.argv.slice(2).find((x) => x.startsWith('http'));
  if (process.argv.includes('--자기점검') || !주소) {
    let 틀림 = 0;
    const 봐 = (이름, 참) => { if (!참) { 틀림++; console.error('✗ ' + 이름); } };
    const 견본 = [
      '<a href="javascript:gfn_fileDown(\'제출서류(서식).hwp\',\'3060603110902102\',\'employ/서울특별시 은평병원\')">서식</a>',
      '<a href="javascript:gfn_fileDown(\'공고문_간호업무요원, 병동보호사.pdf\',\'1460603110634732\',\'employ/서울특별시 은평병원\')">공고문</a>',
    ].join('\n');
    const 목록 = 부름찾기(견본);
    봐('둘 다 찾는다', 목록.length === 2);
    봐('공고문이 먼저다', 목록[0].이름.startsWith('공고문'));
    봐('uuid 를 집는다', 목록[0].uuid === '1460603110634732');
    봐('갈래를 집는다', 목록[0].saveGbn.startsWith('employ/'));
    봐('같은 uuid 는 한 번만', 부름찾기(견본 + '\n' + 견본).length === 2);
    봐('없으면 빈 목록', 부름찾기('<a href="#">첨부 없음</a>').length === 0);
    console.log(틀림 ? '\n★ 자기 점검 ' + 틀림 + '가지 실패' : '○ 자기 점검 통과 — 부름 가름 6가지');
    process.exit(틀림 ? 1 : 0);
  }
  const r = await 첨부받기(주소);
  if (r.왜) console.log('✗ ' + r.왜);
  else {
    console.log('○ ' + r.이름 + ' · ' + r.buf.length + '바이트 · 앞글자 '
      + r.buf.slice(0, 8).toString('latin1').replace(/[^\x20-\x7e]/g, '.'));
    console.log('  쪽에 있던 것 — ' + r.목록.map((f) => f.이름).join(' · ').slice(0, 160));
  }
}
