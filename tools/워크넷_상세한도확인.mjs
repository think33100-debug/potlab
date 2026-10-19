/* 워크넷 **상세 API 의 하루 한도**를 근거로 확인합니다 (2026-10-19 세중님 1번)
 *
 *   node tools/워크넷_상세한도확인.mjs
 *
 * ★ 짐작하지 않습니다 — **응답 헤더를 그대로 찍습니다**.
 *   `공공데이터부르기.mjs` 가 보는 것은 `x-ratelimit-limit`·`x-ratelimit-remaining`
 *   입니다. 워크넷 상세 API 는 `www.work24.go.kr` 이고 `apis.data.go.kr` 과
 *   **다른 체계**라 그 헤더가 없을 수 있습니다 — 있으면 그것이 근거이고,
 *   없으면 「명세를 받아야 한다」가 답입니다 (지침 3·4절).
 */
import fs from 'node:fs';

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const WK = cfg.WORK_KEY;
if (!WK) { console.error('✗ WORK_KEY 가 없습니다'); process.exit(1); }

/* 목록 API 와 상세 API 둘 다 봅니다 — 한도가 같은지 다른지 */
const 곳 = [
  ['상세 (callTp=D)', 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do'
    + '?authKey=' + encodeURIComponent(WK) + '&returnType=XML&callTp=D'
    + '&wantedAuthNo=K120252610120002&infoSvc=VALIDATION'],
  ['목록 (callTp=L)', 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do'
    + '?authKey=' + encodeURIComponent(WK) + '&returnType=XML&callTp=L'
    + '&startPage=1&display=1&infoSvc=VALIDATION'],
];

for (const [이름, u] of 곳) {
  console.log('\n════ ' + 이름);
  console.log('  ' + u.replace(/authKey=[^&]*/, 'authKey=‹가림›'));
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    console.log('  HTTP ' + r.status + ' · ' + t.length + '바이트');
    console.log('  ── 응답 헤더 전부 ──');
    for (const [k, v] of r.headers.entries()) {
      console.log('     ' + k + ': ' + String(v).slice(0, 110));
    }
    const 한도 = r.headers.get('x-ratelimit-limit');
    const 남음 = r.headers.get('x-ratelimit-remaining');
    console.log('  ── 한도 헤더 ──');
    if (한도 || 남음) console.log('     ★ 한도 ' + 한도 + ' · 남음 ' + 남음);
    else console.log('     **없습니다** — 이 API 는 한도를 헤더로 안 알려 줍니다.'
      + '\n       그러면 고용24 신청 화면의 「일일 트래픽」 을 봐야 합니다 (짐작 금지)');
    /* 한도를 넘었을 때의 글귀도 응답에 있을 수 있습니다 */
    const 글 = t.replace(/\s+/g, ' ');
    const 탈 = 글.match(/<message>([^<]*)<\/message>|<errMsg>([^<]*)<\/errMsg>|제한|초과|한도/);
    if (탈) console.log('  응답 안의 한도·오류 글귀 — 「' + 글.slice(Math.max(0, (탈.index || 0) - 60), (탈.index || 0) + 120) + '」');
  } catch (e) {
    console.log('  ✗ ' + String(e.message).slice(0, 70));
  }
  await new Promise((r) => setTimeout(r, 1200));
}

console.log('\n── 참고: 지금 DB 에 적힌 한도 (apis.data.go.kr 쪽) ──');
console.log('   openApiEmployInfo(워크넷 목록) 은 2026-09-30 에 한도 1,000,000 중 990,193 을 썼습니다');
console.log('   ★ 그러나 **상세 API 는 work24.go.kr** 이라 그 표에 없습니다 — 위 헤더가 근거입니다');
