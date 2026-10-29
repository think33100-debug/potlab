/* 공지 섞임 — **왜 목록을 못 읽나** 진단만 (2026-10-29 세중님 15:50)
 *
 *   node tools/긁기/목록진단_1029.mjs --못읽음      다섯 곳: 앞 1200자 · a 태그 수 · script src
 *   node tools/긁기/목록진단_1029.mjs --복주        복주회복 셋째 줄 원문 창 + 날짜 글자 자리
 *   node tools/긁기/목록진단_1029.mjs --자기점검
 *
 * ★ **아무것도 안 바꾸고 안 담습니다.** 읽기만 합니다.
 * ★ **우회하지 않습니다** — robots·403 이면 그대로 적고 넘어갑니다 (세중님 규칙).
 * ★ 판정은 **둘 중 하나만** 합니다 — 「JS 로 그립니다」 / 「꼴이 다릅니다」.
 *   고치는 길은 적지 않습니다 (세중님이 정하실 자리).
 * ★ `줄안의날` 은 **고치지 않습니다** (세중님 3번) — 왜 못 집었나만 찍습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 받기 } from './공통.mjs';
import { 표준읽기, 그누읽기, 꼴정하기, 줄안의날 } from './읽기들.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

/** 쪽을 그리는 자바 묶음인가 — 이름만 봅니다 (판정을 넓히지 않습니다) */
export const 그리는묶음 = /(next|nuxt|vue|react|angular|svelte|_app|chunk|bundle|runtime|hydrat)/i;

/** a 태그 수 · script src 목록 · 글 번호 든 a 수 */
export function 쪽살피기(html) {
  const t = String(html || '');
  const a수 = (t.match(/<a\b/gi) || []).length;
  const src = [...t.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  const 번호든a = (t.match(/<a[^>]+href=["'][^"']*(?:seq|idx|wr_id|nttSn|no|num|bno|articleNo|id)=\d/gi) || []).length;
  /* 판정이 **원문 앞머리**를 봐야 합니다 (frameset·그림) — 함께 들고 다닙니다 */
  return { a수, src, 번호든a, 길이: t.length, 앞글자: t.slice(0, 400) };
}
/** 판정 — **둘 중 하나만** (세중님: JS인지 꼴이 다른지만). 「꼴이 다릅니다」는 **왜**를 답니다.
 *  ★ 2026-10-29 — 처음에는 「a 태그 0개면 JS」로만 봤는데 **틀렸습니다.** 원광은
 *    `<frameset>` 이고 조은금강은 **HTML 이 아니라 PNG 그림**이 옵니다. 둘 다 JS 가
 *    아닙니다 — 원문 앞 1200자를 보고 고쳤습니다 (지침 10-5 · 재는 자를 먼저 의심) */
export function 판정(살핀것, html) {
  const t = String(html || 살핀것.앞글자 || '');
  if (t && !/<html|<!doctype/i.test(t.slice(0, 400))) {
    const 그림 = /^\x89PNG|^\xff\xd8\xff|^GIF8|^%PDF/.test(t) ? (t.startsWith('%PDF') ? 'PDF' : '그림')
      : '알 수 없는 꼴';
    return '꼴이 다릅니다 — HTML 이 아닙니다 (' + 그림 + ' 가 옵니다 · ' + 살핀것.길이 + '바이트)';
  }
  if (/<frameset|<frame\s/i.test(t)) {
    const 속 = (t.match(/<frame[^>]+src=["']([^"']+)["']/i) || [])[1] || '';
    return '꼴이 다릅니다 — 프레임(frameset) 입니다' + (속 ? ' · 속 쪽 ' + 속 : '');
  }
  if (살핀것.a수 <= 3 && 살핀것.src.some((s) => 그리는묶음.test(s))) {
    return 'JS 로 그립니다 (a 태그 ' + 살핀것.a수 + '개 · 그리는 묶음 있음)';
  }
  if (살핀것.a수 <= 3) return 'JS 로 그립니다로 보입니다 (a 태그 ' + 살핀것.a수 + '개 — 묶음 이름은 못 봤습니다)';
  return '꼴이 다릅니다 (a 태그 ' + 살핀것.a수 + '개 있는데 글 번호 든 a 는 ' + 살핀것.번호든a + '개)';
}

/* ★ **들여와도 돌지 않게** 합니다 (지침 6-3) — 다른 도구가 `쪽살피기`·`판정` 만
   빌려 쓸 수 있어야 합니다. 이 울타리가 없으면 들여오는 쪽이 아래 `process.exit(2)`
   에서 통째로 끝납니다 (오늘 `손확인2` 가 그 자를 씁니다) */
const 나를부름 = !!process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (!나를부름) { /* 들여오기 — 아무것도 하지 않습니다 */ } else {

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const js = 쪽살피기('<html><body><div id="app"></div><script src="/_next/static/chunk-1.js"></script></body></html>');
  보('a 태그를 센다', 쪽살피기('<a href="/1">ㄱ</a><a href="/2">ㄴ</a>').a수 === 2);
  보('script src 를 모은다', js.src.length === 1 && /chunk-1/.test(js.src[0]));
  보('번호 든 a 를 센다',
    쪽살피기('<a href="/v.do?seq=12">ㄱ</a><a href="/menu">ㄴ</a>').번호든a === 1);
  보('a 가 없고 묶음이 있으면 JS', /^JS 로 그립니다 \(/.test(판정(js)));
  보('a 는 많은데 번호가 없으면 꼴이 다름',
    /꼴이 다릅니다/.test(판정({ a수: 40, src: [], 번호든a: 0, 길이: 1000, 앞글자: '<html><a>x</a>' })));
  const 프레임 = '<!DOCTYPE HTML><html lang="ko"><head><title>원광종합병원</title></head>'
    + '<frameset frameborder="NO"><frame src="main/main.asp" name="main"></frameset></html>';
  보('프레임은 JS 가 아니라 꼴이 다름',
    /프레임\(frameset\)/.test(판정(쪽살피기(프레임), 프레임)));
  보('프레임 속 쪽 주소를 적는다', /main\/main\.asp/.test(판정(쪽살피기(프레임), 프레임)));
  보('HTML 이 아니면 그렇게 적는다',
    /HTML 이 아닙니다/.test(판정(쪽살피기('\x89PNG\r\n\x1a\n'), '\x89PNG\r\n\x1a\n')));
  const 잘린창 = '<li><a href="/v?idx=1">글 제목</a></li><span class="date">2026-07-16</span>';
  보('닫는 태그 뒤 날짜는 줄안의날이 못 집는다',
    줄안의날(잘린창, 잘린창.indexOf('글 제목'), 5) === null);
  보('줄 안에 있으면 집는다',
    줄안의날('<li><a href="/v?idx=1">글 제목</a> 2026-07-16</li>', 20, 5) === '2026-07-16');
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const { 곳들 } = JSON.parse(fs.readFileSync(path.join(여기, '공지섞임_곳들.json'), 'utf8'));

if (argv.includes('--못읽음')) {
  /* 2026-10-29 마른 실행에서 **목록 줄 0개**였던 곳들 (원광은 첫 화면이라 울타리에서 걸림) */
  const 볼것 = ['온누리', '조은금강', '현대유비스', '화성유일', '원광'];
  for (const 이름조각 of 볼것) {
    const 곳 = 곳들.find((c) => c.이름.includes(이름조각));
    if (!곳) { console.log('\n══ ' + 이름조각 + ' — 곳 목록에 없습니다'); continue; }
    console.log('\n══ ' + 곳.이름 + ' ══\n  주소 ' + 곳.주소);
    const r = await 받기(곳.주소);
    if (!r.됨) { console.log('  ✗ 못 열었습니다 — ' + r.왜 + ' (우회하지 않습니다)'); continue; }
    const 살핀것 = 쪽살피기(r.html);
    const 읽기 = 꼴정하기(곳.주소) === '그누보드' ? 그누읽기 : 표준읽기;
    console.log('  HTTP ' + r.코드 + ' · ' + 살핀것.길이 + '바이트 · a 태그 ' + 살핀것.a수
      + '개 · 글 번호 든 a ' + 살핀것.번호든a + '개 · 목록 읽기 결과 '
      + 읽기(r.html, 곳.주소).length + '줄');
    console.log('  script src — ' + (살핀것.src.length ? '' : '(없음)'));
    for (const s of 살핀것.src.slice(0, 12)) console.log('      · ' + s);
    console.log('  → **' + 판정(살핀것, r.html) + '**');
    console.log('  ── 원문 앞 1200자 ──');
    console.log(String(r.html || '').slice(0, 1200).replace(/\r?\n/g, ' ⏎ '));
  }
}

if (argv.includes('--복주')) {
  const 곳 = 곳들.find((c) => c.이름.includes('복주'));
  console.log('══ ' + 곳.이름 + ' — 날짜를 왜 못 집었나 (진단만) ══\n  주소 ' + 곳.주소);
  const r = await 받기(곳.주소);
  if (!r.됨) { console.log('  ✗ 못 열었습니다 — ' + r.왜); process.exit(0); }
  const t = r.html;
  const 줄들 = 표준읽기(t, 곳.주소);
  console.log('  HTTP ' + r.코드 + ' · ' + t.length + '바이트 · 목록 ' + 줄들.length + '줄');
  /* 세중님이 말씀하신 「셋째 줄」 = 제목에 날짜 글자가 든 그 줄입니다.
     글자로 찾습니다 — 번호로 세면 목록이 바뀔 때 딴 줄을 찍습니다 */
  const 날짜든줄 = 줄들.filter((x) => /20\d\d[-.\/]\d{1,2}[-.\/]\d{1,2}/.test(x.제목));
  console.log('\n  제목에 날짜 글자가 든 줄 — ' + 날짜든줄.length + '개');
  for (const x of 날짜든줄) console.log('      [' + (x.올린날 || '올린날 없음') + ']  ' + x.제목.slice(0, 70));
  const 볼줄 = 날짜든줄[0] || 줄들[2] || 줄들[0];
  if (!볼줄) { console.log('  볼 줄이 없습니다'); process.exit(0); }
  console.log('\n  ── 그 줄의 원문 창 ──');
  /* ★ 읽기가 **그 줄을 찾은 자리**를 그대로 씁니다 (`읽기들.mjs` 가 `자리` 로 냅니다).
     전에는 `t.indexOf(제목)` 으로 찾았는데 **못 찾았습니다** — 제목은 태그를 걷고
     빈칸을 눕힌 글자라 원문에 그대로 없습니다. 그래서 창이 쪽 머리(head)로 찍혔습니다 */
  const 제목자리 = Number.isInteger(볼줄.자리) ? 볼줄.자리 : -1;
  if (제목자리 < 0) { console.log('  읽기가 자리를 안 냈습니다'); process.exit(0); }
  const 앞tr = t.lastIndexOf('<tr', 제목자리);
  const 앞li = t.lastIndexOf('<li', 제목자리);
  const 뒤끝 = t.slice(제목자리).search(/<\/tr>|<\/li>/i);
  console.log('  제목 글자 자리 ' + 제목자리 + ' · lastIndexOf(<tr) ' + 앞tr
    + ' · lastIndexOf(<li) ' + 앞li + ' · 뒤 </tr>|</li> 까지 ' + 뒤끝);
  const 창앞 = Math.max(0, 제목자리 - 600);
  const 창 = t.slice(창앞, 제목자리 + 600);
  console.log('  창(제목 앞 600 ~ 뒤 600자 · ⏎ 는 줄바꿈) —');
  console.log(창.replace(/\r?\n/g, ' ⏎ '));
  console.log('\n  ── 날짜 글자 자리 ──');
  for (const m of t.matchAll(/20\d\d[-.\/]\d{1,2}[-.\/]\d{1,2}/g)) {
    const 멀기 = m.index - 제목자리;
    if (Math.abs(멀기) > 2000) continue;
    console.log('      ' + m[0] + ' — 자리 ' + m.index + ' (제목에서 '
      + (멀기 >= 0 ? '+' : '') + 멀기 + '자) · 앞 60자 「'
      + t.slice(Math.max(0, m.index - 60), m.index).replace(/\r?\n/g, ' ').slice(-60) + '」');
  }
  const 잰것 = 줄안의날(t, 제목자리, 볼줄.창길이 || 볼줄.제목.length);
  console.log('\n  줄안의날 이 그 자리에서 낸 값 — ' + (잰것 || '(없음)'));
  console.log('  ★ 고치지 않습니다 (세중님 3번) — 상세를 열어 날짜를 받는 길로 갑니다');
}

if (!argv.includes('--못읽음') && !argv.includes('--복주')) {
  console.error('쓰는 법 — --못읽음 | --복주 | --자기점검');
  process.exit(2);
}

}   /* ← 나를부름 울타리 끝 */
