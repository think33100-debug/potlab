/* ═══════════════════════════════════════════════════════════════
 *  옛 앱 건강 확인 — **읽기만 합니다**
 *  2026-10-03. 모두의 창업 심사 기간에 하루 한 번 돌립니다.
 * ═══════════════════════════════════════════════════════════════
 *
 *   node tools/옛앱확인.mjs
 *
 *  왜 있나 — 2026-10-03 에 주인 계정의 스크립트 승인이 풀려
 *  옛 앱 웹 주소와 옛 수집기가 통째로 멈췄습니다 (CLAUDE.md 8-4).
 *  겉으로는 「액세스 거부됨 · Drive 액세스 권한 필요」 화면만 보여서
 *  배포 설정 문제로 두 번 헛짚었습니다.
 *
 *  무엇을 보나
 *    ① exportRows     시트를 읽을 수 있나 (다리가 쓰는 창구)
 *    ② healthCheck    시트 상태
 *    ③ jobRegionSummary  공고 창구가 도나
 *       → 로그인 안 했으니 「nologin」이 **맞는 답**입니다.
 *         이게 나오면 함수가 돈 것입니다
 *
 *  「인증 필요」가 보이면 — 편집기에서 healthCheck 를 한 번 실행해
 *  승인(고급 → 허용). 새 배포는 만들지 마십시오.
 *
 *  ★ 아무것도 바꾸지 않습니다. 시트·트리거·글귀에 손대지 않습니다.
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
const g = (f) => {
  const o = {};
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) o[m[1]] = m[2].trim();
  }
  return o;
};
const c = g('.env.local');
const 부르기 = async (action, args) => {
  const cb = '__potlab_cb_1_' + Date.now();
  const url = c.APPS_SCRIPT_URL + '?callback=' + cb + '&action=' + action
    + '&args=' + encodeURIComponent(JSON.stringify(args || [])) + '&t=' + Date.now();
  const r = await fetch(url, { redirect: 'follow' });
  const t = await r.text();
  const m = t.match(new RegExp('^' + cb + '\\(([\\s\\S]*)\\);\\s*$'));
  return { 코드: r.status, JSONP: !!m, 글: t, j: m ? JSON.parse(m[1]) : null };
};

console.log('옛 앱 건강 확인 · ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
console.log('');

/* ★ 옛 앱 앞문이 **둘**입니다 (2026-10-03 에 호되게 배웠습니다)
 *
 *    앱스 스크립트  script.google.com/macros/s/…/exec   ← 아래 ①②③
 *    GitHub Pages   potjob.co.kr                        ← 아래 ④
 *                   저장소 뿌리 index.html 을 그대로 내줍니다
 *
 *  10/1 에 index.html 에 박아 둔 「이사 안내 띠」가 심사 기간에 떠 있었는데,
 *  제가 앱스 스크립트 쪽만 두드려서 「공지 없음」이라고 보고했습니다.
 *  **두 앞문을 다 봐야 합니다.** */
const 페이지확인 = async () => {
  const r = await fetch('https://potjob.co.kr/?cb=' + Date.now(), { redirect: 'follow' });
  const h = await r.text();
  /* 심사 기간에 떠 있으면 안 되는 것들 */
  const 띠 = [
    ['이사 안내 띠 (movedNotice)', /movedNotice/],
    ['「새 주소로 옮겼습니다」', /새 주소로 옮겼/],
    ['「다시 가입해 주세요」', /다시 가입해 주세요/],
  ].filter(([, re]) => re.test(h));
  console.log('  ④ GitHub Pages (potjob.co.kr)    HTTP ' + r.status
    + ' · ' + h.length + '글자');
  if (띠.length) {
    console.log('      ★★ 심사 중에 떠 있으면 안 되는 것이 보입니다 —');
    for (const [이름] of 띠) console.log('         · ' + 이름);
  } else {
    console.log('      올라와 있으면 안 되는 띠·공지 없습니다');
  }
  /* 화면이 제대로 그려지는지 — 맨 위 글 */
  const i = h.indexOf('<body>');
  const t = h.slice(i, i + 700).replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log('      맨 위 글 — ' + t.slice(0, 60));
};

for (const [이름, action, args] of [
  ['① 시트 읽기 (exportRows)', 'exportRows', [c.EXPORT_KEY, '채용공고', 0, 1]],
  ['② 시트 상태 (healthCheck)', 'healthCheck', [c.EXPORT_KEY]],
  ['③ 지역별 공고 (jobRegionSummary)', 'jobRegionSummary', []],
]) {
  try {
    const r = await 부르기(action, args);
    const 요약 = r.j
      ? (r.j.ok === false ? '거절 — ' + String(r.j.error || r.j.message).slice(0, 60)
        : JSON.stringify(r.j.data ?? r.j).slice(0, 110))
      : r.글.slice(0, 80).replace(/\s+/g, ' ');
    console.log('  ' + 이름.padEnd(32) + 'HTTP ' + r.코드
      + ' · JSONP ' + (r.JSONP ? '네' : '아니오') + '\n      ' + 요약);
  } catch (e) {
    console.log('  ' + 이름.padEnd(32) + '★ 못 불렀습니다 — ' + String(e.message).slice(0, 80));
  }
}

await 페이지확인();
